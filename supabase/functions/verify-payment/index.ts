// Verifies a Paystack transaction. Two entry points:
//   1) Paystack webhook  (x-paystack-signature present, HMAC verified)
//   2) Frontend callback (POST { reference, userId?, packageSlug? })
//
// MECKURY_ prefix guard: shared Paystack account across apps. Any reference
// that does not start with MECKURY_ is silently ignored with HTTP 200.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const MASTER_SLUG  = 'master_subscription'
const MASTER_PRICE = 5000   // NGN
const MASTER_DAYS  = 30
const REF_PREFIX   = 'MECKURY_'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

// ── HMAC-SHA512 of raw body using PAYSTACK_SECRET ─────────────
async function hmacSha512Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Shared processor — idempotent ─────────────────────────────
async function processPayment(opts: {
  reference: string
  userId?: string
  packageSlug?: string
  verifiedTx?: any   // already-fetched Paystack tx (from webhook payload)
}) {
  const { reference } = opts

  if (!reference.startsWith(REF_PREFIX)) {
    return { success: true, ignored: true, reason: 'non-meckury reference' }
  }

  // Idempotency
  const { data: existing } = await admin
    .from('credit_transactions').select('id')
    .eq('payment_reference', reference).maybeSingle()
  if (existing) return { success: true, already_processed: true }

  // Always re-verify with Paystack so we trust the amount/status
  let tx: any = opts.verifiedTx
  if (!tx || tx.status !== 'success') {
    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` } },
    )
    const ps = await res.json()
    if (!res.ok || !ps?.status) {
      return { success: false, error: ps?.message || 'Paystack verification failed' }
    }
    tx = ps.data
  }

  if (tx?.status !== 'success') {
    return { success: false, error: `Payment not successful (${tx?.status})` }
  }

  // Pull userId / packageSlug from Paystack metadata when caller didn't supply
  const md = tx.metadata || {}
  const fromCustom = (name: string) =>
    md?.custom_fields?.find?.((f: any) => f.variable_name === name)?.value
  const userId      = opts.userId      || md.user_id      || fromCustom('user_id')
  const packageSlug = opts.packageSlug || md.package_slug || fromCustom('package_slug')

  if (!userId || !packageSlug) {
    return { success: false, error: 'Missing user_id / package_slug in metadata' }
  }

  const paidNgn = Number(tx.amount) / 100

  // ── Master subscription ─────────────────────────────────────
  if (packageSlug === MASTER_SLUG) {
    if (paidNgn + 1 < MASTER_PRICE) {
      return { success: false, error: `Amount mismatch (expected ₦${MASTER_PRICE}, got ₦${paidNgn})` }
    }

    const { data: profile, error: pErr } = await admin
      .from('profiles').select('user_tier, tier_expires_at, credits').eq('id', userId).single()
    if (pErr || !profile) return { success: false, error: 'User profile not found' }

    const base = profile.tier_expires_at && new Date(profile.tier_expires_at) > new Date()
      ? new Date(profile.tier_expires_at) : new Date()
    const newExpiry = new Date(base.getTime() + MASTER_DAYS * 24 * 60 * 60 * 1000)

    const updates: Record<string, unknown> = {
      user_tier:       'master',
      tier_expires_at: newExpiry.toISOString(),
      updated_at:      new Date().toISOString(),
    }
    if (profile.user_tier !== 'master') updates.tier_started_at = new Date().toISOString()

    const { error: uErr } = await admin.from('profiles').update(updates).eq('id', userId)
    if (uErr) return { success: false, error: `Profile update failed: ${uErr.message}` }

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

    return { success: true, kind: 'master_subscription', expires_at: newExpiry.toISOString() }
  }

  // ── Credit pack ────────────────────────────────────────────
  const { data: pkg, error: pkgErr } = await admin
    .from('credit_packages').select('*').eq('slug', packageSlug).single()
  if (pkgErr || !pkg) return { success: false, error: 'Unknown package' }

  if (paidNgn + 1 < Number(pkg.price_ngn)) {
    return { success: false, error: `Amount mismatch (expected ₦${pkg.price_ngn}, got ₦${paidNgn})` }
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
  if (rpcErr) return { success: false, error: `add_credits failed: ${rpcErr.message}` }

  return {
    success:       true,
    kind:          'credit_pack',
    credits_added: rpc?.credits_added ?? null,
    balance_after: rpc?.balance_after ?? null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ success: false, error: 'Method not allowed' }, 405)
  if (!PAYSTACK_SECRET)         return json({ success: false, error: 'Server missing PAYSTACK_SECRET_KEY' }, 500)

  const signature = req.headers.get('x-paystack-signature')
  const rawBody   = await req.text()

  // ── Path 1: Paystack webhook ──────────────────────────────────
  if (signature) {
    let expected = ''
    try { expected = await hmacSha512Hex(PAYSTACK_SECRET, rawBody) } catch { /* fall through */ }
    if (expected !== signature) {
      // Always 200 to avoid Paystack retry storms; just don't act.
      return json({ success: false, error: 'Invalid signature' }, 200)
    }

    let evt: any
    try { evt = JSON.parse(rawBody) } catch { return json({ success: true, ignored: true }, 200) }

    if (evt?.event !== 'charge.success') {
      return json({ success: true, ignored: true, reason: 'unhandled event' }, 200)
    }

    const ref = evt?.data?.reference || ''
    if (!ref.startsWith(REF_PREFIX)) {
      return json({ success: true, ignored: true, reason: 'non-meckury reference' }, 200)
    }

    try {
      const result = await processPayment({ reference: ref, verifiedTx: evt.data })
      return json(result, 200)  // always 200 to webhooks
    } catch (e) {
      console.error('[verify-payment webhook] error:', e)
      return json({ success: false, error: (e as Error).message }, 200)
    }
  }

  // ── Path 2: Frontend callback ─────────────────────────────────
  let body: { reference?: string; userId?: string; packageSlug?: string }
  try { body = JSON.parse(rawBody) } catch { return json({ success: false, error: 'Invalid JSON' }, 400) }

  const { reference, userId, packageSlug } = body
  if (!reference) return json({ success: false, error: 'reference is required' }, 400)

  if (!reference.startsWith(REF_PREFIX)) {
    return json({ success: true, ignored: true, reason: 'non-meckury reference' })
  }

  const result = await processPayment({ reference, userId, packageSlug })
  const status = result.success ? 200 : 400
  return json(result, status)
})