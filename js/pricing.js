// ============================================================
// SEAWAY - Pure pricing rules (cart totals, promo codes, shipping)
// All amounts are in the base currency (EUR). The same rules are
// re-applied server-side in functions/index.js before charging.
// ============================================================

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function cartSubtotal(items) {
    return round2(items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0));
}

/** @returns {{ok:boolean, reason?:string}} */
export function promoStatus(promo, subtotal) {
    if (!promo) return { ok: false, reason: 'invalid' };
    if (promo.active === false) return { ok: false, reason: 'invalid' };
    if (promo.expiresAt && Date.now() > Number(promo.expiresAt)) return { ok: false, reason: 'expired' };
    if (promo.maxUses > 0 && (promo.uses || 0) >= promo.maxUses) return { ok: false, reason: 'used_up' };
    if (promo.minSubtotal > 0 && subtotal < promo.minSubtotal) return { ok: false, reason: 'min', min: promo.minSubtotal };
    return { ok: true };
}

export function promoDiscount(promo, subtotal) {
    if (!promo) return 0;
    if (promo.type === 'percent') return round2(subtotal * Math.min(100, Math.max(0, promo.value)) / 100);
    if (promo.type === 'fixed') return round2(Math.min(subtotal, Math.max(0, promo.value)));
    return 0;
}

export function findZone(zones, country) {
    const c = String(country || '').toUpperCase();
    return zones.find(z => z.countries.includes(c)) || zones.find(z => z.countries.includes('*')) || null;
}

export function shippingFor({ zones, country, subtotalAfterDiscount, promo }) {
    const zone = findZone(zones, country);
    if (!zone) return { cost: 0, zone: null, free: false };
    const freePromo = promo?.type === 'freeship';
    const freeThreshold = zone.freeAbove > 0 && subtotalAfterDiscount >= zone.freeAbove;
    const free = freePromo || freeThreshold;
    return { cost: free ? 0 : round2(zone.rate), zone, free };
}

export function computeTotals({ items, promo, country, shippingSettings }) {
    const subtotal = cartSubtotal(items);
    const status = promo ? promoStatus(promo, subtotal) : { ok: false };
    const applied = status.ok ? promo : null;
    const discount = promoDiscount(applied, subtotal);
    const after = round2(subtotal - discount);
    const ship = shippingFor({ zones: shippingSettings.zones, country, subtotalAfterDiscount: after, promo: applied });
    return {
        subtotal, discount, promo: applied, promoStatus: promo ? status : null,
        shippingCost: ship.cost, shippingFree: ship.free, zone: ship.zone,
        total: round2(after + ship.cost)
    };
}
