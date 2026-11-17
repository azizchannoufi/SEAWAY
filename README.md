# SEAWAY — coastal lifestyle e-commerce

*The way of those who love the sea.*

A complete shop for the Seaway brand: storefront, cart drawer, guest checkout, customer accounts, wishlist, four languages (EN / FR / IT / AR with RTL), three currencies (EUR / TND / USD), Stripe / PayPal / cash on delivery, shipping zones, promo codes, an admin dashboard, order emails, SEO and GDPR cookie consent.

**Stack:** static HTML + vanilla ES modules (no build step) · Firebase (Firestore, Auth, Storage, Hosting, Cloud Functions). The same structure as the DiveYourPassion project.

---

## 1. Try it now (no setup)

Requires Node 18+.

```bash
npm run dev          # http://localhost:5173
```

Out of the box the shop runs in **demo mode**: the 8 sample products, 7 sample orders and all settings live in your browser (`localStorage`), so you can click through everything, including the admin.

| | URL | Login |
|---|---|---|
| Storefront | http://localhost:5173 | — |
| Admin | http://localhost:5173/admin/ | `admin@seaway.com` / `seaway123` |

Demo mode is switched on automatically while `FIREBASE_CONFIG` in `js/config.js` is empty. Card/PayPal payments are simulated (after a confirmation prompt); no money moves and no emails are sent.

---

## 2. Project map

```
index.html shop.html product.html collections.html checkout.html …   storefront pages
admin/                    dashboard (login, orders, products & stock, collections, promos, customers, reviews, settings)
css/style.css             storefront design system (navy / sand / terracotta / foam)
js/config.js              ← the one file you edit: Firebase keys, domain, Stripe URL
js/db.js                  data layer (demo localStorage ⇄ Firebase, same API)
js/seed.js                sample content (4 languages)
js/lang/{en,fr,it,ar}.js  all interface text, legal pages, FAQ
js/pricing.js             cart totals, promo rules, shipping (mirrored in functions/lib/pricing.js)
js/pages/*.js             page logic
functions/                Cloud Functions: order processing, emails, Stripe, sitemap
firestore.rules storage.rules firebase.json
```

---

## 3. Go live on Firebase (about 20 minutes)

1. **Create a project** at <https://console.firebase.google.com>. Add a **Web app** and copy the config object.
2. Enable **Firestore** (production mode, region `eur3` or `europe-west1`), **Authentication → Email/Password**, and **Storage**.
3. Paste the config into `js/config.js` → `FIREBASE_CONFIG`. The shop switches to live mode automatically.
4. Install the CLI and link the project:
   ```bash
   npm i -g firebase-tools && firebase login
   cp .firebaserc.example .firebaserc      # then put your project ID inside
   ```
5. **Create your admin account.** Authentication → Users → *Add user* (your email + a strong password). Copy its **UID**, then in Firestore create the document `admins/<UID>` (any field, e.g. `role: "owner"`). Only UIDs listed there can use `/admin`.
6. **Deploy rules and hosting:**
   ```bash
   firebase deploy --only firestore:rules,storage,hosting
   ```
7. Open `/admin/` → **Settings → Data tools → Import sample products** to load the sample catalogue (or skip it and add your own).
8. For emails, Stripe and stock handling deploy the functions (needs the **Blaze** pay-as-you-go plan; typical shop volumes cost cents):
   ```bash
   cd functions && npm install && cp .env.example .env     # fill in .env (section 6)
   cd .. && firebase deploy --only functions
   ```

> **Why Cloud Functions matter in live mode.** Browsers are never trusted. When an order arrives, `onOrderCreated` re-reads prices from your catalogue, re-applies the promo code and shipping rules, decrements stock, and then sends the emails. Cancelling an order in the admin puts the items back in stock.

---

## 4. Your own products

Admin → **Products & stock** → *New product*.

- Name, description and materials in EN/FR/IT/AR (only English is required; other languages fall back to it).
- Colours and sizes (XS–XXL, or *One size*), with a **stock grid** per colour × size. Sold-out variants are greyed out in the shop automatically.
- **Photos:** drop several images; they are resized in the browser and stored in Firebase Storage. First photo = main image. Without photos the shop shows generated artwork in the product colour.
- Toggle *Featured on home*, *Best seller*, *New* and visibility.
- Collections (Ponchos, T-shirts, Sweats, Shorts, Pants, Caps, Accessories) are managed under **Collections**; each has its own page at `/collections/<slug>`.

The home hero, the announcement bar, contact details, social links, shipping zones, exchange rates and pixels are under **Settings**. Hero video: paste the URL of a short muted MP4 hosted on a CDN, or upload it yourself in the Firebase console (Storage) and paste its download URL.

### Photos and videos to add

The brand logos are in `assets/img/`. For a premium look, upload real lifestyle photography: a hero video or photo (Settings), product photos, collection cover photos, and replace `assets/img/og-image.jpg` (1200×630) for social sharing. The Instagram/UGC section on the home page shows illustrated tiles; replace the handles in `SEED_UGC` (`js/seed.js`) or edit `js/pages/home.js` to link real posts.

---

## 5. Payments

