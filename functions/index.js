// ============================================================
// SEAWAY — Cloud Functions (Node 20, 2nd gen)
//   onOrderCreated        recompute prices/stock server-side, send emails
//   onOrderUpdated        restock on cancel, shipping email
//   createCheckoutSession Stripe Checkout (called by the storefront)
//   stripeWebhook         marks orders paid
//   sitemap               dynamic /sitemap.xml
// Configuration comes from functions/.env (see .env.example).
// ============================================================
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldPath, FieldValue } = require('firebase-admin/firestore');
const pricing = require('./lib/pricing');
const mail = require('./lib/email');

initializeApp();
const db = getFirestore();
const REGION = 'europe-west1';
const opts = { region: REGION };
const siteUrl = () => (process.env.SITE_URL || 'https://www.seaway.example').replace(/\/$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── helpers ─────────────────────────────────────────────────
async function readSettings(tx, name) {
    const snap = await tx.get(db.doc(`settings/${name}`));
    return snap.exists ? snap.data() : {};
}

/** Aggregate qty per product/variant: { productId: { 'color|size': qty } } */
function groupVariants(items) {
    const out = {};
    for (const i of items) {
        const key = `${i.color}|${i.size}`;
        (out[i.productId] ||= {})[key] = (out[i.productId][key] || 0) + i.qty;
    }
    return out;
}

/** Apply stock change inside a transaction. sign = -1 (sell) or +1 (restock). Never goes below 0. */
async function adjustStock(tx, items, sign) {
    const groups = groupVariants(items);
    const ids = Object.keys(groups);
    const refs = ids.map((id) => db.doc(`products/${id}`));
    const snaps = refs.length ? await tx.getAll(...refs) : [];
    const shortages = [];
    return {
        shortages,
        write() {
            snaps.forEach((snap, idx) => {
                if (!snap.exists) return;
                const stock = snap.data().stock || {};
                const args = [];
                for (const [key, qty] of Object.entries(groups[ids[idx]])) {
                    const cur = Number(stock[key]) || 0;
                    if (sign < 0 && cur < qty) shortages.push(`${ids[idx]} ${key}`);
                    args.push(new FieldPath('stock', key), Math.max(0, cur + sign * qty));
                }
                if (args.length) tx.update(snap.ref, ...args);
            });
        }
    };
}

// ── order created ───────────────────────────────────────────
exports.onOrderCreated = onDocumentCreated({ ...opts, document: 'orders/{orderId}' }, async (event) => {
    const ref = event.data.ref;

    const processed = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const o = snap.data();
        if (!o || o.serverProcessed) return null;

        // all reads first
        const productIds = [...new Set((o.items || []).map((i) => i.productId))];
        const productSnaps = productIds.length ? await tx.getAll(...productIds.map((id) => db.doc(`products/${id}`))) : [];
        const products = Object.fromEntries(productSnaps.filter((s) => s.exists).map((s) => [s.id, s.data()]));
        const code = String(o.promoCode || '').toUpperCase();
        const promoRef = code ? db.doc(`promos/${code}`) : null;
        const promoSnap = promoRef ? await tx.get(promoRef) : null;
        const shipping = await readSettings(tx, 'shipping');
        const currency = await readSettings(tx, 'currency');
        // rebuild items from the catalog (client prices are ignored)
        const issues = [];
        const items = [];
        for (const i of o.items || []) {
            const p = products[i.productId];
            const qty = Math.floor(Number(i.qty));
            if (!p || p.active === false) { issues.push(`unknown_product:${i.productId}`); continue; }
            if (!p.colors?.includes(i.color) || !p.sizes?.includes(i.size)) { issues.push(`invalid_variant:${i.productId}`); continue; }
            if (!(qty >= 1 && qty <= 20)) { issues.push(`invalid_qty:${i.productId}`); continue; }
            items.push({ productId: i.productId, slug: p.slug, name: p.name, category: p.category, art: p.art || null, color: i.color, size: i.size, qty, price: Number(p.price) });
        }

        const zones = shipping.zones?.length ? shipping.zones : pricing.DEFAULT_ZONES;
        const promo = promoSnap?.exists ? promoSnap.data() : null;
        const totals = items.length ? pricing.computeTotals({ items, promo, country: o.shipping?.country, zones }) : { subtotal: 0, discount: 0, promo: null, shippingCost: 0, total: 0 };
        const rates = { ...pricing.DEFAULT_RATES, ...(currency.rates || {}) };
        const method = o.payment?.method;
        // Cash on delivery keeps the displayed currency (e.g. TND). Cards/PayPal are charged in EUR/USD only.
        const wanted = method === 'cod' ? o.currency : (o.payment?.currency || o.currency);
        const cur = rates[wanted] && (method === 'cod' || wanted !== 'TND') ? wanted : 'EUR';
        const payment = { ...o.payment };
        if (method === 'cod') payment.status = 'unpaid';
        else if (method === 'stripe') payment.status = 'awaiting';
        else if (method === 'paypal') payment.status = o.payment?.status === 'paid' ? 'paid' : 'unpaid'; // verified after the transaction

        const patch = {
            items, subtotal: totals.subtotal, discount: totals.discount, shippingCost: totals.shippingCost, total: totals.total,
            promoCode: totals.promo ? code : '', currency: cur, rate: rates[cur], payment,
            serverProcessed: true, issues
        };

        if (!items.length || issues.length) {
            // tampered or stale cart: keep it for the admin to review, but do not fulfil it
            patch.status = 'cancelled';
            patch.stockDecremented = false;
            tx.update(ref, patch);
            return { ...o, ...patch };
        }

        const adj = await adjustStock(tx, items, -1);
        adj.write();
        if (adj.shortages.length) patch.issues = adj.shortages.map((s) => `low_stock:${s}`);
        patch.stockDecremented = true;
        if (totals.promo) tx.update(promoRef, { uses: FieldValue.increment(1) });
        tx.update(ref, patch);
        return { ...o, ...patch };
    });
    if (!processed) return;

    const order = { ...processed, id: event.params.orderId };

    // PayPal: confirm the capture with PayPal before trusting "paid"
    if (order.payment?.method === 'paypal') {
        const ok = await verifyPayPal(order).catch((e) => { console.error('PayPal verify failed', e.message); return null; });
        if (ok === true) order.payment.status = 'paid';
        else if (ok === false) { order.payment.status = 'unpaid'; order.issues = [...(order.issues || []), 'paypal_not_verified']; }
        await ref.update({ 'payment.status': order.payment.status, issues: order.issues || [] });
    }

    if (order.status === 'cancelled') { await mail.sendAdminAlert(order).catch(console.error); return; }
    // Stripe orders are announced once the payment is confirmed (webhook)
    if (order.payment.method === 'stripe') return;
    await Promise.allSettled([mail.sendConfirmation(order), mail.sendAdminAlert(order), mail.telegram(order)]);
});

