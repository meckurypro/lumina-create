// Verifies a Paystack transaction and:
//   • for credit packs        → calls add_credits RPC
//   • for master_subscription → flips profile.user_tier='master', 30-day window
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const MASTER_SLUG  = 'master_subscription'
const MASTER_PRICE = 5000           // NGN
const MASTER_DAYS  = 30

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ success: false, error: 'Method not allowed' }, 405)

  let body: { reference?: string; userId?: string; packageSlug?: string }
  try { body = await req.json() } catch { return json({ success: false, error: 'Invalid JSON' }, 400) }

  const { reference, userId, packageSlug } = body
  if (!reference || !userId || !packageSlug) {
    return json({ success: false, error: 'reference, userId and packageSlug are required' }, 400)
  }
  if (!PAYSTACK_SECRET) return json({ success: false, error: 'Server missing PAYSTACK_SECRET_KEY' }, 500)

  // ── 1) Verify with Paystack ───────────────────────────────────
  let ps: any
  try {
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    })
    ps = await res.json()
    if (!res.ok || !ps?.status) return json({ success: false, error: ps?.message || 'Paystack verification failed' }, 400)
  } catch (e) {
    return json({ success: false, error: `Paystack request failed: ${(e as Error).message}` }, 502)
  }

  const tx = ps.data
  if (tx?.status !== 'success') return json({ success: false, error: `Payment not successful (${tx?.status})` }, 400)

  // Idempotency: refuse to re-process the same reference
  const { data: existing } = await admin
    .from('credit_transactions')
    .select('id')
    .eq('payment_reference', reference)
    .maybeSingle()
  if (existing) return json({ success: true, already_processed: true })

  const paidNgn = Number(tx.amount) / 100

  // ── 2A) Master subscription ───────────────────────────────────
  if (packageSlug === MASTER_SLUG) {
    if (paidNgn < MASTER_PRICE) {
      return json({ success: false, error: `Amount mismatch (expected ₦${MASTER_PRICE}, got ₦${paidNgn})` }, 400)
    }

    const { data: profile, error: pErr } = await admin
      .from('profiles').select('user_tier, tier_expires_at, credits').eq('id', userId).single()
    if (pErr || !profile) return json({ success: false, error: 'User profile not found' }, 404)

    // Extend from current expiry if still active, otherwise from now
    const base = profile.tier_expires_at && new Date(profile.tier_expires_at) > new Date()
      ? new Date(profile.tier_expires_at) : new Date()
    const newExpiry = new Date(base.getTime() + MASTER_DAYS * 24 * 60 * 60 * 1000)

    const { error: uErr } = await admin
      .from('profiles')
      .update({
        user_tier:        'master',
        tier_started_at:  profile.user_tier === 'master' ? undefined : new Date().toISOString(),
        tier_expires_at:  newExpiry.toISOString(),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', userId)
    if (uErr) return json({ success: false, error: `Profile update failed: ${uErr.message}` }, 500)

    // Log a transaction row (idempotency anchor + history)
    await admin.from('credit_transactions').insert({
      user_id:            userId,
      type:               'purchase',
      status:             'completed',
      amount:             0,
      balance_before:     profile.credits ?? 0,
      balance_after:      profile.credits ?? 0,
      description:        'Master subscription (30 days)',
      payment_provider:   'paystack',
      payment_reference:  reference,
      payment_amount_ngn: paidNgn,
      metadata: { kind: 'master_subscription', days: MASTER_DAYS, expires_at: newExpiry.toISOString() },
    })

    await admin.from('notifications').insert({
      user_id: userId,
      title:   'Welcome to Master ⭐',
      body:    `Your Master plan is active until ${newExpiry.toUTCString().slice(0, 16)}.`,
      type:    'success',
    })

    return json({ success: true, kind: 'master_subscription', expires_at: newExpiry.toISOString() })
  }

  // ── 2B) Credit package ───────────────────────────────────────
  const { data: pkg, error: pkgErr } = await admin
    .from('credit_packages').select('*').eq('slug', packageSlug).single()
  if (pkgErr || !pkg) return json({ success: false, error: 'Unknown package' }, 404)

  if (paidNgn + 1 < Number(pkg.price_ngn)) {
    return json({ success: false, error: `Amount mismatch (expected ₦${pkg.price_ngn}, got ₦${paidNgn})` }, 400)
  }

  const { data: rpc, error: rpcErr } = await admin.rpc('add_credits', {
    p_user_id:           userId,
    p_amount:            Number(pkg.credits),
    p_bonus_amount:      Number(pkg.bonus_credits || 0),
    p_description:       `Credit pack: ${pkg.name}`,
    p_payment_provider:  'paystack',
    p_payment_reference: reference,
    p_amount_ngn:        paidNgn,
    p_amount_usd:        null,
  })
  if (rpcErr) return json({ success: false, error: `add_credits failed: ${rpcErr.message}` }, 500)

  return json({
    success:        true,
    kind:           'credit_pack',
    credits_added:  rpc?.credits_added ?? null,
    balance_after:  rpc?.balance_after ?? null,
  })
})