import { bootAdmin, db, $, esc, eur, num, nm, dateTime, badge } from './common.js';
import { totalStock, LOW_STOCK, variantStock } from '/js/catalog.js';
import { productThumb } from '/js/catalog.js';

await bootAdmin({ page: 'dashboard', title: 'Dashboard' });

const DAY = 86400000;
const [orders, products, customers, reviews, messages, subs] = await Promise.all([
    db.listOrders(), db.getProducts({ includeInactive: true }), db.listCustomers(),
    db.listAllReviews(), db.listMessages(), db.listSubscribers()
]);

const live = orders.filter(o => o.status !== 'cancelled');
const sum = (arr) => arr.reduce((s, o) => s + (Number(o.total) || 0), 0);
const now = Date.now();
const inRange = (o, from, to) => o.createdAt >= from && o.createdAt < to;
const cur = live.filter(o => inRange(o, now - 30 * DAY, now + 1));
const prev = live.filter(o => inRange(o, now - 60 * DAY, now - 30 * DAY));
const pct = (a, b) => (b ? Math.round((a - b) / b * 100) : null);
const delta = (a, b) => {
    const d = pct(a, b);
    return d === null ? '<span class="delta">no previous period</span>' : `<span class="delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}% vs previous 30 days</span>`;
};
const revenue = sum(cur), prevRevenue = sum(prev);
const aov = cur.length ? revenue / cur.length : 0;
const pending = orders.filter(o => o.status === 'pending').length;

// low-stock variants
const lowVariants = [];
products.filter(p => p.active !== false).forEach(p => {
    (p.colors || []).forEach(c => (p.sizes || []).forEach(s => {
        const n = variantStock(p, c, s);
        if (n <= LOW_STOCK) lowVariants.push({ p, c, s, n });
    }));
});
lowVariants.sort((a, b) => a.n - b.n);

// daily revenue, last 14 days
const days = [];
for (let i = 13; i >= 0; i--) {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setTime(start.getTime() - i * DAY);
    const end = start.getTime() + DAY;
    const list = live.filter(o => inRange(o, start.getTime(), end));
    days.push({ label: start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: sum(list), count: list.length });
}
function chartSVG() {
    const W = 700, H = 220, pad = { l: 44, r: 8, t: 12, b: 28 };
    const max = Math.max(10, ...days.map(d => d.value));
    const nice = Math.ceil(max / 4 / 10) * 10 * 4 || 40;
    const bw = (W - pad.l - pad.r) / days.length;
    let g = '';
    for (let i = 0; i <= 4; i++) {
        const y = pad.t + (H - pad.t - pad.b) * (1 - i / 4);
        g += `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y}" y2="${y}"/><text x="${pad.l - 6}" y="${y + 3}" text-anchor="end">${Math.round(nice * i / 4)}</text>`;
    }
    days.forEach((d, i) => {
        const h = (H - pad.t - pad.b) * d.value / nice;
        const x = pad.l + i * bw + bw * .18, y = H - pad.b - h;
        g += `<rect class="bar" x="${x}" y="${y}" width="${bw * .64}" height="${Math.max(h, d.value ? 2 : 0)}" rx="3"><title>${d.label}: ${eur(d.value)} (${d.count} orders)</title></rect>`;
        if (i % 2 === 0) g += `<text x="${x + bw * .32}" y="${H - 10}" text-anchor="middle">${d.label}</text>`;
    });
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Daily revenue for the last 14 days">${g}</svg>`;
}

// best sellers (units, non-cancelled)
const units = {};
live.forEach(o => (o.items || []).forEach(i => { units[i.productId] = (units[i.productId] || 0) + i.qty; }));
const top = Object.entries(units).sort((a, b) => b[1] - a[1]).slice(0, 5);
const topMax = top[0]?.[1] || 1;
const nameOf = (id) => nm(products.find(p => p.id === id)?.name) || id;

const stat = (label, value, sub, href) => `<div class="card stat"><span class="label">${label}</span><span class="value">${href ? `<a href="${href}">${value}</a>` : value}</span>${sub}</div>`;
const pendingReviews = reviews.filter(r => r.status === 'pending').length;
const unread = messages.filter(m => !m.read).length;

$('#main').innerHTML = `
<div class="grid c4">
    ${stat('Revenue · 30 days', eur(revenue), delta(revenue, prevRevenue))}
    ${stat('Orders · 30 days', num(cur.length), delta(cur.length, prev.length))}
    ${stat('Average order', eur(aov), `<span class="delta">${num(customers.length)} customers · ${num(subs.length)} subscribers</span>`)}
    ${stat('To process', num(pending), `<span class="delta">${pendingReviews} reviews · ${unread} messages waiting</span>`, '/admin/orders.html?status=pending')}
</div>
<div class="grid side">
    <section class="card"><div class="card-h"><h2>Revenue · last 14 days</h2></div><div class="card-b">${chartSVG()}</div></section>
    <section class="card"><div class="card-h"><h2>Best sellers</h2></div><div class="card-b">
        ${top.length ? `<div class="bars">${top.map(([id, n]) => `<div class="bar-row"><span>${esc(nameOf(id))}</span><strong>${n} sold</strong><span class="track"><i style="width:${Math.round(n / topMax * 100)}%"></i></span></div>`).join('')}</div>` : '<p class="empty">No sales yet.</p>'}
    </div></section>
</div>
<div class="grid side">
    <section class="card"><div class="card-h"><h2>Recent orders</h2><span class="spacer"></span><a class="btn sm" href="/admin/orders.html">All orders</a></div>
        <div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th class="num">Total</th></tr></thead><tbody>
        ${orders.slice(0, 7).map(o => `<tr><td><a href="/admin/orders.html?open=${encodeURIComponent(o.id)}"><strong>${esc(o.number)}</strong></a></td><td>${esc(o.customer?.name)}</td><td>${dateTime(o.createdAt)}</td><td>${badge(o.status)}</td><td class="num">${eur(o.total)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No orders yet.</td></tr>'}
        </tbody></table></div>
    </section>
    <section class="card"><div class="card-h"><h2>Low stock</h2><span class="spacer"></span><a class="btn sm" href="/admin/products.html">Manage</a></div>
        <div class="list">${lowVariants.slice(0, 7).map(v => `<div class="list-item"><img src="${productThumb(v.p, v.c)}" alt="" width="36" height="44" style="border-radius:6px;object-fit:cover"><div class="grow"><strong>${esc(nm(v.p.name))}</strong><small>${esc(v.c)} · ${esc(v.s)}</small></div>${v.n ? badge('low', v.n + ' left') : badge('out', 'Sold out')}</div>`).join('') || '<p class="empty">Stock levels look healthy.</p>'}</div>
    </section>
</div>`;
