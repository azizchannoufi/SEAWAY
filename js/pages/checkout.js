import { bootStore, ctx, setSEO, guessCountry } from '../shell.js';
import { getProducts, getSettings, createOrder, currentCustomer, isDemo, updateOrder } from '../db.js';
import { t, loc, escapeHtml, getLang } from '../i18n.js';
import { fmt, getCurrency, getRate } from '../money.js';
import { SITE, COUNTRIES, STORAGE_KEYS } from '../config.js';
import { getCart, syncCart, clearCart } from '../cart.js';
import { computeTotals, round2 } from '../pricing.js';
import { storedPromoCode, applyPromo, clearPromo, loadStoredPromo } from '../promo.js';
import { productThumb, colorHex } from '../catalog.js';
import { sizeLabel, toast } from '../ui.js';
import { track } from '../analytics.js';

await bootStore({ page: 'checkout' });
setSEO({ title: t('checkout.title'), path: '/checkout' });

const root = document.getElementById('checkout-root');
const [products, shippingCfg, payCfg, user] = await Promise.all([
    getProducts({ includeInactive: true }), getSettings('shipping'), getSettings('payments'), currentCustomer()
]);
let items = syncCart(products);

if (!items.length) {
    root.innerHTML = `<div class="notfound"><p>${t('cart.empty')}</p><a class="btn btn--primary" href="/shop">${t('cart.emptyCta')}</a></div>`;
} else {
    start();
}

