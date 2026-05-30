# Meckury AI — Cinematic AI Content Platform

A cinematic AI image, video, and UGC content generation platform built for African creators. Powered by WaveSpeed, Claude, and Supabase.

> **Production URL:** [meckury.ai](https://meckury.ai) (migrating from meckury-ai.vercel.app)
> **Repo:** [lumina-create](https://github.com/meckurypro/lumina-create) · Private

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS + CSS Variables |
| Animation | Framer Motion |
| Backend | Supabase (Auth + PostgreSQL + RLS + Edge Functions) |
| AI Generation | WaveSpeed (sole provider) |
| Prompt AI | Claude (Anthropic) via Edge Function — optional, user-toggleable |
| Payments | Paystack (NGN) |
| Deployment | Vercel |
| PWA | Service Worker + Web Manifest |

---

## Architecture Overview

All AI generation flows through **Supabase Edge Functions**. API keys never touch the client.

```
Client
  └── supabase.functions.invoke('image-generate' | 'video-generate')
        └── Edge Function
              ├── Fetches generation row + UGC context (if applicable)
              ├── Claims generation (pending → processing, idempotency lock)
              ├── Vision analysis — Claude analyses all reference images in parallel
              ├── Prompt engineering — Claude builds model-optimised prompt
              │     ├── UGC path: character-grounded prompt from ugc_profiles + scene
              │     └── Standard path: model-specific system prompt (30+ prompt styles)
              ├── Submits to WaveSpeed API
              ├── Polls for result
              ├── Stores output to Supabase Storage (hard fail — ephemeral URLs never persisted)
              └── Updates generation row → completed / failed + auto-refund trigger
```

**Claude prompt refinement is optional.** Users toggle it on/off in Profile → Settings. When off, the raw user prompt is sent directly to the model.

---

## Project Structure

```
lumina-create/
├── supabase/
│   ├── 01_schema.sql               # All tables, enums, indexes
│   ├── 02_functions.sql            # DB functions (credits, stats, UGC helpers)
│   ├── 03_triggers.sql             # Auto-refund, counters, notifications
│   ├── 04_rls.sql                  # Row Level Security policies
│   ├── 05_app_settings.sql         # Runtime config table
│   └── functions/
│       ├── image-generate/
│       │   └── index.ts            # Image pipeline — vision + prompt engineering + WaveSpeed
│       └── video-generate/
│           └── index.ts            # Video pipeline — vision + prompt engineering + WaveSpeed
│
├── src/
│   ├── lib/
│   │   ├── supabase.js             # Supabase client + all DB helpers
│   │   ├── ugc.js                  # UGC profiles + generations helpers
│   │   ├── creditUtils.js          # Credit cost calculations
│   │   └── paystack.js             # Paystack popup + verification
│   │
│   ├── context/
│   │   ├── AuthContext.jsx         # Auth state, profile, credits, isStaff
│   │   └── ThemeContext.jsx        # Dark / light / system theme
│   │
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useTheme.js
│   │   ├── useCredits.js
│   │   └── useGenerate.js          # Generation pipeline (staff pool support)
│   │
│   ├── templates/
│   │   ├── index.js                # Template registry
│   │   ├── office-handover.js
│   │   └── memory-lane.js
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Modal.jsx
│   │   │   ├── ImageUpload.jsx
│   │   │   └── SmartPromptInput.jsx
│   │   ├── templates/
│   │   │   ├── TemplateCard.jsx
│   │   │   └── TemplateRunner.jsx
│   │   ├── admin/
│   │   │   └── ProviderSettings.jsx
│   │   └── layout/
│   │       ├── BottomNav.jsx
│   │       ├── TopBar.jsx
│   │       └── PageWrapper.jsx
│   │
│   └── pages/
│       ├── LandingPage.jsx
│       ├── AuthPage.jsx
│       ├── ResetPasswordPage.jsx
│       ├── FeedPage.jsx            # Discover: community feed + templates
│       ├── CreatePage.jsx          # Tools hub (Image, Video, Copy Motion, UGC)
│       ├── GeneratePage.jsx        # Active generation screen
│       ├── ResultPage.jsx          # Download + publish to feed
│       ├── HistoryPage.jsx         # User's generation history (Media page)
│       ├── ProfilePage.jsx         # Credits, stats, settings, purchases
│       ├── SettingsPage.jsx        # Theme, password, profile, AI preferences
│       ├── UGCListPage.jsx         # Character library
│       ├── UGCNewPage.jsx          # 5-step character builder
│       ├── UGCGeneratePage.jsx     # Generate with a selected character
│       ├── PromptIQPage.jsx        # Staff-only PromptIQ workspace
│       └── AdminPage.jsx           # Full admin panel
│
├── public/
│   ├── manifest.json
│   ├── sw.js
│   └── icons/                      # 72, 96, 128, 144, 152, 192, 384, 512px
│
├── index.html
├── vite.config.js
├── tailwind.config.js
├── vercel.json
└── package.json
```

---

## Features

### Create Image
Text-to-image and image-to-image generation across 20+ active models. Supports single and multi-reference image input. Claude vision analyses reference photos and engineers a model-specific prompt for maximum output quality.

### Create Video
Image-to-video, text-to-video, start-to-end frame interpolation, and motion transfer. Supports native audio on compatible models. Duration and aspect ratio are model-capability-driven from the `models` table.

### Copy Motion (Motion Transfer)
Transfer the motion from a reference video onto a target image. Powered by Kling 3.0 Pro Motion (`Surge Motion Pro`), Kling 3.0 Std Motion (`Surge Motion`), WAN 2.2 Animate (`Reel Animate`), DreamActor V2 (`Motion`), and Grok Video Ref (`Pulse Ref`).

### UGC — Generate Content With Your Characters
The flagship feature. Users build persistent AI characters with a **5-step profile builder**:

```
Step 1: Identity      → name, age, gender, nationality, ethnic background
Step 2: Personality   → vibe tags, interests, occupation, backstory, socioeconomic status
Step 3: Fashion       → fashion score (1–10), style direction, content energy
Step 4: Platforms     → target social platforms
Step 5: Reference Photos → up to 6 photos (face front, three-quarter, side 90°,
                           body front, body side, body back)
```

**At generation time (edge function):**
1. All reference photos are passed as `input_image_urls`
2. Claude vision analyses each photo in parallel
3. A character-grounded prompt is built using the full profile context
4. Filter applied: **Hyper-Realistic** (natural iPhone-style) or **Cinematic** (film stock)
5. Final prompt and selected photos are written back to `ugc_generations`

Character name is never included in the generation prompt.

### Templates
Modular generation flows for defined use cases. Prompts are versioned in the database — editable and rollback-able from the Admin Panel with no redeployment.

**Visibility tiers:**
- `public` — available to all users
- `promptiq` — exclusive to PromptIQ staff, not visible to regular users

### PromptIQ Staff Workspace
Staff members (promoted by admin) get a glowing ⚡ **PromptIQ** button in the nav. This opens an exclusive workspace with secret templates. Staff generations draw from a **shared credit pool** — not the staff member's personal credits.

### Community Feed
Users publish completed generations to a public feed. Posts are moderated — admin approval required before going live.

---

## Model Registry

All models live in the `models` Supabase table. Credit costs, active status, feature type, aspect ratios, and durations are database-driven. Toggle any model on/off from the Admin Panel without redeployment.

### Model Feature Types

| Feature | Description |
|---|---|
| `text_to_image` | Text prompt only — no image input |
| `text_image_to_image` | Text + optional reference image(s) |
| `image_to_image` | Image required (face swap, head swap) |
| `text_to_video` | Text prompt only |
| `image_to_video` | Image + optional text |
| `image_text_to_video` | Image + text (full control) |
| `frame_to_frame` | Start frame + end frame interpolation |
| `motion_transfer` | Reference video → target image |

### Active Image Models

| Display Name | Aka | Model Key | Credits |
|---|---|---|---|
| FLUX Klein | Flash Klein | `flux_klein` | 2 cr |
| Grok Imagine | Vision | `grok_imagine` | 4 cr |
| Grok 2 Image | Vision 2 | `grok_2_image` | 10 cr |
| WAN 2.7 Image | Horizon | `wan_2_7_image` | 6 cr |
| WAN 2.7 Pro | Horizon Pro | `wan_2_7_image_pro` | 11 cr |
| Nano Banana Pro Edit | Prism | `nano_banana_pro_edit` | 16 cr |

### Available Image Models (toggleable)

| Aka | Model Key | Credits | Notes |
|---|---|---|---|
| Flash Lite | `flux_schnell` | 2 | fastest |
| Flash | `flux_2_turbo` | 2 | ultra-fast 4MP |
| Studio Dev | `flux_2_dev` | 2 | open-weight 4MP |
| Flash Dev | `flux_dev_ultra_fast` | 4 | balanced |
| Craft | `flux_dev` | 10 | high detail |
| Studio | `flux_2_pro` | 5 | production-grade |
| Studio Max | `flux_2_max` | 10 | studio-grade 4MP |
| Canvas | `gpt_image_1_mini` | 3 | OpenAI fast |
| Canvas Pro | `gpt_image_1_5` | 3 | GPT-5 powered |
| Canvas Ultra | `gpt_image_2` | 9 | reasoning model |
| Canvas Ultra HD | `gpt_image_2_hd` | 32 | reasoning HD |
| Apex Fast | `imagen_4_fast` | 3 | Google fast |
| Apex Standard | `imagen_4` | 26 | cinematic quality |
| Apex | `imagen_4_ultra` | 9 | Google flagship |
| Prism T2I | `nano_banana_pro` | 16 | text-only legacy |
| Prism Fast | `nano_banana_2_fast` | 7 | fast editing |
| Prism 2 Edit | `nano_banana_2_edit` | 7 | up to 14 ref images |
| Dream 4K | `seedream_v4_5` | 29 | 4K consistent |
| Dream 4K Edit | `seedream_v4_5_edit` | 4 | multi-ref identity |
| Dream 9MP | `seedream_v5_lite` | 5 | thinking mode |
| Dream 9MP Edit | `seedream_v5_lite_edit` | 4 | multi-ref |
| Clarity | `stable_diffusion_3_5` | 9 | open-weight |
| Spark | `z_image_turbo` | 3 | text-accurate |
| Spark Base | `z_image_base` | 5 | fine control |
| Lingua | `ernie_image_turbo` | 15 | multilingual |

### Active Video Models

| Aka | Model Key | Credits | Feature |
|---|---|---|---|
| Reel Ultra | `wan_2_7` | 15 cr/s | image_text_to_video |
| Scene 2.0 Pro | `seedance_2_0_i2v` | 35 cr (flat) | image_text_to_video |
| Surge Motion Pro | `kling_v3_pro_motion` | 24 cr/s | motion_transfer |
| Reel Animate | `wan_2_2_animate` | 12 cr/s | motion_transfer |
| Surge 2.5 S2E | `kling_v2_5_turbo_pro_s2e` | 10 cr/s | frame_to_frame |

### Available Video Models (toggleable)

| Aka | Model Key | Credits | Feature |
|---|---|---|---|
| Surge 2.6 | `kling_v2_6_pro` | 25–30 | i2v |
| Surge Std | `kling_v3_std` | 25–30 | i2v |
| Surge Pro | `kling_v3_pro` | 16 | i2v |
| Surge Pro 4K | `kling_v3_pro_s2e` | 50 | frame_to_frame |
| Surge Std S2E | `kling_v3_std_s2e` | 30 | frame_to_frame |
| Surge Motion | `kling_v3_std_motion` | 18 | motion_transfer |
| Scene 2.0 | `seedance_2_fast` | 15–20 | i2v |
| Scene 2.0 Text | `seedance_2_0_t2v` | 35 | t2v |
| Scene Pro | `seedance_1_5_pro` | 15–20 | i2v |
| Scene Lite | `seedance_v1_lite_i2v` | 2 | i2v |
| Scene Fast T2V | `seedance_1_5_fast_t2v` | 2 | t2v |
| Scene Fast I2V | `seedance_1_5_fast_i2v` | 2 | i2v |
| Reel HD | `wan_2_6` | 15–20 | i2v |
| Reel | `wan_2_5` | 8–10 | i2v |
| Reel Cinematic | `wan_2_2_i2v` | 6 | i2v |
| Reel Fast | `wan_2_2_i2v_ultra_fast` | 5 | i2v |
| Pulse | `grok_video_t2v` | 8 | t2v |
| Pulse I2V | `grok_video_i2v` | 8 | i2v |
| Pulse Ref | `grok_video_ref` | 8 | motion_transfer |
| Motion | `dreamactor_v2` | 8 (flat) | motion_transfer |
| Orbit Lite | `veo3_1_lite` | 8 | i2v |
| Orbit Fast | `veo3_1_fast` | 15 | i2v |
| Orbit S2E | `veo3_1_lite_s2e` | 58 (flat) | frame_to_frame |
| Arc Fast | `vidu_i2v_q2_turbo` | 3 | i2v |
| Arc Classic | `vidu_s2v_2` | 6 | frame_to_frame |
| Arc S2E | `vidu_s2e` | 3 | frame_to_frame |
| Arc S2E Fast | `vidu_q2_pro_s2e_fast` | 3 | frame_to_frame |
| Arc S2E Pro | `vidu_q3_pro_s2e` | 22 | frame_to_frame |
| Arc Pro | `vidu_q3_i2v` | 22 | i2v |
| Nova | `hailuo_02_pro` | 70 (flat) | i2v |
| Titan | `hunyuan_video_i2v` | 58 (flat) | i2v |

> **Credit billing:** `is_flat_rate: true` = fixed cost regardless of duration. `is_flat_rate: false` = cost × duration in seconds.

---

## Credit System

Credits are purchased via Paystack (NGN). Each model exposes `credit_cost_t2i` (text/image input) and `credit_cost_i2i` (image input) in the `models` table. Credit costs are always shown to the user before generation.

Failed generations are **auto-refunded** via a Supabase DB trigger.

### Credit Packages

| Package | Credits | Price |
|---|---|---|
| Starter | 10 | ₦4,500 |
| Standard | 35 | ₦13,000 |
| Pro | 100 | ₦32,000 |
| Creator | 260 | ₦72,000 |

Credits never expire.

---

## Edge Functions

### `image-generate`

```
Input:  { generationId: string }
Auth:   Bearer token (validated against Supabase auth)

Pipeline:
  1. Fetch generation row
  2. Idempotency lock (pending → processing)
  3. getUGCContext() — check for ugc_generations row + ugc_profiles join
  4. Collect input_image_urls (or start_frame_url fallback)
  5. Vision analysis — parallel Claude calls per image (VISION_MODEL)
  6. Prompt engineering:
       - UGC: ugc system prompt + buildUGCUserMessage() → character-grounded prompt
       - Standard: model-specific system prompt + buildModelPrompt()
  7. Build WaveSpeed request body (size, image keys, model-specific params)
  8. waveSubmit() → prediction ID
  9. wavePoll() → output URL (8 min timeout)
  10. store() → Supabase Storage (hard fail)
  11. Update generation row → completed
  12. On failure: update → failed + refund_credits RPC
```

### `video-generate`

```
Input:  { generationId: string }
Auth:   Bearer token

Pipeline:
  1–3. Same as image-generate
  4. Single start frame analysis (not parallel)
  5. Standard prompt engineering (video system prompt)
  6. Build WaveSpeed body (duration, resolution — 1080P if credits ≥ 20)
  7. Auto-route WAN 2.7 to I2V endpoint when image provided
  8. waveSubmit() → prediction ID
  9. wavePoll() → output URL (15 min timeout)
  10. store() → Supabase Storage
  11. Update generation row → completed
```

### ENV Variables (Edge Functions)

```env
WAVESPEED_KEY=
ANTHROPIC_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
VISION_MODEL=claude-haiku-4-5-20251001   # optional override
PROMPT_MODEL=claude-haiku-4-5-20251001   # optional override
```

---

## Database Tables (Key)

| Table | Purpose |
|---|---|
| `profiles` | User profiles, credits, role, AI preferences |
| `generations` | All generation records — image and video |
| `ugc_profiles` | UGC characters with reference photos and profile data |
| `ugc_generations` | UGC-specific generation metadata linked to generations |
| `models` | Full model registry — costs, capabilities, active status |
| `templates` | Template definitions and visibility |
| `template_prompts` | Versioned prompts per template (rollback-able) |
| `app_settings` | Runtime key-value config |
| `credit_transactions` | Full credit ledger |
| `feed_posts` | Community feed posts (moderated) |

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/meckurypro/lumina-create.git
cd lumina-create
npm install
```

### 2. Environment variables

**Client-side** (`VITE_` prefix):
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_PAYSTACK_PUBLIC_KEY=pk_live_...
```

### 3. Supabase setup

Run SQL files in order from the SQL Editor:
```
supabase/01_schema.sql
supabase/02_functions.sql
supabase/03_triggers.sql
supabase/04_rls.sql
supabase/05_app_settings.sql
```

Enable **Google OAuth** in Authentication → Providers.

Set Site URL and Redirect URLs:
- Production: `https://meckury.ai`
- Local: `http://localhost:5173`

### 4. Storage Buckets

| Bucket | Public | Purpose |
|---|---|---|
| `generation-uploads` | Yes | User-uploaded input images |
| `template-assets` | Yes | Template thumbnails and media |
| `generations` | Yes | AI output images and videos |

### 5. Deploy Edge Functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref your-project-ref
supabase secrets set WAVESPEED_KEY=... ANTHROPIC_KEY=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=...
supabase functions deploy image-generate
supabase functions deploy video-generate
```

### 6. Set admin role

```sql
UPDATE profiles SET role = 'admin' WHERE username = 'your_username';
```

### 7. Staff credit pool

```sql
INSERT INTO app_settings (key, value)
VALUES ('staff_pool_user_id', '"uuid-of-pool-account"');
```

### 8. Run locally

```bash
npm run dev
```

### 9. Deploy to Vercel

Add environment variables in Vercel Dashboard → Settings → Environment Variables:
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_PAYSTACK_PUBLIC_KEY
```

---

## Admin Panel

Visit `/admin` after setting your role to `admin`.

| Tab | What you can do |
|---|---|
| Dashboard | Live stats: users, generations, revenue, success rate |
| Prompts | Edit + version template prompts, rollback anytime |
| Templates | Toggle visibility (PromptIQ ↔ Public), upload media assets |
| Models | Toggle models active/inactive, view credit costs |
| Staff | Promote/demote staff, view pool balance |
| Feed | Approve or reject pending community posts |
| Users | Browse users, view credit balances |
| Settings | Runtime config |

---

## PromptIQ Staff Workspace

- Admin promotes a user via **Admin Panel → Staff tab**
- Staff see a glowing ⚡ PromptIQ button in the nav
- PromptIQ templates (`visibility: 'promptiq'`) are **invisible to regular users**
- Staff generations are billed to the **shared staff credit pool**

### Promoting staff

```sql
SELECT promote_to_staff('admin-uuid', 'user-uuid', 'Senior content creator');
```

---

## Template System

Templates are modular files in `src/templates/`. Prompts live in the database — versioned and rollback-able from the Admin Panel.

```js
// src/templates/my-template.js
export default {
  slug:         'my-template',
  name:         'My Template',
  visibility:   'promptiq',   // 'promptiq' | 'public'
  description:  'What it does',
  instructions: 'Upload a clear photo of Person A, then Person B.',
  inputs: [
    { key: 'startFrame', type: 'image', label: 'Person A', required: true },
    { key: 'endFrame',   type: 'image', label: 'Person B', required: true },
  ],
  supportsAspect:   true,
  supportsDuration: true,
  supportsModel:    false,
}
```

**To add a new template:**
1. Create `src/templates/my-template.js`
2. Register it in `src/templates/index.js`
3. Insert a row into the `templates` table
4. Add an initial prompt in Admin Panel → Prompts

No redeployment needed for prompt or asset changes.

---

## Domain Migration Checklist

When moving from `meckury-ai.vercel.app` to `meckury.ai`:

- [ ] Update Vercel custom domain
- [ ] Update Supabase Auth → Site URL to `https://meckury.ai`
- [ ] Update Supabase Auth → Redirect URLs
- [ ] Update Google OAuth → Authorised redirect URIs
- [ ] Update Paystack → Allowed callback domains

---

## Built by

**Nurse Meck** · [PromptIQ](https://promptiq.ai) · An AFIX / LinkAI Initiative
