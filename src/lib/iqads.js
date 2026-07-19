// src/lib/iqads.js
//
// Order creation + payment for IQ Ads (flyer → video).
// Credit path calls process_iqads_order_payment directly via RPC — no
// initialize-payment/verify-payment involvement, same as any other
// credit-deduction flow in this app (see generationsDb.deductCredits).
// Paystack path reuses the existing initialize/verify functions with
// packageSlug = 'iqads_order'.
import { supabase } from '@/lib/supabase'
import { initializePayment } from '@/lib/paystack'
import { IQADS_RESOLUTIONS } from '@/lib/iqadsConstants'

// ── pricing preview (mirrors the formula used server-side — for display
// only; the order row snapshots the authoritative price at creation) ──
//
// Reads real cost from models.cost_usd_per_second_resolution, e.g.
//   { "480p": 0.031, "720p": 0.052 }
// which is the column the admin panel (IQAdsManager.jsx) actually writes
// to. This used to read model.iqads_cost_per_second_480p_usd and
// model.iqads_720p_cost_multiplier — neither of which exist in the
// schema — so this always returned null and silently disabled checkout.
export function calculateIqadsPrice({ model, duration, resolution }) {
  const costMap = model?.cost_usd_per_second_resolution

  if (!costMap || typeof costMap !== 'object') {
    if (import.meta.env.DEV && model?.is_iqads_model) {
      console.warn(
        `[iqads] Model "${model.value}" is enabled for IQ Ads but has no cost_usd_per_second_resolution set. ` +
        `Set real cost data for it in the IQ Ads admin panel — until then it can't be priced or checked out.`
      )
    }
    return null
  }

  const raw = costMap[resolution]
  if (raw == null) {
    if (import.meta.env.DEV) {
      console.warn(
        `[iqads] Model "${model.value}" has no cost entered for resolution "${resolution}". ` +
        `Available: ${Object.keys(costMap).join(', ') || '(none)'}`
      )
    }
    return null // this model has no real cost entered for this resolution
  }

  const perUnit = Number(raw)
  if (Number.isNaN(perUnit)) return null

  const costUsd = model.is_flat_rate ? perUnit : perUnit * Number(duration)

  return { costUsd, perSecond: model.is_flat_rate ? null : perUnit }
}

// Whether a model has real cost data for more than just the default
// resolution — drives whether the Resolution chips render at all.
export function iqadsSupportsResolutionChoice(model) {
  const costMap = model?.cost_usd_per_second_resolution
  if (!costMap) return false
  return IQADS_RESOLUTIONS.filter((res) => costMap[res] != null).length > 1
}

export async function fetchIqadsGlobalSettings() {
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['iqads_usd_to_ngn_rate', 'iqads_margin_multiplier', 'iqads_ngn_per_credit'])
  const map = {}
  for (const row of data || []) map[row.key] = Number(row.value)
  return {
    usdToNgnRate:     map.iqads_usd_to_ngn_rate     ?? null,
    marginMultiplier: map.iqads_margin_multiplier   ?? null,
    ngnPerCredit:     map.iqads_ngn_per_credit       ?? null, // flat conversion rate for the credit path
  }
}

export async function fetchIqadsModels() {
  const { data } = await supabase
    .from('models')
    .select('*')
    .eq('is_iqads_model', true)
    .eq('is_active', true)
    .order('iqads_sort_order')
  return data || []
}

// ── order creation ────────────────────────────────────────────────────────
// Creates a 'pending' iqads_orders row with the price snapshotted at
// today's global settings. Both payment paths start from this row.
export async function createIqadsOrder({
  userId, flyerUrl, contentType, model, duration, resolution, aspectRatio,
  humanMode, humanReferenceUrl, userDirection, paymentMethod,
}) {
  const settings = await fetchIqadsGlobalSettings()
  if (!settings.usdToNgnRate || !settings.marginMultiplier) {
    throw new Error('IQ Ads pricing is not configured yet. Contact support.')
  }

  const priced = calculateIqadsPrice({ model, duration, resolution })
  if (!priced) {
    throw new Error('This model does not support the selected resolution.')
  }

  const costUsd   = priced.costUsd
  const costNgn   = costUsd * settings.usdToNgnRate
  const amountNgn = Math.round(costNgn * settings.marginMultiplier)

  const { data: order, error } = await supabase
    .from('iqads_orders')
    .insert({
      user_id:              userId,
      status:                'pending',
      flyer_url:             flyerUrl,
      content_type:          contentType,
      model_id:              model.id,
      model_value:           model.value,
      duration:               Number(duration),
      resolution:              resolution,
      aspect_ratio:            aspectRatio,
      human_mode:              humanMode,
      human_reference_url:     humanReferenceUrl || null,
      user_direction:          userDirection || null,
      cost_usd:                costUsd,
      usd_to_ngn_rate:          settings.usdToNgnRate,
      margin_multiplier:        settings.marginMultiplier,
      amount_ngn:               amountNgn,
      payment_method:           paymentMethod,
    })
    .select()
    .single()

  if (error || !order) throw new Error(error?.message || 'Could not create order')
  return order
}

// ── credit path ───────────────────────────────────────────────────────────
export async function payIqadsOrderWithCredits({ order, userId }) {
  const settings = await fetchIqadsGlobalSettings()
  if (!settings.ngnPerCredit) {
    throw new Error('Credit pricing is not configured for IQ Ads. Use Paystack instead.')
  }

  const creditsAmount = Math.ceil(Number(order.amount_ngn) / settings.ngnPerCredit)

  const { data, error } = await supabase.rpc('process_iqads_order_payment', {
    p_order_id:       order.id,
    p_user_id:        userId,
    p_payment_method: 'credit',
    p_credits_amount: creditsAmount,
  })

  if (error) throw new Error(error.message || 'Credit payment failed')
  if (!data?.success) throw new Error(data?.error || 'Not enough credits')
  return data
}

// ── paystack path ─────────────────────────────────────────────────────────
export async function payIqadsOrderWithPaystack({ order, email, userId }) {
  return initializePayment({
    email,
    userId,
    packageSlug: 'iqads_order',
    orderId:     order.id,
  })
  // initializePayment redirects the browser to Paystack's hosted page —
  // no return value reaches here on success (see src/lib/paystack.js).
  // PaymentCallbackPage → verifyPayment() handles the rest.
}

// ── trigger generation after payment confirms ───────────────────────────
// Called after payIqadsOrderWithCredits resolves successfully (Paystack
// path triggers this from PaymentCallbackPage instead, once verify-payment
// returns kind: 'iqads_order').
export async function triggerIqadsGeneration(orderId) {
  const { data, error } = await supabase.functions.invoke('iqads-generate', {
    body: { orderId },
  })
  if (error || data?.error) {
    throw new Error(data?.error || error?.message || 'Could not start generation')
  }
  return data
}