// ── order updated ───────────────────────────────────────────
exports.onOrderUpdated = onDocumentUpdated({ ...opts, document: 'orders/{orderId}' }, async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const ref = event.data.after.ref;
    if (!before || !after || !after.serverProcessed) return;

    const cancelled = before.status !== 'cancelled' && after.status === 'cancelled';
    const reopened = before.status === 'cancelled' && after.status !== 'cancelled';
    if ((cancelled && after.stockDecremented) || (reopened && !after.stockDecremented)) {
        await db.runTransaction(async (tx) => {
            const fresh = (await tx.get(ref)).data();
            const sign = cancelled ? 1 : -1;
            if (cancelled !== !!fresh.stockDecremented) return; // already handled by a previous run
            const adj = await adjustStock(tx, fresh.items || [], sign);
            adj.write();
            tx.update(ref, { stockDecremented: !cancelled });
        });
        return;
    }

    if (after.status === 'shipped' && before.status !== 'shipped') {
        await mail.sendShipped({ ...after, id: event.params.orderId }).catch((e) => console.error('shipped mail', e.message));
    }
});

// ── PayPal verification (optional) ──────────────────────────
/** @returns {Promise<boolean|null>} true/false when verified, null when PayPal API keys are not configured */
async function verifyPayPal(order) {
    const id = process.env.PAYPAL_CLIENT_ID, secret = process.env.PAYPAL_SECRET;
    if (!id || !secret || !order.payment?.paypalOrderId) return null;
    const base = process.env.PAYPAL_ENV === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=client_credentials'
    });
    const { access_token: token } = await tokenRes.json();
    const res = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(order.payment.paypalOrderId)}`, { headers: { Authorization: `Bearer ${token}` } });
    const pp = await res.json();
    const unit = pp.purchase_units?.[0]?.amount;
    const expected = pricing.round2(order.total * order.rate);
    return pp.status === 'COMPLETED' && unit?.currency_code === order.currency && Math.abs(Number(unit.value) - expected) < 0.02;
}

// ── Stripe ──────────────────────────────────────────────────
const stripeClient = () => require('stripe')(process.env.STRIPE_SECRET_KEY);
const STRIPE_LOCALES = { en: 'en', fr: 'fr', it: 'it', ar: 'auto' };

function allowedOrigin(origin) {
    if (!origin) return false;
    const list = (process.env.ALLOWED_ORIGINS || siteUrl()).split(',').map((s) => s.trim().replace(/\/$/, ''));
    return list.includes(origin.replace(/\/$/, '')) || /^http:\/\/localhost(:\d+)?$/.test(origin);
}

exports.createCheckoutSession = onRequest({ ...opts, cors: true }, async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'stripe_not_configured' });
    try {
        const { orderId, lang, origin } = req.body || {};
        if (!orderId || typeof orderId !== 'string') return res.status(400).json({ error: 'bad_request' });
        const ref = db.doc(`orders/${orderId}`);

        // wait (max ~10 s) for onOrderCreated to price the order
        let order;
        for (let i = 0; i < 14; i++) {
            const snap = await ref.get();
            order = snap.exists ? snap.data() : null;
            if (!order || order.serverProcessed) break;
            await sleep(700);
        }
        if (!order || !order.serverProcessed) return res.status(404).json({ error: 'order_not_ready' });
        if (order.payment?.method !== 'stripe' || order.payment?.status !== 'awaiting' || order.status === 'cancelled') return res.status(409).json({ error: 'order_not_payable' });

        const cur = String(order.currency || 'EUR').toLowerCase();
        const rate = Number(order.rate) || 1;
        const cents = (eur) => Math.round(eur * rate * 100);
        const line_items = order.items.map((i) => ({
            quantity: i.qty,
            price_data: {
                currency: cur, unit_amount: cents(i.price),
                product_data: { name: `${i.name?.[lang] || i.name?.en || i.slug} (${i.color}${i.size !== 'ONE' ? ' / ' + i.size : ''})` }
            }
        }));
        if (order.shippingCost > 0) line_items.push({ quantity: 1, price_data: { currency: cur, unit_amount: cents(order.shippingCost), product_data: { name: 'Shipping' } } });

        const stripe = stripeClient();
        const params = {
            mode: 'payment', line_items, customer_email: order.customer.email, client_reference_id: orderId,
            metadata: { orderId, number: order.number },
            payment_intent_data: { metadata: { orderId, number: order.number } },
            locale: STRIPE_LOCALES[lang] || 'auto',
            success_url: `${allowedOrigin(origin) ? origin : siteUrl()}/order-confirmation?o=${encodeURIComponent(order.number)}`,
            cancel_url: `${allowedOrigin(origin) ? origin : siteUrl()}/checkout`
        };
        if (order.discount > 0) {
            const coupon = await stripe.coupons.create({ amount_off: cents(order.discount), currency: cur, duration: 'once', name: order.promoCode || 'Discount' });
            params.discounts = [{ coupon: coupon.id }];
        }
        const session = await stripe.checkout.sessions.create(params);
        await ref.update({ 'payment.sessionId': session.id });
        return res.json({ url: session.url });
    } catch (e) {
        console.error('createCheckoutSession', e);
        return res.status(500).json({ error: 'stripe_failed' });
    }
});

exports.stripeWebhook = onRequest(opts, async (req, res) => {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(500).send('not configured');
    let event;
    try {
        event = stripeClient().webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (e) { return res.status(400).send(`Webhook signature error: ${e.message}`); }

    const session = event.data.object;
    const orderId = session.client_reference_id || session.metadata?.orderId;
    if (orderId && ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(event.type)) {
        const ref = db.doc(`orders/${orderId}`);
        const snap = await ref.get();
        const order = snap.exists ? snap.data() : null;
        if (order && order.payment?.status !== 'paid') {
            if (event.type === 'checkout.session.expired') {
                if (order.payment?.status === 'awaiting') await ref.update({ status: 'cancelled', 'payment.status': 'unpaid', adminNote: 'Stripe checkout expired' });
            } else if (session.payment_status === 'paid') {
                await ref.update({ 'payment.status': 'paid', 'payment.paymentIntent': session.payment_intent || '', status: order.status === 'pending' ? 'confirmed' : order.status });
                const paid = { ...order, id: orderId, status: 'confirmed', payment: { ...order.payment, status: 'paid' } };
                await Promise.allSettled([mail.sendConfirmation(paid), mail.sendAdminAlert(paid), mail.telegram(paid)]);
            }
        }
    }
    res.json({ received: true });
});

// ── dynamic sitemap ─────────────────────────────────────────
exports.sitemap = onRequest(opts, async (req, res) => {
    const base = siteUrl();
    const [products, cats] = await Promise.all([db.collection('products').get(), db.collection('categories').get()]);
    const urls = [
        ['/', 1.0], ['/shop', 0.9], ['/collections', 0.8], ['/story', 0.7], ['/contact', 0.5], ['/faq', 0.5],
        ['/shipping', 0.5], ['/size-guide', 0.5], ['/terms', 0.2], ['/privacy', 0.2], ['/cookies', 0.2]
    ].map(([p, pr]) => ({ loc: base + p, pr }));
    cats.forEach((d) => urls.push({ loc: `${base}/collections/${d.data().slug || d.id}`, pr: 0.8 }));
    products.forEach((d) => {
        const p = d.data();
        if (p.active === false) return;
        urls.push({ loc: `${base}/product/${p.slug || d.id}`, pr: 0.7, mod: p.updatedAt ? new Date(p.updatedAt).toISOString().slice(0, 10) : '' });
    });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) =>
        `  <url><loc>${u.loc}</loc>${u.mod ? `<lastmod>${u.mod}</lastmod>` : ''}<priority>${u.pr}</priority></url>`).join('\n')}\n</urlset>\n`;
    res.set('Content-Type', 'application/xml').set('Cache-Control', 'public, max-age=3600, s-maxage=3600').send(xml);
});
