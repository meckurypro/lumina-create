# Meckury AI — Cinematic Content Creation Platform

A cinematic AI video and image generation web app built for African creators.

---

## Tech Stack

| Layer          | Technology                                              |
|----------------|---------------------------------------------------------|
| Frontend       | React 18 + Vite                                         |
| Styling        | Tailwind CSS + CSS Variables                            |
| Animation      | Framer Motion                                           |
| Backend        | Supabase (Auth + PostgreSQL + RLS)                      |
| AI Video       | WaveSpeed (primary) · fal.ai (fallback) — admin toggle  |
| AI Image       | fal.ai (primary) · WaveSpeed (fallback) — admin toggle  |
| Prompt AI      | WaveSpeed → Claude Sonnet (primary) · Direct Anthropic (fallback) |
| Payments       | Paystack (NGN)                                          |
| Deployment     | Vercel (Serverless Functions)                           |
| PWA            | Service Worker + Web Manifest                           |

---

## AI Provider Architecture

Meckury uses a **hybrid dual-provider** system. The active provider is stored in Supabase and toggled at runtime from the Admin Panel — no redeployment needed.

```
WaveSpeed (primary)
  └── Video generation: Seedance 2.0, Kling 2.5/3.0, Wan
  └── LLM/Prompt AI:   Claude Sonnet via WaveSpeed gateway
  └── Image generation: Nano Banana Pro / Nano Banana 2

fal.ai (fallback / specific models)
  └── Video: Seedance 2.0, Kling 3.0 Pro, Veo 3.1
  └── Image: Imagen 3, Nano Banana 2, Flux i2i
  └── Audio: Lyria 3
```

All API keys live server-side only. The client never touches them — all generation calls are proxied through `/api/generate` (Vercel Serverless Function).

---

## Project Structure

```
meckury/
├── api/
│   ├── generate.js            # Unified AI proxy — fal.ai + WaveSpeed with fallback
│   └── upload.js              # Image upload to Supabase Storage
│
├── supabase/
│   ├── 01_schema.sql          # All tables, enums, indexes, seed data
│   ├── 02_functions.sql       # DB functions (credits, prompts, stats)
│   ├── 03_triggers.sql        # Auto-refund, notifications, counters
│   ├── 04_rls.sql             # Row Level Security policies
│   ├── 05_app_settings.sql    # Runtime config table (provider, model toggles)
│   └── functions/
│       └── verify-payment/
│           └── index.ts       # Edge Function: Paystack verification
│
├── src/
│   ├── lib/
│   │   ├── supabase.js        # Supabase client + all DB helpers
│   │   ├── fal.js             # Generation client — proxies to /api/generate
│   │   ├── wavespeed.js       # WaveSpeed client — proxies to /api/generate
│   │   ├── provider.js        # Smart router — fal vs WaveSpeed from DB settings
│   │   ├── creditUtils.js     # Credit cost calculations (single source of truth)
│   │   └── paystack.js        # Paystack popup + verification
│   │
│   ├── context/
│   │   ├── AuthContext.jsx    # Auth state, profile, credits, isStaff
│   │   └── ThemeContext.jsx   # Dark/light/system theme
│   │
│   ├── hooks/
│   │   ├── useAuth.js         # Re-export from AuthContext
│   │   ├── useTheme.js        # Re-export from ThemeContext
│   │   ├── useCredits.js      # Credit balance + transactions
│   │   └── useGenerate.js     # Full generation pipeline (staff pool support)
│   │
│   ├── templates/
│   │   ├── index.js           # Template registry — import all templates here
│   │   ├── office-handover.js # Office Handover template definition
│   │   └── memory-lane.js     # Memory Lane template definition
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.jsx          # Primary, secondary, ghost, danger
│   │   │   ├── Input.jsx           # Input, OTPInput, Textarea
│   │   │   ├── Modal.jsx           # Modal, Loader, Skeleton, CreditBadge, EmptyState
│   │   │   ├── ImageUpload.jsx     # Single + multi image upload
│   │   │   └── SmartPromptInput.jsx # AI-powered prompt resolver (Create page)
│   │   ├── templates/
│   │   │   ├── TemplateCard.jsx    # Reusable template card (compact + default variants)
│   │   │   └── TemplateRunner.jsx  # Renders template UI from file definition
│   │   ├── admin/
│   │   │   └── ProviderSettings.jsx # Admin toggle: provider + model selection
│   │   └── layout/
│   │       ├── BottomNav.jsx       # 4-tab nav + PromptIQ floating button (staff)
│   │       ├── TopBar.jsx          # Fixed top header + PromptIQ pill (staff)
│   │       └── PageWrapper.jsx     # Animated page container
│   │
│   └── pages/
│       ├── LandingPage.jsx         # Public marketing page
│       ├── AuthPage.jsx            # Login, signup, OTP, password, profile
│       ├── ResetPasswordPage.jsx
│       ├── FeedPage.jsx            # Discover: public templates strip + community feed
│       ├── CreatePage.jsx          # Smart AI tab + Templates + Tools hub
│       ├── GeneratePage.jsx        # Active generation screen
│       ├── ResultPage.jsx          # Download + publish to feed
│       ├── HistoryPage.jsx         # User's generation history
│       ├── ProfilePage.jsx         # Credits, stats, purchases
│       ├── SettingsPage.jsx        # Theme, password, profile edit
│       ├── PromptIQPage.jsx        # Staff-only PromptIQ workspace (sheet)
│       └── AdminPage.jsx           # Dashboard, prompts, templates, staff, feed, users, settings
│
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   └── icons/                 # icon.png in sizes: 72,96,128,144,152,192,384,512
│
├── index.html
├── vite.config.js
├── tailwind.config.js
├── vercel.json                # SPA routing + security headers
├── .env.example               # Copy to .env and fill in keys
└── package.json
```

