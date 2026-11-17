// ============================================================
// SEAWAY - Multi-currency (EUR base, rates editable in admin)
// ============================================================
import { CURRENCIES, STORAGE_KEYS } from './config.js';
import { getSettings } from './db.js';
import { getLang } from './i18n.js';

let cfg = { rates: { EUR: 1 }, enabled: ['EUR'], default: 'EUR' };
let current = 'EUR';

export async function initMoney() {
    cfg = await getSettings('currency');
    const saved = localStorage.getItem(STORAGE_KEYS.currency);
    current = cfg.enabled.includes(saved) ? saved : cfg.default;
}
export const getCurrency = () => current;
export const enabledCurrencies = () => cfg.enabled;
export const getRate = (c = current) => cfg.rates[c] || 1;
export function setCurrency(c) {
    if (!cfg.enabled.includes(c)) return;
    localStorage.setItem(STORAGE_KEYS.currency, c);
    location.reload();
}
export const convert = (eur, c = current) => Number(eur) * getRate(c);

/** Format an amount given in EUR into the selected (or given) currency. */
export function fmt(eur, c = current, rate = null) {
    const val = Number(eur) * (rate || getRate(c));
    return fmtRaw(val, c);
}
export function fmtRaw(val, c = current) {
    const meta = CURRENCIES[c] || CURRENCIES.EUR;
    const locale = (getLang() === 'ar' ? 'ar-TN' : meta.locale) + '-u-nu-latn';
    const num = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);
    if (c === 'EUR') return `${num} €`;
    if (c === 'USD') return `$${num}`;
    return `${num} ${meta.symbol}`;
}