| Method | What you need |
|---|---|
| **Cash on delivery** | Nothing. Toggle it in Settings → Payments. |
| **Stripe cards** | Stripe account → put `STRIPE_SECRET_KEY` in `functions/.env`, deploy functions, then create a webhook endpoint pointing to the `stripeWebhook` function URL listening to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`. Put its signing secret in `STRIPE_WEBHOOK_SECRET`. Finally set `SITE.stripeSessionUrl` in `js/config.js` to the `createCheckoutSession` URL. |
| **PayPal** | Paste your **Client ID** in Settings → Payments. Optionally add `PAYPAL_CLIENT_ID` / `PAYPAL_SECRET` to `functions/.env` so the server verifies each capture with PayPal. |

Notes:

- Prices are stored in **EUR**. TND is for display and cash on delivery. Stripe and PayPal do not accept TND, so card payments in TND are charged in EUR (the checkout says so).
- Stripe order flow: order is created as *awaiting payment* → Stripe Checkout → webhook marks it **paid** and sends the confirmation email. Abandoned/expired sessions cancel the order and return the stock.
- Stripe test mode first: use `sk_test_…` keys and card `4242 4242 4242 4242`.

---

## 6. Emails

`functions/.env` (copy from `.env.example`):

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — any SMTP provider (Brevo, Mailgun, OVH, Gmail with an app password…). Use a sender on your own domain and set up SPF/DKIM for deliverability.
- `ADMIN_EMAIL` receives a "new order" alert. Optional Telegram alert via `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.

Sent automatically, in the customer's language (EN/FR/IT/AR): **order confirmation** (COD and PayPal immediately, Stripe once paid) and **shipping notification** with the tracking number when you set the status to *Shipped* in the admin.

---

## 7. Shipping, currencies, promo codes

- **Shipping zones** (Settings): per zone, a country list, a rate and a *free above* threshold, all in EUR. Defaults: Tunisia 2.50 € (free ≥ 60 €), France 5.90 € (free ≥ 90 €), EU 8.90 € (free ≥ 120 €), rest of world 15 € (free ≥ 200 €). Use `*` for "everywhere else".
- **Currencies** (Settings): enter how many TND / USD equal 1 EUR and which currencies to offer.
- **Promo codes**: percentage, fixed amount or free shipping, with minimum basket, usage limit and expiry. The newsletter pop-up promises 10 % off: keep the `WELCOME10` code (or change the code in Settings → Marketing and create it under Promo codes).

---

## 8. Domain, HTTPS, SEO

1. Firebase console → **Hosting → Add custom domain**; follow the DNS steps. HTTPS certificates are automatic.
2. Replace `https://www.seaway.example` with your domain in `js/config.js` (`SITE.url`), `robots.txt` and `functions/.env` (`SITE_URL`, `ALLOWED_ORIGINS`).
3. `/sitemap.xml` is generated live by the `sitemap` function (all products and collections). Submit it in Google Search Console. `sitemap.static.xml` is a fallback for other hosts (rename it to `sitemap.xml` there).
4. Clean URLs (`/shop`, `/product/<slug>`, `/collections/<slug>`) are configured in `firebase.json`; `npm run dev` mimics them locally.

**SEO limitation:** titles, descriptions, Open Graph tags and JSON-LD are written by JavaScript. Google renders JS and indexes the pages, but some social scrapers (WhatsApp, Facebook) read only the initial HTML, so shared product links show the generic site image and text. If link previews matter a lot, add a pre-rendering step or a small function that serves the product HTML head.

---

## 9. Analytics, pixels, GDPR

- Settings → Marketing: paste your **Meta Pixel**, **TikTok Pixel** and **GA4** IDs.
- Nothing loads before consent. The cookie banner offers *accept all / reject non-essential / customise*; the footer link "Cookie settings" reopens it. Events tracked: PageView, ViewContent, AddToCart, InitiateCheckout, Purchase.
- Newsletter sign-ups are stored in `subscribers` (export CSV from Customers → Newsletter).

---

## 10. Legal pages — read before launch

Terms, privacy and cookie pages are **templates** with placeholders like `[Company legal name]`, `[address]`, `[VAT]` in `js/lang/*.js` (search for `[` in the `legal.*` keys). Fill them in for each language and have them reviewed for your country (Tunisia / EU consumer law: withdrawal period, shipping and returns terms, VAT).

---

## 11. Languages and RTL

Text lives in `js/lang/*.js` (flat key → string). `npm run check:i18n` verifies that every key exists in all four languages. Arabic switches the page to `dir="rtl"` with the Tajawal font. Product content is edited per language in the admin.

---

## 12. Security notes

- Firestore rules (`firestore.rules`) allow the public only to **read the catalogue**, **create** orders / reviews / messages / newsletter sign-ups (with validation), and read their **own** orders. Everything else is admin-only. Reviews stay hidden until approved.
- Secrets (Stripe, SMTP, PayPal secret) live only in `functions/.env`, never in the browser. Don't store secrets in the `settings` collection: it is publicly readable.
- Admin access = Firebase Auth user **and** a document in `admins/{uid}`. Use a strong password and enable multi-factor authentication in Firebase if you can.
- Add rate limiting / App Check (Firebase console → App Check) if you see spam orders or messages.

---

## 13. Known limits

- Demo mode is browser-only: customer login is passwordless and orders are not shared between devices.
- Without the server-side PayPal credentials, a PayPal payment is trusted as reported by the browser. Add them for production.
- Photos for products, UGC tiles, the team and the hero are placeholders until you upload yours.
- No invoices or VAT breakdown are generated; use your accounting tool or add a PDF invoice function.

---

## Launch checklist

- [ ] Firebase config pasted, admin user created (`admins/<uid>`), rules deployed
- [ ] Your products, photos, collections and prices added; sample products removed
- [ ] Store contact details, hero, shipping zones, exchange rates set (Settings)
- [ ] Legal placeholders replaced in all four languages
- [ ] SMTP configured, a test order placed (COD) and emails received
- [ ] Stripe / PayPal tested in test mode, then switched to live keys
- [ ] Domain connected; `SITE.url`, `robots.txt`, `SITE_URL` updated; sitemap submitted
- [ ] Pixels added and cookie banner tested
- [ ] Place a real order end-to-end and cancel it (stock returns)
