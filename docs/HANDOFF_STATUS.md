# Meckury AI — Project Status & Handoff

*Written 8 Oct 2026, at a deliberate pause. Read this first when resuming.*

This document records what was done, what state production is in, what is risky, and what to do next in priority order. Nothing here contains secrets. **Rotate the GitHub token that was shared in chat** (it was used for pushes to `main` and is in the conversation history).

---

## 1. Where things stand (one-minute summary)

| Area | State |
|---|---|
| **Web app (Vercel, `main`)** | Rebrand + redesign shipped through commit `515d233`. Production build passed at that commit. **Not visually QA'd in a browser yet.** |
| **Repo, unpushed** | Local commits after `515d233`: security migrations as SQL files, and this document. Pushes go out together on the next push. |
| **Supabase production** | Several security/credit fixes applied **directly to the live database** (listed in §4). They are mirrored as files in `supabase/migrations/` so git matches production. |
| **Edge Functions** | **Returning HTTP 402 across the board** (`video-poll`, `comfyui-poll`, `email-send`, `agent-x`). Org is on the Supabase **free plan**. Cause not confirmed. See §5, item P0-1. |
| **Agent X** | Database core already existed (empty). I added an admin-only edge function (`agent-x` v2: planner + worker + user actions). **No UI yet. Never run end-to-end.** |
| **Muse (AI chat)** | Enabled in nav. Backend `ai-chat` is at v16 with server-side pricing, confirmation gate and tier check. **Not tested with a signed-in session.** |

---

## 2. What we did, by workstream

### 2.1 UI/UX rebrand (all on `main`)
Goal: make the app look and feel like a modern AI cinematic-filmmaking product (benchmarks researched: Higgsfield, invideo AI, LTX Studio, Google Flow, Runway).

- **Design system:** dark-first cinematic tokens (CSS variables, same names as before so every page re-themed at once), warm light theme, Sora headings, brand gradient, glass surfaces, film grain, focus rings, reduced-motion support. Live system-theme switching; browser-chrome colour follows the theme.
- **Device-aware layout:** desktop sidebar (rail at ≥1024px, full at ≥1280px) + floating glass bottom nav on mobile; `useDevice` hook; no sticky hover on touch; wider content columns on large screens; PWA manifest no longer locked to portrait.
- **Create hub:** "What will you direct today?", Filma flagship banner, Studios as default tab, accent-glow tiles.
- **Creation workspace:** shared `GenerationPreviewPane` (live preview + results strip) on Image, Video, Copy Motion, Talking Head, Photo Polish, both Upscalers, UGC generate pages; DAW and IQ Ads have their own panes (`StudioPreviewPanes.jsx`).
- **Filma:** storyboard film-strip + proportional runtime timeline on the scene page (`ShotTimeline.jsx`).
- **Muse:** switched on (mobile nav + desktop sidebar), full-screen routes (Muse + all Filma pages) wrapped in a desktop shell (`Shell` in `App.jsx`).
- **Pages redesigned:** Landing, Profile, Billing, Referrals, Pricing, Result page (screening room + desktop side panel), Onboarding, Admin navigation (23 tabs → 6 groups with desktop sidebar).
- **Systematic fixes (not individually redesigned):** glass headers + gradient primary buttons across UGC wizards, Render Window, Private Booking, Cinematic, Community; responsive grids on Feed/Media/Community; modal, button and chip polish; unloaded `Syne` font replaced by Sora.

### 2.2 Muse backend (`ai-chat`, deployed in Supabase, source not in repo)
- Fixed: history loaded the **oldest** 15 messages instead of the newest; empty-content messages broke the model call.
- Added: server-side **tier enforcement**, **confirmation gate** (an `execute_generation` is honoured only if the previous assistant turn was a proposal for the same model/type/duration; proposals are stored in new column `ai_chat_messages.proposal jsonb`), and **server-side pricing** (the old code read price columns that no longer exist, so Muse generations cost 0 credits — pre-existing bug).
- Pricing formula (mirrors `src/lib/pricing.js`): `credits = ceil(costUsd × tool margin ÷ global_usd_per_credit)`. Models with no price data are refused instead of treated as free.

### 2.3 Security & credit-integrity audit (applied to production)
Triggered by Supabase's security advisor. Findings and fixes:

