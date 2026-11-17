// ============================================================
// SEAWAY - Sample content (used by DEMO MODE and by the admin
// "Import sample data" button when you go live on Firebase)
// ============================================================
import { SIZES, ONE_SIZE, DEFAULT_SETTINGS } from './config.js';

const L = (en, fr, it, ar) => ({ en, fr, it, ar });

export const SEED_CATEGORIES = [
    { id: 'ponchos', slug: 'ponchos', order: 1, art: 'poncho', hex: '#C8553D',
      name: L('Ponchos', 'Ponchos', 'Poncho', 'بونشو'),
      desc: L('Fouta-inspired ponchos to warm up after the water.', 'Des ponchos inspirés de la fouta pour se réchauffer après l’eau.', 'Poncho ispirati alla foutah per scaldarsi dopo l’acqua.', 'بونشو مستوحى من الفوطة للتدفئة بعد الخروج من الماء.') },
    { id: 'tshirts', slug: 'tshirts', order: 2, art: 'tee', hex: '#F4F1EA',
      name: L('T-shirts', 'T-shirts', 'T-shirt', 'تيشيرتات'),
      desc: L('Organic cotton tees, soft from the first wear.', 'Des tees en coton bio, doux dès le premier jour.', 'T-shirt in cotone biologico, morbide dal primo giorno.', 'تيشيرتات من القطن العضوي، ناعمة منذ أول ارتداء.') },
    { id: 'sweats', slug: 'sweats', order: 3, art: 'sweat', hex: '#0B2545',
      name: L('Sweats', 'Sweats', 'Felpe', 'سويتات'),
      desc: L('Heavy, warm and made to last.', 'Épais, chauds et faits pour durer.', 'Pesanti, caldi e fatti per durare.', 'سميكة ودافئة وصُنعت لتدوم.') },
    { id: 'shorts', slug: 'shorts', order: 4, art: 'shorts', hex: '#6B7048',
      name: L('Shorts', 'Shorts', 'Pantaloncini', 'شورتات'),
      desc: L('Quick-dry shorts for water and street.', 'Des shorts à séchage rapide, de l’eau à la ville.', 'Pantaloncini ad asciugatura rapida, dall’acqua alla città.', 'شورتات سريعة الجفاف من الماء إلى المدينة.') },
    { id: 'pants', slug: 'pants', order: 5, art: 'pants', hex: '#1B1F24',
      name: L('Pants', 'Pantalons', 'Pantaloni', 'سراويل'),
      desc: L('Relaxed pants for cool evenings by the sea.', 'Des pantalons amples pour les soirées fraîches en bord de mer.', 'Pantaloni comodi per le serate fresche in riva al mare.', 'سراويل مريحة لأمسيات البحر الباردة.') },
    { id: 'caps', slug: 'caps', order: 6, art: 'cap', hex: '#C8553D',
      name: L('Caps', 'Casquettes', 'Cappellini', 'قبعات'),
      desc: L('Sun, salt and wind-proof headwear.', 'Pour se protéger du soleil, du sel et du vent.', 'Cappelli contro sole, sale e vento.', 'قبعات تحميك من الشمس والملح والريح.') },
    { id: 'accessories', slug: 'accessories', order: 7, art: 'drybag', hex: '#0B2545',
      name: L('Accessories', 'Accessoires', 'Accessori', 'إكسسوارات'),
      desc: L('Dry bags, beanies and towels for every session.', 'Sacs étanches, bonnets et serviettes pour chaque session.', 'Sacche stagne, berretti e asciugamani per ogni sessione.', 'حقائب مقاومة للماء وقبعات صوفية ومناشف لكل جلسة.') }
];

// deterministic pseudo-stock so the demo shows in-stock, low-stock and sold-out variants
function genStock(colors, sizes, seed) {
    const stock = {};
    colors.forEach((c, ci) => sizes.forEach((s, si) => {
        const n = (seed * 7 + ci * 5 + si * 3) % 11;
        stock[`${c}|${s}`] = n < 2 ? 0 : n < 4 ? n - 1 : n * 2;
    }));
    return stock;
}

