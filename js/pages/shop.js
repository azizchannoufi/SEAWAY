import { bootStore, ctx, setSEO } from '../shell.js';
import { getProducts, getApprovedRatings } from '../db.js';
import { t, loc, escapeHtml } from '../i18n.js';
import { productCard, sizeLabel } from '../ui.js';
import { fmt, getRate } from '../money.js';
import { colorHex, stockState } from '../catalog.js';
import { SIZES, COLOR_PALETTE, ONE_SIZE } from '../config.js';

await bootStore({ page: 'shop' });

// /collections/<slug> pre-selects a category
const pathSlug = location.pathname.startsWith('/collections/') ? decodeURIComponent(location.pathname.split('/')[2] || '') : '';
const params = new URLSearchParams(location.search);

const state = {
    category: pathSlug || params.get('c') || '',
    sizes: params.get('size')?.split(',').filter(Boolean) || [],
    colors: params.get('color')?.split(',').filter(Boolean) || [],
    max: Number(params.get('max')) || 0,       // in EUR
    stock: params.get('stock') === '1',
    sort: params.get('sort') || 'featured',
    q: params.get('q') || ''
};

const [all, ratings] = await Promise.all([getProducts(), getApprovedRatings().catch(() => ({}))]);
const maxPriceEur = Math.ceil(Math.max(...all.map(p => p.price), 100) / 10) * 10;
const cat = ctx.categories.find(c => c.slug === state.category || c.id === state.category);

// page heading
const crumbs = document.getElementById('crumbs');
crumbs.innerHTML = `<a href="/">${t('nav.home')}</a> <span aria-hidden="true">/</span> ${cat ? `<a href="/shop">${t('nav.shop')}</a> <span aria-hidden="true">/</span> <span aria-current="page">${escapeHtml(loc(cat.name))}</span>` : `<span aria-current="page">${t('nav.shop')}</span>`}`;
if (cat) {
    document.getElementById('shop-title').textContent = loc(cat.name);
    document.getElementById('shop-sub').textContent = loc(cat.desc);
}
setSEO({
    title: cat ? loc(cat.name) : t('shop.title'),
    description: cat ? loc(cat.desc) : t('shop.subtitle'),
    path: cat ? `/collections/${cat.slug}` : '/shop'
});
document.getElementById('sort').value = state.sort;

// ── filter panel ────────────────────────────────────────────
const body = document.getElementById('filters-body');
const availSizes = [...new Set(all.flatMap(p => p.sizes))].sort((a, b) => {
    const ia = SIZES.indexOf(a), ib = SIZES.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});
const availColors = COLOR_PALETTE.filter(c => all.some(p => p.colors.includes(c.id)));

function renderFilters() {
    body.innerHTML = `
    <fieldset class="f-group">
        <legend>${t('shop.category')}</legend>
        <label class="radio"><input type="radio" name="cat" value="" ${!state.category ? 'checked' : ''}> <span>${t('shop.all')}</span></label>
        ${ctx.categories.map(c => `<label class="radio"><input type="radio" name="cat" value="${escapeHtml(c.slug)}" ${c.slug === state.category ? 'checked' : ''}> <span>${escapeHtml(loc(c.name))}</span></label>`).join('')}
    </fieldset>
    <fieldset class="f-group">
        <legend>${t('shop.size')}</legend>
        <div class="sizes">${availSizes.map(s => `<button type="button" class="size ${state.sizes.includes(s) ? 'is-on' : ''}" data-size="${s}" aria-pressed="${state.sizes.includes(s)}">${sizeLabel(s)}</button>`).join('')}</div>
    </fieldset>
    <fieldset class="f-group">
        <legend>${t('shop.color')}</legend>
        <div class="swatches">${availColors.map(c => `<button type="button" class="swatch ${state.colors.includes(c.id) ? 'is-on' : ''}" data-color="${c.id}" style="--c:${c.hex}" aria-label="${escapeHtml(t('color.' + c.id))}" title="${escapeHtml(t('color.' + c.id))}" aria-pressed="${state.colors.includes(c.id)}"></button>`).join('')}</div>
    </fieldset>
    <fieldset class="f-group">
        <legend>${t('shop.price')}</legend>
        <input type="range" id="price-range" min="10" max="${Math.round(maxPriceEur * getRate())}" step="5" value="${Math.round((state.max || maxPriceEur) * getRate())}" aria-label="${escapeHtml(t('shop.maxPrice'))}">
        <p class="range-out">${t('shop.upTo')} <strong id="price-out">${fmt(state.max || maxPriceEur)}</strong></p>
    </fieldset>
    <label class="check"><input type="checkbox" id="stock-only" ${state.stock ? 'checked' : ''}> <span>${t('shop.inStockOnly')}</span></label>`;
}

