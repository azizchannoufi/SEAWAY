import { bootAdmin, db, $, $$, esc, nm, openModal, confirmBox, guard, toast } from './common.js';
import { LANGS } from '/js/config.js';
import { collectionArt } from '/js/placeholders.js';

await bootAdmin({ page: 'collections', title: 'Collections' });

const ARTS = [['poncho', 'Poncho'], ['tee', 'T-shirt'], ['sweat', 'Sweatshirt'], ['shorts', 'Shorts'], ['pants', 'Pants'], ['cap', 'Cap'], ['drybag', 'Dry bag'], ['beanie', 'Beanie'], ['towel', 'Towel']];
let cats = [], products = [];

$('#topbar-actions').innerHTML = '<button class="btn accent" id="add" type="button">+ New collection</button>';
$('#main').innerHTML = `<section class="card"><div class="table-wrap"><table>
    <thead><tr><th>Collection</th><th>URL</th><th class="num">Order</th><th class="num">Products</th><th></th></tr></thead><tbody id="rows"></tbody></table></div></section>
    <p class="hint">Collections appear in the shop menu, the filters and on the home page. The URL (slug) is fixed once created so links keep working.</p>`;

function render() {
    $('#rows').innerHTML = cats.map(c => {
        const n = products.filter(p => p.category === c.id).length;
        return `<tr>
            <td><div class="cell-prod"><img src="${esc(c.image || collectionArt(c.art || 'tee', c.hex || '#0B2545'))}" alt="" width="44" height="54"><div><strong>${esc(nm(c.name))}</strong><span>${esc(nm(c.desc)).slice(0, 70)}</span></div></div></td>
            <td><code>/collections/${esc(c.slug)}</code></td><td class="num">${c.order ?? ''}</td><td class="num">${n}</td>
            <td class="actions"><button class="btn sm" data-edit="${esc(c.id)}">Edit</button> <button class="btn sm danger" data-del="${esc(c.id)}">✕</button></td></tr>`;
    }).join('') || '<tr><td colspan="5" class="empty">No collections yet.</td></tr>';
}

function openEditor(src, isNew) {
    const c = JSON.parse(JSON.stringify(src));
    let image = c.image || '';
    const lf = (key, label, tag) => `<div class="field full"><label>${label}</label>${LANGS.map(l => tag === 'input'
        ? `<input class="input" data-f="${key}" data-l="${l.code}" ${l.dir === 'rtl' ? 'dir="rtl"' : ''} value="${esc(c[key]?.[l.code] || '')}" placeholder="${l.label}">`
        : `<textarea class="textarea" rows="2" data-f="${key}" data-l="${l.code}" ${l.dir === 'rtl' ? 'dir="rtl"' : ''} placeholder="${l.label}">${esc(c[key]?.[l.code] || '')}</textarea>`).join('')}</div>`;
    const m = openModal({
        title: isNew ? 'New collection' : `Edit · ${nm(c.name)}`,
        html: `<div class="form-grid">
            ${lf('name', 'Name (EN required)', 'input')}
            ${lf('desc', 'Short description', 'textarea')}
            <div class="field"><label for="c-slug">URL slug</label><input class="input" id="c-slug" value="${esc(c.slug || '')}" ${isNew ? '' : 'readonly'} placeholder="auto from the English name"></div>
            <div class="field"><label for="c-order">Display order</label><input class="input" id="c-order" type="number" min="1" step="1" value="${c.order || cats.length + 1}"></div>
            <div class="field"><label for="c-art">Tile artwork (no photo)</label><select class="select" id="c-art">${ARTS.map(([v, l]) => `<option value="${v}" ${c.art === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field"><label for="c-hex">Artwork colour</label><input class="input" id="c-hex" type="color" value="${esc(c.hex || '#0B2545')}" style="padding:3px;height:40px"></div>
            <div class="field full"><span class="lbl">Cover photo (optional, portrait 4:5 works best)</span>
                <div class="row"><img id="c-prev" alt="" width="64" height="80" style="object-fit:cover;border-radius:8px;border:1px solid var(--line)">
                <button class="btn sm" type="button" id="c-up">Upload photo</button><button class="btn sm" type="button" id="c-clear">Remove</button><input type="file" id="c-file" accept="image/*" hidden></div></div>
        </div>`,
        footer: '<button class="btn" data-cancel type="button">Cancel</button><button class="btn primary" data-save type="button">Save collection</button>'
    });
    const root = m.el;
    const prev = () => { $('#c-prev', root).src = image || collectionArt($('#c-art', root).value, $('#c-hex', root).value); };
    prev();
    ['#c-art', '#c-hex'].forEach(s => $(s, root).addEventListener('input', prev));
    $('#c-up', root).onclick = () => $('#c-file', root).click();
    $('#c-file', root).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const u = await guard(() => db.uploadImage(f, 'collections')); if (u) { image = u; prev(); } };
    $('#c-clear', root).onclick = () => { image = ''; prev(); };
    $('[data-cancel]', root).onclick = m.close;
    if (isNew) {
        const slugEl = $('#c-slug', root);
        $('[data-f="name"][data-l="en"]', root).addEventListener('input', (e) => { if (!slugEl.dataset.t) slugEl.value = db.slugify(e.target.value); });
        slugEl.addEventListener('input', () => { slugEl.dataset.t = '1'; });
    }
    $('[data-save]', root).onclick = async () => {
        const get = (k) => Object.fromEntries(LANGS.map(l => [l.code, $(`[data-f="${k}"][data-l="${l.code}"]`, root).value.trim()]).filter(([, v]) => v));
        const out = { ...c, name: get('name'), desc: get('desc'), order: parseInt($('#c-order', root).value, 10) || 99, art: $('#c-art', root).value, hex: $('#c-hex', root).value, image };
        if (!out.name.en) return toast('Please enter the English name.', 'err');
        if (isNew) {
            const slug = db.slugify($('#c-slug', root).value || out.name.en);
            if (cats.some(x => x.id === slug)) return toast(`The slug "${slug}" is already in use.`, 'err');
            out.slug = slug; out.id = slug;
        }
        if (await guard(() => db.saveCategory(out), 'Collection saved') !== undefined) { await load(); m.close(); }
    };
}

async function load() {
    [cats, products] = await Promise.all([db.getCategories(), db.getProducts({ includeInactive: true })]);
    render();
}
$('#add').onclick = () => openEditor({ name: {}, desc: {}, art: 'tee', hex: '#0B2545' }, true);
$('#rows').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) openEditor(cats.find(c => c.id === ed.dataset.edit), false);
    if (del) {
        const c = cats.find(x => x.id === del.dataset.del);
        const n = products.filter(p => p.category === c.id).length;
        if (n) return toast(`“${nm(c.name)}” still has ${n} product(s). Move or delete them first.`, 'err');
        if (await confirmBox(`Delete the collection “${nm(c.name)}”?`)) { await guard(() => db.deleteCategory(c.id), 'Collection deleted'); await load(); }
    }
});
await load();
