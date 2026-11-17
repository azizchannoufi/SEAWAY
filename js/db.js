// ============================================================
// SEAWAY - Data layer
// One API, two backends:
//   * "demo" : localStorage (no setup, seeded with sample content)
//   * "live" : Firebase Firestore + Auth + Storage (CDN ES modules, no bundler)
// Storefront and admin both import from here.
// ============================================================
import {
    FIREBASE_CONFIG, FIREBASE_VERSION, isFirebaseConfigured, SITE,
    STORAGE_KEYS, DEFAULT_SETTINGS
} from './config.js';
import {
    SEED_CATEGORIES, SEED_PRODUCTS, SEED_PROMOS, SEED_REVIEWS, buildDemoOrders
} from './seed.js';

export const mode = isFirebaseConfigured() ? 'live' : 'demo';
export const isDemo = mode === 'demo';

// ── tiny helpers ────────────────────────────────────────────
const clone = (o) => JSON.parse(JSON.stringify(o));
const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const norm = (s) => String(s || '').trim();
export const slugify = (s) =>
    norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || uid('item');

function deepMerge(base, extra) {
    if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra === undefined ? base : extra;
    const out = { ...base };
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
        for (const k of Object.keys(extra)) out[k] = deepMerge(base[k], extra[k]);
    }
    return out;
}

// ── session cache for public reads (cuts Firestore cost) ────
const CACHE_PREFIX = 'seaway_cache_';
const CACHE_TTL = 5 * 60 * 1000;
const mem = new Map();
async function cached(key, loader) {
    if (isDemo) return loader();
    if (mem.has(key)) return mem.get(key);
    try {
        const raw = sessionStorage.getItem(CACHE_PREFIX + key);
        if (raw) {
            const { t, v } = JSON.parse(raw);
            if (Date.now() - t < CACHE_TTL) { mem.set(key, v); return v; }
        }
    } catch { /* ignore */ }
    const v = await loader();
    mem.set(key, v);
    try { sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v })); } catch { /* quota */ }
    return v;
}
export function invalidateCache() {
    mem.clear();
    try {
        Object.keys(sessionStorage).filter(k => k.startsWith(CACHE_PREFIX)).forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
}

// ════════════════════════════════════════════════════════════
// DEMO BACKEND (localStorage)
// ════════════════════════════════════════════════════════════
function emptyLocal() {
    return {
        products: clone(SEED_PRODUCTS), categories: clone(SEED_CATEGORIES), promos: clone(SEED_PROMOS),
        reviews: clone(SEED_REVIEWS), orders: buildDemoOrders(), subscribers: [], messages: [],
        customers: [], settings: {}
    };
}
function lread() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.localDb);
        if (raw) return JSON.parse(raw);
    } catch { /* corrupted -> reseed */ }
    const fresh = emptyLocal();
    lwrite(fresh);
    return fresh;
}
function lwrite(data) {
    try { localStorage.setItem(STORAGE_KEYS.localDb, JSON.stringify(data)); }
    catch (e) { throw new Error('Browser storage is full. Remove some images or reset the demo data in Settings.'); }
}
export function resetDemoData() {
    localStorage.removeItem(STORAGE_KEYS.localDb);
    lread();
}

// ════════════════════════════════════════════════════════════
// LIVE BACKEND (Firebase, loaded lazily from the CDN)
// ════════════════════════════════════════════════════════════
const FB_BASE = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
let _core, _auth, _storage;
async function core() {
    if (_core) return _core;
    _core = (async () => {
        const [appM, fsM] = await Promise.all([
            import(FB_BASE + 'firebase-app.js'), import(FB_BASE + 'firebase-firestore.js')
        ]);
        const app = appM.getApps().length ? appM.getApp() : appM.initializeApp(FIREBASE_CONFIG);
        return { app, db: fsM.getFirestore(app), fs: fsM };
    })();
    return _core;
}
async function authMod() {
    if (_auth) return _auth;
    _auth = (async () => {
        const { app } = await core();
        const m = await import(FB_BASE + 'firebase-auth.js');
        return { auth: m.getAuth(app), m };
    })();
    return _auth;
}
async function storageMod() {
    if (_storage) return _storage;
    _storage = (async () => {
        const { app } = await core();
        const m = await import(FB_BASE + 'firebase-storage.js');
        return { storage: m.getStorage(app), m };
    })();
    return _storage;
}

