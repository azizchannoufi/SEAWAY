// Transactional emails (order confirmation, shipping, admin alert) via any SMTP server.
const nodemailer = require('nodemailer');

const T = {
    en: {
        confirmSubject: (n) => `Your Seaway order ${n}`, shipSubject: (n) => `Your Seaway order ${n} is on its way`,
        hi: (name) => `Hi ${name},`, confirmIntro: 'Thank you for your order! We are preparing it with care. Here is your summary:',
        shipIntro: 'Good news: your order has been shipped.', tracking: 'Tracking number', item: 'Item', qty: 'Qty', total: 'Total',
        subtotal: 'Subtotal', discount: 'Discount', shipping: 'Shipping', free: 'Free', address: 'Delivery address',
        payment: { cod: 'Cash on delivery', stripe: 'Card', paypal: 'PayPal' }, payLabel: 'Payment', order: 'Order',
        bye: 'See you by the sea,', team: 'The Seaway team', questions: 'Questions? Just reply to this email.'
    },
    fr: {
        confirmSubject: (n) => `Votre commande Seaway ${n}`, shipSubject: (n) => `Votre commande Seaway ${n} est en route`,
        hi: (name) => `Bonjour ${name},`, confirmIntro: 'Merci pour votre commande ! Nous la préparons avec soin. Voici le récapitulatif :',
        shipIntro: 'Bonne nouvelle : votre commande a été expédiée.', tracking: 'Numéro de suivi', item: 'Article', qty: 'Qté', total: 'Total',
        subtotal: 'Sous-total', discount: 'Réduction', shipping: 'Livraison', free: 'Offerte', address: 'Adresse de livraison',
        payment: { cod: 'Paiement à la livraison', stripe: 'Carte bancaire', paypal: 'PayPal' }, payLabel: 'Paiement', order: 'Commande',
        bye: 'À bientôt au bord de l’eau,', team: 'L’équipe Seaway', questions: 'Une question ? Répondez simplement à cet e-mail.'
    },
    it: {
        confirmSubject: (n) => `Il tuo ordine Seaway ${n}`, shipSubject: (n) => `Il tuo ordine Seaway ${n} è in viaggio`,
        hi: (name) => `Ciao ${name},`, confirmIntro: 'Grazie per il tuo ordine! Lo stiamo preparando con cura. Ecco il riepilogo:',
        shipIntro: 'Buone notizie: il tuo ordine è stato spedito.', tracking: 'Numero di tracking', item: 'Articolo', qty: 'Qtà', total: 'Totale',
        subtotal: 'Subtotale', discount: 'Sconto', shipping: 'Spedizione', free: 'Gratuita', address: 'Indirizzo di consegna',
        payment: { cod: 'Contrassegno', stripe: 'Carta', paypal: 'PayPal' }, payLabel: 'Pagamento', order: 'Ordine',
        bye: 'A presto in riva al mare,', team: 'Il team Seaway', questions: 'Domande? Rispondi semplicemente a questa email.'
    },
    ar: {
        confirmSubject: (n) => `طلبك من سيواي ${n}`, shipSubject: (n) => `طلبك من سيواي ${n} في الطريق إليك`,
        hi: (name) => `مرحبًا ${name}،`, confirmIntro: 'شكرًا على طلبك! نجهّزه بعناية. هذا ملخص الطلب:',
        shipIntro: 'أخبار سارة: تم شحن طلبك.', tracking: 'رقم التتبع', item: 'المنتج', qty: 'الكمية', total: 'المجموع',
        subtotal: 'المجموع الفرعي', discount: 'الخصم', shipping: 'الشحن', free: 'مجاني', address: 'عنوان التوصيل',
        payment: { cod: 'الدفع عند الاستلام', stripe: 'بطاقة', paypal: 'PayPal' }, payLabel: 'الدفع', order: 'الطلب',
        bye: 'إلى اللقاء قرب البحر،', team: 'فريق سيواي', questions: 'لديك سؤال؟ ما عليك سوى الرد على هذا البريد.'
    }
};
const LOCALES = { en: 'en-GB', fr: 'fr-FR', it: 'it-IT', ar: 'ar-TN' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pick = (o, lang) => (typeof o === 'string' ? o : (o && (o[lang] || o.en || Object.values(o).find(Boolean))) || '');

function money(order, eur) {
    const cur = order.currency || 'EUR';
    const rate = Number(order.rate) || 1;
    try {
        return new Intl.NumberFormat(LOCALES[order.lang] || 'en-GB', { style: 'currency', currency: cur }).format(eur * rate);
    } catch { return `${(eur * rate).toFixed(2)} ${cur}`; }
}

let transporter;
function getTransport() {
    if (!process.env.SMTP_HOST) return null;
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
        });
    }
    return transporter;
}

async function send({ to, subject, html, text }) {
    const tr = getTransport();
    if (!tr) { console.warn('SMTP_HOST not set: email skipped ->', subject); return false; }
    await tr.sendMail({ from: process.env.MAIL_FROM || 'Seaway <no-reply@seaway.example>', to, replyTo: process.env.REPLY_TO || undefined, subject, html, text });
    return true;
}

