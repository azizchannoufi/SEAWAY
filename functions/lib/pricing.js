// Server-side copy of /js/pricing.js (CommonJS). Keep the two files in sync:
// the browser shows these numbers, this file is the one that actually charges.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const cartSubtotal = (items) => round2(items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0));

function promoStatus(promo, subtotal) {
    if (!promo || promo.active === false) return { ok: false, reason: 'invalid' };
    if (promo.expiresAt && Date.now() > Number(promo.expiresAt)) return { ok: false, reason: 'expired' };
    if (promo.maxUses > 0 && (promo.uses || 0) >= promo.maxUses) return { ok: false, reason: 'used_up' };
    if (promo.minSubtotal > 0 && subtotal < promo.minSubtotal) return { ok: false, reason: 'min' };
    return { ok: true };
}

function promoDiscount(promo, subtotal) {
    if (!promo) return 0;
    if (promo.type === 'percent') return round2(subtotal * Math.min(100, Math.max(0, promo.value)) / 100);
    if (promo.type === 'fixed') return round2(Math.min(subtotal, Math.max(0, promo.value)));
    return 0;
}

function findZone(zones, country) {
    const c = String(country || '').toUpperCase();
    return zones.find((z) => (z.countries || []).includes(c)) || zones.find((z) => (z.countries || []).includes('*')) || null;
}

function shippingFor({ zones, country, subtotalAfterDiscount, promo }) {
    const zone = findZone(zones, country);
    if (!zone) return { cost: 0, free: false };
    const free = promo?.type === 'freeship' || (zone.freeAbove > 0 && subtotalAfterDiscount >= zone.freeAbove);
    return { cost: free ? 0 : round2(zone.rate), free };
}

function computeTotals({ items, promo, country, zones }) {
    const subtotal = cartSubtotal(items);
    const applied = promo && promoStatus(promo, subtotal).ok ? promo : null;
    const discount = promoDiscount(applied, subtotal);
    const after = round2(subtotal - discount);
    const ship = shippingFor({ zones, country, subtotalAfterDiscount: after, promo: applied });
    return { subtotal, discount, promo: applied, shippingCost: ship.cost, total: round2(after + ship.cost) };
}

// Used only if settings/shipping has not been saved yet (mirrors DEFAULT_SETTINGS in js/config.js)
const DEFAULT_ZONES = [
    { code: 'TN', countries: ['TN'], rate: 2.5, freeAbove: 60 },
    { code: 'FR', countries: ['FR'], rate: 5.9, freeAbove: 90 },
    { code: 'EU', countries: ['DE', 'IT', 'ES', 'BE', 'NL', 'PT', 'LU', 'AT', 'IE', 'GR'], rate: 8.9, freeAbove: 120 },
    { code: 'INT', countries: ['*'], rate: 15, freeAbove: 200 }
];
const DEFAULT_RATES = { EUR: 1, TND: 3.35, USD: 1.08 };

module.exports = { round2, cartSubtotal, promoStatus, promoDiscount, findZone, shippingFor, computeTotals, DEFAULT_ZONES, DEFAULT_RATES };
