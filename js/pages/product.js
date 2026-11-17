import { bootStore, ctx, setSEO } from '../shell.js';
import { getProducts, getProduct, getReviews, addReview, getApprovedRatings } from '../db.js';
import { t, loc, escapeHtml, formatDate } from '../i18n.js';
import { fmt, getCurrency } from '../money.js';
import { SITE } from '../config.js';
import {
    productImages, colorHex, variantStock, colorStock, totalStock, isOneSize, LOW_STOCK
} from '../catalog.js';
import { productCard, productUrl, collectionUrl, addProductToCart, priceHTML, starsHTML, sizeLabel, toast, initReveal } from '../ui.js';
import { inWishlist, toggleWishlist } from '../cart.js';
import { sizeTableHTML } from '../sizes.js';
import { track } from '../analytics.js';

await bootStore({ page: 'product' });

const slug = location.pathname.startsWith('/product/')
    ? decodeURIComponent(location.pathname.split('/')[2] || '')
    : new URLSearchParams(location.search).get('p') || '';
const root = document.getElementById('pdp');
const p = slug ? await getProduct(slug) : null;

if (!p || p.active === false) {
    setSEO({ title: t('product.notFound') });
    root.innerHTML = `<div class="notfound"><h1>${t('product.notFound')}</h1><p>${t('product.notFoundText')}</p><a class="btn btn--primary" href="/shop">${t('cart.emptyCta')}</a></div>`;
} else {
    await renderProduct(p);
}

