// ============================================================
// SEAWAY - Internationalisation (EN / FR / IT / AR with RTL)
// Dictionaries live in js/lang/*.js and are loaded on demand.
// ============================================================
import { LANGS, SITE, STORAGE_KEYS } from './config.js';

let current = SITE.defaultLang;
let dict = {};
let fallback = {};

export const getLang = () => current;
export const langMeta = () => LANGS.find(l => l.code === current) || LANGS[0];
export const isRTL = () => langMeta().dir === 'rtl';

function detect() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && LANGS.some(l => l.code === q)) { localStorage.setItem(STORAGE_KEYS.lang, q); return q; }
    const saved = localStorage.getItem(STORAGE_KEYS.lang);
    if (saved && LANGS.some(l => l.code === saved)) return saved;
    for (const l of navigator.languages || [navigator.language || '']) {
        const code = String(l).slice(0, 2).toLowerCase();
        if (LANGS.some(x => x.code === code)) return code;
    }
    return SITE.defaultLang;
}

export async function initI18n() {
    current = detect();
    const [d, f] = await Promise.all([
        import(`./lang/${current}.js`),
        current === 'en' ? null : import('./lang/en.js')
    ]);
    dict = d.default;
    fallback = f ? f.default : dict;
    const meta = langMeta();
    document.documentElement.lang = meta.code;
    document.documentElement.dir = meta.dir;
    if (meta.code === 'ar') {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap';
        document.head.appendChild(link);
    }
    applyI18n();
}

export function setLang(code) {
    if (!LANGS.some(l => l.code === code)) return;
    localStorage.setItem(STORAGE_KEYS.lang, code);
    const u = new URL(location.href);
    u.searchParams.delete('lang');
    location.href = u.toString();
}

/** Raw value (string, array or object) */
export function tr(key) {
    return dict[key] ?? fallback[key] ?? undefined;
}

export function t(key, vars) {
    let s = tr(key);
    if (typeof s !== 'string') return s === undefined ? key : s;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
    return s;
}

/** Pick the current language from {en, fr, it, ar} content objects */
export function loc(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[current] || obj.en || obj.fr || Object.values(obj).find(Boolean) || '';
}

/**
 * data-i18n="key"                  -> textContent
 * data-i18n-html="key"             -> innerHTML (trusted dictionary only)
 * data-i18n-attr="placeholder:key; aria-label:key2"
 */
export function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-attr]').forEach(el => {
        el.dataset.i18nAttr.split(';').forEach(pair => {
            const [attr, key] = pair.split(':').map(s => s.trim());
            if (attr && key) el.setAttribute(attr, t(key));
        });
    });
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function formatDate(ts, opts = { day: '2-digit', month: 'short', year: 'numeric' }) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString(langMeta().locale + '-u-nu-latn', opts);
}
