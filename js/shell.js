// ============================================================
// SEAWAY - Storefront shell
// Header, footer, cart drawer, cookie banner, newsletter pop-up,
// SEO helpers. Every storefront page calls bootStore().
// ============================================================
import { SITE, LANGS, STORAGE_KEYS } from './config.js';
import { initI18n, t, loc, getLang, setLang, applyI18n, escapeHtml } from './i18n.js';
import { initMoney, fmt, getCurrency, enabledCurrencies, setCurrency } from './money.js';
import { getSettings, getCategories, getProducts, subscribe, isDemo } from './db.js';
import { getCart, cartCount, setQty, removeItem, syncCart, getWishlist } from './cart.js';
import { cartSubtotal, promoStatus, promoDiscount, findZone } from './pricing.js';
import { storedPromoCode, applyPromo, clearPromo, loadStoredPromo } from './promo.js';
import { getConsent, saveConsent, initAnalytics } from './analytics.js';
import { initCardActions, initReveal, toast, productUrl, collectionUrl, sizeLabel } from './ui.js';
import { productThumb, colorHex } from './catalog.js';

const $ = (s, r = document) => r.querySelector(s);
const ICON = {
    bag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    heart: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.2-9.3C1.600 7.900 3.600 5 6.700 5c1.900 0 3.600 1 5.300 3 1.700-2 3.400-3 5.300-3 3.100 0 5.100 2.900 3.900 6.200-1.700 4.700-9.200 9.300-9.200 9.300z"/></svg>',
    user: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>',
    menu: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    ig: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.500" cy="6.500" r="1" fill="currentColor"/></svg>',
    tt: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v11.500a3.500 3.500 0 1 1-3.500-3.500"/><path d="M14 3c.4 2.600 2 4.200 5 4.500"/></svg>',
    fb: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.500c0-.3.200-.5.500-.5z"/></svg>'
};

export const ctx = { store: null, marketing: null, categories: [], products: [] };

// ════════════════════════════════════════════════════════════
// SEO
// ════════════════════════════════════════════════════════════
function setMeta(attr, key, value) {
    if (!value) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', value);
}
export function setSEO({ title, description, image, type = 'website', path, jsonLd } = {}) {
    const full = title ? `${title} — ${SITE.name}` : `${SITE.name} — ${t('brand.tagline')}`;
    document.title = full;
    const desc = description || t('seo.defaultDescription');
    const url = SITE.url.replace(/\/$/, '') + (path ?? location.pathname);
    const img = image || SITE.url.replace(/\/$/, '') + '/assets/img/og-image.jpg';
    setMeta('name', 'description', desc);
    setMeta('property', 'og:title', full);
    setMeta('property', 'og:description', desc);
    setMeta('property', 'og:type', type);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', img);
    setMeta('property', 'og:site_name', SITE.name);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', full);
    setMeta('name', 'twitter:description', desc);
    setMeta('name', 'twitter:image', img);
    let can = document.head.querySelector('link[rel="canonical"]');
    if (!can) { can = document.createElement('link'); can.rel = 'canonical'; document.head.appendChild(can); }
    can.href = url;
    if (jsonLd) {
        let s = document.getElementById('jsonld');
        if (!s) { s = document.createElement('script'); s.type = 'application/ld+json'; s.id = 'jsonld'; document.head.appendChild(s); }
        s.textContent = JSON.stringify(jsonLd);
    }
}