function layout(body, lang) {
    return `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><body style="margin:0;background:#FAF7F2;font-family:Arial,Helvetica,sans-serif;color:#0B2545">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #E8D8BE">
<tr><td style="background:#0B2545;padding:22px;text-align:center;color:#fff;font-size:22px;letter-spacing:6px;font-weight:bold">SEAWAY</td></tr>
<tr><td style="padding:28px 28px 8px;line-height:1.55;font-size:15px">${body}</td></tr>
<tr><td style="padding:0 28px 28px;font-size:13px;color:#5E6B80">${''}</td></tr></table></td></tr></table></body></html>`;
}

function itemsTable(order, t, lang) {
    const rows = order.items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">${esc(pick(i.name, lang))}<br><span style="color:#5E6B80;font-size:12px">${esc(i.color)} · ${i.size === 'ONE' ? '—' : esc(i.size)}</span></td>
<td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center">${i.qty}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:end">${money(order, i.price * i.qty)}</td></tr>`).join('');
    const line = (label, val, bold) => `<tr><td colspan="2" style="padding:4px 0;${bold ? 'font-weight:bold;font-size:16px;' : ''}">${label}</td><td style="padding:4px 0;text-align:end;${bold ? 'font-weight:bold;font-size:16px;' : ''}">${val}</td></tr>`;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:14px"><tr><th align="start" style="padding-bottom:6px;color:#5E6B80;font-size:12px">${t.item}</th><th style="color:#5E6B80;font-size:12px">${t.qty}</th><th align="end" style="color:#5E6B80;font-size:12px">${t.total}</th></tr>${rows}
${line(t.subtotal, money(order, order.subtotal))}${order.discount ? line(`${t.discount}${order.promoCode ? ' (' + esc(order.promoCode) + ')' : ''}`, '−' + money(order, order.discount)) : ''}${line(t.shipping, order.shippingCost ? money(order, order.shippingCost) : t.free)}${line(t.total, money(order, order.total), true)}</table>`;
}

async function sendConfirmation(order) {
    const lang = T[order.lang] ? order.lang : 'en';
    const t = T[lang];
    const s = order.shipping || {};
    const html = layout(`<p>${esc(t.hi(order.customer.name))}</p><p>${t.confirmIntro}</p>
<p style="margin:0"><strong>${t.order} ${esc(order.number)}</strong></p>${itemsTable(order, t, lang)}
<p style="margin:0 0 4px"><strong>${t.payLabel}:</strong> ${esc(t.payment[order.payment?.method] || '')}</p>
<p style="margin:0 0 16px"><strong>${t.address}:</strong><br>${esc(order.customer.name)}<br>${esc(s.address)}<br>${esc(s.postal)} ${esc(s.city)}, ${esc(s.country)}</p>
<p>${t.questions}</p><p>${t.bye}<br><strong>${t.team}</strong></p>`, lang);
    return send({ to: order.customer.email, subject: t.confirmSubject(order.number), html });
}

async function sendShipped(order) {
    const lang = T[order.lang] ? order.lang : 'en';
    const t = T[lang];
    const html = layout(`<p>${esc(t.hi(order.customer.name))}</p><p>${t.shipIntro}</p><p><strong>${t.order} ${esc(order.number)}</strong>${order.tracking ? `<br>${t.tracking}: <strong>${esc(order.tracking)}</strong>` : ''}</p>
<p>${t.questions}</p><p>${t.bye}<br><strong>${t.team}</strong></p>`, lang);
    return send({ to: order.customer.email, subject: t.shipSubject(order.number), html });
}

async function sendAdminAlert(order) {
    const to = process.env.ADMIN_EMAIL;
    if (!to) return false;
    const lines = order.items.map((i) => `${i.qty} x ${pick(i.name, 'en')} (${i.color}/${i.size})`).join('<br>');
    const html = `<p><strong>New order ${esc(order.number)}</strong> — ${order.total.toFixed(2)} EUR (${esc(order.payment?.method)}, ${esc(order.payment?.status)})</p>
<p>${lines}</p><p>${esc(order.customer.name)} · ${esc(order.customer.email)} · ${esc(order.customer.phone)}<br>${esc(order.shipping?.city)}, ${esc(order.shipping?.country)}</p>
${order.issues?.length ? `<p style="color:#B3261E"><strong>Check:</strong> ${esc(order.issues.join(', '))}</p>` : ''}`;
    return send({ to, subject: `New order ${order.number} · ${order.total.toFixed(2)} EUR`, html });
}

async function telegram(order) {
    const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chat) return;
    const text = `🧺 New Seaway order ${order.number}\n${order.customer.name} (${order.shipping?.country})\n${order.items.map((i) => `${i.qty}x ${pick(i.name, 'en')}`).join(', ')}\nTotal: ${order.total.toFixed(2)} EUR · ${order.payment?.method}`;
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ chat_id: chat, text })
    });
    if (!res.ok) console.error('Telegram failed', res.status);
}

module.exports = { sendConfirmation, sendShipped, sendAdminAlert, telegram };
