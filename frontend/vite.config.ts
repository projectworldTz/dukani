/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { landingStaticHtml, structuredData } from './src/content/landing.ts'

/**
 * SEO: bakes the landing page text and schema.org data into index.html, so search
 * engines read real content without running JavaScript. React replaces the block as
 * soon as it renders; on any other route (or when signed in) it is hidden at once.
 */
function seoLanding(): Plugin {
  return {
    name: 'dukani-seo-landing',
    transformIndexHtml(html) {
      const jsonLd = structuredData()
        // "<" escaped so text inside the JSON can never close the script tag.
        .map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`)
        .join('\n    ')
      return html
        .replace('<!--seo:jsonld-->', jsonLd)
        .replace('<div id="root"></div>', `<div id="root">${landingStaticHtml()}</div>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    seoLanding(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'Dukani',
        short_name: 'Dukani',
        description: 'Dukani — smarter sales, better business. Point of sale and inventory management.',
        theme_color: '#2563EB',
        background_color: '#f6f7f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Never cache API calls — POS data (stock, prices, sales) must always be live.
        // Only the app shell (JS/CSS/HTML/icons) is precached for fast/offline loading.
        // Opening a real file (robots.txt, sitemap.xml, og-image.png…) in the address
        // bar must reach the server, not be answered with the app's index.html.
        navigateFallbackDenylist: [/^\/backend\//, /\/[^/?]+\.[a-z0-9]{2,5}$/i],
        runtimeCaching: [
          {
            urlPattern: /\/backend\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