// ════════════════════════════════════════════════════════════
// HEADER / FOOTER
// ════════════════════════════════════════════════════════════
function headerHTML() {
    const s = ctx.store;
    const ann = s.announcement?.enabled ? loc(s.announcement.text) : '';
    const cats = ctx.categories;
    const cur = getCurrency();
    return `
    <a class="skip" href="#main">${t('nav.skip')}</a>
    ${ann ? `<div class="announce"><p>${escapeHtml(ann)}</p></div>` : ''}
    <header class="header" id="hdr">
        <div class="header-in">
            <button type="button" class="icon-btn menu-btn" id="menu-btn" aria-expanded="false" aria-controls="mnav" aria-label="${escapeHtml(t('nav.menu'))}">${ICON.menu}</button>
            <a class="logo" href="/" aria-label="Seaway — ${escapeHtml(t('nav.home'))}">
                <img class="logo-dark" src="/assets/img/logo-seaway.png" alt="Seaway" width="180" height="20">
                <img class="logo-light" src="/assets/img/logo-seaway-light.png" alt="" width="180" height="20" aria-hidden="true">
            </a>
            <nav class="nav" aria-label="${escapeHtml(t('nav.main'))}">
                <a href="/shop">${t('nav.shop')}</a>
                <div class="nav-dd">
                    <a href="/collections" aria-haspopup="true">${t('nav.collections')}</a>
                    <div class="dd-panel">
                        ${cats.map(c => `<a href="${collectionUrl(c)}">${escapeHtml(loc(c.name))}</a>`).join('')}
                    </div>
                </div>
                <a href="/story">${t('nav.story')}</a>
                <a href="/contact">${t('nav.contact')}</a>
            </nav>
            <div class="actions">
                <div class="locale">
                    <button type="button" class="icon-btn locale-btn" id="locale-btn" aria-expanded="false" aria-controls="locale-pop" aria-label="${escapeHtml(t('locale.title'))}">${ICON.globe}<span class="locale-txt">${getLang().toUpperCase()} · ${cur}</span></button>
                    <div class="locale-pop" id="locale-pop" hidden>
                        <p class="lp-title">${t('locale.language')}</p>
                        <div class="lp-row">${LANGS.map(l => `<button type="button" data-lang="${l.code}" class="${l.code === getLang() ? 'is-on' : ''}" lang="${l.code}">${l.label}</button>`).join('')}</div>
                        <p class="lp-title">${t('locale.currency')}</p>
                        <div class="lp-row">${enabledCurrencies().map(c => `<button type="button" data-cur="${c}" class="${c === cur ? 'is-on' : ''}">${c}</button>`).join('')}</div>
                    </div>
                </div>
                <a class="icon-btn" href="/account" aria-label="${escapeHtml(t('nav.account'))}">${ICON.user}</a>
                <a class="icon-btn has-count" href="/wishlist" aria-label="${escapeHtml(t('nav.wishlist'))}">${ICON.heart}<span class="count" id="wish-count" hidden>0</span></a>
                <button type="button" class="icon-btn has-count" id="cart-btn" aria-label="${escapeHtml(t('nav.cart'))}" aria-haspopup="dialog">${ICON.bag}<span class="count" id="cart-count" hidden>0</span></button>
            </div>
        </div>
    </header>
    <div class="mnav" id="mnav" hidden>
        <nav aria-label="${escapeHtml(t('nav.menu'))}">
            <a href="/shop">${t('nav.shop')}</a>
            <a href="/collections">${t('nav.collections')}</a>
            <div class="mnav-sub">${cats.map(c => `<a href="${collectionUrl(c)}">${escapeHtml(loc(c.name))}</a>`).join('')}</div>
            <a href="/story">${t('nav.story')}</a>
            <a href="/contact">${t('nav.contact')}</a>
            <a href="/faq">${t('link.faq')}</a>
            <a href="/account">${t('nav.account')}</a>
            <a href="/wishlist">${t('nav.wishlist')}</a>
        </nav>
    </div>`;
}