function start() {
    let country = guessCountry();
    let promoDoc = null;
    let totals;
    const methods = [
        payCfg.cod?.enabled && 'cod',
        payCfg.stripe?.enabled && 'stripe',
        payCfg.paypal?.enabled && 'paypal'
    ].filter(Boolean);
    let method = methods[0] || 'cod';
    const prev = (() => { try { return JSON.parse(localStorage.getItem('seaway_checkout')) || {}; } catch { return {}; } })();

    root.innerHTML = `
    <div class="co-grid">
        <form id="co-form" class="co-form" novalidate>
            <section>
                <h2>${t('checkout.contact')}</h2>
                <div class="field"><label for="c-email">${t('checkout.email')}</label><input id="c-email" name="email" type="email" required autocomplete="email" value="${escapeHtml(user?.email || prev.email || '')}"></div>
                <div class="field"><label for="c-phone">${t('checkout.phone')}</label><input id="c-phone" name="phone" type="tel" required autocomplete="tel" value="${escapeHtml(prev.phone || '')}"></div>
                ${user ? '' : `<p class="hint">${t('checkout.guestNote')} <a href="/account">${t('checkout.haveAccount')}</a></p>`}
            </section>
            <section>
                <h2>${t('checkout.shipping')}</h2>
                <div class="field"><label for="c-name">${t('checkout.name')}</label><input id="c-name" name="name" required autocomplete="name" value="${escapeHtml(user?.name || prev.name || '')}"></div>
                <div class="field"><label for="c-address">${t('checkout.address')}</label><input id="c-address" name="address" required autocomplete="street-address" value="${escapeHtml(prev.address || '')}"></div>
                <div class="field-row">
                    <div class="field"><label for="c-postal">${t('checkout.postal')}</label><input id="c-postal" name="postal" required autocomplete="postal-code" value="${escapeHtml(prev.postal || '')}"></div>
                    <div class="field"><label for="c-city">${t('checkout.city')}</label><input id="c-city" name="city" required autocomplete="address-level2" value="${escapeHtml(prev.city || '')}"></div>
                </div>
                <div class="field"><label for="c-country">${t('checkout.country')}</label>
                    <select id="c-country" name="country" required autocomplete="country">
                        ${COUNTRIES.map(([c, n]) => `<option value="${c}" ${c === country ? 'selected' : ''}>${escapeHtml(t('country.' + c) === 'country.' + c ? n : t('country.' + c))}</option>`).join('')}
                    </select></div>
                <div class="field"><label for="c-notes">${t('checkout.notes')}</label><textarea id="c-notes" name="notes" rows="2" maxlength="500"></textarea></div>
            </section>
            <section>
                <h2>${t('checkout.payment')}</h2>
                <div class="pay-methods" role="radiogroup" aria-label="${escapeHtml(t('checkout.payment'))}">
                    ${methods.map(m => `
                    <label class="pay-opt"><input type="radio" name="pay" value="${m}" ${m === method ? 'checked' : ''}>
                        <span><strong>${t('pay.' + m)}</strong><small>${t('pay.' + m + 'Sub')}</small></span></label>`).join('')}
                </div>
                <p class="hint" id="pay-note"></p>
                <div id="paypal-box" hidden></div>
            </section>
            <label class="check"><input type="checkbox" id="c-terms" required> <span>${t('checkout.agree')} <a href="/terms" target="_blank">${t('link.terms')}</a> &amp; <a href="/privacy" target="_blank">${t('link.privacy')}</a></span></label>
            <p class="form-msg err" id="co-err" role="alert"></p>
            <button type="submit" class="btn btn--primary btn--lg btn--block" id="co-submit"></button>
        </form>

        <aside class="co-summary" aria-label="${escapeHtml(t('checkout.summary'))}">
            <h2>${t('checkout.summary')}</h2>
            <ul class="sum-list">${items.map(it => {
                const p = products.find(x => x.id === it.productId);
                return `<li><div class="sum-img"><img src="${productThumb(p, it.color)}" alt="" width="64" height="80"><span class="sum-qty">${it.qty}</span></div>
                    <div><strong>${escapeHtml(loc(it.name))}</strong><small><span class="dot" style="--c:${colorHex(it.color)}"></span>${escapeHtml(t('color.' + it.color))} · ${escapeHtml(sizeLabel(it.size))}</small></div>
                    <span>${fmt(it.price * it.qty)}</span></li>`;
            }).join('')}</ul>
            <div id="co-promo"></div>
            <dl class="totals" id="co-totals"></dl>
        </aside>
    </div>`;

    const form = document.getElementById('co-form');
    const submit = document.getElementById('co-submit');
    const err = document.getElementById('co-err');

    async function recompute() {
        promoDoc = await loadStoredPromo();
        totals = computeTotals({ items, promo: promoDoc, country, shippingSettings: shippingCfg });
        const code = storedPromoCode();
        const promoBox = document.getElementById('co-promo');
        const msgKey = totals.promoStatus && !totals.promoStatus.ok ? ({ min: 'cart.promoMin', expired: 'cart.promoExpired', used_up: 'cart.promoUsedUp' }[totals.promoStatus.reason] || 'cart.promoInvalid') : '';
        promoBox.innerHTML = totals.promo
            ? `<p class="promo-on">${t('cart.promoApplied', { code })} <button type="button" class="linklike" id="promo-rm">${t('cart.promoRemove')}</button></p>`
            : `<form id="promo-form" class="inline-form" novalidate><label class="sr" for="promo-input">${t('cart.promoLabel')}</label>
                <input id="promo-input" placeholder="${escapeHtml(t('cart.promoPlaceholder'))}" autocapitalize="characters" value="${escapeHtml(code)}"><button class="btn btn--ghost" type="submit">${t('cart.promoApply')}</button></form>
                <p class="form-msg err" id="promo-msg" role="alert">${msgKey ? escapeHtml(t(msgKey, { min: fmt(promoDoc?.minSubtotal || 0) })) : ''}</p>`;
        document.getElementById('promo-rm')?.addEventListener('click', () => { clearPromo(); recompute(); });
        document.getElementById('promo-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const r = await applyPromo(document.getElementById('promo-input').value, totals.subtotal);
            await recompute();
            if (!r.ok && r.reason !== 'min') document.getElementById('promo-msg').textContent = t({ expired: 'cart.promoExpired', used_up: 'cart.promoUsedUp' }[r.reason] || 'cart.promoInvalid');
        });
        document.getElementById('co-totals').innerHTML = `
            <div><dt>${t('cart.subtotal')}</dt><dd>${fmt(totals.subtotal)}</dd></div>
            ${totals.discount ? `<div class="disc"><dt>${t('cart.discount')}</dt><dd>−${fmt(totals.discount)}</dd></div>` : ''}
            <div><dt>${t('checkout.shippingLine')}</dt><dd>${totals.shippingFree ? t('checkout.free') : fmt(totals.shippingCost)}</dd></div>
            <div class="grand"><dt>${t('checkout.total')}</dt><dd>${fmt(totals.total)}</dd></div>`;
        refreshPayUi();
    }

    const chargeCurrency = () => (getCurrency() === 'TND' ? 'EUR' : getCurrency());

    function refreshPayUi() {
        const note = document.getElementById('pay-note');
        const cardNote = (method !== 'cod' && getCurrency() === 'TND') ? t('checkout.cardEurNote', { amount: fmt(totals.total, 'EUR') }) : '';
        note.textContent = cardNote || (isDemo && method !== 'cod' ? t('checkout.demoPay') : '');
        submit.textContent = method === 'cod' ? `${t('checkout.placeOrder')} · ${fmt(totals.total)}` : `${t('checkout.payNow')} · ${fmt(totals.total)}`;
        const paypalBox = document.getElementById('paypal-box');
        const usePayPalButtons = method === 'paypal' && payCfg.paypal?.clientId;
        paypalBox.hidden = !usePayPalButtons;
        submit.hidden = !!usePayPalButtons;
        if (usePayPalButtons) mountPayPal();
    }

    document.getElementById('c-country').addEventListener('change', (e) => {
        country = e.target.value;
        localStorage.setItem('seaway_country', country);
        recompute();
    });
    form.addEventListener('change', (e) => {
        if (e.target.name === 'pay') { method = e.target.value; refreshPayUi(); }
    });

    // ── validation ──
    function validate() {
        err.textContent = '';
        const f = new FormData(form);
        const email = String(f.get('email') || '').trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('c-email', t('common.invalidEmail'));
        if (String(f.get('phone') || '').replace(/\D/g, '').length < 6) return fail('c-phone', t('checkout.errPhone'));
        for (const k of ['name', 'address', 'postal', 'city']) if (!String(f.get(k) || '').trim()) return fail('c-' + k, t('checkout.errRequired'));
        if (!document.getElementById('c-terms').checked) return fail('c-terms', t('checkout.errTerms'));
        return true;
    }
    function fail(id, msg) { err.textContent = msg; document.getElementById(id)?.focus(); return false; }

    function collect(payment) {
        const f = new FormData(form);
        localStorage.setItem('seaway_checkout', JSON.stringify({
            email: f.get('email'), phone: f.get('phone'), name: f.get('name'), address: f.get('address'), postal: f.get('postal'), city: f.get('city')
        }));
        return {
            items: items.map(i => ({ productId: i.productId, slug: i.slug, name: i.name, category: i.category, art: i.art || null, color: i.color, size: i.size, qty: i.qty, price: i.price })),
            subtotal: totals.subtotal, discount: totals.discount, shippingCost: totals.shippingCost, total: totals.total,
            promoCode: totals.promo ? storedPromoCode() : '',
            currency: getCurrency(), rate: getRate(), lang: getLang(),
            customer: { name: String(f.get('name')).trim(), email: String(f.get('email')).trim().toLowerCase(), phone: String(f.get('phone')).trim() },
            shipping: { address: String(f.get('address')).trim(), city: String(f.get('city')).trim(), postal: String(f.get('postal')).trim(), country },
            notes: String(f.get('notes') || '').trim(),
            payment
        };
    }

    async function finish(order, created) {
        sessionStorage.setItem(STORAGE_KEYS.lastOrder, JSON.stringify({ ...order, id: created.id, number: created.number }));
        track('Purchase', { value: order.total, items: order.items.map(i => ({ id: i.productId, name: loc(i.name), price: i.price, qty: i.qty })) });
        clearCart(); clearPromo();
        location.href = `/order-confirmation?o=${encodeURIComponent(created.number)}`;
    }

    // ── submit (COD, Stripe, demo payments) ──
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!validate()) return;
        submit.disabled = true;
        const label = submit.textContent;
        submit.textContent = t('checkout.processing');
        try {
            track('InitiateCheckout', { value: totals.total, items: items.map(i => ({ id: i.productId, name: loc(i.name), price: i.price, qty: i.qty })) });
            if (method === 'cod') {
                const order = collect({ method: 'cod', status: 'unpaid', currency: getCurrency() });
                return await finish(order, await createOrder(order));
            }
            if (method === 'stripe') {
                if (SITE.stripeSessionUrl) {
                    const order = collect({ method: 'stripe', status: 'awaiting', currency: chargeCurrency() });
                    const created = await createOrder(order);
                    const res = await fetch(SITE.stripeSessionUrl, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ orderId: created.id, lang: getLang(), origin: location.origin })
                    });
                    const data = await res.json();
                    if (!res.ok || !data.url) throw new Error(data.error || 'stripe_failed');
                    // the cart is emptied on the confirmation page, so a cancelled payment keeps it
                    sessionStorage.setItem(STORAGE_KEYS.lastOrder, JSON.stringify({ ...order, id: created.id, number: created.number }));
                    location.href = data.url;
                    return;
                }
                if (!isDemo) throw new Error('stripe_not_configured');
            }
            // DEMO payment (no real money moves)
            if (isDemo) {
                if (!confirm(t('checkout.demoConfirm'))) throw new Error('cancelled');
                const order = collect({ method, status: 'paid', demo: true, currency: chargeCurrency() });
                return await finish(order, await createOrder(order));
            }
            throw new Error('not_configured');
        } catch (ex) {
            if (ex.message !== 'cancelled') err.textContent = t('checkout.errPayment');
            console.error(ex);
        } finally {
            submit.disabled = false;
            submit.textContent = label;
        }
    });

    // ── PayPal buttons (client-side capture; see README for hardening) ──
    let paypalLoaded;
    async function mountPayPal() {
        const box = document.getElementById('paypal-box');
        const cur = chargeCurrency();
        if (!paypalLoaded) {
            paypalLoaded = new Promise((res, rej) => {
                const s = document.createElement('script');
                s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(payCfg.paypal.clientId)}&currency=${cur}&intent=capture`;
                s.onload = res; s.onerror = rej;
                document.head.appendChild(s);
            });
        }
        try { await paypalLoaded; } catch { box.textContent = t('checkout.errPayment'); return; }
        box.innerHTML = '';
        window.paypal.Buttons({
            onClick: (_d, actions) => (validate() ? actions.resolve() : actions.reject()),
            createOrder: (_d, actions) => actions.order.create({
                purchase_units: [{ amount: { currency_code: cur, value: round2(totals.total * getRate(cur)).toFixed(2) } }]
            }),
            onApprove: async (data, actions) => {
                const capture = await actions.order.capture();
                const order = collect({ method: 'paypal', status: 'paid', paypalOrderId: capture.id || data.orderID, currency: cur });
                await finish(order, await createOrder(order));
            },
            onError: () => { err.textContent = t('checkout.errPayment'); }
        }).render(box);
    }

    recompute();
}