| Finding | Severity | Fix |
|---|---|---|
| `add_credits`, `refund_credits` etc. callable by **anonymous** users (no auth check inside) → anyone with the public anon key could mint credits | Critical | Revoked from `PUBLIC/anon/authenticated`; service-role only |
| Admin/privileged functions trusted a caller-supplied `p_admin_id` / `p_user_id` | Critical | 53 functions now start with an `auth.uid()` guard (`_assert_self`, `_assert_admin`, …); service role, cron and internal calls are trusted |
| Failure trigger refunded `credits_charged` even if nothing was charged, and users could edit `credits_charged` / reopen completed generations → refund-for-free | Critical | `refund_credits` capped at what was actually charged; trigger on `generations` blocks client edits to money fields and reopening completed rows |
| `profiles_update_own` didn't protect `user_tier` → self-promote to Master | High | Policy now pins `user_tier`, `tier_started_at`, `tier_expires_at` |
| 12 tables with RLS off (coupons, teams, cohorts, workflow backups, …) | High | RLS enabled with policies matching real client access; helper functions avoid policy recursion |

Verified with rolled-back tests (nothing persisted): uncharged refund refused; 9,999,999 request capped to the real charge (56); client `credits_charged` edit blocked; completed→failed blocked; non-admin self-promotion blocked; ordinary profile edits still work; no public table left without RLS.

### 2.4 Cost / quota work
`pg_cron` called Edge Functions on fixed schedules even when idle (~7,600 calls/day). Five jobs are now **gated** with `WHERE EXISTS (…)` on exactly the work each function performs (jobs 14, 16, 19, 20, 22). Schedules unchanged.

### 2.5 Agent X
- Spec: `Agent_X_Comprehensive_Implementation_Spec.md` (5,887 lines; phased plan, §145).
- **Audit result:** a mature DB core already exists (`agent_x_projects/steps/tasks/events/dependencies` + 13 `agent_x_*` functions: claim, heartbeat, complete, fail, evaluate, reconcile, user actions, spend budget, provider sync). All empty. Functions are service-role only (correct).
- I first drafted a competing schema, **discarded it before applying** after discovering the existing one.
- **Incident:** I deployed `agent-x` without first listing deployed functions. A version 1 already existed (created ~4:47 UTC 7 Oct) and was overwritten; its source is unrecoverable. Evidence suggests it was the target of cron job 22 (`agent-x-tick`, body `{"op":"tick"}`). My v2 is live and **does not understand `op`**. Because that cron job is now gated on active projects (none), nothing is currently failing because of it.
- Built (`supabase/functions/agent-x/index.ts`, deployed as v2, **admin-only** via `AGENT_X_PUBLIC`): actions `models`, `create`, `action` (approve/pause/resume/cancel/retry), `tick`, `work`; handlers for `ANALYZE_ASSET` (vision), `PLAN` (structured tool-call, validated/clamped), `GENERATE_VIDEO` (idempotent, budget-reserved, credit-charged), `ASSEMBLE` (outputs a clip manifest — the edge runtime cannot stitch video).
- Human approval gate: after PLAN the project sits in `AWAITING_APPROVAL` with `plan.estimated_credits`; budget = 1.5× estimate.

---

## 3. Commit / migration reference

Repo commits (newest last): `573a44f` Agent X source · `fc1738c` Result/Onboarding · `515d233` Pricing/Admin (**last pushed**) · `4910151` security migrations (local) · this document (local).

`supabase/migrations/` (applied to production by hand; filenames are documentation order, not the applied versions):

1. `20261008080000_harden_money_and_admin_functions.sql`
2. `20261008090000_authz_guards_for_privileged_functions.sql`
3. `20261008095000_gate_idle_cron_edge_function_calls.sql`
4. `20261008100000_fix_credit_leaks.sql`
5. `20261008101000_enable_rls_render_window_and_ugc_tables.sql` (policies made re-runnable)

Also applied: `ai_chat_messages_add_proposal` (column). All are reversible; revert hints are in each file's header.

> The `ai-chat` and `agent-x` function sources: `agent-x` is in the repo; **`ai-chat` is not** (only in Supabase). Add `supabase/functions/ai-chat/` to the repo.

---

## 4. Risks and open facts (verify, don't assume)

- **HTTP 402 on Edge Functions.** Every logged poller call in the retained window returned 402. I could not read the cause; free plan + quota/billing is the leading hypothesis, unconfirmed.
- **Credits already leaked.** At least 5 automatic refunds (1,586 credits, 3 users) have no charge on record and their generation rows were deleted; 4 "insufficient credits" failures (335 credits) were also refunded. No balances were changed. Muse generations before v16 charged 0 (count unknown).
- **Possible Master self-promotion** before the fix. Not checked.
- **Client sets the price (still open).** Studios insert a `generations` row with a client-computed `credits_charged` and call `deduct_credits` with a client-supplied amount. The new guards stop *editing* afterwards and impersonation, but a client can still **insert with a low price and deduct a low amount**. Real fix = price and charge server-side inside `image-generate` / `video-generate` / etc.
- `deduct_credits` still trusts the amount it is given (only the *user* is now verified).
- `verify-payment` accepts a client-supplied `userId` (lets a payer credit someone else; low impact). Payment re-verification with Paystack itself is sound.
- Cron jobs 19/20 appear to embed a literal bearer token in the command text; confirm whether it's the anon or service key and move it to Vault.
- Remaining advisor items: `SECURITY DEFINER` views, ~70 functions with mutable `search_path`, leaked-password protection, anonymous-readable definer functions beyond those fixed.
- `ai-chat` / `agent-x`: after a failed credit charge they mark the generation failed with `credits_charged` still > 0. Harmless now (refund cap), but should set `credits_charged: 0` for cleanliness.
- Muse v16 and the Agent X function were **never exercised live** (no signed-in test session, and functions are returning 402).

