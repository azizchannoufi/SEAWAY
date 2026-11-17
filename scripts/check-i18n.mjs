// Verifies every translation key used by the storefront exists in EN / FR / IT / AR.
// Usage: node scripts/check-i18n.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const langs = ['en', 'fr', 'it', 'ar'];
const dicts = {};
for (const l of langs) dicts[l] = (await import(pathToFileURL(join(root, 'js', 'lang', l + '.js')).href)).default;

const files = [];
(function walk(dir) {
    for (const f of readdirSync(dir)) {
        if (['node_modules', '.git', 'functions', 'admin'].includes(f)) continue;
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (['.js', '.html'].includes(extname(p)) && !p.includes(join('js', 'lang'))) files.push(p);
    }
})(root);

const used = new Set();
const dynamic = [
    ...['navy', 'sand', 'terracotta', 'white', 'black', 'olive', 'sage', 'sky', 'stone'].map(c => 'color.' + c),
    ...['cod', 'stripe', 'paypal'].flatMap(m => ['pay.' + m, 'pay.' + m + 'Sub']),
    ...['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].map(s => 'status.' + s),
    ...['TN', 'FR', 'EU', 'INT'].map(z => 'zone.' + z),
    ...['order', 'product', 'wholesale', 'other'].map(s => 'contact.subject.' + s),
    ...['terms', 'privacy', 'cookies'].flatMap(k => [`legal.${k}.title`, `legal.${k}.sections`]),
    'cart.promoMin', 'cart.promoExpired', 'cart.promoUsedUp', 'cart.promoInvalid', 'toast.wishAdded', 'toast.wishRemoved',
    'card.addWishlist', 'card.removeWishlist', 'shop.results', 'shop.resultOne', 'collections.items', 'collections.itemOne'
];
dynamic.forEach(k => used.add(k));
for (const f of files) {
    const c = readFileSync(f, 'utf8');
    for (const re of [/\bt\('([A-Za-z0-9_.]+)'/g, /\btr\('([A-Za-z0-9_.]+)'/g, /data-i18n(?:-html)?="([A-Za-z0-9_.]+)"/g, /data-i18n-attr="[a-z-]+:([A-Za-z0-9_.]+)/g]) {
        for (const m of c.matchAll(re)) if (!m[1].endsWith('.') && m[1] !== 'key') used.add(m[1]);
    }
}

let bad = 0;
for (const k of [...used].sort()) {
    for (const l of langs) if (!(k in dicts[l])) { console.log(`MISSING [${l}] ${k}`); bad++; }
}
const base = new Set(Object.keys(dicts.en));
for (const l of langs.slice(1)) {
    for (const k of base) if (!(k in dicts[l])) { console.log(`NOT TRANSLATED [${l}] ${k}`); bad++; }
    for (const k of Object.keys(dicts[l])) if (!base.has(k)) { console.log(`EXTRA [${l}] ${k}`); bad++; }
}
console.log(bad ? `\n${bad} problem(s)` : `OK: ${used.size} keys used, all four languages complete (${base.size} keys).`);
process.exit(bad ? 1 : 0);
