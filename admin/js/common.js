// ============================================================
// SEAWAY admin — shared shell: auth gate, sidebar, helpers
// ============================================================
import * as db from '/js/db.js';
import { SITE } from '/js/config.js';

export { db };

// ── tiny helpers ────────────────────────────────────────────
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const eur = (n) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
export const num = (n) => new Intl.NumberFormat('en-GB').format(Number(n) || 0);
export const dateOnly = (ts) => ts ? new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const dateTime = (ts) => ts ? new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
/** localized object ({en,fr,...}) -> English (or first available) text */
export const nm = (o) => (typeof o === 'string' ? o : (o?.en || o?.fr || Object.values(o || {})[0] || ''));
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const badge = (status, label) => `<span class="badge ${esc(status)}">${esc(label || status)}</span>`;
export const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

export function toast(msg, type = '') {
    let box = $('.toasts');
    if (!box) { box = document.createElement('div'); box.className = 'toasts'; box.setAttribute('role', 'status'); document.body.appendChild(box); }
    const el = document.createElement('div');
    el.className = 'toast ' + type; el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), type === 'err' ? 6000 : 3200);
}

/** Opens a <dialog>. Returns { el, body, foot, close }. */
export function openModal({ title, html = '', footer = '', wide = false, onClose } = {}) {
    const el = document.createElement('dialog');
    if (wide) el.className = 'wide';
    el.innerHTML = `<div class="dlg-h"><h2>${esc(title)}</h2><button class="btn icon" type="button" data-x aria-label="Close">✕</button></div>
        <div class="dlg-b">${html}</div>${footer ? `<div class="dlg-f">${footer}</div>` : ''}`;
    document.body.appendChild(el);
    const close = () => { if (el.open) el.close(); };
    el.addEventListener('close', () => { el.remove(); onClose?.(); });
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    $('[data-x]', el).addEventListener('click', close);
    el.showModal();
    return { el, body: $('.dlg-b', el), foot: $('.dlg-f', el), close };
}

export function confirmBox(message, { okLabel = 'Delete', danger = true, title = 'Please confirm' } = {}) {
    return new Promise((resolve) => {
        let answer = false;
        const m = openModal({
            title, html: `<p style="margin:0">${esc(message)}</p>`,
            footer: `<button class="btn" data-no type="button">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes type="button">${esc(okLabel)}</button>`,
            onClose: () => resolve(answer)
        });
        $('[data-no]', m.el).onclick = m.close;
        $('[data-yes]', m.el).onclick = () => { answer = true; m.close(); };
    });
}

export function downloadCSV(filename, rows) {
    const cell = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(cell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function guard(fn, okMsg) {
    // resolves with the function's result (true when it returns nothing), or undefined on error
    try { const r = await fn(); if (okMsg) toast(okMsg, 'ok'); return r === undefined ? true : r; }
    catch (e) { console.error(e); toast(e?.message || 'Something went wrong', 'err'); return undefined; }
}

// ── navigation ──────────────────────────────────────────────
const I = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const NAV = [
    { id: 'dashboard', href: '/admin/', label: 'Dashboard', icon: I('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>') },
    { id: 'orders', href: '/admin/orders.html', label: 'Orders', badge: 'orders', icon: I('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>') },
    { id: 'products', href: '/admin/products.html', label: 'Products & stock', icon: I('<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>') },
    { id: 'collections', href: '/admin/collections.html', label: 'Collections', icon: I('<path d="M3 7h18M3 12h18M3 17h18"/>') },
    { id: 'promos', href: '/admin/promos.html', label: 'Promo codes', icon: I('<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>') },
    { id: 'customers', href: '/admin/customers.html', label: 'Customers', badge: 'messages', icon: I('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>') },
    { id: 'reviews', href: '/admin/reviews.html', label: 'Reviews', badge: 'reviews', icon: I('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3-6.2 3.3L8 14.2 3 9.3l6.9-1z"/>') },
    { id: 'settings', href: '/admin/settings.html', label: 'Settings', icon: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>') }
];

function renderShell(page, title, admin) {
    const side = $('#sidebar');
    side.innerHTML = `
        <a class="side-brand" href="/admin/"><img src="/assets/img/emblem.webp" alt="" width="38" height="38"><span><strong>SEAWAY</strong><small>ADMIN</small></span></a>
        <nav class="side-nav" aria-label="Admin">${NAV.map(n => `<a href="${n.href}" data-nav="${n.id}" ${n.id === page ? 'class="active" aria-current="page"' : ''}>${n.icon}<span>${n.label}</span>${n.badge ? `<span class="count" data-badge="${n.badge}" hidden></span>` : ''}</a>`).join('')}</nav>
        <div class="side-foot">
            <span class="who">${esc(admin.email)}</span>
            <a href="/" target="_blank" rel="noopener">View storefront ↗</a>
            <button type="button" id="logout">Sign out</button>
        </div>`;
    $('#topbar').innerHTML = `<button class="menu-btn" id="menu-btn" type="button" aria-label="Menu"><svg viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></svg></button>
        <h1>${esc(title)}</h1><span class="spacer"></span><span id="topbar-actions" class="row"></span>`;
    $('#menu-btn').onclick = () => document.body.classList.toggle('nav-open');
    $('.content').addEventListener('click', () => document.body.classList.remove('nav-open'));
    $('#logout').onclick = async () => { await db.adminLogout(); location.href = '/admin/login.html'; };
    if (db.isDemo) {
        const bar = document.createElement('div');
        bar.className = 'demo-bar';
        bar.innerHTML = '<strong>Demo mode</strong> — data is stored in this browser only. Connect Firebase in <code>js/config.js</code> to go live (see README).';
        $('#topbar').after(bar);
    }
}

async function loadBadges() {
    try {
        const [orders, reviews, msgs] = await Promise.all([db.listOrders(), db.listAllReviews(), db.listMessages()]);
        const counts = {
            orders: orders.filter(o => o.status === 'pending').length,
            reviews: reviews.filter(r => r.status === 'pending').length,
            messages: msgs.filter(m => !m.read).length
        };
        $$('[data-badge]').forEach(el => { const n = counts[el.dataset.badge]; if (n) { el.textContent = n; el.hidden = false; } });
    } catch { /* badges are optional */ }
}

/**
 * Page bootstrap: verifies the admin session, renders the shell, reveals #main.
 * @returns {Promise<{email:string}>}
 */
export async function bootAdmin({ page, title }) {
    const admin = await db.currentAdmin().catch(() => null);
    if (!admin) { location.replace('/admin/login.html'); return new Promise(() => {}); }
    document.title = `${title} · Seaway Admin`;
    renderShell(page, title, admin);
    $('#main').hidden = false;
    loadBadges();
    return admin;
}

export const SITE_URL = SITE.url;