function matches(p) {
    if (state.category && p.category !== state.category) return false;
    if (state.sizes.length && !state.sizes.some(s => p.sizes.includes(s))) return false;
    if (state.colors.length && !state.colors.some(c => p.colors.includes(c))) return false;
    if (state.max && p.price > state.max + 0.001) return false;
    if (state.stock && stockState(p) === 'out') return false;
    if (state.q) {
        const hay = `${loc(p.name)} ${loc(p.desc)}`.toLowerCase();
        if (!hay.includes(state.q.toLowerCase())) return false;
    }
    return true;
}
const sorters = {
    featured: (a, b) => (b.featured | 0) - (a.featured | 0) || (b.bestseller | 0) - (a.bestseller | 0) || (b.createdAt - a.createdAt),
    popular: (a, b) => (b.bestseller | 0) - (a.bestseller | 0) || (ratings[b.id]?.count || 0) - (ratings[a.id]?.count || 0),
    new: (a, b) => (b.isNew | 0) - (a.isNew | 0) || b.createdAt - a.createdAt,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price
};

function syncUrl() {
    const q = new URLSearchParams();
    if (!pathSlug && state.category) q.set('c', state.category);
    if (state.sizes.length) q.set('size', state.sizes.join(','));
    if (state.colors.length) q.set('color', state.colors.join(','));
    if (state.max) q.set('max', state.max);
    if (state.stock) q.set('stock', '1');
    if (state.sort !== 'featured') q.set('sort', state.sort);
    if (state.q) q.set('q', state.q);
    const base = pathSlug ? location.pathname : '/shop';
    history.replaceState(null, '', base + (q.toString() ? '?' + q : ''));
}

function renderGrid() {
    const list = all.filter(matches).sort(sorters[state.sort] || sorters.featured);
    const grid = document.getElementById('grid');
    grid.innerHTML = list.map(p => productCard(p, { ratings })).join('');
    document.getElementById('empty').hidden = list.length > 0;
    const n = list.length;
    document.getElementById('result-count').textContent = t(n === 1 ? 'shop.resultOne' : 'shop.results', { n });
    document.getElementById('filters-apply').textContent = t('shop.showResultsN', { n });
    syncUrl();
}

body.addEventListener('click', (e) => {
    const s = e.target.closest('[data-size]');
    const c = e.target.closest('[data-color]');
    if (s) {
        const v = s.dataset.size;
        state.sizes = state.sizes.includes(v) ? state.sizes.filter(x => x !== v) : [...state.sizes, v];
        s.classList.toggle('is-on'); s.setAttribute('aria-pressed', String(state.sizes.includes(v)));
        renderGrid();
    }
    if (c) {
        const v = c.dataset.color;
        state.colors = state.colors.includes(v) ? state.colors.filter(x => x !== v) : [...state.colors, v];
        c.classList.toggle('is-on'); c.setAttribute('aria-pressed', String(state.colors.includes(v)));
        renderGrid();
    }
});
body.addEventListener('change', (e) => {
    if (e.target.name === 'cat') {
        state.category = e.target.value;
        if (pathSlug) { location.href = state.category ? `/collections/${state.category}` : '/shop'; return; }
        const c = ctx.categories.find(x => x.slug === state.category);
        document.getElementById('shop-title').textContent = c ? loc(c.name) : t('shop.title');
        document.getElementById('shop-sub').textContent = c ? loc(c.desc) : t('shop.subtitle');
        renderGrid();
    }
    if (e.target.id === 'stock-only') { state.stock = e.target.checked; renderGrid(); }
});
body.addEventListener('input', (e) => {
    if (e.target.id === 'price-range') {
        const eur = Number(e.target.value) / getRate();
        state.max = eur >= maxPriceEur - 0.01 ? 0 : eur;
        document.getElementById('price-out').textContent = fmt(state.max || maxPriceEur);
        renderGrid();
    }
});
document.getElementById('sort').addEventListener('change', (e) => { state.sort = e.target.value; renderGrid(); });
document.getElementById('filters-clear').addEventListener('click', () => {
    Object.assign(state, { category: pathSlug, sizes: [], colors: [], max: 0, stock: false, q: '' });
    renderFilters(); renderGrid();
});

// mobile filter drawer
const panel = document.getElementById('filters');
const openF = document.getElementById('filters-open');
const setPanel = (open) => {
    panel.classList.toggle('open', open);
    openF.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open && matchMedia('(max-width: 900px)').matches);
};
openF.addEventListener('click', () => setPanel(true));
document.getElementById('filters-close').addEventListener('click', () => setPanel(false));
document.getElementById('filters-apply').addEventListener('click', () => setPanel(false));

renderFilters();
renderGrid();
