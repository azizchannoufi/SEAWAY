import { bootAdmin, db, $, esc, eur, badge, openModal, confirmBox, guard, toast, dateOnly } from './common.js';

await bootAdmin({ page: 'promos', title: 'Promo codes' });

let promos = [];
const TYPE = { percent: 'Percentage off', fixed: 'Fixed amount off', freeship: 'Free shipping' };

$('#topbar-actions').innerHTML = '<button class="btn accent" id="add" type="button">+ New promo code</button>';
$('#main').innerHTML = `<section class="card"><div class="table-wrap"><table>
    <thead><tr><th>Code</th><th>Discount</th><th>Conditions</th><th class="num">Used</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></section>
    <p class="hint">Customers type the code in the cart or at checkout. The newsletter pop-up code is set in Settings → Marketing (create it here first).</p>`;

const label = (p) => p.type === 'percent' ? `${p.value}% off` : p.type === 'fixed' ? `${eur(p.value)} off` : 'Free shipping';
function state(p) {
    if (p.active === false) return badge('inactive', 'Disabled');
    if (p.expiresAt && Date.now() > p.expiresAt) return badge('out', 'Expired');
    if (p.maxUses > 0 && (p.uses || 0) >= p.maxUses) return badge('out', 'Used up');
    return badge('active', 'Active');
}
function render() {
    $('#rows').innerHTML = promos.map(p => `<tr>
        <td><strong>${esc(p.code)}</strong>${p.note ? `<br><span class="hint">${esc(p.note)}</span>` : ''}</td>
        <td>${label(p)}</td>
        <td>${[p.minSubtotal > 0 && `min ${eur(p.minSubtotal)}`, p.expiresAt && `until ${dateOnly(p.expiresAt)}`, p.maxUses > 0 && `max ${p.maxUses} uses`].filter(Boolean).join(' · ') || '—'}</td>
        <td class="num">${p.uses || 0}${p.maxUses > 0 ? ` / ${p.maxUses}` : ''}</td><td>${state(p)}</td>
        <td class="actions"><button class="btn sm" data-edit="${esc(p.code)}">Edit</button> <button class="btn sm danger" data-del="${esc(p.code)}">✕</button></td></tr>`).join('')
        || '<tr><td colspan="6" class="empty">No promo codes yet.</td></tr>';
}

function openEditor(src, isNew) {
    const p = { type: 'percent', value: 10, minSubtotal: 0, maxUses: 0, uses: 0, active: true, ...src };
    const exp = p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : '';
    const m = openModal({
        title: isNew ? 'New promo code' : `Edit · ${p.code}`,
        html: `<div class="form-grid">
            <div class="field"><label for="p-code">Code</label><input class="input" id="p-code" value="${esc(p.code || '')}" ${isNew ? '' : 'readonly'} style="text-transform:uppercase" placeholder="SUMMER20" autocomplete="off"></div>
            <div class="field"><label for="p-type">Type</label><select class="select" id="p-type">${Object.entries(TYPE).map(([k, v]) => `<option value="${k}" ${p.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
            <div class="field" id="val-wrap"><label for="p-value" id="val-label">Value</label><input class="input" id="p-value" type="number" min="0" step="0.01" value="${p.value}"></div>
            <div class="field"><label for="p-min">Minimum basket (EUR)</label><input class="input" id="p-min" type="number" min="0" step="1" value="${p.minSubtotal || 0}"></div>
            <div class="field"><label for="p-max">Maximum uses (0 = unlimited)</label><input class="input" id="p-max" type="number" min="0" step="1" value="${p.maxUses || 0}"></div>
            <div class="field"><label for="p-exp">Expires on (optional)</label><input class="input" id="p-exp" type="date" value="${exp}"></div>
            <div class="field full"><label for="p-note">Internal note</label><input class="input" id="p-note" value="${esc(p.note || '')}" placeholder="Campaign, influencer…"></div>
            <div class="field full"><label class="switch"><input type="checkbox" id="p-active" ${p.active !== false ? 'checked' : ''}> Code is active</label></div>
        </div>`,
        footer: '<button class="btn" data-cancel type="button">Cancel</button><button class="btn primary" data-save type="button">Save</button>'
    });
    const root = m.el;
    const sync = () => {
        const t = $('#p-type', root).value;
        $('#val-wrap', root).hidden = t === 'freeship';
        $('#val-label', root).textContent = t === 'percent' ? 'Discount (%)' : 'Discount (EUR)';
    };
    $('#p-type', root).onchange = sync; sync();
    $('[data-cancel]', root).onclick = m.close;
    $('[data-save]', root).onclick = async () => {
        const code = $('#p-code', root).value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const type = $('#p-type', root).value;
        const value = type === 'freeship' ? 0 : parseFloat($('#p-value', root).value) || 0;
        if (!code) return toast('Please enter a code (letters and digits).', 'err');
        if (type !== 'freeship' && value <= 0) return toast('The discount must be greater than 0.', 'err');
        if (type === 'percent' && value > 100) return toast('A percentage cannot exceed 100.', 'err');
        if (isNew && promos.some(x => x.code === code)) return toast('This code already exists.', 'err');
        const expVal = $('#p-exp', root).value;
        const out = {
            ...p, code, type, value, minSubtotal: parseFloat($('#p-min', root).value) || 0, maxUses: parseInt($('#p-max', root).value, 10) || 0,
            expiresAt: expVal ? new Date(expVal + 'T23:59:59').getTime() : 0, note: $('#p-note', root).value.trim(), active: $('#p-active', root).checked
        };
        if (await guard(() => db.savePromo(out), 'Promo code saved') !== undefined) { await load(); m.close(); }
    };
}
async function load() { promos = await db.listPromos(); render(); }
$('#add').onclick = () => openEditor({}, true);
$('#rows').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) openEditor(promos.find(p => p.code === ed.dataset.edit), false);
    if (del && await confirmBox(`Delete the code ${del.dataset.del}?`)) { await guard(() => db.deletePromo(del.dataset.del), 'Promo code deleted'); await load(); }
});
await load();
