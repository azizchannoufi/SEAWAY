// ============================================================
// SEAWAY - Shared configuration (storefront + admin)
// ============================================================
// 1) Leave FIREBASE_CONFIG empty  -> DEMO MODE (data lives in this browser's localStorage,
//    admin login: admin@seaway.com / seaway123). Perfect to preview the whole shop.
// 2) Paste your Firebase web config -> LIVE MODE (Firestore + Auth + Storage). See README.md.
// ============================================================

export const FIREBASE_CONFIG = {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: ''
};

export const FIREBASE_VERSION = '10.12.2';

export const isFirebaseConfigured = () =>
    Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);

export const SITE = {
    name: 'Seaway',
    url: 'https://www.seaway.example',          // <- your domain (used for canonical, OG, sitemap)
    defaultLang: 'en',
    baseCurrency: 'EUR',                          // all prices are stored in this currency
    // Cloud Function endpoint creating Stripe Checkout sessions (set after `firebase deploy`).
    // Example: https://europe-west1-YOUR_PROJECT.cloudfunctions.net/createCheckoutSession
    stripeSessionUrl: '',
    demoAdmin: { email: 'admin@seaway.com', password: 'seaway123' }
};

export const LANGS = [
    { code: 'en', label: 'English', short: 'EN', dir: 'ltr', locale: 'en-GB' },
    { code: 'fr', label: 'Français', short: 'FR', dir: 'ltr', locale: 'fr-FR' },
    { code: 'it', label: 'Italiano', short: 'IT', dir: 'ltr', locale: 'it-IT' },
    { code: 'ar', label: 'العربية', short: 'AR', dir: 'rtl', locale: 'ar-TN' }
];

export const CURRENCIES = {
    EUR: { symbol: '€', locale: 'fr-FR', decimals: 2 },
    TND: { symbol: 'DT', locale: 'fr-TN', decimals: 3 },
    USD: { symbol: '$', locale: 'en-US', decimals: 2 }
};

export const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const ONE_SIZE = 'ONE';

// Colour palette offered in the admin (names are translated in js/lang/*.js -> color.<id>)
export const COLOR_PALETTE = [
    { id: 'navy',       hex: '#0B2545' },
    { id: 'sand',       hex: '#E8D8BE' },
    { id: 'terracotta', hex: '#C8553D' },
    { id: 'white',      hex: '#F4F1EA' },
    { id: 'black',      hex: '#1B1F24' },
    { id: 'olive',      hex: '#6B7048' },
    { id: 'sage',       hex: '#9CAF98' },
    { id: 'sky',        hex: '#8FB3C9' },
    { id: 'stone',      hex: '#B9B2A5' }
];

export const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export const STORAGE_KEYS = {
    cart: 'seaway_cart',
    wishlist: 'seaway_wishlist',
    lang: 'seaway_lang',
    currency: 'seaway_currency',
    consent: 'seaway_consent',
    popup: 'seaway_popup_seen',
    localDb: 'seaway_demo_db_v1',
    localUser: 'seaway_demo_user',
    localAdmin: 'seaway_demo_admin',
    lastOrder: 'seaway_last_order'
};

// Defaults merged under whatever the admin saves in settings/{name}
export const DEFAULT_SETTINGS = {
    store: {
        name: 'Seaway',
        email: 'hello@seaway.example',
        phone: '+216 00 000 000',
        whatsapp: '',
        address: 'Marina de Sidi Bou Saïd, Tunisia',
        instagram: 'https://instagram.com/seaway',
        tiktok: 'https://tiktok.com/@seaway',
        facebook: '',
        instagramHandle: '@seaway',
        heroVideo: '',          // optional: URL of a short muted mp4 for the home hero
        heroImage: '',          // optional: URL of a hero photo
        announcement: {
            enabled: true,
            text: {
                en: 'Free shipping on orders over €90 · Made for after the session',
                fr: 'Livraison offerte dès 90 € · Pensé pour l’après-session',
                it: 'Spedizione gratuita sopra 90 € · Pensato per il dopo-sessione',
                ar: 'شحن مجاني للطلبات فوق 90 € · صُمم لما بعد الجلسة'
            }
        }
    },
    shipping: {
        zones: [
            { code: 'TN',  countries: ['TN'], rate: 2.5,  freeAbove: 60 },
            { code: 'FR',  countries: ['FR'], rate: 5.9,  freeAbove: 90 },
            { code: 'EU',  countries: ['DE', 'IT', 'ES', 'BE', 'NL', 'PT', 'LU', 'AT', 'IE', 'GR'], rate: 8.9, freeAbove: 120 },
            { code: 'INT', countries: ['*'], rate: 15, freeAbove: 200 }
        ]
    },
    currency: {
        rates: { EUR: 1, TND: 3.35, USD: 1.08 },
        enabled: ['EUR', 'TND', 'USD'],
        default: 'EUR'
    },
    payments: {
        cod:    { enabled: true },
        stripe: { enabled: true },
        paypal: { enabled: true, clientId: '' }
    },
    marketing: {
        popupEnabled: true,
        popupPercent: 10,
        popupDelaySec: 8,
        popupCode: 'WELCOME10',
        metaPixelId: '',
        tiktokPixelId: '',
        ga4Id: ''
    }
};

export const COUNTRIES = [
    ['TN', 'Tunisia'], ['FR', 'France'], ['IT', 'Italy'], ['ES', 'Spain'], ['DE', 'Germany'],
    ['BE', 'Belgium'], ['NL', 'Netherlands'], ['PT', 'Portugal'], ['LU', 'Luxembourg'],
    ['AT', 'Austria'], ['IE', 'Ireland'], ['GR', 'Greece'], ['GB', 'United Kingdom'],
    ['CH', 'Switzerland'], ['MA', 'Morocco'], ['DZ', 'Algeria'], ['US', 'United States'],
    ['CA', 'Canada'], ['AE', 'United Arab Emirates'], ['OTHER', 'Other country']
];