---

## 5. Next fixes, in priority order

### P0 — do first
1. **Resolve the 402.** Open Supabase → Billing/Usage. If over quota or unpaid, upgrade or reduce usage. Then confirm pollers return 200 (`select … from logs where event_message like '%video-poll%'`), and look for stuck generations:
   `select id, status, created_at from generations where status in ('processing','waiting') and created_at < now() - interval '30 minutes';`
2. **Rotate secrets:** the GitHub token shared in chat; check Supabase keys embedded in cron command text.
3. **Review the credit leak history** (owner decision): list affected accounts, decide on clawbacks; check for self-promoted Master users (`user_tier='master'` with no payment/admin record); count Muse generations with `credits_charged = 0`.
4. **Exercise Muse once** end-to-end (idea → plan → confirm → generate) and watch the price shown vs. charged.

### P1 — high
5. **Server-side pricing and charging for every studio** (close the "client sets the price" hole). Move `calculatePrice` + `deduct_credits` into the generate edge functions; make `deduct_credits` accept service role only; clients send intent, not amounts.
6. **Agent X compatibility patch** (3 lines in `agent-x/index.ts`): `const action = body.action ?? body.op`; when the bearer is the service key and `action === 'tick'`, call `runWorker()` instead of `kick()`; set `credits_charged: 0` when a charge fails. Redeploy, then confirm the next cron tick returns 200 once a project exists. **Before deploying, list functions and compare the live hash** (live v2 = `35b21929…`).
7. **Agent X UI (admin-gated first):** project list; create flow (pick an uploaded flyer from `assets`, pick a model from the `models` action, direction text); project detail with step list, event timeline, plan-approval card showing `plan.estimated_credits`, and approve/pause/resume/cancel/retry buttons via the function's `action` endpoint. Read data through RLS owner policies (projects/steps/events); poll or use realtime. Route `/agent-x` under the Admin guard.
8. **Agent X end-to-end test** with a cheap model after the 402 is fixed: happy path, a retried failure, lease expiry, cancellation, budget exceeded.
9. **Add `ai-chat` source to the repo**; add automated tests for pricing parity between `src/lib/pricing.js` and the edge copies.

### P2 — medium
10. Visual QA on the Vercel preview (desktop + mobile, light + dark): sidebar/top-bar spacing, Create hub, the preview pane on all studios, Muse/Filma shell, Result page, Billing, Pricing, Admin.
11. Remaining redesigns done only as systematic fixes: UGC wizards, Render Window / Private Booking plan cards, Cinematic Transitions page, admin sub-managers.
12. Light-mode pass for hardcoded colours; replace the ~4,400 inline `style` props with shared components over time; new PWA icon set (needs artwork).
13. Clear remaining security-advisor items (§4).

### P3 — later
14. Agent X later phases per spec §145: richer planning/QC, regeneration + dependency invalidation, real assembly (needs a render service or ffmpeg worker), user-facing progress vocabulary, observability.
15. Reduce Edge Function invocations further (e.g. webhooks instead of polling) once billing is settled.

---

## 6. How to resume

```bash
git clone https://github.com/meckurypro/lumina-create && cd lumina-create
npm install && npm run build          # should pass (last verified at 515d233)
```
- Supabase project: **Meckury AI** (`kojagsoimsjbspvsmnmv`, eu-west-2). Connected tools can list functions, run SQL, apply migrations, read logs and advisors.
- Env on Edge Functions: `ANTHROPIC_KEY` (set), optional `AGENT_X_PUBLIC=true` (opens Agent X to all users — **leave off**), `AGENT_X_MODEL`, `VISION_MODEL`, `AGENT_X_TOOL_KEY` (pricing margin key, default `create_video`).
- Ground rules learned the hard way: list deployed functions and compare hashes before deploying; verify privileges after `REVOKE` (the `PUBLIC` role grants access); test money logic inside a rolled-back block; check `models` columns before assuming price fields.

*End of handoff.*
