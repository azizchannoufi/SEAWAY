import { bootAdmin, db, $, $$, esc, eur, nm, badge, openModal, confirmBox, guard, toast, debounce } from './common.js';
import { COLOR_PALETTE, SIZES, ONE_SIZE, LANGS } from '/js/config.js';
import { totalStock, colorStock, productThumb, LOW_STOCK } from '/js/catalog.js';

await bootAdmin({ page: 'products', title: 'Products & stock' });

let products = [], categories = [];
const catName = (id) => nm(categories.find(c => c.id === id)?.name) || id;
const COLOR_LABEL = { navy: 'Deep navy', sand: 'Warm sand', terracotta: 'Terracotta', white: 'Foam white', black: 'Black', olive: 'Olive', sage: 'Sage', sky: 'Sky', stone: 'Stone' };

$('#topbar-actions').innerHTML = '<button class="btn accent" id="add" type="button">+ New product</button>';
$('#main').innerHTML = `
<section class="card">
    <div class="toolbar">
        <input class="input search" id="q" type="search" placeholder="Search products…" aria-label="Search products">
        <select class="select" id="f-cat" aria-label="Collection"></select>
        <select class="select" id="f-stock" aria-label="Stock"><option value="">All stock levels</option><option value="low">Low stock</option><option value="out">Sold out</option><option value="hidden">Hidden</option></select>
    </div>
    <div class="table-wrap"><table>
        <thead><tr><th>Product</th><th>Collection</th><th class="num">Price</th><th>Colours</th><th class="num">Stock</th><th>Status</th><th></th></tr></thead>
        <tbody id="rows"></tbody>
    </table></div>
</section>`;

function filtered() {
    const q = $('#q').value.trim().toLowerCase(), c = $('#f-cat').value, s = $('#f-stock').value;
    return products.filter(p => {
        if (c && p.category !== c) return false;
        if (q && !(Object.values(p.name || {}).join(' ') + ' ' + p.slug).toLowerCase().includes(q)) return false;
        const t = totalStock(p);
        if (s === 'out') return t <= 0;
        if (s === 'low') return t > 0 && t <= LOW_STOCK * 3;
        if (s === 'hidden') return p.active === false;
        return true;
    });
}

