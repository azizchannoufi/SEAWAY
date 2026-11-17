// ============================================================
// SEAWAY - Generated product artwork (SVG placeholders)
// Used whenever a product has no uploaded photo, so the shop looks
// finished out of the box. Colour follows the selected variant.
// ============================================================

const cache = new Map();

function clamp(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function mix(hex, target, amt) {
    const h = hex.replace('#', '');
    const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
    const t = target === 'w' ? 255 : 0;
    return '#' + c.map(v => clamp(v + (t - v) * amt).toString(16).padStart(2, '0')).join('');
}
const dark = (h, a = 0.2) => mix(h, 'b', a);
const light = (h, a = 0.25) => mix(h, 'w', a);

// Garment silhouettes drawn in an 800 x 1000 box
const SHAPES = {
    tee: (c) => `
        <path d="M270 215 L335 188 Q400 238 465 188 L530 215 L650 330 L580 400 L530 360 L530 810 L270 810 L270 360 L220 400 L150 330 Z" fill="${c}"/>
        <path d="M270 360 L270 810 L330 810 L330 300 Z" fill="${dark(c, .07)}" opacity=".5"/>
        <path d="M335 188 Q400 262 465 188 Q400 224 335 188" fill="${dark(c, .28)}"/>
        <path d="M270 790 H530" stroke="${dark(c, .15)}" stroke-width="3"/>`,
    sweat: (c) => `
        <path d="M285 195 L340 172 Q400 225 460 172 L515 195 L655 700 L580 728 L530 470 L530 830 L270 830 L270 470 L220 728 L145 700 Z" fill="${c}"/>
        <rect x="270" y="786" width="260" height="44" fill="${dark(c, .14)}"/>
        <path d="M145 700 L220 728 L228 765 L152 738 Z" fill="${dark(c, .14)}"/>
        <path d="M655 700 L580 728 L572 765 L648 738 Z" fill="${dark(c, .14)}"/>
        <path d="M340 172 Q400 245 460 172 Q400 210 340 172" fill="${dark(c, .3)}"/>
        <path d="M400 235 V330" stroke="${dark(c, .2)}" stroke-width="4"/>
        <g stroke="${dark(c, .14)}" stroke-width="2">${Array.from({ length: 13 }, (_, i) => `<path d="M${280 + i * 20} 786 V830"/>`).join('')}</g>`,
    poncho: (c) => `
        <path d="M255 270 Q400 205 545 270 L745 800 L55 800 Z" fill="${c}"/>
        <path d="M300 285 Q400 85 500 285 Q400 345 300 285" fill="${dark(c, .12)}"/>
        <path d="M335 270 Q400 150 465 270 Q400 310 335 270" fill="${dark(c, .45)}"/>
        <clipPath id="pc"><path d="M255 270 Q400 205 545 270 L745 800 L55 800 Z"/></clipPath>
        <g clip-path="url(#pc)">
            <rect x="0" y="670" width="800" height="14" fill="${light(c, .55)}" opacity=".85"/>
            <rect x="0" y="700" width="800" height="6" fill="${dark(c, .25)}"/>
            <rect x="0" y="728" width="800" height="22" fill="${light(c, .55)}" opacity=".85"/>
            <rect x="0" y="758" width="800" height="6" fill="${dark(c, .25)}"/>
            <rect x="0" y="560" width="800" height="5" fill="${light(c, .45)}" opacity=".8"/>
        </g>
        <g stroke="${light(c, .35)}" stroke-width="3">${Array.from({ length: 37 }, (_, i) => `<path d="M${64 + i * 18.6} 800 V836"/>`).join('')}</g>
        <path d="M400 330 V560" stroke="${dark(c, .15)}" stroke-width="3" stroke-dasharray="4 8"/>`,
    shorts: (c) => `
        <path d="M235 265 L565 265 L610 700 L430 700 L400 470 L370 700 L190 700 Z" fill="${c}"/>
        <rect x="235" y="265" width="330" height="46" fill="${dark(c, .16)}"/>
        <path d="M385 311 Q380 380 360 400 M415 311 Q420 380 440 400" stroke="${light(c, .55)}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M400 470 L400 311" stroke="${dark(c, .2)}" stroke-width="3"/>
        <path d="M190 700 L370 700 M430 700 L610 700" stroke="${dark(c, .2)}" stroke-width="6"/>`,
    pants: (c) => `
        <path d="M245 175 L555 175 L598 845 L445 845 L400 420 L355 845 L202 845 Z" fill="${c}"/>
        <rect x="245" y="175" width="310" height="48" fill="${dark(c, .16)}"/>
        <path d="M385 223 Q380 290 360 312 M415 223 Q420 290 440 312" stroke="${light(c, .55)}" stroke-width="5" fill="none" stroke-linecap="round"/>
        <path d="M400 420 L400 223" stroke="${dark(c, .2)}" stroke-width="3"/>
        <path d="M202 810 H355 M445 810 H598" stroke="${dark(c, .2)}" stroke-width="22"/>`,
    cap: (c) => `
        <path d="M190 590 Q195 310 400 285 Q605 310 610 590 Z" fill="${c}"/>
        <path d="M400 285 V590 M300 300 Q290 450 300 590 M500 300 Q510 450 500 590" stroke="${dark(c, .14)}" stroke-width="3" fill="none"/>
        <path d="M150 590 Q420 540 770 640 Q700 725 410 680 Q250 650 150 590 Z" fill="${dark(c, .2)}"/>
        <circle cx="400" cy="290" r="14" fill="${dark(c, .22)}"/>
        <rect x="190" y="572" width="420" height="20" fill="${dark(c, .12)}"/>`,
    drybag: (c) => `
        <path d="M250 340 H550 V780 Q550 830 500 830 H300 Q250 830 250 780 Z" fill="${c}"/>
        <rect x="235" y="240" width="330" height="100" rx="14" fill="${dark(c, .18)}"/>
        <path d="M235 290 H565" stroke="${dark(c, .35)}" stroke-width="3"/>
        <path d="M290 240 Q400 120 510 240" stroke="${dark(c, .25)}" stroke-width="16" fill="none" stroke-linecap="round"/>
        <rect x="372" y="330" width="56" height="34" rx="6" fill="${light(c, .45)}"/>
        <path d="M280 520 H520 M280 680 H520" stroke="${light(c, .3)}" stroke-width="3" opacity=".6"/>
        <circle cx="400" cy="600" r="46" fill="none" stroke="${light(c, .55)}" stroke-width="5"/>
        <path d="M368 615 Q384 590 400 610 Q416 630 432 600" stroke="${light(c, .55)}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    beanie: (c) => `
        <path d="M215 600 Q210 270 400 250 Q590 270 585 600 Z" fill="${c}"/>
        <rect x="205" y="575" width="390" height="115" rx="26" fill="${dark(c, .14)}"/>
        <g stroke="${dark(c, .3)}" stroke-width="3">${Array.from({ length: 18 }, (_, i) => `<path d="M${228 + i * 21} 585 V682"/>`).join('')}</g>
        <circle cx="400" cy="244" r="30" fill="${light(c, .25)}"/>`,
    towel: (c) => `
        <rect x="170" y="250" width="460" height="560" rx="10" fill="${c}" transform="rotate(-4 400 530)"/>
        <g transform="rotate(-4 400 530)">
            <rect x="170" y="330" width="460" height="22" fill="${light(c, .6)}"/>
            <rect x="170" y="364" width="460" height="8" fill="${dark(c, .25)}"/>
            <rect x="170" y="700" width="460" height="22" fill="${light(c, .6)}"/>
            <rect x="170" y="688" width="460" height="8" fill="${dark(c, .25)}"/>
            <g stroke="${light(c, .4)}" stroke-width="3">${Array.from({ length: 25 }, (_, i) => `<path d="M${178 + i * 18.3} 810 V842"/>`).join('')}</g>
        </g>`
};

const CATEGORY_KIND = {
    ponchos: 'poncho', tshirts: 'tee', sweats: 'sweat', shorts: 'shorts',
    pants: 'pants', caps: 'cap', accessories: 'drybag'
};

export function artKind(product) {
    return product?.art || CATEGORY_KIND[product?.category] || 'tee';
}

/**
 * @param {object} o { kind, hex, view: 'flat'|'detail'|'scene' }
 * @returns {string} data URI
 */
export function artDataUri({ kind = 'tee', hex = '#0B2545', view = 'flat' } = {}) {
    const key = `${kind}|${hex}|${view}`;
    if (cache.has(key)) return cache.get(key);
    const draw = SHAPES[kind] || SHAPES.tee;
    const garment = `<g stroke="#0B2545" stroke-opacity=".18" stroke-width="2.5" stroke-linejoin="round">${draw(hex)}</g>`;
    let body;
    if (view === 'scene') {
        body = `
        <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F3E3C6"/><stop offset=".62" stop-color="#E8D8BE"/></linearGradient></defs>
        <rect width="800" height="1000" fill="url(#sky)"/>
        <circle cx="560" cy="360" r="130" fill="#C8553D" opacity=".92"/>
        <rect y="640" width="800" height="360" fill="#0B2545"/>
        <path d="M0 640 Q100 610 200 640 T400 640 T600 640 T800 640 V680 H0Z" fill="#14396B"/>
        <path d="M0 720 Q120 690 240 720 T480 720 T720 720 T960 720" stroke="#E8D8BE" stroke-width="3" fill="none" opacity=".35"/>
        <g transform="translate(130 110) scale(.72)">${garment}</g>`;
    } else if (view === 'detail') {
        body = `
        <defs><pattern id="tx" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="10" height="10" fill="none"/><path d="M0 0 V10" stroke="#fff" stroke-opacity=".08" stroke-width="2"/></pattern></defs>
        <rect width="800" height="1000" fill="#F1E8D6"/>
        <g transform="translate(-290 -250) scale(1.75)">${garment}</g>
        <rect width="800" height="1000" fill="url(#tx)"/>`;
    } else {
        body = `
        <rect width="800" height="1000" fill="#EFE6D4"/>
        <circle cx="400" cy="520" r="330" fill="#F7F0E2"/>
        <ellipse cx="400" cy="900" rx="230" ry="22" fill="#0B2545" opacity=".08"/>
        ${garment}`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice">${body}</svg>`;
    const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    cache.set(key, uri);
    return uri;
}

/** Collection tile art (decorative, no garment) */
export function collectionArt(kind, hex = '#0B2545') {
    return artDataUri({ kind, hex, view: 'scene' });
}