async function fsList(col, { orderField, dir = 'desc', where: w } = {}) {
    const { db, fs } = await core();
    const cons = [];
    const wheres = w ? (Array.isArray(w[0]) ? w : [w]) : [];
    wheres.forEach(x => cons.push(fs.where(...x)));
    if (orderField) cons.push(fs.orderBy(orderField, dir));
    const snap = await fs.getDocs(fs.query(fs.collection(db, col), ...cons));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fsGet(col, id) {
    const { db, fs } = await core();
    const s = await fs.getDoc(fs.doc(db, col, id));
    return s.exists() ? { id: s.id, ...s.data() } : null;
}
async function fsSave(col, id, data) {
    const { db, fs } = await core();
    const clean = JSON.parse(JSON.stringify(data));
    delete clean.id;
    if (id) { await fs.setDoc(fs.doc(db, col, id), clean, { merge: false }); return id; }
    const ref = await fs.addDoc(fs.collection(db, col), clean);
    return ref.id;
}
async function fsPatch(col, id, patch) {
    const { db, fs } = await core();
    await fs.updateDoc(fs.doc(db, col, id), JSON.parse(JSON.stringify(patch)));
}
async function fsDelete(col, id) {
    const { db, fs } = await core();
    await fs.deleteDoc(fs.doc(db, col, id));
}

// ════════════════════════════════════════════════════════════
// PUBLIC API — CATALOG
// ════════════════════════════════════════════════════════════
const byCreated = (a, b) => (b.createdAt || 0) - (a.createdAt || 0);

export async function getProducts({ includeInactive = false } = {}) {
    const all = await cached('products', async () => {
        if (isDemo) return lread().products;
        return fsList('products');
    });
    const list = includeInactive ? all : all.filter(p => p.active !== false);
    return clone(list).sort(byCreated);
}
export async function getProduct(idOrSlug) {
    const all = await getProducts({ includeInactive: true });
    return all.find(p => p.id === idOrSlug || p.slug === idOrSlug) || null;
}
export async function saveProduct(p) {
    const data = { ...p };
    data.slug = slugify(data.slug || data.name?.en || data.name?.fr || data.id);
    data.createdAt = data.createdAt || Date.now();
    data.updatedAt = Date.now();
    let id = data.id || data.slug;
    if (isDemo) {
        const db = lread();
        const i = db.products.findIndex(x => x.id === id);
        data.id = id;
        if (i >= 0) db.products[i] = data; else db.products.push(data);
        lwrite(db);
    } else {
        if (!p.id) id = data.slug;
        await fsSave('products', id, data);
    }
    invalidateCache();
    return id;
}
export async function deleteProduct(id) {
    if (isDemo) { const db = lread(); db.products = db.products.filter(p => p.id !== id); lwrite(db); }
    else await fsDelete('products', id);
    invalidateCache();
}

export async function getCategories() {
    const all = await cached('categories', async () => (isDemo ? lread().categories : fsList('categories')));
    return clone(all).sort((a, b) => (a.order || 99) - (b.order || 99));
}
export async function saveCategory(c) {
    const data = { ...c };
    data.slug = slugify(data.slug || data.name?.en || data.id);
    const id = data.id || data.slug;
    data.id = id;
    if (isDemo) {
        const db = lread();
        const i = db.categories.findIndex(x => x.id === id);
        if (i >= 0) db.categories[i] = data; else db.categories.push(data);
        lwrite(db);
    } else await fsSave('categories', id, data);
    invalidateCache();
    return id;
}
export async function deleteCategory(id) {
    if (isDemo) { const db = lread(); db.categories = db.categories.filter(c => c.id !== id); lwrite(db); }
    else await fsDelete('categories', id);
    invalidateCache();
}

// ── settings (settings/{name}) merged over DEFAULT_SETTINGS ─
export async function getSettings(name) {
    const saved = await cached('settings_' + name, async () => {
        if (isDemo) return lread().settings[name] || {};
        return (await fsGet('settings', name)) || {};
    });
    const { id, ...rest } = saved || {};
    return deepMerge(clone(DEFAULT_SETTINGS[name] || {}), rest);
}
export async function getAllSettings() {
    const names = Object.keys(DEFAULT_SETTINGS);
    const vals = await Promise.all(names.map(n => getSettings(n)));
    return Object.fromEntries(names.map((n, i) => [n, vals[i]]));
}
export async function saveSettings(name, data) {
    if (isDemo) { const db = lread(); db.settings[name] = clone(data); lwrite(db); }
    else await fsSave('settings', name, data);
    invalidateCache();
}

// ── promos ──────────────────────────────────────────────────
export async function getPromo(code) {
    const c = norm(code).toUpperCase();
    if (!c) return null;
    if (isDemo) return clone(lread().promos.find(p => p.code === c) || null);
    return fsGet('promos', c);
}
export async function listPromos() {
    if (isDemo) return clone(lread().promos);
    return fsList('promos');
}
export async function savePromo(p) {
    const code = norm(p.code).toUpperCase();
    if (!code) throw new Error('Code required');
    const data = { ...p, code, id: code };
    if (isDemo) {
        const db = lread();
        const i = db.promos.findIndex(x => x.code === code);
        if (i >= 0) db.promos[i] = data; else db.promos.push(data);
        lwrite(db);
    } else await fsSave('promos', code, data);
}
export async function deletePromo(code) {
    if (isDemo) { const db = lread(); db.promos = db.promos.filter(p => p.code !== code); lwrite(db); }
    else await fsDelete('promos', code);
}

// ── orders ──────────────────────────────────────────────────
function orderNumber() {
    return 'SW-' + Date.now().toString(36).toUpperCase().slice(-5) + Math.random().toString(36).toUpperCase().slice(2, 4);
}

/** Decrease stock in the demo DB (live mode does it server-side in the Cloud Function). */
function demoDecrementStock(db, items) {
    for (const it of items) {
        const p = db.products.find(x => x.id === it.productId);
        if (!p) continue;
        const key = `${it.color}|${it.size}`;
        if (p.stock && typeof p.stock[key] === 'number') p.stock[key] = Math.max(0, p.stock[key] - it.qty);
    }
}

export async function createOrder(order) {
    const o = { ...order, status: 'pending', createdAt: Date.now() };
    o.number = orderNumber();
    if (isDemo) {
        const db = lread();
        o.id = uid('ord');
        db.orders.push(o);
        demoDecrementStock(db, o.items);
        if (o.promoCode) {
            const pr = db.promos.find(p => p.code === o.promoCode);
            if (pr) pr.uses = (pr.uses || 0) + 1;
        }
        const email = norm(o.customer?.email).toLowerCase();
        if (email && !db.customers.find(c => c.email === email)) {
            db.customers.push({ id: uid('cus'), email, name: o.customer.name, phone: o.customer.phone, createdAt: Date.now(), guest: !o.uid });
        }
        lwrite(db);
        return { id: o.id, number: o.number };
    }
    const { auth } = await authMod().catch(() => ({ auth: null }));
    if (auth?.currentUser) o.uid = auth.currentUser.uid;
    const id = await fsSave('orders', null, o);
    return { id, number: o.number };
}
export async function listOrders() {
    if (isDemo) return clone(lread().orders).sort(byCreated);
    return fsList('orders', { orderField: 'createdAt' });
}
export async function updateOrder(id, patch) {
    if (isDemo) {
        const db = lread();
        const o = db.orders.find(x => x.id === id);
        if (o) {
            // restock when cancelling
            if (patch.status === 'cancelled' && o.status !== 'cancelled') {
                o.items.forEach(it => {
                    const p = db.products.find(x => x.id === it.productId);
                    const key = `${it.color}|${it.size}`;
                    if (p?.stock && typeof p.stock[key] === 'number') p.stock[key] += it.qty;
                });
            }
            Object.assign(o, patch, { updatedAt: Date.now() });
        }
        lwrite(db);
        return;
    }
    await fsPatch('orders', id, { ...patch, updatedAt: Date.now() });
}
export async function myOrders() {
    const u = await currentCustomer();
    if (!u) return [];
    if (isDemo) return clone(lread().orders.filter(o => (o.customer?.email || '').toLowerCase() === u.email.toLowerCase())).sort(byCreated);
    return fsList('orders', { where: ['uid', '==', u.uid] }).then(l => l.sort(byCreated));
}

// ── reviews ─────────────────────────────────────────────────
export async function getReviews(productId) {
    let list;
    if (isDemo) list = lread().reviews.filter(r => r.productId === productId && r.status === 'approved');
    else list = await fsList('reviews', { where: [['productId', '==', productId], ['status', '==', 'approved']] });
    return clone(list).sort(byCreated);
}
export async function getApprovedRatings() {
    // average rating per product (used for stars on cards)
    let list;
    if (isDemo) list = lread().reviews.filter(r => r.status === 'approved');
    else list = await cached('ratings', () => fsList('reviews', { where: ['status', '==', 'approved'] }));
    const map = {};
    list.forEach(r => { (map[r.productId] ||= []).push(r.rating); });
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { avg: v.reduce((a, b) => a + b, 0) / v.length, count: v.length }]));
}
export async function addReview(r) {
    const data = { ...r, status: 'pending', createdAt: Date.now() };
    if (isDemo) { const db = lread(); data.id = uid('rev'); db.reviews.push(data); lwrite(db); return; }
    await fsSave('reviews', null, data);
}
export async function listAllReviews() {
    if (isDemo) return clone(lread().reviews).sort(byCreated);
    return fsList('reviews', { orderField: 'createdAt' });
}
export async function updateReview(id, patch) {
    if (isDemo) { const db = lread(); const r = db.reviews.find(x => x.id === id); if (r) Object.assign(r, patch); lwrite(db); return; }
    await fsPatch('reviews', id, patch);
    invalidateCache();
}
export async function deleteReview(id) {
    if (isDemo) { const db = lread(); db.reviews = db.reviews.filter(x => x.id !== id); lwrite(db); return; }
    await fsDelete('reviews', id);
}

