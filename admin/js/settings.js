import { bootAdmin, db, $, $$, esc, openModal, confirmBox, guard, toast } from './common.js';
import { LANGS, CURRENCIES } from '/js/config.js';

await bootAdmin({ page: 'settings', title: 'Settings' });

const S = await db.getAllSettings();
const st = S.store, ann = st.announcement || { enabled: false, text: {} };
let zones = JSON.parse(JSON.stringify(S.shipping.zones || []));

$('#topbar-actions').innerHTML = '<button class="btn accent" id="save" type="button">Save all settings</button>';
const field = (id, label, value, { type = 'text', hint = '', ph = '', full = false, attrs = '' } = {}) =>
    `<div class="field ${full ? 'full' : ''}"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type}" value="${esc(value ?? '')}" placeholder="${esc(ph)}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
const sw = (id, label, on) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;

$('#main').innerHTML = `
<section class="card"><div class="card-h"><h2>Store</h2></div><div class="card-b"><div class="form-grid">
    ${field('s-name', 'Store name', st.name)}${field('s-email', 'Contact email', st.email, { type: 'email', hint: 'Shown in the footer and contact page.' })}
    ${field('s-phone', 'Phone', st.phone)}${field('s-wa', 'WhatsApp number (optional)', st.whatsapp, { ph: '+21600000000', hint: 'Digits with country code. Adds a chat link on the contact page.' })}
    ${field('s-address', 'Address', st.address, { full: true })}
    ${field('s-ig', 'Instagram URL', st.instagram)}${field('s-igh', 'Instagram handle', st.instagramHandle)}
    ${field('s-tt', 'TikTok URL', st.tiktok)}${field('s-fb', 'Facebook URL (optional)', st.facebook)}
</div></div></section>

<section class="card"><div class="card-h"><h2>Home hero & announcement bar</h2></div><div class="card-b"><div class="form-grid">
    ${field('s-hv', 'Hero video URL (optional)', st.heroVideo, { full: true, ph: 'https://…/hero.mp4', hint: 'Short, muted, looping MP4 (under 6 MB works best on mobile). Leave empty to use the image.' })}
    <div class="field full"><label for="s-hi">Hero photo URL (optional)</label>
        <div class="row"><input class="input" id="s-hi" value="${esc(st.heroImage || '')}" placeholder="Upload a photo or paste a URL" style="flex:1;min-width:220px"><button class="btn" id="hi-up" type="button">Upload</button><input type="file" id="hi-file" accept="image/*" hidden></div>
        <span class="hint">Landscape, at least 1600 px wide. Without a video or photo, the built-in illustration is shown.</span></div>
    <div class="field full">${sw('a-on', 'Show the announcement bar', ann.enabled)}</div>
    ${LANGS.map(l => `<div class="field full"><label for="a-${l.code}">Announcement text · ${l.label}</label><input class="input" id="a-${l.code}" ${l.dir === 'rtl' ? 'dir="rtl"' : ''} value="${esc(ann.text?.[l.code] || '')}"></div>`).join('')}
</div></div></section>

<section class="card"><div class="card-h"><h2>Shipping zones</h2><span class="spacer"></span><button class="btn sm" id="add-zone" type="button">+ Add zone</button></div><div class="card-b" style="display:grid;gap:12px">
    <p class="hint" style="margin:0">Prices are in EUR. Zones are checked top to bottom; use <code>*</code> as the country list for “rest of the world”. Free shipping applies once the basket (after discount) reaches the threshold; set it to 0 to disable.</p>
    <div id="zones" style="display:grid;gap:10px"></div>
</div></section>

