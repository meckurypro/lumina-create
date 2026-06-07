// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ── Auto-update: new deploy → SW updates → fresh version immediately
      // No "stuck on old version" bug. No manual skipWaiting needed.
      registerType: 'autoUpdate',

      // ── Only activate SW in production builds
      devOptions: {
        enabled: false, // NEVER enable in dev — causes the hangs you've seen
      },

      // ── What gets cached (app shell only — NO API calls)
      workbox: {
        // Cache the compiled JS/CSS/HTML shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // ── Runtime caching strategy
        runtimeCaching: [
          {
            // Google Fonts — cache first (never changes)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Supabase Storage (uploaded images/videos) — network first, fall back to cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-storage',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          // ── NEVER cache Supabase API / auth / functions — always network only
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/(rest|auth|functions)\/.*/i,
            handler: 'NetworkOnly',
          },
        ],

        // ── Skip waiting + claim clients immediately on update
        // This is what prevents the "old version stuck" problem
        skipWaiting: true,
        clientsClaim: true,

        // ── Clean up old caches on activation
        cleanupOutdatedCaches: true,
      },

      // ── Web App Manifest
      manifest: {
        name:             'Meckury AI',
        short_name:       'Meck AI',
        description:      'AI-powered content creation — imagine it, create it.',
        start_url:        '/',
        display:          'standalone',
        orientation:      'portrait',
        background_color: '#000000',
        theme_color:      '#000000',
        lang:             'en',
        scope:            '/',

        icons: [
          {
            src:     '/icon-72.png',
            sizes:   '72x72',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-96.png',
            sizes:   '96x96',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-128.png',
            sizes:   '128x128',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-144.png',
            sizes:   '144x144',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-152.png',
            sizes:   '152x152',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-192.png',
            sizes:   '192x192',
            type:    'image/png',
            purpose: 'any maskable',
          },
          {
            src:     '/icon-384.png',
            sizes:   '384x384',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     '/icon-512.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'any maskable',
          },
        ],

        shortcuts: [
          {
            name:       'Create',
            short_name: 'Create',
            url:        '/create',
            icons:      [{ src: '/icon-96.png', sizes: '96x96' }],
          },
          {
            name:       'Feed',
            short_name: 'Feed',
            url:        '/feed',
            icons:      [{ src: '/icon-96.png', sizes: '96x96' }],
          },
        ],

        screenshots: [
          {
            src:          '/icon-512.png',
            sizes:        '512x512',
            type:         'image/png',
            form_factor:  'narrow',
            label:        'Meckury AI — AI Content Creation',
          },
        ],
      },
    }),
  ],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