function footerHTML() {
    const s = ctx.store;
    const social = [
        s.instagram && `<a href="${escapeHtml(s.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${ICON.ig}</a>`,
        s.tiktok && `<a href="${escapeHtml(s.tiktok)}" target="_blank" rel="noopener" aria-label="TikTok">${ICON.tt}</a>`,
        s.facebook && `<a href="${escapeHtml(s.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${ICON.fb}</a>`
    ].filter(Boolean).join('');
    return `
    <footer class="footer">
        <div class="wrap footer-grid">
            <div class="f-brand">
                <img src="/assets/img/emblem.webp" alt="Seaway — Mediterranean sea spirit" width="120" height="120" loading="lazy">
                <p class="f-tag">${t('brand.tagline')}</p>
                <div class="social">${social}</div>
            </div>
            <div>
                <h2 class="f-h">${t('footer.shop')}</h2>
                <ul>
                    <li><a href="/shop">${t('footer.allProducts')}</a></li>
                    ${ctx.categories.slice(0, 5).map(c => `<li><a href="${collectionUrl(c)}">${escapeHtml(loc(c.name))}</a></li>`).join('')}
                </ul>
            </div>
            <div>
                <h2 class="f-h">${t('footer.help')}</h2>
                <ul>
                    <li><a href="/faq">${t('link.faq')}</a></li>
                    <li><a href="/shipping">${t('link.shipping')}</a></li>
                    <li><a href="/size-guide">${t('link.sizeGuide')}</a></li>
                    <li><a href="/contact">${t('link.contact')}</a></li>
                    <li><a href="/account">${t('nav.account')}</a></li>
                </ul>
            </div>
            <div>
                <h2 class="f-h">${t('footer.company')}</h2>
                <ul>
                    <li><a href="/story">${t('link.story')}</a></li>
                    <li><a href="/terms">${t('link.terms')}</a></li>
                    <li><a href="/privacy">${t('link.privacy')}</a></li>
                    <li><a href="/cookies">${t('link.cookies')}</a></li>
                    <li><button type="button" class="linklike" data-cookie-settings>${t('footer.cookieSettings')}</button></li>
                </ul>
            </div>
            <form class="f-news" id="footer-news" novalidate>
                <h2 class="f-h">${t('footer.newsletterTitle')}</h2>
                <p>${t('footer.newsletterText')}</p>
                <div class="inline-form">
                    <label class="sr" for="fn-email">${t('footer.emailPlaceholder')}</label>
                    <input id="fn-email" type="email" autocomplete="email" required placeholder="${escapeHtml(t('footer.emailPlaceholder'))}">
                    <button type="submit" class="btn btn--light">${t('footer.subscribe')}</button>
                </div>
                <p class="form-msg" role="status" aria-live="polite"></p>
            </form>
        </div>
        <div class="wrap f-bottom">
            <p>© ${new Date().getFullYear()} Seaway. ${t('footer.rights')}</p>
            <p class="pay">${t('footer.payments')}</p>
            ${isDemo ? `<p class="demo-note">${t('footer.demo')}</p>` : ''}
        </div>
    </footer>`;
}

