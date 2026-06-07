// Initializes a Paystack transaction server-side and returns the hosted
// authorization_url. Frontend redirects the browser there (no iframe).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

const MASTER_SLUG  = 'master_subscription'
const MASTER_PRICE = 5000 // NGN

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

function randomRef() {
  const rand = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(rand, (b) => b.toString(36)).join('').slice(0, 9).toUpperCase()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST')    return json({ success: false, error: 'Method not allowed' }, 405)
  if (!PAYSTACK_SECRET)         return json({ success: false, error: 'Server missing PAYSTACK_SECRET_KEY' }, 500)

  let body: { userId?: string; packageSlug?: string; email?: string; callbackUrl?: string }
  try { body = await req.json() } catch { return json({ success: false, error: 'Invalid JSON' }, 400) }

  const { userId, packageSlug, email, callbackUrl } = body
  if (!userId || !packageSlug || !email || !callbackUrl) {
    return json({ success: false, error: 'userId, packageSlug, email, callbackUrl are required' }, 400)
  }

  // Look up amount
  let amountNgn = 0
  if (packageSlug === MASTER_SLUG) {
    amountNgn = MASTER_PRICE
  } else {
    const { data: pkg, error: pkgErr } = await admin
      .from('credit_packages').select('price_ngn, credits, bonus_credits').eq('slug', packageSlug).single()
    if (pkgErr || !pkg) return json({ success: false, error: 'Unknown package' }, 404)
    amountNgn = Number(pkg.price_ngn)
  }

  const reference = `MECKURY_${Date.now()}_${randomRef()}`

  try {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amountNgn * 100),
        currency: 'NGN',
        reference,
        callback_url: callbackUrl,
        metadata: {
          custom_fields: [
            { display_name: 'User ID',  variable_name: 'user_id',      value: userId      },
            { display_name: 'Package',  variable_name: 'package_slug', value: packageSlug },
          ],
          user_id:      userId,
          package_slug: packageSlug,
        },
      }),
    })
    const ps = await res.json()
    if (!res.ok || !ps?.status) {
      return json({ success: false, error: ps?.message || 'Paystack initialize failed' }, 400)
    }
    return json({
      success: true,
      authorization_url: ps.data.authorization_url,
      access_code:       ps.data.access_code,
      reference,
    })
  } catch (e) {
    return json({ success: false, error: `Paystack request failed: ${(e as Error).message}` }, 502)
  }
})