async function renderProduct(p) {
    const cat = ctx.categories.find(c => c.id === p.category);
    const [reviews, ratings] = await Promise.all([getReviews(p.id).catch(() => []), getApprovedRatings().catch(() => ({}))]);
    const r = ratings[p.id];

    // state
    let color = p.colors.find(c => colorStock(p, c) > 0) || p.colors[0];
    let size = isOneSize(p) ? p.sizes[0] : null;
    let qty = 1;
    let imgIdx = 0;

    // breadcrumbs + SEO
    document.getElementById('crumbs').innerHTML = `<a href="/">${t('nav.home')}</a> <span aria-hidden="true">/</span> <a href="/shop">${t('nav.shop')}</a>${cat ? ` <span aria-hidden="true">/</span> <a href="${collectionUrl(cat)}">${escapeHtml(loc(cat.name))}</a>` : ''} <span aria-hidden="true">/</span> <span aria-current="page">${escapeHtml(loc(p.name))}</span>`;
    const origin = SITE.url.replace(/\/$/, '');
    const imgs0 = productImages(p, color);
    const absImg = (u) => (u.startsWith('http') ? u : origin + '/assets/img/og-image.jpg');
    setSEO({
        title: loc(p.name),
        description: loc(p.desc).slice(0, 155),
        image: absImg(imgs0[0]),
        type: 'product',
        path: productUrl(p),
        jsonLd: {
            '@context': 'https://schema.org', '@type': 'Product',
            name: loc(p.name), description: loc(p.desc), sku: p.id,
            image: imgs0.filter(u => u.startsWith('http')),
            brand: { '@type': 'Brand', name: 'Seaway' },
            offers: {
                '@type': 'Offer', priceCurrency: 'EUR', price: p.price,
                availability: totalStock(p) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                url: origin + productUrl(p)
            },
            ...(r ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: r.avg.toFixed(1), reviewCount: r.count } } : {})
        }
    });
    track('ViewContent', { value: p.price, items: [{ id: p.id, name: loc(p.name), price: p.price }] });

    const draw = () => {
        const imgs = productImages(p, color);
        if (imgIdx >= imgs.length) imgIdx = 0;
        const stockN = size ? variantStock(p, color, size) : colorStock(p, color);
        const status = stockN <= 0 ? 'out' : stockN <= LOW_STOCK ? 'low' : 'in';
        const statusText = {
            in: t('product.inStock'),
            low: t('product.lowStock', { n: stockN }),
            out: t('product.outOfStock')
        }[status];
        const wished = inWishlist(p.id);
        root.innerHTML = `
        <article class="pdp" itemscope itemtype="https://schema.org/Product">
            <div class="gallery">
                <div class="g-thumbs" role="tablist" aria-label="${escapeHtml(t('product.gallery'))}">
                    ${imgs.map((u, i) => `<button type="button" role="tab" class="g-thumb ${i === imgIdx ? 'is-on' : ''}" data-i="${i}" aria-selected="${i === imgIdx}" aria-label="${escapeHtml(t('product.photo', { n: i + 1 }))}"><img src="${u}" alt="" width="96" height="120" loading="lazy"></button>`).join('')}
                </div>
                <button type="button" class="g-main" id="g-main" aria-label="${escapeHtml(t('product.zoom'))}">
                    <img id="g-img" src="${imgs[imgIdx]}" alt="${escapeHtml(loc(p.name))} — ${escapeHtml(t('color.' + color))}" width="800" height="1000" fetchpriority="high" itemprop="image">
                    <span class="zoom-hint" aria-hidden="true">⤢</span>
                </button>
            </div>

            <div class="info">
                <div class="badges-row">
                    ${p.isNew ? `<span class="badge badge--new">${t('card.new')}</span>` : ''}
                    ${p.bestseller ? `<span class="badge">${t('card.bestseller')}</span>` : ''}
                </div>
                <h1 itemprop="name">${escapeHtml(loc(p.name))}</h1>
                <div class="info-meta">
                    ${priceHTML(p)}
                    ${r ? `<a href="#reviews" class="rate-link">${starsHTML(r.avg, r.count)}</a>` : ''}
                </div>
                <p class="p-short" itemprop="description">${escapeHtml(loc(p.desc))}</p>

                <fieldset class="opt">
                    <legend>${t('product.color')}: <strong>${escapeHtml(t('color.' + color))}</strong></legend>
                    <div class="swatches swatches--lg">${p.colors.map(c => `
                        <button type="button" class="swatch ${c === color ? 'is-on' : ''} ${colorStock(p, c) <= 0 ? 'is-out' : ''}" data-color="${c}" style="--c:${colorHex(c)}" aria-label="${escapeHtml(t('color.' + c))}${colorStock(p, c) <= 0 ? ' — ' + escapeHtml(t('product.outOfStock')) : ''}" aria-pressed="${c === color}"></button>`).join('')}
                    </div>
                </fieldset>

                ${isOneSize(p) ? '' : `
                <fieldset class="opt" id="size-opt">
                    <legend><span>${t('product.size')}${size ? `: <strong>${escapeHtml(sizeLabel(size))}</strong>` : ''}</span>
                        <button type="button" class="linklike" id="size-guide-btn">${t('product.sizeGuide')}</button></legend>
                    <div class="sizes sizes--lg">${p.sizes.map(s => `
                        <button type="button" class="size ${s === size ? 'is-on' : ''}" data-size="${s}" ${variantStock(p, color, s) <= 0 ? 'disabled' : ''} aria-pressed="${s === size}" aria-label="${escapeHtml(sizeLabel(s))}${variantStock(p, color, s) <= 0 ? ' — ' + escapeHtml(t('product.outOfStock')) : ''}">${sizeLabel(s)}</button>`).join('')}
                    </div>
                    <p class="field-err" id="size-err" role="alert" hidden>${t('product.selectSize')}</p>
                </fieldset>`}

                <p class="stock stock--${status}" aria-live="polite"><i></i>${statusText}</p>

                <div class="buy-row" id="buy-row">
                    <div class="qty qty--lg" role="group" aria-label="${escapeHtml(t('cart.qty'))}">
                        <button type="button" id="q-dec" aria-label="${escapeHtml(t('cart.decrease'))}">−</button>
                        <output id="q-val" aria-live="polite">${qty}</output>
                        <button type="button" id="q-inc" aria-label="${escapeHtml(t('cart.increase'))}">+</button>
                    </div>
                    <button type="button" class="btn btn--primary btn--lg" id="add-btn" ${status === 'out' ? 'disabled' : ''}>${status === 'out' ? t('product.outOfStock') : t('product.addToCart')}</button>
                    <button type="button" class="btn-icon wish-btn wish-btn--inline ${wished ? 'is-on' : ''}" id="pdp-wish" aria-pressed="${wished}" aria-label="${escapeHtml(t(wished ? 'card.removeWishlist' : 'card.addWishlist'))}">
                        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.9 3.6 5 6.7 5c1.9 0 3.6 1 5.3 3 1.7-2 3.4-3 5.3-3 3.1 0 5.1 2.9 3.9 6.2-1.7 4.7-9.2 9.3-9.2 9.3z" fill="${wished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
                    </button>
                </div>

                <ul class="perks">
                    <li>${t('product.perkShipping')}</li>
                    <li>${t('product.perkReturns')}</li>
                    <li>${t('product.perkSecure')}</li>
                </ul>

                <div class="acc">
                    <details open><summary>${t('product.description')}</summary><div class="acc-body"><p>${escapeHtml(loc(p.desc))}</p></div></details>
                    <details><summary>${t('product.materials')}</summary><div class="acc-body"><p>${escapeHtml(loc(p.material) || t('product.materialsDefault'))}</p></div></details>
                    <details><summary>${t('product.delivery')}</summary><div class="acc-body"><p>${t('product.deliveryText')}</p><p><a href="/shipping">${t('link.shipping')}</a></p></div></details>
                </div>
            </div>
        </article>

        <div class="sticky-buy" id="sticky-buy" hidden>
            <div><strong>${escapeHtml(loc(p.name))}</strong><span>${fmt(p.price)}</span></div>
            <button type="button" class="btn btn--primary" id="sticky-add" ${status === 'out' ? 'disabled' : ''}>${t('product.addToCart')}</button>
        </div>`;
        wire(imgs, status);
    };

    function addNow() {
        if (!size) {
            const err = document.getElementById('size-err');
            if (err) { err.hidden = false; document.getElementById('size-opt').classList.add('shake'); setTimeout(() => document.getElementById('size-opt')?.classList.remove('shake'), 500); document.getElementById('size-opt').scrollIntoView({ block: 'center', behavior: 'smooth' }); }
            return;
        }
        addProductToCart(p, color, size, qty);
    }

    function wire(imgs, status) {
        root.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
            color = b.dataset.color;
            if (size && variantStock(p, color, size) <= 0) size = null;
            qty = 1; draw();
        }));
        root.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { size = b.dataset.size; qty = 1; draw(); }));
        root.querySelectorAll('.g-thumb').forEach(b => b.addEventListener('click', () => {
            imgIdx = Number(b.dataset.i);
            document.getElementById('g-img').src = imgs[imgIdx];
            root.querySelectorAll('.g-thumb').forEach((x, i) => { x.classList.toggle('is-on', i === imgIdx); x.setAttribute('aria-selected', String(i === imgIdx)); });
        }));

        const max = () => (size ? variantStock(p, color, size) : 99);
        document.getElementById('q-dec').addEventListener('click', () => { qty = Math.max(1, qty - 1); document.getElementById('q-val').textContent = qty; });
        document.getElementById('q-inc').addEventListener('click', () => { qty = Math.min(max(), qty + 1); document.getElementById('q-val').textContent = qty; });
        document.getElementById('add-btn').addEventListener('click', addNow);
        document.getElementById('sticky-add')?.addEventListener('click', addNow);
        document.getElementById('pdp-wish').addEventListener('click', (e) => {
            const on = toggleWishlist(p.id);
            e.currentTarget.classList.toggle('is-on', on);
            e.currentTarget.setAttribute('aria-pressed', String(on));
            e.currentTarget.querySelector('path').setAttribute('fill', on ? 'currentColor' : 'none');
            toast(t(on ? 'toast.wishAdded' : 'toast.wishRemoved'));
        });
        document.getElementById('size-guide-btn')?.addEventListener('click', openSizeGuide);

        // hover zoom (desktop) + lightbox (click / tap)
        const main = document.getElementById('g-main');
        const img = document.getElementById('g-img');
        if (matchMedia('(hover: hover)').matches) {
            main.addEventListener('mousemove', (e) => {
                const b = main.getBoundingClientRect();
                img.style.transformOrigin = `${((e.clientX - b.left) / b.width) * 100}% ${((e.clientY - b.top) / b.height) * 100}%`;
                main.classList.add('zooming');
            });
            main.addEventListener('mouseleave', () => main.classList.remove('zooming'));
        }
        main.addEventListener('click', () => openLightbox(imgs, imgIdx));
        // swipe between photos on touch devices
        let sx = 0;
        main.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
        main.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - sx;
            if (Math.abs(dx) > 50) {
                imgIdx = (imgIdx + (dx < 0 ? 1 : -1) + imgs.length) % imgs.length;
                draw();
            }
        }, { passive: true });

        // sticky add-to-cart bar on small screens once the main button scrolls away
        const sticky = document.getElementById('sticky-buy');
        if (sticky && 'IntersectionObserver' in window) {
            new IntersectionObserver(([en]) => { sticky.hidden = en.isIntersecting || window.scrollY < 200; }, { threshold: 0 })
                .observe(document.getElementById('buy-row'));
        }
    }

    function openSizeGuide() {
        const d = document.createElement('dialog');
        d.className = 'sheet sheet--wide';
        d.setAttribute('aria-labelledby', 'sg-title');
        d.innerHTML = `<div class="sheet-inner"><button type="button" class="sheet-close" aria-label="${escapeHtml(t('common.close'))}">×</button>
            <h2 id="sg-title">${t('sizeguide.title')}</h2><p>${t('sizeguide.intro')}</p>${sizeTableHTML()}<p><a href="/size-guide">${t('sizeguide.fullGuide')}</a></p></div>`;
        document.body.appendChild(d);
        d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('.sheet-close')) d.close(); });
        d.addEventListener('close', () => d.remove());
        d.showModal();
    }
    function openLightbox(imgs, i) {
        const d = document.createElement('dialog');
        d.className = 'lightbox';
        d.setAttribute('aria-label', loc(p.name));
        d.innerHTML = `<button type="button" class="sheet-close" aria-label="${escapeHtml(t('common.close'))}">×</button><img src="${imgs[i]}" alt="${escapeHtml(loc(p.name))}">`;
        document.body.appendChild(d);
        d.addEventListener('click', () => d.close());
        d.addEventListener('close', () => d.remove());
        d.showModal();
    }

    draw();

    // ── reviews ──
    const revSec = document.getElementById('reviews');
    revSec.hidden = false;
    const sum = document.getElementById('rev-summary');
    if (reviews.length) {
        const avg = reviews.reduce((s, x) => s + x.rating, 0) / reviews.length;
        sum.innerHTML = `<p class="rev-avg">${avg.toFixed(1)}</p>${starsHTML(avg)}<p>${t('reviews.based', { n: reviews.length })}</p>`;
    } else sum.innerHTML = `<p>${t('reviews.none')}</p>`;
    document.getElementById('rev-list').innerHTML = reviews.map(x => `
        <li class="rev"><div class="rev-top"><strong>${escapeHtml(x.name)}</strong>${starsHTML(x.rating)}<time>${formatDate(x.createdAt)}</time></div><p>${escapeHtml(x.text)}</p></li>`).join('');
    document.getElementById('rev-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target, msg = document.getElementById('rev-msg');
        const rating = Number(f.rating.value);
        if (!rating || !f.name.value.trim() || !f.text.value.trim()) { msg.textContent = t('reviews.fillAll'); msg.className = 'form-msg err'; return; }
        try {
            await addReview({ productId: p.id, name: f.name.value.trim().slice(0, 60), text: f.text.value.trim().slice(0, 1000), rating });
            msg.textContent = t('reviews.thanks'); msg.className = 'form-msg ok';
            f.reset();
        } catch { msg.textContent = t('common.error'); msg.className = 'form-msg err'; }
    });

    // ── related ──
    const all = await getProducts();
    const same = all.filter(x => x.id !== p.id && x.category === p.category);
    const others = all.filter(x => x.id !== p.id && x.category !== p.category);
    const rel = [...same, ...others].slice(0, 4);
    if (rel.length) {
        document.getElementById('related').hidden = false;
        document.getElementById('related-grid').innerHTML = rel.map(x => productCard(x, { ratings })).join('');
    }
    initReveal();
}
