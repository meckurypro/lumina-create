// src/lib/iqads.js
//
// Order creation + payment for IQ Ads (flyer → video).
// Credit path calls process_iqads_order_payment directly via RPC — no
// initialize-payment/verify-payment involvement, same as any other
// credit-deduction flow in this app (see generationsDb.deductCredits).
// Paystack path reuses the existing initialize/verify functions with
// packageSlug = 'iqads_order'.
//
// Pricing math itself lives in lib/pricing.js and is shared with every
// other tool — this file just supplies IQAds' tool_key ('iqads') and
// wires the result into an order row.
import { supabase } from '@/lib/supabase'
import { initializePayment } from '@/lib/paystack'
import {
  fetchGlobalPricingSettings, fetchToolMargin, calculatePrice,
  modelSupportsResolutionChoice,
} from '@/lib/pricing'

const TOOL_KEY = 'iqads'

export { modelSupportsResolutionChoice as iqadsSupportsResolutionChoice }

// ── pricing preview (for display — the order row snapshots the
// authoritative price at creation, computed the same way server-side
// should if/when this moves behind an edge function) ─────────────────
export async function calculateIqadsPrice({ model, duration, resolution }) {
  const [globalSettings, marginMultiplier] = await Promise.all([
    fetchGlobalPricingSettings(),
    fetchToolMargin(TOOL_KEY),
  ])
  return calculatePrice({ model, resolution, duration, marginMultiplier, globalSettings })
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
// today's cost + margin + rate. Both payment paths start from this row.
export async function createIqadsOrder({
  userId, flyerUrl, contentType, model, duration, resolution, aspectRatio,
  humanMode, humanReferenceUrl, userDirection, paymentMethod,
}) {
  const priced = await calculateIqadsPrice({ model, duration, resolution })
  if (!priced) {
    throw new Error('This model is not priced for the selected resolution yet. Contact support.')
  }

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
      cost_usd:                priced.costUsd,
      usd_to_ngn_rate:          priced.priceNgn / priced.priceUsd, // effective rate, for audit trail
      margin_multiplier:        priced.priceUsd / priced.costUsd,
      amount_ngn:               priced.priceNgn,
      payment_method:           paymentMethod,
    })
    .select()
    .single()

  if (error || !order) throw new Error(error?.message || 'Could not create order')
  return order
}

// ── credit path ───────────────────────────────────────────────────────────
export async function payIqadsOrderWithCredits({ order, userId }) {
  const { ngnPerCredit } = await fetchGlobalPricingSettings()
  if (!ngnPerCredit) {
    throw new Error('Credit pricing is not configured. Use Paystack instead.')
  }

  const creditsAmount = Math.ceil(Number(order.amount_ngn) / ngnPerCredit)

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
export async function triggerIqadsGeneration(orderId) {
  const { data, error } = await supabase.functions.invoke('iqads-generate', {
    body: { orderId },
  })
  if (error || data?.error) {
    throw new Error(data?.error || error?.message || 'Could not start generation')
  }
  return data
}
