## Goal

Restore a standard **Vite + React Router + Supabase + Vercel** project that matches your existing codebase 1:1, so your files drop in without translation and `vercel deploy` works out of the box.

## What gets removed

- `src/router.tsx`, `src/server.ts`, `src/start.ts`, `src/routeTree.gen.ts`
- `src/routes/` (TanStack file-based routes)
- `src/integrations/supabase/` (TanStack-specific clients)
- `wrangler.jsonc`, `.tanstack/`
- TanStack packages from `package.json` (`@tanstack/react-start`, `@tanstack/react-router`, `@tanstack/router-plugin`, `@cloudflare/vite-plugin`, etc.)
- TanStack-specific bits in `vite.config.ts` and `tsconfig.json`

## What gets added / restored

**Root config**
- `package.json` — React Router DOM, framer-motion, lucide-react, paystack-inline-js, etc.
- `vite.config.ts` — clean Vite + React + path alias `@`
- `vercel.json` — SPA fallback + API function config
- `index.html` — Vite entrypoint

**Source tree (`src/`)**
- `main.jsx` — React root + BrowserRouter + AuthProvider
- `App.jsx` — `<Routes>` with all your pages
- `context/AuthContext.jsx` — yours, as-is
- `lib/supabase.js` — yours, as-is
- `lib/paystack.js` — yours, as-is
- `lib/api.js` — small helper for calling `/api/generate`
- `templates/` — your full registry (`index.js`, `office-handover`, `memory-lane`)
- `components/` — `ui/Button`, `ui/ImageUpload`, `layout/TopBar`, `layout/PageWrapper`, etc.
- `pages/` — `FeedPage`, `CreatePage`, `TemplateRunner`, `HistoryPage`, `ResultPage`, `ProfilePage`, `SettingsPage`, `AdminPage`, `AuthPage`
- `styles/` or `index.css` — Tailwind + your design tokens

**API (Vercel serverless)**
- `api/generate.js` — the unified generation endpoint (fal/wavespeed dispatch + fallback)

**Supabase**
- `supabase/functions/verify-payment/` — kept exactly as-is (already correct)

## Environment variables (Vercel only — nothing to add here)

Already set on Vercel per your message:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_PAYSTACK_PUBLIC_KEY`
- `FAL_KEY`, `WAVESPEED_KEY`
- (optional) `ANTHROPIC_KEY`

## Lovable preview caveats

- `/api/generate` and Paystack flows will throw "missing env" in the Lovable preview (expected — you'll test on Vercel).
- Hot reload, routing, Supabase auth/data **will** work in preview because `VITE_SUPABASE_*` is in `.env`.

## Order of operations

1. Delete TanStack files and rewrite `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
2. Install deps (`bun install`)
3. Drop in `src/main.jsx`, `src/App.jsx`, `src/context/AuthContext.jsx`, `src/lib/*`
4. Drop in `src/components/**` and `src/templates/**`
5. Drop in `src/pages/**`
6. Write `api/generate.js` + `vercel.json`
7. Verify build (`bun run build`)

## Technical notes

- React Router v6 (`<Routes>`/`<Route>` syntax matches your code samples)
- Tailwind v3 (your code uses utility classes, not v4 `@theme`)
- API routes are Vercel Node serverless functions (`export default function handler(req, res)`)
- `verify-payment` stays a Supabase Edge Function — the frontend calls it directly via `${SUPABASE_URL}/functions/v1/verify-payment` (no Vercel API route needed)

Confirm and I'll execute.