const ALL = SIZES;
const SMXL = ['S', 'M', 'L', 'XL'];
const SXXL = ['S', 'M', 'L', 'XL', 'XXL'];
const ONE = [ONE_SIZE];
const now = Date.now();
const day = 86400000;

function P(id, category, price, colors, sizes, seed, extra) {
    return {
        id, slug: id, category, price, colors, sizes,
        stock: genStock(colors, sizes, seed), images: [], active: true,
        createdAt: now - seed * day, ...extra
    };
}

export const SEED_PRODUCTS = [
    P('seaway-poncho-fouta', 'ponchos', 89, ['sand', 'terracotta', 'navy'], SMXL, 3, {
        bestseller: true, featured: true, comparePrice: 0,
        name: L('Seaway Poncho — Fouta', 'Poncho Seaway — Fouta', 'Poncho Seaway — Fouta', 'بونشو سيواي — فوطة'),
        desc: L(
            'Our signature poncho, inspired by the fouta towels of the Mediterranean. Soft terry cloth that wraps you in warmth the moment you leave the water: dry off, change and stay cosy on the beach.',
            'Notre poncho signature, inspiré des foutas méditerranéennes. Une éponge douce qui vous enveloppe de chaleur dès la sortie de l’eau : séchez-vous, changez-vous et restez bien au chaud sur la plage.',
            'Il nostro poncho simbolo, ispirato alle foute del Mediterraneo. Morbida spugna che ti avvolge di calore appena esci dall’acqua: asciugati, cambiati e resta al caldo in spiaggia.',
            'بونشو سيواي المميز، مستوحى من فوطة البحر المتوسط. قماش إسفنجي ناعم يلفّك بالدفء فور خروجك من الماء: جفّف جسمك وبدّل ملابسك وابقَ دافئًا على الشاطئ.'),
        material: L(
            '100% cotton terry, 420 gsm. Woven fouta stripes and knotted fringes. Machine wash 30°C with similar colours, line dry. No bleach, no tumble dry.',
            'Éponge 100 % coton, 420 g/m². Rayures fouta tissées et franges nouées. Lavage machine 30 °C avec couleurs similaires, séchage à l’air. Pas d’eau de Javel, pas de sèche-linge.',
            'Spugna 100% cotone, 420 g/m². Righe foutah tessute e frange annodate. Lavaggio in lavatrice a 30 °C con colori simili, asciugatura all’aria. No candeggina, no asciugatrice.',
            'قماش إسفنجي 100٪ قطن، 420 غ/م². خطوط فوطة منسوجة وأهداب معقودة. غسيل آلي 30° مع ألوان متشابهة وتجفيف في الهواء. بدون مبيّض وبدون مجفف.') }),
    P('seaway-poncho-technical', 'ponchos', 129, ['navy', 'black', 'olive'], SXXL, 5, {
        isNew: true, featured: true,
        name: L('Seaway Poncho — Technical Windproof', 'Poncho Seaway — Technique coupe-vent', 'Poncho Seaway — Tecnico antivento', 'بونشو سيواي — تقني مقاوم للريح'),
        desc: L(
            'The windproof version for kitesurf and sailing sessions. Water-repellent shell, soft terry lining, big hood and a kangaroo pocket for your keys and phone.',
            'La version coupe-vent pour le kitesurf et la voile. Coque déperlante, doublure éponge douce, grande capuche et poche kangourou pour vos clés et votre téléphone.',
            'La versione antivento per kitesurf e vela. Guscio idrorepellente, fodera in spugna morbida, ampio cappuccio e tasca a marsupio per chiavi e telefono.',
            'النسخة المقاومة للريح لجلسات الكايتسيرف والإبحار. غلاف طارد للماء وبطانة إسفنجية ناعمة وقبعة كبيرة وجيب أمامي لمفاتيحك وهاتفك.'),
        material: L(
            'Outer: recycled polyester ripstop, DWR treated. Lining: 100% cotton terry. Rinse with fresh water after salt exposure. Machine wash 30°C, no softener.',
            'Extérieur : ripstop polyester recyclé, traitement DWR. Doublure : éponge 100 % coton. Rincer à l’eau douce après exposition au sel. Lavage 30 °C, sans adoucissant.',
            'Esterno: ripstop in poliestere riciclato, trattamento DWR. Fodera: spugna 100% cotone. Sciacquare con acqua dolce dopo l’esposizione al sale. Lavaggio a 30 °C, senza ammorbidente.',
            'الخارج: بوليستر معاد تدويره ريب ستوب بمعالجة طاردة للماء. البطانة: قماش إسفنجي 100٪ قطن. اشطفه بالماء العذب بعد التعرض للملح. غسيل 30° بدون منعّم.') }),
    P('organic-cotton-tee', 'tshirts', 39, ['white', 'sand', 'navy', 'terracotta'], ALL, 4, {
        bestseller: true,
        name: L('Organic Cotton Tee', 'T-shirt en coton bio', 'T-shirt in cotone biologico', 'تيشيرت قطن عضوي'),
        desc: L(
            'A relaxed everyday tee in heavyweight organic cotton, with a small wave embroidered on the chest. Made to be worn from the beach to the evening.',
            'Un tee décontracté en coton bio épais, avec une petite vague brodée sur la poitrine. Fait pour passer de la plage à la soirée.',
            'Una t-shirt rilassata in cotone biologico pesante, con una piccola onda ricamata sul petto. Perfetta dalla spiaggia alla sera.',
            'تيشيرت مريح للاستخدام اليومي من القطن العضوي السميك مع موجة صغيرة مطرزة على الصدر. للارتداء من الشاطئ حتى المساء.'),
        material: L(
            '100% GOTS-certified organic cotton, 220 gsm. Machine wash 30°C inside out. Tumble dry low or line dry.',
            'Coton biologique 100 % certifié GOTS, 220 g/m². Lavage 30 °C à l’envers. Séchage doux ou à l’air.',
            'Cotone biologico 100% certificato GOTS, 220 g/m². Lavaggio a 30 °C al rovescio. Asciugatura delicata o all’aria.',
            'قطن عضوي 100٪ معتمد GOTS، 220 غ/م². غسيل 30° مقلوبًا. تجفيف لطيف أو في الهواء.') }),
    P('heavy-sweatshirt', 'sweats', 79, ['navy', 'sand', 'olive'], ALL, 6, {
        bestseller: true,
        name: L('Heavy Sweatshirt', 'Sweat épais', 'Felpa pesante', 'سويت شيرت سميك'),
        desc: L(
            'A heavyweight crewneck brushed on the inside, for chilly mornings and windy pontoons. Boxy fit, ribbed cuffs, built to last for many seasons.',
            'Un col rond épais, gratté à l’intérieur, pour les matins frais et les pontons venteux. Coupe ample, poignets côtelés, conçu pour durer des saisons.',
            'Una felpa girocollo pesante, spazzolata all’interno, per mattine fredde e pontili ventosi. Taglio ampio, polsini a coste, fatta per durare.',
            'سويت شيرت سميك بياقة دائرية ومبطّن من الداخل للصباحات الباردة والأرصفة العاصفة. قصة واسعة وأساور مضلّعة وصُنع ليدوم مواسم.'),
        material: L(
            '80% organic cotton, 20% recycled polyester, 450 gsm brushed fleece. Wash 30°C inside out, do not iron on print.',
            '80 % coton bio, 20 % polyester recyclé, molleton gratté 450 g/m². Lavage 30 °C à l’envers, ne pas repasser sur l’impression.',
            '80% cotone biologico, 20% poliestere riciclato, felpa spazzolata 450 g/m². Lavaggio a 30 °C al rovescio, non stirare sulla stampa.',
            '80٪ قطن عضوي و20٪ بوليستر معاد تدويره، فليس مبطّن 450 غ/م². غسيل 30° مقلوبًا ولا تكوِ فوق الطباعة.') }),
    P('coastal-shorts', 'shorts', 59, ['navy', 'olive', 'sand'], SXXL, 2, {
        name: L('Coastal Shorts', 'Short Coastal', 'Pantaloncini Coastal', 'شورت كوستال'),
        desc: L(
            'Quick-dry shorts with an elastic waist and drawcord. Light enough for the water, smart enough for the harbour café.',
            'Un short à séchage rapide, taille élastiquée avec cordon. Assez léger pour l’eau, assez soigné pour le café du port.',
            'Pantaloncini ad asciugatura rapida con vita elastica e coulisse. Leggeri per l’acqua, curati per il bar del porto.',
            'شورت سريع الجفاف بخصر مطاطي وحبل شد. خفيف للماء وأنيق لمقهى الميناء.'),
        material: L(
            '100% recycled nylon, 140 gsm, UPF 30. Rinse after the sea, machine wash 30°C, line dry.',
            '100 % nylon recyclé, 140 g/m², UPF 30. Rincer après la mer, lavage 30 °C, séchage à l’air.',
            '100% nylon riciclato, 140 g/m², UPF 30. Sciacquare dopo il mare, lavaggio a 30 °C, asciugatura all’aria.',
            'نايلون معاد تدويره 100٪، 140 غ/م²، UPF 30. اشطفه بعد البحر، غسيل 30° وتجفيف في الهواء.') }),
    P('everyday-pants', 'pants', 85, ['sand', 'navy', 'black'], ALL, 8, {
        name: L('Everyday Pants', 'Pantalon Everyday', 'Pantaloni Everyday', 'سروال إيفري داي'),
        desc: L(
            'Relaxed, tapered pants in a soft cotton twill. Deep pockets, a drawcord waist and just enough stretch to move from the pontoon to the dinner table.',
            'Un pantalon ample et fuselé en sergé de coton doux. Poches profondes, taille à cordon et juste ce qu’il faut d’élasticité pour passer du ponton à la table.',
            'Pantaloni comodi e affusolati in morbido twill di cotone. Tasche profonde, vita con coulisse e il giusto stretch per passare dal pontile alla tavola.',
            'سروال مريح بقصة مدببة من قطن التويل الناعم. جيوب عميقة وخصر بحبل وقدر مناسب من المرونة للانتقال من الرصيف إلى مائدة العشاء.'),
        material: L(
            '97% organic cotton, 3% elastane, 260 gsm twill. Wash 30°C, tumble dry low.',
            '97 % coton bio, 3 % élasthanne, sergé 260 g/m². Lavage 30 °C, séchage doux.',
            '97% cotone biologico, 3% elastan, twill 260 g/m². Lavaggio a 30 °C, asciugatura delicata.',
            '97٪ قطن عضوي و3٪ إيلاستان، تويل 260 غ/م². غسيل 30° وتجفيف لطيف.') }),
    P('seaway-cap', 'caps', 29, ['navy', 'sand', 'terracotta'], ONE, 1, {
        bestseller: true, art: 'cap',
        name: L('Seaway Cap', 'Casquette Seaway', 'Cappellino Seaway', 'قبعة سيواي'),
        desc: L(
            'A low-profile six-panel cap with an adjustable strap and a woven Seaway label. Salt, sun and wind approved.',
            'Une casquette six panneaux à profil bas, sangle réglable et étiquette Seaway tissée. Validée par le sel, le soleil et le vent.',
            'Un cappellino a sei pannelli a profilo basso con chiusura regolabile ed etichetta Seaway tessuta. Approvato da sale, sole e vento.',
            'قبعة ستة أقسام منخفضة مع حزام قابل للتعديل وشعار سيواي منسوج. معتمدة من الملح والشمس والريح.'),
        material: L(
            '100% organic cotton twill with moisture-wicking sweatband. Hand wash cold, reshape and air dry.',
            'Sergé 100 % coton bio avec bandeau anti-transpiration. Lavage à la main à froid, remettre en forme et sécher à l’air.',
            'Twill 100% cotone biologico con fascia antisudore. Lavaggio a mano a freddo, rimodellare e asciugare all’aria.',
            'تويل قطن عضوي 100٪ مع شريط ماص للعرق. غسيل يدوي بارد وإعادة التشكيل والتجفيف في الهواء.') }),
    P('dry-bag-20l', 'accessories', 35, ['navy', 'terracotta', 'sand'], ONE, 7, {
        isNew: true, art: 'drybag',
        name: L('Dry Bag 20L', 'Sac étanche 20 L', 'Sacca stagna 20 L', 'حقيبة مقاومة للماء 20 لتر'),
        desc: L(
            'A roll-top dry bag that keeps towel, phone and keys dry on the boat, the board or the bike. Welded seams and a padded shoulder strap.',
            'Un sac étanche à fermeture roulée qui garde serviette, téléphone et clés au sec sur le bateau, la planche ou le vélo. Coutures soudées et bretelle rembourrée.',
            'Una sacca stagna con chiusura a rullo che mantiene asciutti asciugamano, telefono e chiavi su barca, tavola o bici. Cuciture saldate e tracolla imbottita.',
            'حقيبة مقاومة للماء بإغلاق ملفوف تحفظ منشفتك وهاتفك ومفاتيحك جافة على القارب أو اللوح أو الدراجة. خياطة ملحومة وحزام كتف مبطّن.'),
        material: L(
            '500D recycled PVC-free TPU tarpaulin, welded seams, IPX6. Wipe clean with fresh water, air dry open.',
            'Bâche TPU recyclée 500D sans PVC, coutures soudées, IPX6. Nettoyer à l’eau douce, sécher ouvert à l’air.',
            'Telo TPU riciclato 500D senza PVC, cuciture saldate, IPX6. Pulire con acqua dolce, asciugare aperta all’aria.',
            'قماش TPU معاد تدويره 500D خالٍ من PVC وخياطة ملحومة IPX6. امسحه بالماء العذب وجففه مفتوحًا في الهواء.') })
];