// ════════════════════════════════════════════════════════════
// CART DRAWER
// ════════════════════════════════════════════════════════════
let drawerOpener = null;
function mountDrawer() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
    <div class="overlay" id="overlay" hidden></div>
    <aside class="drawer" id="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden>
        <div class="drawer-head">
            <h2 id="drawer-title">${t('cart.title')}</h2>
            <button type="button" class="icon-btn" id="drawer-close" aria-label="${escapeHtml(t('common.close'))}">${ICON.close}</button>
        </div>
        <div class="drawer-body" id="drawer-body"></div>
        <div class="drawer-foot" id="drawer-foot"></div>
    </aside>`;
    document.body.append(...wrap.children);

    $('#cart-btn').addEventListener('click', () => openDrawer($('#cart-btn')));
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#overlay').addEventListener('click', () => { closeDrawer(); closeMenu(); });
    window.addEventListener('cart:open', () => openDrawer());
    window.addEventListener('cart:updated', () => { updateCounts(); if (!$('#cart-drawer').hidden) renderDrawer(); });
    window.addEventListener('promo:updated', () => { if (!$('#cart-drawer').hidden) renderDrawer(); });
    window.addEventListener('wishlist:updated', updateCounts);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { closeDrawer(); closeMenu(); closeLocale(); }
        if (e.key === 'Tab' && !$('#cart-drawer').hidden) trapFocus(e, $('#cart-drawer'));
    });
}
function trapFocus(e, root) {
    const f = [...root.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el => !el.hidden && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
async function openDrawer(opener) {
    drawerOpener = opener || document.activeElement;
    await renderDrawer();
    $('#overlay').hidden = false;
    $('#cart-drawer').hidden = false;
    requestAnimationFrame(() => { $('#overlay').classList.add('on'); $('#cart-drawer').classList.add('on'); });
    document.body.classList.add('no-scroll');
    $('#drawer-close').focus();
}
function closeDrawer() {
    const d = $('#cart-drawer');
    if (!d || d.hidden) return;
    d.classList.remove('on'); $('#overlay').classList.remove('on');
    setTimeout(() => { d.hidden = true; if ($('#mnav').hidden) $('#overlay').hidden = true; }, 250);
    document.body.classList.remove('no-scroll');
    drawerOpener?.focus?.();
}

export function guessCountry() {
    const saved = localStorage.getItem('seaway_country');
    if (saved) return saved;
    return { ar: 'TN', fr: 'FR', it: 'IT', en: 'FR' }[getLang()] || 'FR';
}

async function renderDrawer() {
    const body = $('#drawer-body'), foot = $('#drawer-foot');
    ctx.products = await getProducts({ includeInactive: true });
    const items = syncCart(ctx.products);
    if (!items.length) {
        body.innerHTML = `<div class="drawer-empty"><p>${t('cart.empty')}</p><a class="btn btn--primary" href="/shop">${t('cart.emptyCta')}</a></div>`;
        foot.innerHTML = '';
        return;
    }
    body.innerHTML = `<ul class="cart-list">${items.map(it => {
        const p = ctx.products.find(x => x.id === it.productId);
        const img = p ? productThumb(p, it.color) : '';
        return `<li class="cart-item" data-key="${escapeHtml(it.key)}">
            <a href="${productUrl(it)}"><img src="${img}" alt="${escapeHtml(loc(it.name))}" width="80" height="100" loading="lazy"></a>
            <div class="ci-info">
                <a class="ci-name" href="${productUrl(it)}">${escapeHtml(loc(it.name))}</a>
                <p class="ci-var"><span class="dot" style="--c:${colorHex(it.color)}"></span>${escapeHtml(t('color.' + it.color))} · ${escapeHtml(sizeLabel(it.size))}</p>
                <div class="ci-row">
                    <div class="qty" role="group" aria-label="${escapeHtml(t('cart.qty'))}">
                        <button type="button" data-dec aria-label="${escapeHtml(t('cart.decrease'))}">−</button>
                        <output aria-live="polite">${it.qty}</output>
                        <button type="button" data-inc aria-label="${escapeHtml(t('cart.increase'))}" ${it.qty >= it.max ? 'disabled' : ''}>+</button>
                    </div>
                    <span class="ci-price">${fmt(it.price * it.qty)}</span>
                </div>
                <button type="button" class="linklike ci-remove" data-remove>${t('cart.remove')}</button>
            </div>
        </li>`;
    }).join('')}</ul>`;

    const subtotal = cartSubtotal(items);
    const promoDoc = await loadStoredPromo();
    const pst = promoDoc ? promoStatus(promoDoc, subtotal) : null;
    const discount = pst?.ok ? promoDiscount(promoDoc, subtotal) : 0;
    const shipping = await getSettings('shipping');
    const zone = findZone(shipping.zones, guessCountry());
    let bar = '';
    if (zone?.freeAbove > 0) {
        const left = Math.max(0, zone.freeAbove - (subtotal - discount));
        const pct = Math.min(100, ((subtotal - discount) / zone.freeAbove) * 100);
        bar = `<div class="ship-bar"><p>${left > 0 ? t('cart.freeShipAway', { amount: fmt(left) }) : t('cart.freeShipReached')}</p><div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }
    const code = storedPromoCode();
    const promoMsg = pst && !pst.ok ? t(pst.reason === 'min' ? 'cart.promoMin' : pst.reason === 'expired' ? 'cart.promoExpired' : pst.reason === 'used_up' ? 'cart.promoUsedUp' : 'cart.promoInvalid', { min: fmt(promoDoc?.minSubtotal || 0) }) : '';
    foot.innerHTML = `
        ${bar}
        <form class="promo" id="promo-form" novalidate>
            ${pst?.ok ? `<p class="promo-on">${t('cart.promoApplied', { code })} <button type="button" class="linklike" data-promo-remove>${t('cart.promoRemove')}</button></p>` : `
            <label class="sr" for="promo-input">${t('cart.promoLabel')}</label>
            <div class="inline-form"><input id="promo-input" type="text" autocomplete="off" autocapitalize="characters" placeholder="${escapeHtml(t('cart.promoPlaceholder'))}" value="${escapeHtml(code)}"><button type="submit" class="btn btn--ghost">${t('cart.promoApply')}</button></div>
            <p class="form-msg err" role="alert">${escapeHtml(promoMsg)}</p>`}
        </form>
        <dl class="totals">
            <div><dt>${t('cart.subtotal')}</dt><dd>${fmt(subtotal)}</dd></div>
            ${discount ? `<div class="disc"><dt>${t('cart.discount')}</dt><dd>−${fmt(discount)}</dd></div>` : ''}
        </dl>
        <p class="note">${t('cart.shippingNote')}</p>
        <a class="btn btn--primary btn--block" href="/checkout">${t('cart.checkout')}</a>
        <button type="button" class="linklike center" id="drawer-continue">${t('cart.continue')}</button>`;

    body.querySelectorAll('.cart-item').forEach(li => {
        const key = li.dataset.key;
        const it = items.find(i => i.key === key);
        li.querySelector('[data-dec]').addEventListener('click', () => setQty(key, it.qty - 1));
        li.querySelector('[data-inc]').addEventListener('click', () => setQty(key, it.qty + 1));
        li.querySelector('[data-remove]').addEventListener('click', () => removeItem(key));
    });
    $('#drawer-continue').addEventListener('click', closeDrawer);
    $('#promo-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = $('#promo-input')?.value;
        if (!v) return;
        const r = await applyPromo(v, subtotal);
        if (!r.ok && r.reason !== 'min') {
            const msg = { expired: 'cart.promoExpired', used_up: 'cart.promoUsedUp' }[r.reason] || 'cart.promoInvalid';
            $('#promo-form .form-msg').textContent = t(msg);
        }
    });
    $('[data-promo-remove]')?.addEventListener('click', clearPromo);
}

