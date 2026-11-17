// ============================================================
// SEAWAY - Cart & wishlist (localStorage, no account needed)
// ============================================================
import { STORAGE_KEYS } from './config.js';

const readJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

// ── cart ────────────────────────────────────────────────────
export const getCart = () => readJson(STORAGE_KEYS.cart, []);
function saveCart(cart) {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
}
export const cartKey = (productId, color, size) => `${productId}|${color}|${size}`;
export const cartCount = () => getCart().reduce((s, i) => s + i.qty, 0);

/**
 * item: { productId, slug, name, category, art, color, size, price, max }
 * @returns {number} quantity now in cart for that variant
 */
export function addToCart(item, qty = 1) {
    const cart = getCart();
    const key = cartKey(item.productId, item.color, item.size);
    const found = cart.find(i => i.key === key);
    const max = item.max ?? 99;
    if (found) { found.qty = Math.min(max, found.qty + qty); found.max = max; found.price = item.price; }
    else cart.push({ ...item, key, qty: Math.min(max, qty) });
    saveCart(cart);
    return cart.find(i => i.key === key).qty;
}
export function setQty(key, qty) {
    let cart = getCart();
    const it = cart.find(i => i.key === key);
    if (!it) return;
    if (qty <= 0) cart = cart.filter(i => i.key !== key);
    else it.qty = Math.min(it.max ?? 99, qty);
    saveCart(cart);
}
export function removeItem(key) { saveCart(getCart().filter(i => i.key !== key)); }
export function clearCart() { saveCart([]); }
/** Refresh price/max from the live catalog (called by drawer & checkout) */
export function syncCart(products) {
    const cart = getCart();
    let changed = false;
    const next = [];
    for (const it of cart) {
        const p = products.find(x => x.id === it.productId);
        if (!p || p.active === false) { changed = true; continue; }
        const stock = p.stock?.[`${it.color}|${it.size}`] ?? 0;
        if (stock <= 0) { changed = true; continue; }
        const qty = Math.min(it.qty, stock);
        if (qty !== it.qty || it.price !== p.price || it.max !== stock) changed = true;
        next.push({ ...it, qty, price: p.price, max: stock });
    }
    if (changed) saveCart(next);
    return next;
}

// ── wishlist ────────────────────────────────────────────────
export const getWishlist = () => readJson(STORAGE_KEYS.wishlist, []);
export const inWishlist = (id) => getWishlist().includes(id);
export function toggleWishlist(id) {
    let w = getWishlist();
    const had = w.includes(id);
    w = had ? w.filter(x => x !== id) : [...w, id];
    localStorage.setItem(STORAGE_KEYS.wishlist, JSON.stringify(w));
    window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: { id, active: !had } }));
    return !had;
}