---

## Setup Guide

### 1. Clone and install

```bash
git clone https://github.com/yourusername/meckury.git
cd meckury
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

**Client-side** (prefixed `VITE_` — safe to expose):

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
```

**Server-side only** (Vercel Serverless Functions — never in client bundle):

```env
FAL_KEY=fal-...
WAVESPEED_KEY=your-wavespeed-api-key
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

> **Note:** `VITE_ANTHROPIC_KEY` is no longer needed. Claude Sonnet is accessed through WaveSpeed using `WAVESPEED_KEY`. Only add a direct `ANTHROPIC_KEY` server-side if you need to bypass WaveSpeed for LLM calls.

### 3. Supabase setup

1. Create project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run files in order:
   ```
   supabase/01_schema.sql
   supabase/02_functions.sql
   supabase/03_triggers.sql
   supabase/04_rls.sql
   supabase/05_app_settings.sql
   ```
3. Enable **Google OAuth** in Authentication → Providers
4. Set Site URL and Redirect URLs in Authentication → URL Configuration

### 4. Create Storage Buckets

In Supabase Dashboard → Storage, create these buckets:

| Bucket              | Public | Purpose                        |
|---------------------|--------|--------------------------------|
| `generation-uploads`| Yes    | User-uploaded input images     |
| `template-assets`   | Yes    | Template thumbnails, media     |
| `generations`       | Yes    | AI output videos/images        |

### 5. Deploy Edge Function

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase secrets set PAYSTACK_SECRET_KEY=sk_live_xxxx
supabase functions deploy verify-payment
```

### 6. Set yourself as admin

```sql
UPDATE profiles SET role = 'admin' WHERE username = 'your_username';
```

### 7. Seed templates

```sql
-- Run after schema to add initial templates
INSERT INTO templates (name, slug, description, visibility, credit_cost, min_images, max_images, sort_order)
VALUES
  ('Office Handover', 'office-handover', 'Cinematic leadership transition video between two people', 'promptiq', 2, 2, 2, 1),
  ('Memory Lane',     'memory-lane',     'Beautiful photo journey video from your memories',         'public',   1, 3, 20, 2);
```

### 8. Run locally

```bash
npm run dev
```

### 9. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Add in **Vercel Dashboard → Settings → Environment Variables**:

```
FAL_KEY
WAVESPEED_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PAYSTACK_PUBLIC_KEY
```

---

## PromptIQ — Staff Workspace

Staff members (promoted by admin) get access to **PromptIQ**, a private template workspace.

### How it works