// ── newsletter + contact messages ───────────────────────────
export async function subscribe(email, source = 'footer') {
    const e = norm(email).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('invalid_email');
    const data = { email: e, source, createdAt: Date.now() };
    if (isDemo) {
        const db = lread();
        if (!db.subscribers.find(s => s.email === e)) db.subscribers.push({ id: uid('sub'), ...data });
        lwrite(db);
        return;
    }
    try { await fsSave('subscribers', e.replace(/[^a-z0-9]/g, '_'), data); }
    catch (err) { if (err?.code !== 'permission-denied') throw err; /* already subscribed: rules forbid overwriting */ }
}
export async function listSubscribers() {
    if (isDemo) return clone(lread().subscribers).sort(byCreated);
    return fsList('subscribers', { orderField: 'createdAt' });
}
export async function deleteSubscriber(id) {
    if (isDemo) { const db = lread(); db.subscribers = db.subscribers.filter(x => x.id !== id); lwrite(db); return; }
    await fsDelete('subscribers', id);
}
export async function addMessage(m) {
    const data = { ...m, read: false, createdAt: Date.now() };
    if (isDemo) { const db = lread(); data.id = uid('msg'); db.messages.push(data); lwrite(db); return; }
    await fsSave('messages', null, data);
}
export async function listMessages() {
    if (isDemo) return clone(lread().messages).sort(byCreated);
    return fsList('messages', { orderField: 'createdAt' });
}
export async function updateMessage(id, patch) {
    if (isDemo) { const db = lread(); const m = db.messages.find(x => x.id === id); if (m) Object.assign(m, patch); lwrite(db); return; }
    await fsPatch('messages', id, patch);
}
export async function deleteMessage(id) {
    if (isDemo) { const db = lread(); db.messages = db.messages.filter(x => x.id !== id); lwrite(db); return; }
    await fsDelete('messages', id);
}