function updateCounts() {
    const c = cartCount(), w = getWishlist().length;
    const cc = $('#cart-count'), wc = $('#wish-count');
    if (cc) { cc.textContent = c > 99 ? '99+' : c; cc.hidden = c === 0; }
    if (wc) { wc.textContent = w; wc.hidden = w === 0; }
}

// ════════════════════════════════════════════════════════════
// MENU / LOCALE / HEADER BEHAVIOUR
// ════════════════════════════════════════════════════════════
function closeMenu() {
    const m = $('#mnav');
    if (!m || m.hidden) return;
    m.hidden = true;
    $('#menu-btn').setAttribute('aria-expanded', 'false');
    document.body.classList.remove('no-scroll', 'menu-open');
}
function closeLocale() {
    const p = $('#locale-pop');
    if (p && !p.hidden) { p.hidden = true; $('#locale-btn').setAttribute('aria-expanded', 'false'); }
}
function wireHeader({ hero }) {
    const hdr = $('#hdr');
    const onScroll = () => hdr.classList.toggle('is-solid', window.scrollY > 24 || !hero);
    onScroll();
    if (hero) document.body.classList.add('has-hero');
    window.addEventListener('scroll', onScroll, { passive: true });

    $('#menu-btn').addEventListener('click', () => {
        const m = $('#mnav');
        const open = m.hidden;
        m.hidden = !open;
        $('#menu-btn').setAttribute('aria-expanded', String(open));
        document.body.classList.toggle('no-scroll', open);
        document.body.classList.toggle('menu-open', open);
        hdr.classList.toggle('is-solid', open || window.scrollY > 24 || !hero);
    });
    $('#mnav').addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });

    $('#locale-btn').addEventListener('click', () => {
        const p = $('#locale-pop');
        p.hidden = !p.hidden;
        $('#locale-btn').setAttribute('aria-expanded', String(!p.hidden));
    });
    $('#locale-pop').addEventListener('click', (e) => {
        const l = e.target.closest('[data-lang]'), c = e.target.closest('[data-cur]');
        if (l) setLang(l.dataset.lang);
        if (c) setCurrency(c.dataset.cur);
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('.locale')) closeLocale(); });
}

