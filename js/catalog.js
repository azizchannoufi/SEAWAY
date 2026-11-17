// ============================================================
// SEAWAY - Product helpers (stock, colours, images)
// ============================================================
import { COLOR_PALETTE, ONE_SIZE } from './config.js';
import { artDataUri, artKind } from './placeholders.js';

export const PALETTE = Object.fromEntries(COLOR_PALETTE.map(c => [c.id, c.hex]));
export const colorHex = (id) => PALETTE[id] || '#0B2545';
export const isOneSize = (p) => p.sizes?.length === 1 && p.sizes[0] === ONE_SIZE;
export const LOW_STOCK = 3;

export function variantStock(p, color, size) {
    const n = p.stock?.[`${color}|${size}`];
    return typeof n === 'number' ? n : 0;
}
export function colorStock(p, color) {
    return (p.sizes || []).reduce((s, size) => s + variantStock(p, color, size), 0);
}
export function totalStock(p) {
    return (p.colors || []).reduce((s, c) => s + colorStock(p, c), 0);
}
/** 'in' | 'low' | 'out' for a product, or for a specific variant if given */
export function stockState(p, color, size) {
    const n = color && size ? variantStock(p, color, size) : totalStock(p);
    return n <= 0 ? 'out' : n <= LOW_STOCK ? 'low' : 'in';
}

/** Gallery images: uploaded photos first, otherwise generated artwork in the chosen colour. */
export function productImages(p, colorId) {
    if (p.images?.length) return p.images;
    const hex = colorHex(colorId || p.colors?.[0]);
    const kind = artKind(p);
    return ['flat', 'detail', 'scene'].map(view => artDataUri({ kind, hex, view }));
}
export const productThumb = (p, colorId) => productImages(p, colorId)[0];
export const productHover = (p, colorId) => {
    const imgs = productImages(p, colorId);
    return imgs[1] || imgs[0];
};