// ── customers (admin view: accounts + guests aggregated from orders) ─
export async function listCustomers() {
    const [orders, accounts, subs] = await Promise.all([
        listOrders(),
        isDemo ? Promise.resolve(clone(lread().customers)) : fsList('customers'),
        listSubscribers()
    ]);
    const map = new Map();
    const touch = (email, base) => {
        const k = (email || '').toLowerCase();
        if (!k) return null;
        if (!map.has(k)) map.set(k, { email: k, name: '', phone: '', orders: 0, spent: 0, lastOrder: 0, account: false, subscribed: false, createdAt: 0 });
        const c = map.get(k);
        Object.assign(c, Object.fromEntries(Object.entries(base || {}).filter(([, v]) => v)));
        return c;
    };
    accounts.forEach(a => { const c = touch(a.email, { name: a.name, phone: a.phone, createdAt: a.createdAt }); if (c) c.account = !a.guest; });
    orders.forEach(o => {
        const c = touch(o.customer?.email, { name: o.customer?.name, phone: o.customer?.phone });
        if (!c) return;
        c.orders += 1;
        if (o.status !== 'cancelled') c.spent += Number(o.total) || 0;
        c.lastOrder = Math.max(c.lastOrder, o.createdAt || 0);
        c.createdAt = c.createdAt || o.createdAt;
    });
    subs.forEach(s => { const c = touch(s.email); if (c) c.subscribed = true; });
    return [...map.values()].sort((a, b) => b.spent - a.spent);
}

