// src/lib/pricing.js
//
// Single source of truth for turning a model's real USD cost into what a
// user pays, in any tool. Every page that charges for a generation should
// go through this file instead of computing its own formula — that's what
// let IQAds and the old flat credit_cost_t2i/i2i numbers drift out of sync
// with each other and with what WaveSpeed/fal actually charge.
//
// Data model:
//   models.cost_usd_resolution   jsonb — real provider cost. Keyed either
//     by resolution ("480p"/"720p") for models that price per resolution,
//     or by "standard" for models that don't split by resolution (most
//     image models, and any video model with one flat rate).
//   models.is_flat_rate          bool  — true: cost_usd_resolution value
//     is a flat per-generation cost. false: value is USD per second and
//     gets multiplied by duration.
//   tool_pricing_settings        one row per tool_key, one margin_multiplier
//     applied to every model used in that tool. Not model-specific.
//   app_settings.global_usd_to_ngn_rate / global_ngn_per_credit — the two
//     currency conversion numbers, shared by every tool.
import { supabase } from '@/lib/supabase'

// ── real provider cost for one model at one resolution/duration ──────────
// Returns null if the model has no real cost data yet for the requested
// resolution (and no "standard" fallback) — callers should treat that as
// "not orderable yet", not as free / zero cost.
export function calculateModelCostUsd({ model, resolution, duration }) {
  const costMap = model?.cost_usd_resolution
  if (!costMap || typeof costMap !== 'object') return null

  // Prefer an exact resolution match; fall back to "standard" for models
  // that don't split cost by resolution.
  const key = costMap[resolution] != null
    ? resolution
    : (costMap.standard != null ? 'standard' : null)
  if (!key) return null

  const perUnit = Number(costMap[key])
  if (Number.isNaN(perUnit)) return null

  return model.is_flat_rate ? perUnit : perUnit * Number(duration || 0)
}

// Whether a model has more than one real resolution entered — drives
// whether a "Resolution" selector should render at all in a tool's UI.
// A model with only "standard" (or nothing) doesn't offer a choice.
export function modelSupportsResolutionChoice(model) {
  const costMap = model?.cost_usd_resolution
  if (!costMap) return false
  const keys = Object.keys(costMap).filter((k) => k !== 'standard' && costMap[k] != null)
  return keys.length > 1
}

// ── global currency settings (shared by every tool) ──────────────────────
export async function fetchGlobalPricingSettings() {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['global_usd_to_ngn_rate', 'global_ngn_per_credit'])
  const map = {}
  for (const row of data || []) map[row.key] = Number(row.value)
  return {
    usdToNgnRate: map.global_usd_to_ngn_rate ?? null,
    ngnPerCredit: map.global_ngn_per_credit ?? null,
  }
}

export async function saveGlobalPricingSetting(key, value) {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message || 'Failed to save setting')
}

// ── per-tool margin ────────────────────────────────────────────────────
export async function fetchToolMargin(toolKey) {
  const { data } = await supabase
    .from('tool_pricing_settings')
    .select('margin_multiplier')
    .eq('tool_key', toolKey)
    .maybeSingle()
  return data?.margin_multiplier != null ? Number(data.margin_multiplier) : null
}

export async function fetchAllToolMargins() {
  const { data } = await supabase
    .from('tool_pricing_settings')
    .select('tool_key, margin_multiplier')
    .order('tool_key')
  return data || []
}

export async function saveToolMargin(toolKey, marginMultiplier) {
  const { error } = await supabase
    .from('tool_pricing_settings')
    .upsert(
      { tool_key: toolKey, margin_multiplier: Number(marginMultiplier), updated_at: new Date().toISOString() },
      { onConflict: 'tool_key' }
    )
  if (error) throw new Error(error.message || 'Failed to save margin')
}

// ── the actual price a user pays ──────────────────────────────────────
// Pass in already-fetched globalSettings/marginMultiplier when calling this
// repeatedly (e.g. on every keystroke in a duration/resolution picker) so
// each call isn't a fresh round-trip — fetch those once per page load.
export function calculatePrice({ model, resolution, duration, marginMultiplier, globalSettings }) {
  if (!marginMultiplier || !globalSettings?.usdToNgnRate || !globalSettings?.ngnPerCredit) return null

  const costUsd = calculateModelCostUsd({ model, resolution, duration })
  if (costUsd == null) return null

  const priceUsd = costUsd * marginMultiplier
  const priceNgn = Math.round(priceUsd * globalSettings.usdToNgnRate)
  const credits  = Math.ceil(priceNgn / globalSettings.ngnPerCredit)

  return { costUsd, priceUsd, priceNgn, credits }
}

