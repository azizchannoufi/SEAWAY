// ============================================================
// SEAWAY - Cookie consent + marketing pixels (GDPR friendly)
// Pixels (GA4, Meta, TikTok) only load AFTER the visitor consents.
// IDs are set in Admin > Settings > Marketing.
// ============================================================
import { STORAGE_KEYS } from './config.js';

let ids = { metaPixelId: '', tiktokPixelId: '', ga4Id: '' };
let loaded = { analytics: false, marketing: false };

export function getConsent() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.consent)); } catch { return null; }
}
export function saveConsent(c) {
    const v = { necessary: true, analytics: !!c.analytics, marketing: !!c.marketing, ts: Date.now() };
    localStorage.setItem(STORAGE_KEYS.consent, JSON.stringify(v));
    applyConsent();
    return v;
}

export function initAnalytics(marketing) {
    ids = { ...ids, ...marketing };
    applyConsent();
}

function script(src, attrs = {}) {
    const s = document.createElement('script');
    s.async = true; s.src = src;
    Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v));
    document.head.appendChild(s);
}

function applyConsent() {
    const c = getConsent();
    if (!c) return;
    if (c.analytics && !loaded.analytics && ids.ga4Id) {
        loaded.analytics = true;
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        window.gtag('config', ids.ga4Id);
        script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.ga4Id)}`);
    }
    if (c.marketing && !loaded.marketing) {
        loaded.marketing = true;
        if (ids.metaPixelId) {
            /* eslint-disable */
            !function (f, b, e, v, n, t, s) {
                if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
                if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
                t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
            }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
            /* eslint-enable */
            window.fbq('init', ids.metaPixelId);
            window.fbq('track', 'PageView');
        }
        if (ids.tiktokPixelId) {
            /* eslint-disable */
            !function (w, d, t) {
                w.TiktokAnalyticsObject = t; var ttq = w[t] = w[t] || [];
                ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
                ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); }; };
                for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
                ttq.load = function (e) {
                    var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
                    ttq._i = ttq._i || {}; ttq._i[e] = []; ttq._t = ttq._t || {}; ttq._t[e] = +new Date();
                    var o = d.createElement('script'); o.type = 'text/javascript'; o.async = !0; o.src = i + '?sdkid=' + e + '&lib=' + t;
                    var a = d.getElementsByTagName('script')[0]; a.parentNode.insertBefore(o, a);
                };
                ttq.load(ids.tiktokPixelId); ttq.page();
            }(window, document, 'ttq');
            /* eslint-enable */
        }
    }
}

/** Fire an e-commerce event on every loaded pixel. */
export function track(event, data = {}) {
    const { value, currency = 'EUR', items = [] } = data;
    try {
        if (window.gtag) {
            const map = { ViewContent: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', Purchase: 'purchase' };
            window.gtag('event', map[event] || event, { value, currency, items: items.map(i => ({ item_id: i.id, item_name: i.name, quantity: i.qty || 1, price: i.price })) });
        }
        if (window.fbq) window.fbq('track', event, { value, currency, content_ids: items.map(i => i.id), content_type: 'product' });
        if (window.ttq) {
            const map = { ViewContent: 'ViewContent', AddToCart: 'AddToCart', InitiateCheckout: 'InitiateCheckout', Purchase: 'CompletePayment' };
            window.ttq.track(map[event] || event, { value, currency, contents: items.map(i => ({ content_id: i.id, quantity: i.qty || 1, price: i.price })) });
        }
    } catch { /* never break the shop because of a pixel */ }
}
