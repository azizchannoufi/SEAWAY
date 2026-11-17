// Renders the content pages (story, faq, shipping, size guide, contact, legal)
// from the translation dictionaries so every language stays in one place.
import { bootStore, ctx, setSEO } from '../shell.js';
import { t, tr, loc, escapeHtml } from '../i18n.js';
import { getSettings, addMessage, getProducts } from '../db.js';
import { fmt } from '../money.js';
import { sizeTableHTML } from '../sizes.js';
import { artDataUri } from '../placeholders.js';
import { initReveal } from '../ui.js';

const page = document.body.dataset.static;
await bootStore({ page });
const root = document.getElementById('static-root');
const paragraphs = (s) => String(s).split('\n').map(p => `<p>${escapeHtml(p)}</p>`).join('');
const sections = (arr) => (arr || []).map(s => `<section class="prose-sec"><h2>${escapeHtml(s.title)}</h2>${paragraphs(s.text)}</section>`).join('');
const head = (title, sub) => `<header class="page-head page-head--tight"><h1>${escapeHtml(title)}</h1>${sub ? `<p class="page-sub">${escapeHtml(sub)}</p>` : ''}</header>`;

const R = {
    // ── Our story ───────────────────────────────────────────
    story() {
        const team = tr('story.team') || [];
        root.innerHTML = `
        <div class="story-hero">
            <img src="/assets/img/emblem.webp" alt="Seaway emblem" width="200" height="200">
            <p class="eyebrow eyebrow--dark">${t('story.eyebrow')}</p>
            <h1>${t('story.title')}</h1>
            <p class="lead">${t('story.lead')}</p>
        </div>
        <div class="story-blocks">${(tr('story.sections') || []).map((s, i) => `
            <section class="story-block ${i % 2 ? 'rev' : ''} reveal">
                <div class="sb-art"><img src="${artDataUri({ kind: ['poncho', 'tee', 'sweat'][i % 3], hex: ['#C8553D', '#0B2545', '#6B7048'][i % 3], view: 'scene' })}" alt="" width="520" height="650" loading="lazy"></div>
                <div class="sb-text"><h2>${escapeHtml(s.title)}</h2>${paragraphs(s.text)}</div>
            </section>`).join('')}</div>
        <section class="sec sec--sand"><div class="wrap reveal">
            <h2 class="center">${t('story.valuesTitle')}</h2>
            <div class="values">${(tr('story.values') || []).map(v => `<article><h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.text)}</p></article>`).join('')}</div>
        </div></section>
        <section class="sec wrap reveal">
            <h2 class="center">${t('story.teamTitle')}</h2>
            <div class="team">${team.map((m, i) => `
                <figure><img src="${artDataUri({ kind: ['tee', 'sweat', 'cap'][i % 3], hex: ['#E8D8BE', '#0B2545', '#C8553D'][i % 3], view: 'flat' })}" alt="${escapeHtml(m.name)}" width="320" height="400" loading="lazy">
                <figcaption><strong>${escapeHtml(m.name)}</strong><span>${escapeHtml(m.role)}</span></figcaption></figure>`).join('')}</div>
            <p class="hint center">${t('story.teamNote')}</p>
            <p class="center"><a class="btn btn--primary" href="/shop">${t('home.shopNow')}</a></p>
        </section>`;
        setSEO({ title: t('story.title'), description: t('story.lead'), path: '/story' });
    },

    // ── FAQ ─────────────────────────────────────────────────
    faq() {
        const items = tr('faq.items') || [];
        root.innerHTML = head(t('faq.title'), t('faq.subtitle')) + `
        <div class="acc acc--page">${items.map(i => `<details><summary>${escapeHtml(i.q)}</summary><div class="acc-body"><p>${escapeHtml(i.a)}</p></div></details>`).join('')}</div>
        <p class="center hint">${t('faq.more')} <a href="/contact">${t('link.contact')}</a></p>`;
        setSEO({
            title: t('faq.title'), description: t('faq.subtitle'), path: '/faq',
            jsonLd: { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items.map(i => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })) }
        });
    },

    // ── Shipping & returns ──────────────────────────────────
    async shipping() {
        const ship = await getSettings('shipping');
        root.innerHTML = head(t('shipping.title'), t('shipping.subtitle')) + `
        <div class="prose">
            <section class="prose-sec"><h2>${t('shipping.ratesTitle')}</h2>
            <div class="table-wrap"><table class="table">
                <thead><tr><th scope="col">${t('shipping.zone')}</th><th scope="col">${t('shipping.rate')}</th><th scope="col">${t('shipping.free')}</th></tr></thead>
                <tbody>${ship.zones.map(z => `<tr><th scope="row">${escapeHtml(t('zone.' + z.code) === 'zone.' + z.code ? z.code : t('zone.' + z.code))}</th><td>${fmt(z.rate)}</td><td>${z.freeAbove > 0 ? t('shipping.above', { amount: fmt(z.freeAbove) }) : '—'}</td></tr>`).join('')}</tbody>
            </table></div></section>
            ${sections(tr('shipping.sections'))}
        </div>`;
        setSEO({ title: t('shipping.title'), description: t('shipping.subtitle'), path: '/shipping' });
    },

    // ── Size guide ──────────────────────────────────────────
    'size-guide'() {
        root.innerHTML = head(t('sizeguide.title'), t('sizeguide.intro')) + `
        <div class="prose">${sizeTableHTML()}
        <section class="prose-sec"><h2>${t('sizeguide.howTitle')}</h2>
            <ol class="steps">${(tr('sizeguide.how') || []).map(s => `<li><strong>${escapeHtml(s.title)}</strong> ${escapeHtml(s.text)}</li>`).join('')}</ol>
            <p class="hint">${t('sizeguide.note')}</p></section></div>`;
        setSEO({ title: t('sizeguide.title'), description: t('sizeguide.intro'), path: '/size-guide' });
    },

    // ── Contact ─────────────────────────────────────────────
    contact() {
        const s = ctx.store;
        root.innerHTML = head(t('contact.title'), t('contact.subtitle')) + `
        <div class="contact-grid">
            <form id="contact-form" novalidate>
                <div class="field"><label for="ct-name">${t('checkout.name')}</label><input id="ct-name" name="name" required autocomplete="name" maxlength="80"></div>
                <div class="field"><label for="ct-email">${t('checkout.email')}</label><input id="ct-email" name="email" type="email" required autocomplete="email"></div>
                <div class="field"><label for="ct-subject">${t('contact.subject')}</label>
                    <select id="ct-subject" name="subject">${['order', 'product', 'wholesale', 'other'].map(k => `<option value="${k}">${t('contact.subject.' + k)}</option>`).join('')}</select></div>
                <div class="field"><label for="ct-msg">${t('contact.message')}</label><textarea id="ct-msg" name="message" rows="6" required maxlength="2000"></textarea></div>
                <p class="form-msg" id="ct-status" role="status" aria-live="polite"></p>
                <button class="btn btn--primary" type="submit">${t('contact.send')}</button>
            </form>
            <aside class="contact-info">
                <h2>${t('contact.direct')}</h2>
                <p><strong>${t('checkout.email')}</strong><br><a href="mailto:${escapeHtml(s.email)}">${escapeHtml(s.email)}</a></p>
                ${s.phone ? `<p><strong>${t('checkout.phone')}</strong><br><a href="tel:${escapeHtml(s.phone.replace(/\s/g, ''))}">${escapeHtml(s.phone)}</a></p>` : ''}
                ${s.whatsapp ? `<p><strong>WhatsApp</strong><br><a href="https://wa.me/${escapeHtml(s.whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noopener">${escapeHtml(s.whatsapp)}</a></p>` : ''}
                ${s.address ? `<p><strong>${t('checkout.address')}</strong><br>${escapeHtml(s.address)}</p>` : ''}
                <p class="hint">${t('contact.hours')}</p>
                <p><a href="/faq">${t('contact.seeFaq')}</a></p>
            </aside>
        </div>`;
        const f = document.getElementById('contact-form'), st = document.getElementById('ct-status');
        f.addEventListener('submit', async (e) => {
            e.preventDefault();
            const d = Object.fromEntries(new FormData(f));
            if (!d.name.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email) || !d.message.trim()) { st.textContent = t('checkout.errRequired'); st.className = 'form-msg err'; return; }
            try { await addMessage({ ...d }); st.textContent = t('contact.sent'); st.className = 'form-msg ok'; f.reset(); }
            catch { st.textContent = t('common.error'); st.className = 'form-msg err'; }
        });
        setSEO({ title: t('contact.title'), description: t('contact.subtitle'), path: '/contact' });
    }
};

// legal pages share one renderer
for (const k of ['terms', 'privacy', 'cookies']) {
    R[k] = () => {
        root.innerHTML = head(t(`legal.${k}.title`), t('legal.updated')) + `
        <div class="prose">${sections(tr(`legal.${k}.sections`))}<p class="hint">${t('legal.disclaimer')}</p></div>`;
        setSEO({ title: t(`legal.${k}.title`), path: '/' + k });
    };
}

await R[page]?.();
initReveal();
