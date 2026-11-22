/**
 * Landing page text — the single source for both the live React landing page and
 * the pre-rendered copy baked into index.html at build time (see vite.config.ts), so
 * Google reads the same words without running JavaScript. Plain data only: this file
 * is imported by the Vite config, so it must not import React, MUI or assets.
 */

export const SITE_URL = 'https://dukani.projectworldtz.com'

export const HERO = {
  eyebrow: 'POS system for Tanzanian businesses',
  title: 'Dukani POS — sell, manage stock and see your profit from one simple app',
  subtitle:
    'Point of sale and stock management software for shops, supermarkets, pharmacies, butcheries, restaurants and wholesalers in Tanzania. Works on a phone, tablet or computer — start with a 14-day free trial.',
  swahili: 'Mfumo wa POS wa kisasa kwa maduka, famasi, bucha na biashara zote Tanzania — mauzo, stoo, faida na ripoti mahali pamoja.',
  cta: 'Start your 14-day free trial',
}

export const FEATURES = [
  { key: 'checkout', title: 'Fast checkout', text: 'Scan barcodes, take cash, M-Pesa, Tigo Pesa, Airtel Money or card, split payments and print or share receipts.' },
  { key: 'stock', title: 'Stock management', text: 'Know what is in stock, get low-stock alerts, add deliveries and see the value of your stock at any time.' },
  { key: 'profit', title: 'Profit & reports', text: "Today's sales, profit, best sellers, expenses and sales history — clear reports you can understand at a glance." },
  { key: 'staff', title: 'Staff & shifts', text: 'Give each cashier their own login, open and close shifts, and see who sold what — no more missing money.' },
  { key: 'customers', title: 'Customers & credit', text: 'Keep customer records, sell on credit with limits, track who owes you and reward loyal customers with points.' },
  { key: 'branches', title: 'Many branches', text: 'Run one business across several shops and move stock between branches.' },
  { key: 'efd', title: 'EFD / TRA receipts', text: 'Receipts with your TIN and VRN, ready for an EFD/VFD integration with a TRA-approved provider.' },
  { key: 'calculator', title: 'Business calculator', text: 'Built-in calculator for profit, markup, VAT, discounts, change and break-even.' },
] as const

export const PLATFORMS = [
  {
    key: 'pharmacy',
    title: 'Pharmacy POS system',
    text: 'A dedicated pharmacy platform: medicines by batch and expiry date (FEFO), expired stock blocked from sale, prescriptions for prescription-only medicines, dosage labels on receipts and a controlled drugs register.',
  },
  {
    key: 'butchery',
    title: 'Butchery POS system',
    text: 'Sell meat by weight (kg) or by amount ("nipe ya elfu tano"), update prices per kg on a daily price board, cut a carcass into stock with the real cost per kg, and track waste.',
  },
  {
    key: 'retail',
    title: 'Shop & supermarket POS',
    text: 'Fast barcode checkout for minimarts, supermarkets, wholesale, hardware, electronics, boutiques, bookshops and more.',
  },
] as const

/** Business types Dukani is set up for (shown to crawlers; mirrors the registration list). */
export const BUSINESS_TYPES = [
  'Retail shops & supermarkets', 'Pharmacies & health shops', 'Butcheries & fresh foods', 'Restaurants & bars',
  'Electronics & phone shops', 'Fashion & boutiques', 'Hardware & construction', 'Salons & spas',
  'Bookshops & stationery', 'Wholesalers & distributors',
] as const

export const FAQ = [
  {
    q: 'What is Dukani?',
    a: 'Dukani is an online POS (point of sale) and stock management system made for businesses in Tanzania. You use it to record sales, manage stock, track expenses and see your profit — from a phone, tablet or computer.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Yes. Every new business gets a 14-day free trial with all features. No payment is needed to start.',
  },
  {
    q: 'Does Dukani work for pharmacies and butcheries?',
    a: 'Yes. Pharmacies get batch and expiry tracking, prescriptions and a controlled drugs register. Butcheries can sell by weight in kilograms, run a daily price board and cut carcasses into stock.',
  },
  {
    q: 'Can I use Dukani on my phone?',
    a: 'Yes. Dukani runs in the browser on any Android phone, iPhone, tablet or computer, and can be installed like an app.',
  },
  {
    q: 'Dukani ni nini?',
    a: 'Dukani ni mfumo wa POS na usimamizi wa stoo kwa biashara za Tanzania. Unarekodi mauzo, unasimamia stoo, unafuatilia matumizi na kuona faida yako — kwa simu, tablet au kompyuta.',
  },
  {
    q: 'Je, kuna kipindi cha majaribio bure?',
    a: 'Ndiyo. Kila biashara mpya inapata siku 14 za majaribio bure, bila malipo yoyote kuanza.',
  },
] as const

/** Plain HTML for the pre-rendered copy in index.html (crawlers / no-JavaScript). */
export function landingStaticHtml(): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return `
<main id="seo-landing" class="seo-landing">
  <header><a href="/" class="seo-brand">Dukani</a> <a href="/login">Sign in</a></header>
  <p class="seo-eyebrow">${esc(HERO.eyebrow)}</p>
  <h1>${esc(HERO.title)}</h1>
  <p>${esc(HERO.subtitle)}</p>
  <p lang="sw">${esc(HERO.swahili)}</p>
  <p><a href="/register" class="seo-cta">${esc(HERO.cta)}</a></p>
  <section>
    <h2>Everything you need to run your business</h2>
    ${FEATURES.map((f) => `<h3>${esc(f.title)}</h3><p>${esc(f.text)}</p>`).join('\n    ')}
  </section>
  <section>
    <h2>Built for your kind of business</h2>
    ${PLATFORMS.map((p) => `<h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>`).join('\n    ')}
    <ul>${BUSINESS_TYPES.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  </section>
  <section>
    <h2>Frequently asked questions</h2>
    ${FAQ.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('\n    ')}
  </section>
  <footer><p>Dukani by Project World Tanzania · <a href="/register">Register</a> · <a href="/login">Sign in</a></p></footer>
</main>`
}

/** schema.org structured data: the software (with its free trial), the company and the FAQ. */
export function structuredData(): object[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Dukani POS',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Point of Sale',
      operatingSystem: 'Web, Android, iOS, Windows',
      url: SITE_URL + '/',
      image: SITE_URL + '/og-image.png',
      description: HERO.subtitle,
      inLanguage: ['en', 'sw'],
      areaServed: { '@type': 'Country', name: 'Tanzania' },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'TZS',
        description: '14-day free trial',
        url: SITE_URL + '/register',
      },
      publisher: { '@type': 'Organization', name: 'Project World Tanzania' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Project World Tanzania',
      url: 'https://projectworldtz.com',
      logo: SITE_URL + '/pwa-512.png',
      areaServed: 'TZ',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQ.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]
}