// ════════════════════════════════════════════════════════════
// AUTH — customers
// ════════════════════════════════════════════════════════════
const listeners = new Set();
function emitCustomer(u) { listeners.forEach(cb => cb(u)); }

export async function currentCustomer() {
    if (isDemo) {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.localUser)) || null; } catch { return null; }
    }
    const { auth } = await authMod();
    await auth.authStateReady?.();
    const u = auth.currentUser;
    return u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null;
}
export function onCustomerChange(cb) {
    listeners.add(cb);
    currentCustomer().then(cb).catch(() => cb(null));
    if (!isDemo) {
        authMod().then(({ auth, m }) => m.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email, name: u.displayName || '' } : null)));
    }
    return () => listeners.delete(cb);
}
export async function registerCustomer({ name, email, password }) {
    const e = norm(email).toLowerCase();
    if (isDemo) {
        const db = lread();
        let c = db.customers.find(x => x.email === e);
        if (!c) { c = { id: uid('cus'), email: e, name, createdAt: Date.now() }; db.customers.push(c); }
        else { c.name = name || c.name; c.guest = false; }
        lwrite(db);
        const u = { uid: c.id, email: e, name: c.name };
        localStorage.setItem(STORAGE_KEYS.localUser, JSON.stringify(u));
        emitCustomer(u);
        return u;
    }
    const { auth, m } = await authMod();
    const cred = await m.createUserWithEmailAndPassword(auth, e, password);
    await m.updateProfile(cred.user, { displayName: name });
    await fsSave('customers', cred.user.uid, { email: e, name, createdAt: Date.now() });
    const u = { uid: cred.user.uid, email: e, name };
    emitCustomer(u);
    return u;
}
export async function loginCustomer({ email, password }) {
    const e = norm(email).toLowerCase();
    if (isDemo) {
        // DEMO ONLY: passwordless. Live mode uses real Firebase Authentication.
        const db = lread();
        const c = db.customers.find(x => x.email === e && !x.guest) || db.customers.find(x => x.email === e);
        if (!c) throw new Error('auth/user-not-found');
        const u = { uid: c.id, email: e, name: c.name || '' };
        localStorage.setItem(STORAGE_KEYS.localUser, JSON.stringify(u));
        emitCustomer(u);
        return u;
    }
    const { auth, m } = await authMod();
    const cred = await m.signInWithEmailAndPassword(auth, e, password);
    return { uid: cred.user.uid, email: e, name: cred.user.displayName || '' };
}
export async function resetPassword(email) {
    if (isDemo) return;
    const { auth, m } = await authMod();
    await m.sendPasswordResetEmail(auth, norm(email));
}
export async function logoutCustomer() {
    if (isDemo) { localStorage.removeItem(STORAGE_KEYS.localUser); emitCustomer(null); return; }
    const { auth, m } = await authMod();
    await m.signOut(auth);
    emitCustomer(null);
}