function render() {
    $('#rows').innerHTML = filtered().map(p => {
        const t = totalStock(p);
        const st = p.active === false ? badge('inactive', 'Hidden') : t <= 0 ? badge('out', 'Sold out') : t <= LOW_STOCK * 3 ? badge('low', 'Low stock') : badge('active', 'Active');
        const flags = [p.featured && 'Featured', p.bestseller && 'Best seller', p.isNew && 'New'].filter(Boolean).join(' · ');
        return `<tr>
            <td><div class="cell-prod"><img src="${productThumb(p)}" alt="" width="44" height="54"><div><strong>${esc(nm(p.name))}</strong><span>${esc(p.slug)}${flags ? ' · ' + flags : ''}</span></div></div></td>
            <td>${esc(catName(p.category))}</td>
            <td class="num">${eur(p.price)}${p.comparePrice ? `<br><span class="hint"><s>${eur(p.comparePrice)}</s></span>` : ''}</td>
            <td>${(p.colors || []).map(c => `<span title="${esc(COLOR_LABEL[c] || c)} · ${colorStock(p, c)} in stock" style="display:inline-block;width:16px;height:16px;border-radius:50%;margin-inline-end:4px;border:1px solid rgba(0,0,0,.2);background:${COLOR_PALETTE.find(x => x.id === c)?.hex || '#ccc'}"></span>`).join('')}</td>
            <td class="num"><strong>${t}</strong></td>
            <td>${st}</td>
            <td class="actions"><button class="btn sm" data-edit="${esc(p.id)}">Edit</button> <button class="btn sm" data-dup="${esc(p.id)}" title="Duplicate">⧉</button> <button class="btn sm danger" data-del="${esc(p.id)}" title="Delete">✕</button></td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">No products found.</td></tr>';
}

// ── editor ──────────────────────────────────────────────────
function emptyProduct() {
    return {
        name: {}, desc: {}, material: {}, category: categories[0]?.id || '', price: 0, comparePrice: 0,
        colors: ['navy'], sizes: ['S', 'M', 'L', 'XL'], stock: {}, images: [], active: true, featured: false, bestseller: false, isNew: true
    };
}

function openEditor(src, { isNew }) {
    const p = JSON.parse(JSON.stringify(src));
    let images = [...(p.images || [])];
    let lang = 'en';
    const langBtns = LANGS.map(l => `<button type="button" data-lang="${l.code}" aria-pressed="${l.code === 'en'}">${l.short}</button>`).join('');
    const perLang = (key, label, tag, rows) => `<div class="field full"><label>${label} <span class="hint" data-miss="${key}"></span></label>${LANGS.map(l =>
        tag === 'input'
            ? `<input class="input" data-f="${key}" data-l="${l.code}" ${l.dir === 'rtl' ? 'dir="rtl"' : ''} value="${esc(p[key]?.[l.code] || '')}" ${l.code === 'en' ? '' : 'hidden'} placeholder="${label} (${l.short})">`
            : `<textarea class="textarea" rows="${rows}" data-f="${key}" data-l="${l.code}" ${l.dir === 'rtl' ? 'dir="rtl"' : ''} ${l.code === 'en' ? '' : 'hidden'} placeholder="${label} (${l.short})">${esc(p[key]?.[l.code] || '')}</textarea>`).join('')}</div>`;

    const m = openModal({
        wide: true, title: isNew ? 'New product' : `Edit · ${nm(p.name)}`,
        html: `
        <div class="form-grid">
            <div class="field full"><div class="row"><span class="lbl">Content language</span><div class="langtabs" id="langtabs">${langBtns}</div><span class="hint">Only English is required. Missing translations fall back to English.</span></div></div>
            ${perLang('name', 'Product name', 'input')}
            ${perLang('desc', 'Description', 'textarea', 4)}
            ${perLang('material', 'Materials & care', 'textarea', 3)}
            <div class="field"><label for="p-cat">Collection</label><select class="select" id="p-cat">${categories.map(c => `<option value="${esc(c.id)}" ${c.id === p.category ? 'selected' : ''}>${esc(nm(c.name))}</option>`).join('')}</select></div>
            <div class="field"><label for="p-slug">URL slug</label><input class="input" id="p-slug" value="${esc(p.slug || '')}" ${isNew ? '' : 'readonly'} placeholder="auto from the English name"><span class="hint">${isNew ? 'Used in /product/<slug>. Cannot be changed later.' : 'The slug is locked so existing links keep working.'}</span></div>
            <div class="field"><label for="p-price">Price (EUR)</label><input class="input" id="p-price" type="number" min="0" step="0.01" value="${p.price || ''}"></div>
            <div class="field"><label for="p-compare">Compare-at price (EUR, optional)</label><input class="input" id="p-compare" type="number" min="0" step="0.01" value="${p.comparePrice || ''}"><span class="hint">Shows a crossed-out price and a sale badge.</span></div>
            <div class="field"><label for="p-art">Artwork style (used when there are no photos)</label><select class="select" id="p-art"><option value="">Automatic (from collection)</option>${[['poncho', 'Poncho'], ['tee', 'T-shirt'], ['sweat', 'Sweatshirt'], ['shorts', 'Shorts'], ['pants', 'Pants'], ['cap', 'Cap'], ['drybag', 'Dry bag'], ['beanie', 'Beanie'], ['towel', 'Towel']].map(([v, l]) => `<option value="${v}" ${p.art === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            <div class="field full"><span class="lbl">Visibility & badges</span><div class="row" style="gap:20px">
                <label class="switch"><input type="checkbox" id="p-active" ${p.active !== false ? 'checked' : ''}> Visible in shop</label>
                <label class="check"><input type="checkbox" id="p-featured" ${p.featured ? 'checked' : ''}> Featured on home</label>
                <label class="check"><input type="checkbox" id="p-best" ${p.bestseller ? 'checked' : ''}> Best seller</label>
                <label class="check"><input type="checkbox" id="p-new" ${p.isNew ? 'checked' : ''}> New</label></div></div>
            <div class="field full"><span class="lbl">Colours</span><div class="chips" id="colors">${COLOR_PALETTE.map(c => `<label class="chip"><input type="checkbox" value="${c.id}" ${p.colors?.includes(c.id) ? 'checked' : ''}><span class="dot" style="background:${c.hex}"></span>${COLOR_LABEL[c.id] || c.id}</label>`).join('')}</div></div>
            <div class="field full"><span class="lbl">Sizes</span><div class="chips" id="sizes">${[...SIZES, ONE_SIZE].map(s => `<label class="chip"><input type="checkbox" value="${s}" ${p.sizes?.includes(s) ? 'checked' : ''}>${s === ONE_SIZE ? 'One size' : s}</label>`).join('')}</div></div>
            <div class="field full"><span class="lbl">Stock per colour × size</span><div class="stock-grid" id="stock"></div>
                <span class="hint">Stock decreases automatically with each order and is restored if an order is cancelled.</span></div>
            <div class="field full"><span class="lbl">Photos</span>
                <div class="img-grid" id="imgs"></div>
                <div class="dropzone" id="drop" tabindex="0" role="button">Click or drop photos here — they are resized automatically.<input type="file" id="file" accept="image/*" multiple hidden></div>
                <span class="hint">No photos yet? The shop shows generated artwork in the product's colour until you upload some. First photo = main image.</span></div>
        </div>`,
        footer: '<button class="btn" data-cancel type="button">Cancel</button><button class="btn primary" data-save type="button">Save product</button>'
    });
    const root = m.el;
    $('[data-cancel]', root).onclick = m.close;

    // language tabs
    const showLang = (l) => {
        lang = l;
        $$('#langtabs button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
        $$('[data-f]', root).forEach(el => { el.hidden = el.dataset.l !== l; });
    };
    $$('#langtabs button', root).forEach(b => b.onclick = () => showLang(b.dataset.lang));
    const refreshMissing = () => {
        ['name', 'desc', 'material'].forEach(k => {
            const miss = LANGS.filter(l => l.code !== 'en' && !$(`[data-f="${k}"][data-l="${l.code}"]`, root).value.trim()).map(l => l.short);
            $(`[data-miss="${k}"]`, root).textContent = miss.length ? `· missing: ${miss.join(', ')}` : '';
        });
    };
    root.addEventListener('input', (e) => { if (e.target.matches('[data-f]')) refreshMissing(); });
    refreshMissing();

    // auto slug
    if (isNew) {
        const slugEl = $('#p-slug', root);
        $('[data-f="name"][data-l="en"]', root).addEventListener('input', (e) => { if (!slugEl.dataset.touched) slugEl.value = db.slugify(e.target.value); });
        slugEl.addEventListener('input', () => { slugEl.dataset.touched = '1'; });
    }

    // colours / sizes -> stock matrix
    const checked = (sel) => $$(`${sel} input:checked`, root).map(i => i.value);
    const readStock = () => {
        $$('#stock input[data-k]', root).forEach(i => { p.stock[i.dataset.k] = Math.max(0, parseInt(i.value, 10) || 0); });
    };
    function buildStock() {
        readStock();
        const colors = checked('#colors'), sizes = checked('#sizes');
        const box = $('#stock', root);
        if (!colors.length || !sizes.length) { box.innerHTML = '<p class="empty" style="padding:16px">Choose at least one colour and one size.</p>'; return; }
        box.innerHTML = `<table><thead><tr><th>Colour</th>${sizes.map(s => `<th class="num">${s === ONE_SIZE ? 'One size' : s}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>${colors.map(c =>
            `<tr><td><span class="dot" style="display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:-1px;margin-inline-end:6px;border:1px solid rgba(0,0,0,.2);background:${COLOR_PALETTE.find(x => x.id === c).hex}"></span>${COLOR_LABEL[c] || c}</td>${sizes.map(s =>
                `<td class="num"><input type="number" min="0" step="1" data-k="${c}|${s}" value="${p.stock?.[`${c}|${s}`] ?? 0}" aria-label="${c} ${s} stock"></td>`).join('')}<td class="num rowtotal" data-c="${c}"></td></tr>`).join('')}</tbody></table>`;
        sumRows();
    }
    function sumRows() {
        $$('.rowtotal', root).forEach(td => { td.textContent = $$(`input[data-k^="${td.dataset.c}|"]`, root).reduce((s, i) => s + (parseInt(i.value, 10) || 0), 0); });
    }
    $('#stock', root).addEventListener('input', sumRows);
    $('#colors', root).addEventListener('change', buildStock);
    $('#sizes', root).addEventListener('change', (e) => {
        // "One size" excludes the others
        if (e.target.value === ONE_SIZE && e.target.checked) $$('#sizes input', root).forEach(i => { if (i.value !== ONE_SIZE) i.checked = false; });
        else if (e.target.checked) $(`#sizes input[value="${ONE_SIZE}"]`, root).checked = false;
        buildStock();
    });
    buildStock();

    // images
    function drawImgs() {
        $('#imgs', root).innerHTML = images.map((src, i) => `<div class="img-tile"><img src="${esc(src)}" alt="Photo ${i + 1}" loading="lazy">
            <div class="tools"><button type="button" data-mv="${i}" data-d="-1" aria-label="Move earlier" ${i === 0 ? 'disabled' : ''}>‹</button><button type="button" data-rm="${i}" aria-label="Remove">✕</button><button type="button" data-mv="${i}" data-d="1" aria-label="Move later" ${i === images.length - 1 ? 'disabled' : ''}>›</button></div>
            ${i === 0 ? '<span class="first">Main</span>' : ''}</div>`).join('');
    }
    drawImgs();
    $('#imgs', root).addEventListener('click', (e) => {
        const rm = e.target.closest('[data-rm]'), mv = e.target.closest('[data-mv]');
        if (rm) images.splice(+rm.dataset.rm, 1);
        else if (mv) { const i = +mv.dataset.mv, j = i + +mv.dataset.d; [images[i], images[j]] = [images[j], images[i]]; }
        else return;
        drawImgs();
    });
    const upload = async (files) => {
        const list = [...files].filter(f => f.type.startsWith('image/'));
        if (!list.length) return;
        const drop = $('#drop', root); const label = drop.firstChild.textContent;
        drop.firstChild.textContent = `Uploading ${list.length} photo(s)…`;
        for (const f of list) {
            const url = await guard(() => db.uploadImage(f, 'products'));
            if (url) { images.push(url); drawImgs(); }
        }
        drop.firstChild.textContent = label;
    };
    const drop = $('#drop', root), file = $('#file', root);
    drop.onclick = () => file.click();
    drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } };
    file.onchange = () => { upload(file.files); file.value = ''; };
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
    drop.addEventListener('drop', (e) => upload(e.dataTransfer.files));

    // save
    $('[data-save]', root).onclick = async (ev) => {
        readStock();
        const field = (k) => Object.fromEntries(LANGS.map(l => [l.code, $(`[data-f="${k}"][data-l="${l.code}"]`, root).value.trim()]).filter(([, v]) => v));
        const out = {
            ...p,
            name: field('name'), desc: field('desc'), material: field('material'),
            category: $('#p-cat', root).value, art: $('#p-art', root).value || undefined,
            price: Math.round(parseFloat($('#p-price', root).value) * 100) / 100 || 0,
            comparePrice: Math.round(parseFloat($('#p-compare', root).value) * 100) / 100 || 0,
            colors: checked('#colors'), sizes: checked('#sizes'),
            active: $('#p-active', root).checked, featured: $('#p-featured', root).checked,
            bestseller: $('#p-best', root).checked, isNew: $('#p-new', root).checked, images
        };
        const slug = db.slugify($('#p-slug', root).value || out.name.en || '');
        if (!out.name.en) { showLang('en'); $('[data-f="name"][data-l="en"]', root).focus(); return toast('Please enter the English product name.', 'err'); }
        if (!(out.price > 0)) return toast('Please enter a price greater than 0.', 'err');
        if (!out.category) return toast('Please create a collection first.', 'err');
        if (!out.colors.length || !out.sizes.length) return toast('Choose at least one colour and one size.', 'err');
        if (out.comparePrice && out.comparePrice <= out.price) out.comparePrice = 0;
        if (isNew) {
            if (products.some(x => x.slug === slug || x.id === slug)) { return toast(`The slug "${slug}" is already used by another product.`, 'err'); }
            out.slug = slug;
        }
        // keep only stock for the selected variants
        out.stock = Object.fromEntries(out.colors.flatMap(c => out.sizes.map(s => [`${c}|${s}`, p.stock?.[`${c}|${s}`] || 0])));
        ev.target.disabled = true;
        const id = await guard(() => db.saveProduct(out), 'Product saved');
        ev.target.disabled = false;
        if (id) { await load(); m.close(); }
    };
}