export const SEED_PROMOS = [
    { id: 'WELCOME10', code: 'WELCOME10', type: 'percent', value: 10, minSubtotal: 0, maxUses: 0, uses: 0, active: true, note: 'Newsletter welcome discount' },
    { id: 'SEAWAY15', code: 'SEAWAY15', type: 'percent', value: 15, minSubtotal: 80, maxUses: 200, uses: 12, active: true, note: 'Summer campaign' },
    { id: 'FREESHIP', code: 'FREESHIP', type: 'freeship', value: 0, minSubtotal: 40, maxUses: 0, uses: 4, active: true, note: 'Free shipping' }
];

export const SEED_REVIEWS = [
    { id: 'r1', productId: 'seaway-poncho-fouta', name: 'Yasmine B.', rating: 5, text: 'Wore it straight out of a kite session in La Goulette. Warm, soft, and it looks so good. Everyone asked where it was from!', status: 'approved', createdAt: now - 9 * day },
    { id: 'r2', productId: 'seaway-poncho-fouta', name: 'Marco L.', rating: 5, text: 'Bellissimo, davvero come una foutah di una volta ma con un taglio moderno. Perfetto dopo il nuoto in mare aperto.', status: 'approved', createdAt: now - 21 * day },
    { id: 'r3', productId: 'seaway-poncho-technical', name: 'Karim T.', rating: 4, text: 'Blocks the wind on the water-start pontoon. Wish the pocket was a touch deeper but love the hood.', status: 'approved', createdAt: now - 5 * day },
    { id: 'r4', productId: 'organic-cotton-tee', name: 'Camille D.', rating: 5, text: 'Épais, doux, parfait. Je l’ai pris en trois couleurs.', status: 'approved', createdAt: now - 14 * day },
    { id: 'r5', productId: 'heavy-sweatshirt', name: 'Sofia R.', rating: 5, text: 'Best sweatshirt I own. Heavy and warm without feeling bulky.', status: 'approved', createdAt: now - 30 * day },
    { id: 'r6', productId: 'seaway-cap', name: 'Anis M.', rating: 4, text: 'Great fit, the colour looks even better in the sun.', status: 'approved', createdAt: now - 12 * day },
    { id: 'r7', productId: 'dry-bag-20l', name: 'Lea P.', rating: 5, text: 'Kept everything bone dry during a stormy sailing day.', status: 'approved', createdAt: now - 3 * day },
    { id: 'r8', productId: 'coastal-shorts', name: 'Nour H.', rating: 4, text: 'Dries in minutes. Waiting for more colours!', status: 'pending', createdAt: now - 1 * day }
];

