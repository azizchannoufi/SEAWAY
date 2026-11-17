import { bootAdmin, db, $, $$, esc, eur, nm, dateTime, badge, openModal, confirmBox, guard, toast, debounce, downloadCSV } from './common.js';
import { ORDER_STATUSES, COUNTRIES } from '/js/config.js';

await bootAdmin({ page: 'orders', title: 'Orders' });

const qs = new URLSearchParams(location.search);
let orders = [];
const countryName = Object.fromEntries(COUNTRIES);
const METHOD = { cod: 'Cash on delivery', stripe: 'Card (Stripe)', paypal: 'PayPal' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

$('#main').innerHTML = `
<section class="card">
    <div class="toolbar">
        <input class="input search" id="q" type="search" placeholder="Search number, name, email…" aria-label="Search orders">
        <select class="select" id="f-status" aria-label="Status"><option value="">All statuses</option>${ORDER_STATUSES.map(s => `<option value="${s}">${cap(s)}</option>`).join('')}</select>
        <select class="select" id="f-method" aria-label="Payment method"><option value="">All payments</option>${Object.entries(METHOD).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <button class="btn" id="csv" type="button">Export CSV</button>
    </div>
    <div class="table-wrap"><table>
        <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Country</th><th>Payment</th><th>Status</th><th class="num">Total</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
    </table></div>
</section>`;
if (qs.get('status')) $('#f-status').value = qs.get('status');

function filtered() {
    const q = $('#q').value.trim().toLowerCase(), st = $('#f-status').value, me = $('#f-method').value;
    return orders.filter(o =>
        (!st || o.status === st) && (!me || o.payment?.method === me) &&
        (!q || [o.number, o.customer?.name, o.customer?.email, o.customer?.phone].join(' ').toLowerCase().includes(q)));
}

function render() {
    const list = filtered();
    $('#rows').innerHTML = list.map(o => `<tr>
        <td><button class="link" data-open="${esc(o.id)}">${esc(o.number)}</button></td>
        <td>${dateTime(o.createdAt)}</td>
        <td><strong>${esc(o.customer?.name)}</strong><br><span class="hint">${esc(o.customer?.email)}</span></td>
        <td>${esc(o.shipping?.country)}</td>
        <td>${esc(METHOD[o.payment?.method] || o.payment?.method || '—')}<br>${badge(o.payment?.status || 'unpaid')}</td>
        <td>${badge(o.status)}</td>
        <td class="num"><strong>${eur(o.total)}</strong>${o.currency && o.currency !== 'EUR' ? `<br><span class="hint">shown in ${esc(o.currency)}</span>` : ''}</td>
        <td class="actions"><button class="btn sm" data-open="${esc(o.id)}">View</button></td></tr>`).join('')
        || '<tr><td colspan="8" class="empty">No orders match these filters.</td></tr>';
}

function openOrder(id) {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    const items = (o.items || []).map(i => `<tr><td>${esc(nm(i.name))}<br><span class="hint">${esc(i.color)} · ${esc(i.size === 'ONE' ? 'One size' : i.size)}</span></td><td class="num">${i.qty}</td><td class="num">${eur(i.price)}</td><td class="num">${eur(i.price * i.qty)}</td></tr>`).join('');
    const ship = o.shipping || {};
    const m = openModal({
        wide: true, title: `Order ${o.number}`,
        html: `
        ${o.issues?.length ? `<div class="login-err" style="margin-bottom:16px"><strong>Needs your attention:</strong> ${esc(o.issues.join(', '))}. ${o.status === 'cancelled' ? 'The order was cancelled automatically.' : 'Check stock before shipping.'}</div>` : ''}
        <div class="grid c2">
            <div>
                <p class="sect-title">Customer</p>
                <dl class="kv">
                    <dt>Name</dt><dd>${esc(o.customer?.name)}</dd>
                    <dt>Email</dt><dd><a href="mailto:${esc(o.customer?.email)}">${esc(o.customer?.email)}</a></dd>
                    <dt>Phone</dt><dd>${esc(o.customer?.phone) || '—'}</dd>
                    <dt>Address</dt><dd>${esc(ship.address)}<br>${esc(ship.postal)} ${esc(ship.city)}<br>${esc(countryName[ship.country] || ship.country)}</dd>
                    <dt>Placed</dt><dd>${dateTime(o.createdAt)}</dd>
                    <dt>Language</dt><dd>${esc((o.lang || 'en').toUpperCase())}</dd>
                    ${o.notes ? `<dt>Customer note</dt><dd>${esc(o.notes)}</dd>` : ''}
                </dl>
            </div>
            <div>
                <p class="sect-title">Fulfilment</p>
                <div class="form-grid" style="margin-top:10px">
                    <div class="field"><label for="o-status">Order status</label><select class="select" id="o-status">${ORDER_STATUSES.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${cap(s)}</option>`).join('')}</select></div>
                    <div class="field"><label for="o-pay">Payment status</label><select class="select" id="o-pay">${['unpaid', 'awaiting', 'paid', 'refunded'].map(s => `<option value="${s}" ${(o.payment?.status || 'unpaid') === s ? 'selected' : ''}>${cap(s)}</option>`).join('')}</select></div>
                    <div class="field full"><label for="o-track">Tracking number</label><input class="input" id="o-track" value="${esc(o.tracking || '')}" placeholder="Carrier tracking number"></div>
                    <div class="field full"><label for="o-admin-note">Internal note</label><textarea class="textarea" id="o-admin-note" placeholder="Visible to admins only">${esc(o.adminNote || '')}</textarea></div>
                </div>
                <p class="hint" style="margin-top:8px">Payment: ${esc(METHOD[o.payment?.method] || '—')}${o.demo ? ' (demo)' : ''}. Cancelling an order puts its items back in stock. A shipping email is sent automatically when you set the status to “Shipped” (live mode).</p>
            </div>
        </div>
        <p class="sect-title" style="margin-top:20px">Items</p>
        <div class="table-wrap"><table class="order-items"><thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Total</th></tr></thead><tbody>${items}</tbody></table></div>
        <div class="sum">
            <div><span>Subtotal</span><span>${eur(o.subtotal)}</span></div>
            ${o.discount ? `<div><span>Discount ${o.promoCode ? `(${esc(o.promoCode)})` : ''}</span><span>−${eur(o.discount)}</span></div>` : ''}
            <div><span>Shipping</span><span>${o.shippingCost ? eur(o.shippingCost) : 'Free'}</span></div>
            <div class="total"><span>Total</span><span>${eur(o.total)}</span></div>
        </div>`,
        footer: `<button class="btn" data-print type="button">Print</button><button class="btn" data-close type="button">Close</button><button class="btn primary" data-save type="button">Save changes</button>`
    });
    $('[data-close]', m.el).onclick = m.close;
    $('[data-print]', m.el).onclick = () => window.print();
    $('[data-save]', m.el).onclick = async () => {
        const status = $('#o-status', m.el).value;
        if (status === 'cancelled' && o.status !== 'cancelled' && !(await confirmBox('Cancel this order and return its items to stock?', { okLabel: 'Cancel order', title: 'Cancel order' }))) return;
        const patch = {
            status, tracking: $('#o-track', m.el).value.trim(), adminNote: $('#o-admin-note', m.el).value.trim(),
            payment: { ...(o.payment || {}), status: $('#o-pay', m.el).value }
        };
        if (!(await guard(() => db.updateOrder(o.id, patch), 'Order updated'))) return;
        orders = await db.listOrders();
        render(); m.close();
    };
}

$('#rows').addEventListener('click', (e) => { const b = e.target.closest('[data-open]'); if (b) openOrder(b.dataset.open); });
['#q', '#f-status', '#f-method'].forEach(s => $(s).addEventListener('input', debounce(render, 120)));
$('#csv').onclick = () => {
    const rows = [['Number', 'Date', 'Name', 'Email', 'Phone', 'Country', 'City', 'Address', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total EUR', 'Payment', 'Payment status', 'Status', 'Tracking']];
    filtered().forEach(o => rows.push([o.number, new Date(o.createdAt).toISOString(), o.customer?.name, o.customer?.email, o.customer?.phone, o.shipping?.country, o.shipping?.city, o.shipping?.address,
        (o.items || []).map(i => `${i.qty}x ${nm(i.name)} (${i.color}/${i.size})`).join(' | '), o.subtotal, o.discount, o.shippingCost, o.total, o.payment?.method, o.payment?.status, o.status, o.tracking]));
    downloadCSV(`seaway-orders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
    toast(`${rows.length - 1} orders exported`, 'ok');
};

orders = await db.listOrders();
render();
if (qs.get('open')) openOrder(qs.get('open'));