async function load() {
    [products, categories] = await Promise.all([db.getProducts({ includeInactive: true }), db.getCategories()]);
    const sel = $('#f-cat'), cur = sel.value;
    sel.innerHTML = '<option value="">All collections</option>' + categories.map(c => `<option value="${esc(c.id)}">${esc(nm(c.name))}</option>`).join('');
    sel.value = cur;
    render();
}

$('#add').onclick = () => openEditor(emptyProduct(), { isNew: true });
$('#rows').addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]'), dup = e.target.closest('[data-dup]');
    if (ed) openEditor(products.find(p => p.id === ed.dataset.edit), { isNew: false });
    if (dup) {
        const src = products.find(p => p.id === dup.dataset.dup);
        const copy = { ...JSON.parse(JSON.stringify(src)), id: undefined, slug: '', createdAt: Date.now() };
        copy.name = Object.fromEntries(Object.entries(copy.name || {}).map(([k, v]) => [k, v + (k === 'ar' ? '' : ' (copy)')]));
        delete copy.id;
        openEditor(copy, { isNew: true });
    }
    if (del) {
        const p = products.find(x => x.id === del.dataset.del);
        if (await confirmBox(`Delete “${nm(p.name)}”? Past orders keep their own copy of the item. To just hide it, edit the product instead.`)) {
            await guard(() => db.deleteProduct(p.id), 'Product deleted');
            await load();
        }
    }
});
['#q', '#f-cat', '#f-stock'].forEach(s => $(s).addEventListener('input', debounce(render, 120)));
await load();