<section class="card"><div class="card-h"><h2>Currencies</h2></div><div class="card-b"><div class="form-grid">
    <div class="field full"><span class="lbl">Prices are stored in EUR. Enter how many units of each currency equal 1 EUR.</span></div>
    ${field('c-tnd', 'TND per 1 EUR', S.currency.rates.TND, { type: 'number', attrs: 'step="0.001" min="0"' })}
    ${field('c-usd', 'USD per 1 EUR', S.currency.rates.USD, { type: 'number', attrs: 'step="0.001" min="0"' })}
    <div class="field"><span class="lbl">Currencies offered to customers</span><div class="row" style="gap:18px">${Object.keys(CURRENCIES).map(c => `<label class="check"><input type="checkbox" class="cur-en" value="${c}" ${S.currency.enabled.includes(c) || c === 'EUR' ? 'checked' : ''} ${c === 'EUR' ? 'disabled' : ''}> ${c}</label>`).join('')}</div></div>
    <div class="field"><label for="c-def">Default currency</label><select class="select" id="c-def">${Object.keys(CURRENCIES).map(c => `<option ${S.currency.default === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
    <p class="hint full" style="margin:0">Card payments (Stripe/PayPal) are always charged in EUR or USD: TND is shown for information and is charged in EUR. Cash on delivery uses the displayed currency.</p>
</div></div></section>

<section class="card"><div class="card-h"><h2>Payments</h2></div><div class="card-b"><div class="form-grid">
    <div class="field">${sw('p-cod', 'Cash on delivery', S.payments.cod.enabled)}</div>
    <div class="field">${sw('p-stripe', 'Card payments (Stripe)', S.payments.stripe.enabled)}<span class="hint">Needs the Stripe Cloud Function and <code>SITE.stripeSessionUrl</code> in <code>js/config.js</code>.</span></div>
    <div class="field">${sw('p-paypal', 'PayPal', S.payments.paypal.enabled)}</div>
    ${field('p-ppid', 'PayPal client ID', S.payments.paypal.clientId, { ph: 'AaBb…', hint: 'From developer.paypal.com → Apps & credentials (use the Live client ID in production).' })}
</div></div></section>

<section class="card"><div class="card-h"><h2>Marketing & tracking</h2></div><div class="card-b"><div class="form-grid">
    <div class="field full">${sw('m-pop', 'Show the newsletter pop-up', S.marketing.popupEnabled)}</div>
    ${field('m-pct', 'Pop-up discount (%)', S.marketing.popupPercent, { type: 'number', attrs: 'min="1" max="90"' })}
    ${field('m-delay', 'Show after (seconds)', S.marketing.popupDelaySec, { type: 'number', attrs: 'min="1" max="120"' })}
    ${field('m-code', 'Promo code revealed after signup', S.marketing.popupCode, { hint: 'Create this code in Promo codes with the same percentage.', attrs: 'style="text-transform:uppercase"' })}
    <div></div>
    ${field('m-meta', 'Meta (Facebook/Instagram) Pixel ID', S.marketing.metaPixelId, { ph: '1234567890' })}
    ${field('m-tt', 'TikTok Pixel ID', S.marketing.tiktokPixelId)}
    ${field('m-ga', 'Google Analytics 4 ID', S.marketing.ga4Id, { ph: 'G-XXXXXXXXXX' })}
    <p class="hint full" style="margin:0">Pixels only load after the visitor accepts marketing/analytics cookies (GDPR).</p>
</div></div></section>

<section class="card"><div class="card-h"><h2>Data tools</h2></div><div class="card-b row">
    <button class="btn" id="import" type="button">${db.isDemo ? 'Reset demo data' : 'Import sample products'}</button>
    <span class="hint">${db.isDemo ? 'Restores the original sample shop, orders and settings in this browser.' : 'Writes the 8 sample products, collections, promo codes and default settings to Firebase. Existing items with the same ID are overwritten.'}</span>
</div></section>`;

function drawZones() {
    $('#zones').innerHTML = zones.map((z, i) => `<div class="zone" data-i="${i}">
        <div class="field"><label>Name</label><input class="input z-code" value="${esc(z.code)}"></div>
        <div class="field"><label>Countries (ISO codes, comma separated)</label><input class="input z-countries" value="${esc((z.countries || []).join(', '))}" placeholder="FR, IT, DE or *"></div>
        <div class="field"><label>Rate (EUR)</label><input class="input z-rate" type="number" min="0" step="0.1" value="${z.rate}"></div>
        <div class="field"><label>Free above (EUR)</label><input class="input z-free" type="number" min="0" step="1" value="${z.freeAbove || 0}"></div>
        <button class="btn sm danger" data-rm="${i}" type="button" aria-label="Remove zone">✕</button></div>`).join('');
}
function readZones() {
    return $$('.zone').map(el => ({
        code: $('.z-code', el).value.trim() || 'ZONE',
        countries: $('.z-countries', el).value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
        rate: Math.max(0, parseFloat($('.z-rate', el).value) || 0), freeAbove: Math.max(0, parseFloat($('.z-free', el).value) || 0)
    }));
}
drawZones();
$('#add-zone').onclick = () => { zones = readZones(); zones.splice(Math.max(0, zones.length - 1), 0, { code: 'NEW', countries: [], rate: 9, freeAbove: 150 }); drawZones(); };
$('#zones').addEventListener('click', (e) => { const b = e.target.closest('[data-rm]'); if (b) { zones = readZones(); zones.splice(+b.dataset.rm, 1); drawZones(); } });

$('#hi-up').onclick = () => $('#hi-file').click();
$('#hi-file').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const u = await guard(() => db.uploadImage(f, 'site')); if (u) { $('#s-hi').value = u; toast('Photo uploaded — remember to save.', 'ok'); } };

$('#save').onclick = async (ev) => {
    zones = readZones();
    if (!zones.length) return toast('Add at least one shipping zone.', 'err');
    if (!zones.some(z => z.countries.includes('*'))) toast('Tip: add a zone with "*" so every country can order.');
    const tnd = parseFloat($('#c-tnd').value), usd = parseFloat($('#c-usd').value);
    if (!(tnd > 0) || !(usd > 0)) return toast('Exchange rates must be greater than 0.', 'err');
    const enabled = ['EUR', ...$$('.cur-en:checked').map(i => i.value)].filter((v, i, a) => a.indexOf(v) === i);
    const def = enabled.includes($('#c-def').value) ? $('#c-def').value : 'EUR';
    const v = (id) => $(id).value.trim();
    const next = {
        store: {
            ...st, name: v('#s-name'), email: v('#s-email'), phone: v('#s-phone'), whatsapp: v('#s-wa').replace(/[^\d+]/g, ''), address: v('#s-address'),
            instagram: v('#s-ig'), instagramHandle: v('#s-igh'), tiktok: v('#s-tt'), facebook: v('#s-fb'), heroVideo: v('#s-hv'), heroImage: v('#s-hi'),
            announcement: { enabled: $('#a-on').checked, text: Object.fromEntries(LANGS.map(l => [l.code, v('#a-' + l.code)])) }
        },
        shipping: { zones },
        currency: { rates: { EUR: 1, TND: tnd, USD: usd }, enabled, default: def },
        payments: { cod: { enabled: $('#p-cod').checked }, stripe: { enabled: $('#p-stripe').checked }, paypal: { enabled: $('#p-paypal').checked, clientId: v('#p-ppid') } },
        marketing: {
            popupEnabled: $('#m-pop').checked, popupPercent: parseInt(v('#m-pct'), 10) || 10, popupDelaySec: parseInt(v('#m-delay'), 10) || 8,
            popupCode: v('#m-code').toUpperCase(), metaPixelId: v('#m-meta'), tiktokPixelId: v('#m-tt'), ga4Id: v('#m-ga')
        }
    };
    ev.target.disabled = true;
    const ok = await guard(async () => { for (const [k, val] of Object.entries(next)) await db.saveSettings(k, val); return true; }, 'Settings saved');
    ev.target.disabled = false;
    if (ok) setTimeout(() => location.reload(), 600);
};

$('#import').onclick = async () => {
    const msg = db.isDemo ? 'Reset all demo data (products, orders, settings) to the original sample content?' : 'Import the sample content to Firebase? Items with the same ID will be overwritten.';
    if (!(await confirmBox(msg, { okLabel: db.isDemo ? 'Reset' : 'Import', danger: db.isDemo, title: db.isDemo ? 'Reset demo data' : 'Import sample data' }))) return;
    if (await guard(() => db.importSampleData(), db.isDemo ? 'Demo data reset' : 'Sample data imported') !== undefined) setTimeout(() => location.reload(), 700);
};
