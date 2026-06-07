import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      // ── Off in dev — prevents the hangs/stale cache issues
      devOptions: {
        enabled: false,
      },

      workbox: {
        // Cache app shell assets only
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        runtimeCaching: [
          {
            // Google Fonts — cache forever
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Supabase Storage (images/videos) — network first
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-storage',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Supabase API/auth/functions — NEVER cache
            urlPattern: /^https:\/\/.*\.supabase\.co\/(rest|auth|functions)\/.*/i,
            handler: 'NetworkOnly',
          },
        ],

        // Prevents "stuck on old version" — new SW activates immediately on deploy
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },

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
          { src: '/icon-72.png',  sizes: '72x72',   type: 'image/png', purpose: 'any'           },
          { src: '/icon-96.png',  sizes: '96x96',   type: 'image/png', purpose: 'any'           },
          { src: '/icon-128.png', sizes: '128x128', type: 'image/png', purpose: 'any'           },
          { src: '/icon-144.png', sizes: '144x144', type: 'image/png', purpose: 'any'           },
          { src: '/icon-152.png', sizes: '152x152', type: 'image/png', purpose: 'any'           },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable'  },
          { src: '/icon-384.png', sizes: '384x384', type: 'image/png', purpose: 'any'           },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable'  },
        ],

        shortcuts: [
          { name: 'Create', short_name: 'Create', url: '/create', icons: [{ src: '/icon-96.png', sizes: '96x96' }] },
          { name: 'Feed',   short_name: 'Feed',   url: '/feed',   icons: [{ src: '/icon-96.png', sizes: '96x96' }] },
        ],
      },
    }),
  ],

  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },

  server: {
    host: '::',
    port: 8080,
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
