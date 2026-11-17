// ============================================================
// SEAWAY - Shared UI pieces (toasts, product card, quick-add)
// ============================================================
import { t, loc, escapeHtml } from './i18n.js';
import { fmt } from './money.js';
import { getProducts } from './db.js';
import {
    productThumb, productHover, colorHex, stockState, variantStock, totalStock, isOneSize
} from './catalog.js';
import { addToCart, inWishlist, toggleWishlist } from './cart.js';
import { track } from './analytics.js';
import { ONE_SIZE } from './config.js';

// ── paths ───────────────────────────────────────────────────
export const productUrl = (p) => `/product/${encodeURIComponent(p.slug || p.id)}`;
export const collectionUrl = (c) => `/collections/${encodeURIComponent(c.slug || c.id)}`;
export const sizeLabel = (s) => (s === ONE_SIZE ? t('size.ONE') : s);

// ── toast ───────────────────────────────────────────────────
export function toast(message, { type = 'ok', action } = {}) {
    let box = document.getElementById('toasts');
    if (!box) {
        box = document.createElement('div');
        box.id = 'toasts';
        box.setAttribute('aria-live', 'polite');
        document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span>${escapeHtml(message)}</span>`;
    if (action) {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = action.label;
        b.addEventListener('click', () => { action.onClick(); el.remove(); });
        el.appendChild(b);
    }
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3800);
}

// ── stars ───────────────────────────────────────────────────
export function starsHTML(avg, count) {
    const full = Math.round(avg);
    const star = (on) => `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    const label = t('reviews.ratingOf', { n: avg.toFixed(1) });
    return `<span class="stars" role="img" aria-label="${escapeHtml(label)}">${[1, 2, 3, 4, 5].map(i => star(i <= full)).join('')}${count != null ? `<span class="stars-count">(${count})</span>` : ''}</span>`;
}

// ── price ───────────────────────────────────────────────────
export function priceHTML(p) {
    const hasCompare = p.comparePrice && p.comparePrice > p.price;
    return `<span class="price">${hasCompare ? `<s class="price-old">${fmt(p.comparePrice)}</s> ` : ''}<span class="price-now">${fmt(p.price)}</span></span>`;
}

// ── product card ────────────────────────────────────────────
export function productCard(p, { ratings = {} } = {}) {
    const name = escapeHtml(loc(p.name));
    const state = stockState(p);
    const r = ratings[p.id];
    const badges = [
        state === 'out' ? `<span class="badge badge--out">${t('card.soldOut')}</span>` : '',
        p.isNew && state !== 'out' ? `<span class="badge badge--new">${t('card.new')}</span>` : '',
        p.bestseller && !p.isNew && state !== 'out' ? `<span class="badge">${t('card.bestseller')}</span>` : '',
        state === 'low' ? `<span class="badge badge--low">${t('card.lowStock')}</span>` : ''
    ].join('');
    const wished = inWishlist(p.id);
    const dots = (p.colors || []).slice(0, 6).map(c => `<span class="dot" style="--c:${colorHex(c)}" title="${escapeHtml(t('color.' + c))}"></span>`).join('');
    return `
    <article class="card" data-id="${escapeHtml(p.id)}">
        <div class="card-media">
            <a href="${productUrl(p)}" class="card-link" aria-label="${name}">
                <img class="img-main" src="${productThumb(p)}" alt="${name}" width="800" height="1000" loading="lazy" decoding="async">
                <img class="img-hover" src="${productHover(p)}" alt="" width="800" height="1000" loading="lazy" decoding="async" aria-hidden="true">
            </a>
            <div class="badges">${badges}</div>
            <button type="button" class="wish-btn ${wished ? 'is-on' : ''}" data-wish="${escapeHtml(p.id)}" aria-pressed="${wished}" aria-label="${escapeHtml(t(wished ? 'card.removeWishlist' : 'card.addWishlist'))}">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.9 3.6 5 6.7 5c1.9 0 3.6 1 5.3 3 1.7-2 3.4-3 5.3-3 3.1 0 5.1 2.9 3.900 6.200-1.700 4.700-9.200 9.300-9.200 9.300z" fill="${wished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
            </button>
            ${state === 'out' ? '' : `<button type="button" class="quick-btn" data-quick="${escapeHtml(p.id)}">${t('card.quickAdd')}</button>`}
        </div>
        <div class="card-body">
            <h3 class="card-title"><a href="${productUrl(p)}">${name}</a></h3>
            <div class="card-meta">${priceHTML(p)}${r ? starsHTML(r.avg, r.count) : ''}</div>
            <div class="dots" aria-hidden="true">${dots}</div>
        </div>
    </article>`;
}

// ── add helper (stock-checked) ──────────────────────────────
export function addProductToCart(p, color, size, qty = 1, { openDrawer = true } = {}) {
    const max = variantStock(p, color, size);
    if (max <= 0) { toast(t('product.outOfStock'), { type: 'err' }); return false; }
    addToCart({
        productId: p.id, slug: p.slug, name: p.name, category: p.category, art: p.art || null,
        color, size, price: p.price, max
    }, qty);
    track('AddToCart', { value: p.price * qty, items: [{ id: p.id, name: loc(p.name), price: p.price, qty }] });
    toast(t('toast.added', { name: loc(p.name) }));
    if (openDrawer) window.dispatchEvent(new Event('cart:open'));
    return true;
}

// ── quick add dialog ────────────────────────────────────────
let dlg;
function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'quick-add';
    dlg.className = 'sheet';
    dlg.setAttribute('aria-labelledby', 'qa-title');
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.appendChild(dlg);
    return dlg;
}