export const SEED_UGC = [
    { handle: '@yasmine.kite', art: 'poncho', hex: '#C8553D' },
    { handle: '@marco.openwater', art: 'tee', hex: '#F4F1EA' },
    { handle: '@sofia.sail', art: 'sweat', hex: '#6B7048' },
    { handle: '@karim.surf', art: 'poncho', hex: '#0B2545' },
    { handle: '@lea.salt', art: 'cap', hex: '#E8D8BE' },
    { handle: '@nour.waves', art: 'drybag', hex: '#C8553D' }
];

/** A few demo orders so the admin dashboard has something to show. */
export function buildDemoOrders() {
    const mk = (n, daysAgo, status, name, country, itemsSpec, method, promo) => {
        const items = itemsSpec.map(([pid, color, size, qty]) => {
            const p = SEED_PRODUCTS.find(x => x.id === pid);
            return { productId: pid, slug: pid, name: p.name, category: p.category, art: p.art || null, color, size, qty, price: p.price };
        });
        const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
        const discount = promo ? Math.round(subtotal * promo.pct) / 100 : 0;
        const shipping = subtotal - discount >= 90 ? 0 : 5.9;
        const rate = country === 'TN' ? 3.35 : 1;
        return {
            id: `demo-${n}`,
            number: `SW-${String(1000 + n)}`,
            items, subtotal, discount, shippingCost: shipping,
            total: Math.round((subtotal - discount + shipping) * 100) / 100,
            currency: country === 'TN' ? 'TND' : 'EUR', rate,
            promoCode: promo ? promo.code : '',
            customer: { name, email: name.toLowerCase().replace(/[^a-z]/g, '') + '@example.com', phone: '+33 6 00 00 00 0' + n },
            shipping: { address: '12 Rue du Port', city: country === 'TN' ? 'La Marsa' : 'Marseille', postal: country === 'TN' ? '2078' : '13002', country },
            payment: { method, status: method === 'cod' ? (status === 'delivered' ? 'paid' : 'unpaid') : 'paid' },
            status, lang: 'en', notes: '', tracking: status === 'shipped' || status === 'delivered' ? 'TRK' + (700000 + n * 137) : '',
            createdAt: now - daysAgo * day - n * 3600000
        };
    };
    return [
        mk(1, 13, 'delivered', 'Amel Trabelsi', 'TN', [['seaway-poncho-fouta', 'sand', 'M', 1]], 'cod'),
        mk(2, 11, 'delivered', 'Julien Moreau', 'FR', [['heavy-sweatshirt', 'navy', 'L', 1], ['seaway-cap', 'navy', ONE_SIZE, 1]], 'stripe'),
        mk(3, 8, 'delivered', 'Giulia Ferri', 'IT', [['organic-cotton-tee', 'white', 'S', 2]], 'paypal'),
        mk(4, 5, 'shipped', 'Omar Ben Salah', 'TN', [['seaway-poncho-technical', 'navy', 'L', 1]], 'cod'),
        mk(5, 3, 'confirmed', 'Chloé Martin', 'FR', [['dry-bag-20l', 'terracotta', ONE_SIZE, 1], ['coastal-shorts', 'olive', 'M', 1]], 'stripe', { code: 'SEAWAY15', pct: 15 }),
        mk(6, 1, 'pending', 'Lina Haddad', 'TN', [['everyday-pants', 'sand', 'M', 1], ['organic-cotton-tee', 'navy', 'M', 1]], 'cod'),
        mk(7, 0, 'pending', 'Thomas Weber', 'DE', [['seaway-poncho-fouta', 'terracotta', 'L', 1]], 'paypal')
    ];
}

export const SEED_SETTINGS = DEFAULT_SETTINGS;
