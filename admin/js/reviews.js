import { bootAdmin, db, $, $$, esc, nm, stars, badge, dateOnly, confirmBox, guard } from './common.js';

await bootAdmin({ page: 'reviews', title: 'Reviews' });

let reviews = [], products = [], filter = 'pending';
$('#main').innerHTML = `<section class="card">
    <div class="tabs" role="tablist"><button class="tab" role="tab" data-f="pending"></button><button class="tab" role="tab" data-f="approved"></button><button class="tab" role="tab" data-f="all"></button></div>
    <div id="list"></div></section>
    <p class="hint">Customer reviews are submitted as “pending” and only appear in the shop once you approve them.</p>`;

function render() {
    const n = (s) => reviews.filter(r => s === 'all' || r.status === s).length;
    const labels = { pending: `Pending (${n('pending')})`, approved: `Approved (${n('approved')})`, all: `All (${n('all')})` };
    $$('.tab').forEach(b => { b.textContent = labels[b.dataset.f]; b.setAttribute('aria-selected', String(b.dataset.f === filter)); });
    const list = reviews.filter(r => filter === 'all' || r.status === filter);
    $('#list').innerHTML = list.map(r => `<article class="review-card">
        <div class="row"><span class="stars" aria-label="${r.rating} out of 5">${stars(r.rating)}</span><strong>${esc(r.name)}</strong>${badge(r.status)}<span class="hint">${dateOnly(r.createdAt)} · ${esc(nm(products.find(p => p.id === r.productId)?.name) || r.productId)}</span></div>
        <p style="margin:0">${esc(r.text)}</p>
        <div class="row">${r.status !== 'approved' ? `<button class="btn sm primary" data-ok="${esc(r.id)}">Approve</button>` : `<button class="btn sm" data-hide="${esc(r.id)}">Unpublish</button>`}<button class="btn sm danger" data-del="${esc(r.id)}">Delete</button></div>
    </article>`).join('') || '<p class="empty">Nothing here.</p>';
}
async function load() {
    [reviews, products] = await Promise.all([db.listAllReviews(), db.getProducts({ includeInactive: true })]);
    render();
}
$$('.tab').forEach(b => b.onclick = () => { filter = b.dataset.f; render(); });
$('#list').addEventListener('click', async (e) => {
    const ok = e.target.closest('[data-ok]'), hide = e.target.closest('[data-hide]'), del = e.target.closest('[data-del]');
    if (ok) { await guard(() => db.updateReview(ok.dataset.ok, { status: 'approved' }), 'Review approved'); await load(); }
    if (hide) { await guard(() => db.updateReview(hide.dataset.hide, { status: 'pending' }), 'Review unpublished'); await load(); }
    if (del && await confirmBox('Delete this review permanently?')) { await guard(() => db.deleteReview(del.dataset.del), 'Review deleted'); await load(); }
});
await load();