export function openQuickAdd(p) {
    const d = ensureDialog();
    let color = (p.colors || []).find(c => variantStock(p, c, p.sizes.find(s => variantStock(p, c, s) > 0)) > 0) || p.colors[0];
    let size = isOneSize(p) ? p.sizes[0] : null;

    const render = () => {
        d.innerHTML = `
        <form method="dialog" class="sheet-inner">
            <button class="sheet-close" value="cancel" aria-label="${escapeHtml(t('common.close'))}">×</button>
            <div class="qa-top">
                <img src="${productThumb(p, color)}" alt="" width="96" height="120">
                <div><h2 id="qa-title">${escapeHtml(loc(p.name))}</h2>${priceHTML(p)}</div>
            </div>
            <fieldset class="opt"><legend>${t('product.color')}: <strong>${escapeHtml(t('color.' + color))}</strong></legend>
                <div class="swatches">${p.colors.map(c => `
                    <button type="button" class="swatch ${c === color ? 'is-on' : ''}" data-color="${c}" style="--c:${colorHex(c)}" aria-label="${escapeHtml(t('color.' + c))}" aria-pressed="${c === color}"></button>`).join('')}</div>
            </fieldset>
            ${isOneSize(p) ? '' : `<fieldset class="opt"><legend>${t('product.size')}</legend>
                <div class="sizes">${p.sizes.map(s => {
                    const out = variantStock(p, color, s) <= 0;
                    return `<button type="button" class="size ${s === size ? 'is-on' : ''}" data-size="${s}" ${out ? 'disabled' : ''} aria-pressed="${s === size}">${sizeLabel(s)}</button>`;
                }).join('')}</div></fieldset>`}
            <p class="qa-err" role="alert" hidden>${t('product.selectSize')}</p>
            <button type="button" class="btn btn--primary btn--block" data-qa-add>${t('product.addToCart')}</button>
            <a class="qa-more" href="${productUrl(p)}">${t('card.viewDetails')}</a>
        </form>`;
        d.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
            color = b.dataset.color;
            if (size && variantStock(p, color, size) <= 0) size = null;
            render();
        }));
        d.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { size = b.dataset.size; render(); }));
        d.querySelector('[data-qa-add]').addEventListener('click', () => {
            if (!size) { d.querySelector('.qa-err').hidden = false; return; }
            if (addProductToCart(p, color, size, 1)) d.close();
        });
    };
    render();
    d.showModal();
}

// ── delegated card actions (wishlist heart, quick add) ──────
export function initCardActions() {
    document.addEventListener('click', async (e) => {
        const wish = e.target.closest('[data-wish]');
        if (wish) {
            e.preventDefault();
            const on = toggleWishlist(wish.dataset.wish);
            wish.classList.toggle('is-on', on);
            wish.setAttribute('aria-pressed', String(on));
            wish.setAttribute('aria-label', t(on ? 'card.removeWishlist' : 'card.addWishlist'));
            const path = wish.querySelector('path');
            if (path) path.setAttribute('fill', on ? 'currentColor' : 'none');
            toast(t(on ? 'toast.wishAdded' : 'toast.wishRemoved'));
            return;
        }
        const quick = e.target.closest('[data-quick]');
        if (quick) {
            e.preventDefault();
            const list = await getProducts();
            const p = list.find(x => x.id === quick.dataset.quick);
            if (!p) return;
            if (p.colors.length === 1 && p.sizes.length === 1) {
                addProductToCart(p, p.colors[0], p.sizes[0], 1);
            } else openQuickAdd(p);
        }
    });
}

// ── reveal on scroll (subtle fade-in) ───────────────────────
export function initReveal(root = document) {
    const els = root.querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        els.forEach(el => el.classList.add('in'));
        return;
    }
    const io = new IntersectionObserver((entries) => {
        entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
}
