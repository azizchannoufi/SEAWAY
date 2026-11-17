import { bootAdmin, db, $, $$, esc, eur, badge, dateOnly, dateTime, openModal, confirmBox, guard, toast, debounce, downloadCSV } from './common.js';

await bootAdmin({ page: 'customers', title: 'Customers' });

let customers = [], subs = [], msgs = [], tab = new URLSearchParams(location.search).get('tab') || 'customers';
const SUBJECT = { order: 'My order', product: 'A product', wholesale: 'Wholesale', other: 'Other' };

$('#main').innerHTML = `<section class="card">
    <div class="tabs" role="tablist"><button class="tab" role="tab" data-tab="customers"></button><button class="tab" role="tab" data-tab="subs"></button><button class="tab" role="tab" data-tab="msgs"></button></div>
    <div id="panel"></div></section>`;

function head() {
    const unread = msgs.filter(m => !m.read).length;
    const names = { customers: `Customers (${customers.length})`, subs: `Newsletter (${subs.length})`, msgs: `Messages (${msgs.length})${unread ? ` · ${unread} new` : ''}` };
    $$('.tab').forEach(b => { b.textContent = names[b.dataset.tab]; b.setAttribute('aria-selected', String(b.dataset.tab === tab)); });
}

function renderCustomers() {
    $('#panel').innerHTML = `<div class="toolbar"><input class="input search" id="q" type="search" placeholder="Search name or email…" aria-label="Search customers"><span class="spacer"></span><button class="btn" id="csv" type="button">Export CSV</button></div>
        <div class="table-wrap"><table><thead><tr><th>Customer</th><th>Phone</th><th class="num">Orders</th><th class="num">Spent</th><th>Last order</th><th>Tags</th></tr></thead><tbody id="rows"></tbody></table></div>`;
    const draw = () => {
        const q = $('#q').value.trim().toLowerCase();
        $('#rows').innerHTML = customers.filter(c => !q || (c.name + ' ' + c.email).toLowerCase().includes(q)).map(c => `<tr>
            <td><strong>${esc(c.name) || '—'}</strong><br><a class="hint" href="mailto:${esc(c.email)}">${esc(c.email)}</a></td><td>${esc(c.phone) || '—'}</td>
            <td class="num">${c.orders}</td><td class="num"><strong>${eur(c.spent)}</strong></td><td>${dateOnly(c.lastOrder)}</td>
            <td>${c.account ? badge('confirmed', 'Account') : badge('plain', 'Guest')} ${c.subscribed ? badge('ok', 'Newsletter') : ''}</td></tr>`).join('')
            || '<tr><td colspan="6" class="empty">No customers yet.</td></tr>';
    };
    $('#q').addEventListener('input', debounce(draw, 120));
    $('#csv').onclick = () => downloadCSV('seaway-customers.csv', [['Name', 'Email', 'Phone', 'Orders', 'Spent EUR', 'Account', 'Newsletter'], ...customers.map(c => [c.name, c.email, c.phone, c.orders, c.spent.toFixed(2), c.account ? 'yes' : 'no', c.subscribed ? 'yes' : 'no'])]);
    draw();
}

function renderSubs() {
    $('#panel').innerHTML = `<div class="toolbar"><span class="hint">Subscribers from the footer form and the 10% welcome pop-up.</span><span class="spacer"></span><button class="btn" id="csv" type="button">Export CSV</button></div>
        <div class="table-wrap"><table><thead><tr><th>Email</th><th>Source</th><th>Joined</th><th></th></tr></thead><tbody>${subs.map(s => `<tr><td>${esc(s.email)}</td><td>${esc(s.source || '—')}</td><td>${dateTime(s.createdAt)}</td><td class="actions"><button class="btn sm danger" data-del="${esc(s.id)}">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No subscribers yet.</td></tr>'}</tbody></table></div>`;
    $('#csv').onclick = () => downloadCSV('seaway-subscribers.csv', [['Email', 'Source', 'Joined'], ...subs.map(s => [s.email, s.source, new Date(s.createdAt).toISOString()])]);
    $('#panel').onclick = async (e) => {
        const b = e.target.closest('[data-del]');
        if (b && await confirmBox('Remove this subscriber?')) { await guard(() => db.deleteSubscriber(b.dataset.del), 'Subscriber removed'); await load(); }
    };
}

function renderMsgs() {
    $('#panel').innerHTML = `<div class="table-wrap"><table><thead><tr><th>From</th><th>Subject</th><th>Message</th><th>Date</th><th></th></tr></thead><tbody>${msgs.map(m => `<tr class="${m.read ? '' : 'msg-unread'}">
        <td><strong>${esc(m.name)}</strong><br><span class="hint">${esc(m.email)}</span></td><td>${esc(SUBJECT[m.subject] || m.subject || '—')}</td>
        <td style="max-width:360px">${esc((m.message || '').slice(0, 110))}${(m.message || '').length > 110 ? '…' : ''}</td><td>${dateTime(m.createdAt)}</td>
        <td class="actions"><button class="btn sm" data-open="${esc(m.id)}">Open</button> <button class="btn sm danger" data-del="${esc(m.id)}">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">No messages yet.</td></tr>'}</tbody></table></div>`;
    $('#panel').onclick = async (e) => {
        const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]');
        if (o) {
            const m = msgs.find(x => x.id === o.dataset.open);
            const dlg = openModal({
                title: `Message from ${m.name}`,
                html: `<dl class="kv"><dt>Email</dt><dd><a href="mailto:${esc(m.email)}">${esc(m.email)}</a></dd><dt>Subject</dt><dd>${esc(SUBJECT[m.subject] || m.subject || '—')}</dd><dt>Received</dt><dd>${dateTime(m.createdAt)}</dd></dl><hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><p style="white-space:pre-wrap;margin:0">${esc(m.message)}</p>`,
                footer: `<button class="btn" data-close type="button">Close</button><a class="btn primary" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your message to Seaway')}">Reply by email</a>`
            });
            $('[data-close]', dlg.el).onclick = dlg.close;
            if (!m.read) { await db.updateMessage(m.id, { read: true }); m.read = true; head(); renderMsgs(); }
        }
        if (d && await confirmBox('Delete this message?')) { await guard(() => db.deleteMessage(d.dataset.del), 'Message deleted'); await load(); }
    };
}

function show() {
    head();
    ({ customers: renderCustomers, subs: renderSubs, msgs: renderMsgs }[tab] || renderCustomers)();
}
async function load() {
    [customers, subs, msgs] = await Promise.all([db.listCustomers(), db.listSubscribers(), db.listMessages()]);
    show();
}
$$('.tab').forEach(b => b.onclick = () => { tab = b.dataset.tab; show(); });
await load();