// ════════════════════════════════════════════════════════════
// NEWSLETTER (footer + pop-up)
// ════════════════════════════════════════════════════════════
function wireFooterNewsletter() {
    const f = $('#footer-news');
    f?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = f.querySelector('.form-msg');
        try {
            await subscribe($('#fn-email').value, 'footer');
            msg.textContent = t('footer.subscribed'); msg.className = 'form-msg ok';
            f.reset();
        } catch { msg.textContent = t('common.invalidEmail'); msg.className = 'form-msg err'; }
    });
}

function maybeShowPopup() {
    const m = ctx.marketing;
    if (!m.popupEnabled) return;
    const page = document.body.dataset.page;
    if (['checkout', 'confirmation'].includes(page)) return;
    const seen = Number(localStorage.getItem(STORAGE_KEYS.popup) || 0);
    if (seen && Date.now() - seen < 30 * 86400000) return;
    setTimeout(() => {
        if (document.querySelector('dialog[open]') || !$('#cart-drawer').hidden || !getConsent()) {
            // wait for the cookie banner / other overlays, then try once more
            setTimeout(showPopup, 6000);
            return;
        }
        showPopup();
    }, Math.max(2, m.popupDelaySec || 8) * 1000);
}
function showPopup() {
    if (document.getElementById('news-popup') || document.querySelector('dialog[open]') || !getConsent()) return;
    const m = ctx.marketing;
    const d = document.createElement('dialog');
    d.id = 'news-popup'; d.className = 'sheet popup';
    d.setAttribute('aria-labelledby', 'np-title');
    d.innerHTML = `
    <div class="sheet-inner popup-in">
        <button type="button" class="sheet-close" data-close aria-label="${escapeHtml(t('common.close'))}">×</button>
        <img src="/assets/img/emblem.webp" alt="" width="84" height="84">
        <h2 id="np-title">${t('popup.title', { percent: m.popupPercent })}</h2>
        <p>${t('popup.text')}</p>
        <form id="np-form" novalidate>
            <label class="sr" for="np-email">${t('footer.emailPlaceholder')}</label>
            <input id="np-email" type="email" autocomplete="email" required placeholder="${escapeHtml(t('footer.emailPlaceholder'))}">
            <button class="btn btn--primary btn--block" type="submit">${t('popup.cta', { percent: m.popupPercent })}</button>
            <p class="form-msg" role="status" aria-live="polite"></p>
        </form>
        <button type="button" class="linklike center" data-close>${t('popup.dismiss')}</button>
    </div>`;
    document.body.appendChild(d);
    const done = () => { localStorage.setItem(STORAGE_KEYS.popup, String(Date.now())); d.close(); d.remove(); };
    d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) done(); });
    d.addEventListener('cancel', done);
    d.querySelector('#np-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = d.querySelector('.form-msg');
        try {
            await subscribe(d.querySelector('#np-email').value, 'popup');
            localStorage.setItem(STORAGE_KEYS.popup, String(Date.now()));
            d.querySelector('.sheet-inner').innerHTML = `
                <img src="/assets/img/emblem.webp" alt="" width="84" height="84">
                <h2>${t('popup.successTitle')}</h2>
                <p>${t('popup.success')}</p>
                <p class="promo-code" aria-label="${escapeHtml(t('popup.code'))}">${escapeHtml(m.popupCode)}</p>
                <button type="button" class="btn btn--primary btn--block" data-close>${t('popup.shopNow')}</button>`;
        } catch { msg.textContent = t('common.invalidEmail'); msg.className = 'form-msg err'; }
    });
    d.showModal();
}

