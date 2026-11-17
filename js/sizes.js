// Shared size chart (cm) used by the product-page dialog and /size-guide
import { t } from './i18n.js';
import { SIZES } from './config.js';

const CHART = {
    XS:  ['84–88',   '68–72',   '66'],
    S:   ['88–94',   '72–78',   '68'],
    M:   ['94–100',  '78–84',   '70'],
    L:   ['100–106', '84–90',   '72'],
    XL:  ['106–112', '90–96',   '74'],
    XXL: ['112–120', '96–104',  '76']
};

export function sizeTableHTML() {
    return `<div class="table-wrap"><table class="table">
        <caption class="sr">${t('sizeguide.title')}</caption>
        <thead><tr><th scope="col">${t('sizeguide.size')}</th><th scope="col">${t('sizeguide.chest')}</th><th scope="col">${t('sizeguide.waist')}</th><th scope="col">${t('sizeguide.length')}</th></tr></thead>
        <tbody>${SIZES.map(s => `<tr><th scope="row">${s}</th>${CHART[s].map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
}
