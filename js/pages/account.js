import { bootStore, setSEO } from '../shell.js';
import {
    currentCustomer, registerCustomer, loginCustomer, logoutCustomer, myOrders, resetPassword, isDemo
} from '../db.js';
import { t, loc, escapeHtml, formatDate } from '../i18n.js';
import { fmt } from '../money.js';
import { sizeLabel } from '../ui.js';

await bootStore({ page: 'account' });
setSEO({ title: t('account.title'), path: '/account' });
const root = document.getElementById('account-root');

const errText = (e) => {
    const m = String(e?.code || e?.message || '');
    if (m.includes('invalid-credential') || m.includes('wrong-password') || m.includes('user-not-found')) return t('account.errCredentials');
    if (m.includes('email-already-in-use')) return t('account.errExists');
    if (m.includes('weak-password')) return t('account.errWeak');
    if (m.includes('too-many-requests')) return t('account.errMany');
    return t('common.error');
};

async function render() {
    const user = await currentCustomer();
    user ? await renderDashboard(user) : renderAuth('login');
}

function renderAuth(tab) {
    root.innerHTML = `
    <div class="auth">
        ${isDemo ? `<p class="demo-note">${t('account.demoNote')}</p>` : ''}
        <div class="tabs" role="tablist">
            <button type="button" role="tab" class="${tab === 'login' ? 'is-on' : ''}" aria-selected="${tab === 'login'}" data-tab="login">${t('account.login')}</button>
            <button type="button" role="tab" class="${tab === 'register' ? 'is-on' : ''}" aria-selected="${tab === 'register'}" data-tab="register">${t('account.register')}</button>
        </div>
        <form id="auth-form" novalidate>
            ${tab === 'register' ? `<div class="field"><label for="a-name">${t('checkout.name')}</label><input id="a-name" name="name" required autocomplete="name"></div>` : ''}
            <div class="field"><label for="a-email">${t('checkout.email')}</label><input id="a-email" name="email" type="email" required autocomplete="email"></div>
            <div class="field"><label for="a-pass">${t('account.password')}</label><input id="a-pass" name="password" type="password" ${isDemo ? '' : 'required'} minlength="6" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}"></div>
            <p class="form-msg err" id="auth-err" role="alert"></p>
            <button class="btn btn--primary btn--block" type="submit">${t(tab === 'login' ? 'account.login' : 'account.createAccount')}</button>
            ${tab === 'login' && !isDemo ? `<button type="button" class="linklike center" id="reset-btn">${t('account.forgot')}</button>` : ''}
        </form>
        <p class="hint center">${t('account.guestHint')}</p>
    </div>`;
    root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => renderAuth(b.dataset.tab)));
    const form = document.getElementById('auth-form');
    const err = document.getElementById('auth-err');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        err.textContent = '';
        const f = Object.fromEntries(new FormData(form));
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email || '')) { err.textContent = t('common.invalidEmail'); return; }
        try {
            if (tab === 'login') await loginCustomer(f); else await registerCustomer(f);
            render();
        } catch (ex) { err.textContent = errText(ex); }
    });
    document.getElementById('reset-btn')?.addEventListener('click', async () => {
        const email = form.email.value;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = t('common.invalidEmail'); return; }
        try { await resetPassword(email); err.className = 'form-msg ok'; err.textContent = t('account.resetSent'); }
        catch { err.className = 'form-msg err'; err.textContent = t('common.error'); }
    });
}

async function renderDashboard(user) {
    root.innerHTML = `<div class="skeleton-pdp"></div>`;
    const orders = await myOrders().catch(() => []);
    root.innerHTML = `
    <div class="acct-head">
        <div><p class="eyebrow eyebrow--dark">${t('account.welcome')}</p><h2>${escapeHtml(user.name || user.email)}</h2><p>${escapeHtml(user.email)}</p></div>
        <button type="button" class="btn btn--ghost" id="logout">${t('account.logout')}</button>
    </div>
    <h2 class="acct-h">${t('account.orders')}</h2>
    ${orders.length ? `<ul class="orders">${orders.map(o => `
        <li class="order">
            <div class="order-top">
                <div><strong>${escapeHtml(o.number)}</strong><small>${formatDate(o.createdAt)}</small></div>
                <span class="status status--${o.status}">${t('status.' + o.status)}</span>
                <strong>${fmt(o.total, o.currency, o.rate)}</strong>
            </div>
            <ul class="order-items">${o.items.map(i => `<li>${escapeHtml(loc(i.name))} <small>${escapeHtml(t('color.' + i.color))} · ${escapeHtml(sizeLabel(i.size))} × ${i.qty}</small></li>`).join('')}</ul>
            ${o.tracking ? `<p class="note">${t('account.tracking')}: <strong>${escapeHtml(o.tracking)}</strong></p>` : ''}
        </li>`).join('')}</ul>` : `<p class="empty">${t('account.noOrders')} <a href="/shop">${t('cart.emptyCta')}</a></p>`}`;
    document.getElementById('logout').addEventListener('click', async () => { await logoutCustomer(); render(); });
}

render();