// ════════════════════════════════════════════════════════════
// COOKIE BANNER (GDPR)
// ════════════════════════════════════════════════════════════
function showCookieBanner(force = false) {
    if (!force && getConsent()) return;
    document.getElementById('cookie')?.remove();
    const c = getConsent() || {};
    const el = document.createElement('div');
    el.id = 'cookie'; el.className = 'cookie';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-labelledby', 'ck-title');
    el.innerHTML = `
        <h2 id="ck-title">${t('cookie.title')}</h2>
        <p>${t('cookie.text')} <a href="/cookies">${t('link.cookies')}</a></p>
        <div class="ck-opts" hidden>
            <label><input type="checkbox" checked disabled> <span><strong>${t('cookie.necessary')}</strong> ${t('cookie.necessaryDesc')}</span></label>
            <label><input type="checkbox" id="ck-an" ${c.analytics ? 'checked' : ''}> <span><strong>${t('cookie.analytics')}</strong> ${t('cookie.analyticsDesc')}</span></label>
            <label><input type="checkbox" id="ck-mk" ${c.marketing ? 'checked' : ''}> <span><strong>${t('cookie.marketing')}</strong> ${t('cookie.marketingDesc')}</span></label>
        </div>
        <div class="ck-btns">
            <button type="button" class="btn btn--ghost" data-ck="reject">${t('cookie.reject')}</button>
            <button type="button" class="btn btn--ghost" data-ck="custom">${t('cookie.customize')}</button>
            <button type="button" class="btn btn--primary" data-ck="all">${t('cookie.acceptAll')}</button>
        </div>`;
    document.body.appendChild(el);
    const close = () => el.remove();
    el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-ck]');
        if (!b) return;
        if (b.dataset.ck === 'all') { saveConsent({ analytics: true, marketing: true }); close(); }
        if (b.dataset.ck === 'reject') { saveConsent({ analytics: false, marketing: false }); close(); }
        if (b.dataset.ck === 'custom') {
            const opts = el.querySelector('.ck-opts');
            if (opts.hidden) { opts.hidden = false; b.textContent = t('cookie.save'); }
            else { saveConsent({ analytics: el.querySelector('#ck-an').checked, marketing: el.querySelector('#ck-mk').checked }); close(); }
        }
    });
}

// ════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════
export async function bootStore({ page = '', hero = false } = {}) {
    document.body.dataset.page = page;
    await initI18n();
    await initMoney();
    const [store, marketing, categories] = await Promise.all([
        getSettings('store'), getSettings('marketing'), getCategories()
    ]);
    Object.assign(ctx, { store, marketing, categories });

    const hd = document.getElementById('site-header');
    const ft = document.getElementById('site-footer');
    hd.innerHTML = headerHTML();
    ft.innerHTML = footerHTML();
    // unwrap so skip-link / announcement / header are direct body children
    hd.replaceWith(...hd.childNodes);

    mountDrawer();
    wireHeader({ hero });
    wireFooterNewsletter();
    updateCounts();
    initCardActions();
    applyI18n();
    document.querySelector('[data-cookie-settings]')?.addEventListener('click', () => showCookieBanner(true));
    initAnalytics(marketing);
    showCookieBanner();
    maybeShowPopup();
    if (isDemo) document.body.classList.add('is-demo');
    initReveal();
    return ctx;
}

export { toast };
