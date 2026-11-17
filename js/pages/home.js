import { bootStore, ctx, setSEO } from '../shell.js';
import { getProducts, getApprovedRatings, subscribe } from '../db.js';
import { t, loc, escapeHtml } from '../i18n.js';
import { productCard, collectionUrl, initReveal } from '../ui.js';
import { collectionArt } from '../placeholders.js';
import { SEED_UGC } from '../seed.js';
import { artDataUri } from '../placeholders.js';

await bootStore({ page: 'home', hero: true });
setSEO({ title: '', description: t('seo.homeDescription'), path: '/' });
document.title = `Seaway — ${t('brand.tagline')}`;

// hero: video > photo > generated artwork
const { heroVideo, heroImage } = ctx.store;
const media = document.getElementById('hero-media');
if (heroVideo) {
    media.innerHTML = `<video autoplay muted loop playsinline preload="metadata" ${heroImage ? `poster="${escapeHtml(heroImage)}"` : ''}><source src="${escapeHtml(heroVideo)}" type="video/mp4"></video>`;
} else if (heroImage) {
    media.innerHTML = `<img src="${escapeHtml(heroImage)}" alt="" width="1600" height="900" fetchpriority="high">`;
}

// newsletter band
document.getElementById('home-news').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('hn-msg');
    try {
        await subscribe(document.getElementById('hn-email').value, 'home');
        msg.textContent = t('popup.success'); msg.className = 'form-msg ok';
        e.target.reset();
    } catch { msg.textContent = t('common.invalidEmail'); msg.className = 'form-msg err'; }
});
const pct = ctx.marketing.popupPercent;
document.querySelector('#nb-title').textContent = t('home.newsTitle', { percent: pct });

// social
const handle = ctx.store.instagramHandle || '@seaway';
document.getElementById('ugc-handle').textContent = handle;
const follow = document.getElementById('ugc-follow');
follow.href = ctx.store.instagram || '#';

document.getElementById('ugc-grid').innerHTML = SEED_UGC.map(u => `
    <a class="ugc-item" href="${escapeHtml(ctx.store.instagram || '#')}" target="_blank" rel="noopener" aria-label="${escapeHtml(u.handle)}">
        <img src="${artDataUri({ kind: u.art, hex: u.hex, view: 'scene' })}" alt="" width="400" height="500" loading="lazy">
        <span>${escapeHtml(u.handle)}</span>
    </a>`).join('');

// collection tiles
document.getElementById('collection-tiles').innerHTML = ctx.categories.map(c => `
    <a class="tile" href="${collectionUrl(c)}">
        <img src="${c.image || collectionArt(c.art || 'tee', c.hex || '#0B2545')}" alt="" width="400" height="500" loading="lazy">
        <span class="tile-name">${escapeHtml(loc(c.name))}</span>
    </a>`).join('');

// products
const [products, ratings] = await Promise.all([getProducts(), getApprovedRatings().catch(() => ({}))]);
const inStock = products;
let featured = inStock.filter(p => p.featured).slice(0, 4);
if (featured.length < 2) featured = inStock.slice(0, 4);
let best = inStock.filter(p => p.bestseller).slice(0, 4);
if (best.length < 2) best = inStock.slice(0, 4);
const render = (el, list) => { el.innerHTML = list.map(p => productCard(p, { ratings })).join(''); };
// editorial layout: two featured pieces are shown large, three or more in the 4-column grid
const fg = document.getElementById('featured-grid');
if (featured.length <= 2) { fg.classList.remove('grid--4'); fg.classList.add('grid--2'); }
render(fg, featured);
render(document.getElementById('best-grid'), best);
initReveal();