// ════════════════════════════════════════════════════════════
// AUTH — admin (Firebase Auth user that also exists in admins/{uid})
// ════════════════════════════════════════════════════════════
export async function adminLogin(email, password) {
    if (isDemo) {
        const d = SITE.demoAdmin;
        if (norm(email).toLowerCase() === d.email && password === d.password) {
            localStorage.setItem(STORAGE_KEYS.localAdmin, JSON.stringify({ email: d.email }));
            return { email: d.email };
        }
        throw new Error('auth/invalid-credential');
    }
    const { auth, m } = await authMod();
    const cred = await m.signInWithEmailAndPassword(auth, norm(email), password);
    const ok = await fsGet('admins', cred.user.uid).catch(() => null);
    if (!ok) { await m.signOut(auth); throw new Error('not_admin'); }
    return { uid: cred.user.uid, email: cred.user.email };
}
/** Resolves with the admin user, or null when not signed in / not on the allowlist. */
export async function currentAdmin() {
    if (isDemo) {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.localAdmin)) || null; } catch { return null; }
    }
    const { auth } = await authMod();
    await auth.authStateReady();
    const u = auth.currentUser;
    if (!u) return null;
    const ok = await fsGet('admins', u.uid).catch(() => null);
    return ok ? { uid: u.uid, email: u.email } : null;
}
export async function adminLogout() {
    if (isDemo) { localStorage.removeItem(STORAGE_KEYS.localAdmin); return; }
    const { auth, m } = await authMod();
    await m.signOut(auth);
}

// ════════════════════════════════════════════════════════════
// IMAGES (compress in the browser, then Storage / data URL)
// ════════════════════════════════════════════════════════════
export function compressImage(file, maxWidth = 1200, quality = 0.78) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the file.'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('Invalid image.'));
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed.')), 'image/jpeg', quality);
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}
const blobToDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

/** @returns {Promise<string>} public URL (Storage) or data URL (demo) */
export async function uploadImage(file, folder = 'products') {
    if (isDemo) {
        const blob = await compressImage(file, 900, 0.7);
        return blobToDataUrl(blob);
    }
    const blob = await compressImage(file);
    const { storage, m } = await storageMod();
    const name = `${folder}/${Date.now()}_${(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '')}.jpg`;
    const r = m.ref(storage, name);
    await m.uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' });
    return m.getDownloadURL(r);
}

// ════════════════════════════════════════════════════════════
// SAMPLE DATA IMPORT (live mode)
// ════════════════════════════════════════════════════════════
export async function importSampleData() {
    if (isDemo) { resetDemoData(); return; }
    await Promise.all([
        ...SEED_CATEGORIES.map(c => fsSave('categories', c.id, c)),
        ...SEED_PRODUCTS.map(p => fsSave('products', p.id, p)),
        ...SEED_PROMOS.map(p => fsSave('promos', p.code, p)),
        ...SEED_REVIEWS.filter(r => r.status === 'approved').map(r => fsSave('reviews', r.id, r))
    ]);
    await Promise.all(Object.keys(DEFAULT_SETTINGS).map(n => fsSave('settings', n, DEFAULT_SETTINGS[n])));
    invalidateCache();
}
