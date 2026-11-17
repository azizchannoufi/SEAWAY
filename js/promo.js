// ============================================================
// SEAWAY - Promo code state shared by cart drawer & checkout
// ============================================================
import { getPromo } from './db.js';
import { promoStatus } from './pricing.js';

const KEY = 'seaway_promo';
export const storedPromoCode = () => sessionStorage.getItem(KEY) || '';
export const clearPromo = () => { sessionStorage.removeItem(KEY); window.dispatchEvent(new Event('promo:updated')); };

/** Validates a code against the subtotal (EUR). Stores it when valid. */
export async function applyPromo(code, subtotal) {
    const c = String(code || '').trim().toUpperCase();
    if (!c) return { ok: false, reason: 'invalid' };
    let promo = null;
    try { promo = await getPromo(c); } catch { promo = null; }
    const st = promoStatus(promo, subtotal);
    if (!st.ok) {
        // a code that only fails the minimum is still remembered so it applies once the cart qualifies
        if (st.reason === 'min') { sessionStorage.setItem(KEY, c); window.dispatchEvent(new Event('promo:updated')); }
        return { ...st, promo };
    }
    sessionStorage.setItem(KEY, c);
    window.dispatchEvent(new Event('promo:updated'));
    return { ok: true, promo };
}

/** Returns the stored promo document (or null) without side effects. */
export async function loadStoredPromo() {
    const c = storedPromoCode();
    if (!c) return null;
    try { return await getPromo(c); } catch { return null; }
}