- Admin promotes a user to staff via **Admin Panel → Staff tab**
- Staff see a glowing ⚡ **PromptIQ button** in the center of BottomNav and a pill button in TopBar
- Tapping opens the PromptIQ workspace sheet — a curated gallery of exclusive templates
- Staff PromptIQ templates are **free** (deducted from the shared staff credit pool, not the user's own credits)
- Public templates are also accessible from PromptIQ but cost the user's own credits

### Staff Credit Pool

A dedicated Supabase user acts as the credit pool. Set its UUID in `app_settings`:

```sql
INSERT INTO app_settings (key, value) VALUES ('staff_pool_user_id', '"uuid-of-pool-account"');
```

Top up the pool account's credits from the Admin Panel or directly via SQL.

### Promoting staff

```sql
-- Via SQL
SELECT promote_to_staff('admin-uuid', 'user-uuid', 'Senior content creator');

-- Via Admin Panel → Staff tab → Search username → Promote
```

---

## Template System

Templates are **modular files** in `src/templates/`. Each file exports a definition object. Prompts live in the database (versioned, rollback-able). Assets live in Supabase Storage.

### Template file structure

```js
// src/templates/my-template.js
export default {
  slug:         'my-template',
  name:         'My Template',
  visibility:   'promptiq',   // 'promptiq' | 'public'
  description:  'What it does',

  // User-facing instructions shown before the upload fields
  instructions: 'Upload a clear photo of Person A, then Person B.',

  // Input fields rendered by TemplateRunner
  inputs: [
    { key: 'startFrame', type: 'image', label: 'Person A', hint: 'Clear headshot', required: true },
    { key: 'endFrame',   type: 'image', label: 'Person B', hint: 'Clear headshot', required: true },
  ],

  // Which generation settings to expose
  supportsAspect:   true,
  supportsDuration: true,
  supportsModel:    false,
}
```

### Adding a new template

1. Create `src/templates/my-template.js`
2. Import and register it in `src/templates/index.js`
3. Insert a row into the `templates` table in Supabase
4. Add an initial prompt in Admin Panel → Prompts tab

No redeployment needed for prompt or asset changes.

---

## Provider Toggle (Admin)

Visit `/admin` → **Settings** tab to:

- Switch active provider between **WaveSpeed** and **fal.ai** instantly
- Select preferred Kling model (2.5 / 3.0)
- Select preferred Seedance model (1.5 / 2.0)
- Select preferred image model (Nano Banana 2 / Nano Banana Pro)

Changes take effect immediately. Failed generations auto-fallback to the other provider.

### app_settings table

| key               | default           | options                             |
|-------------------|-------------------|-------------------------------------|
| `active_provider` | `"fal"`           | `"fal"` · `"wavespeed"`             |
| `model_kling`     | `"kling_2_5"`     | `"kling_2_5"` · `"kling_3_0"`       |
| `model_seedance`  | `"seedance_2_0"`  | `"seedance_1_5"` · `"seedance_2_0"` |
| `model_image`     | `"imagen_3_fast"` | `"imagen_3_fast"` · `"imagen_3"`    |

---

## Credit System

| Generation Type      | 5s | 8s | 10s |
|----------------------|----|----|-----|
| Text/Image to Image  | 1  | —  | —   |
| Image to Video       | 2  | 4  | 5   |
| Start + End Frame    | 2  | 4  | 5   |
| Text to Video        | 3  | 4  | 5   |
| Office Handover      | 2  | —  | —   |
| Memory Lane          | 1 per photo | — | — |

| Package  | Credits | Price    |
|----------|---------|----------|
| Starter  | 10      | ₦4,500   |
| Standard | 35      | ₦13,000  |
| Pro      | 100     | ₦32,000  |
| Creator  | 260     | ₦72,000  |

New users receive **5 free credits** on signup. Credits never expire. Failed generations are auto-refunded via DB trigger.

---

## Model Reference

### WaveSpeed model IDs

| Key              | Model ID                                          |
|------------------|---------------------------------------------------|
| `kling_2_5`      | `wavespeed-ai/kling-v2.6-pro/image-to-video`      |
| `kling_2_5_t2v`  | `wavespeed-ai/kling-v2.6-pro/text-to-video`       |
| `kling_3_0`      | `wavespeed-ai/kling-v3.0-pro/image-to-video`      |
| `seedance_1_5`   | `wavespeed-ai/seedance-v1.5-pro/image-to-video`   |
| `seedance_2_0`   | `bytedance/seedance-2.0/image-to-video`           |
| `imagen_3_fast`  | `wavespeed-ai/google/nano-banana-2/text-to-image` |
| `imagen_3`       | `wavespeed-ai/google/nano-banana-pro/text-to-image`|
| `flux_i2i`       | `wavespeed-ai/flux-kontext-dev/multi`             |

### fal.ai model IDs

| Key              | Model ID                                          |
|------------------|---------------------------------------------------|
| `kling_2_5`      | `fal-ai/kling-video/v2.5/pro/image-to-video`      |
| `kling_2_5_t2v`  | `fal-ai/kling-video/v2.5/pro/text-to-video`       |
| `kling_3_0`      | `fal-ai/kling-video/v3.0/pro/image-to-video`      |
| `seedance_1_5`   | `fal-ai/seedance-1-5-pro`                         |
| `seedance_2_0`   | `fal-ai/seedance-2.0`                             |
| `imagen_3_fast`  | `fal-ai/imagen3/fast`                             |
| `imagen_3`       | `fal-ai/imagen3`                                  |
| `flux_i2i`       | `fal-ai/flux/dev/image-to-image`                  |

---

## Icons Required

Place in `/public/icons/` before deploying:

```
icon-72.png   icon-96.png   icon-128.png  icon-144.png
icon-152.png  icon-192.png  icon-384.png  icon-512.png
```

Recommended: [realfavicongenerator.net](https://realfavicongenerator.net)

---

## Admin Access

Visit `/admin` after setting your role to `admin`.

| Tab        | What you can do                                             |
|------------|-------------------------------------------------------------|
| Dashboard  | Live stats: users, generations, revenue, success rate       |
| Prompts    | Edit + version template prompts, rollback anytime           |
| Templates  | Toggle visibility (PromptIQ ↔ Public), upload media assets  |
| Staff      | Promote/demote staff, view pool balance                     |
| Feed       | Approve or reject pending community posts                   |
| Users      | Browse recent users, view credit balances                   |
| Settings   | Toggle AI provider + model selection live                   |

---

## Built by

[LinkAI](https://afix.linkai) · An AFIX Initiative
