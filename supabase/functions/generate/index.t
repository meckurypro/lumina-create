// Unified generation edge function.
// Routes by `action` and dispatches to FAL / Wavespeed / Anthropic.
// Paste your full action handlers in the `handlers` map below.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const FAL_KEY = Deno.env.get('FAL_KEY') ?? ''
const WAVESPEED_KEY = Deno.env.get('WAVESPEED_KEY') ?? ''
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') ?? ''

type Ctx = {
  userId: string
  supabase: ReturnType<typeof createClient>
  payload: Record<string, unknown>
}

// ---- Provider helpers ---------------------------------------------------

async function callFal(model: string, input: unknown) {
  const res = await fetch(`https://fal.run/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`FAL ${res.status}: ${await res.text()}`)
  return res.json()
}

async function callWavespeed(model: string, input: unknown) {
  const res = await fetch(`https://api.wavespeed.ai/api/v3/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WAVESPEED_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(`Wavespeed ${res.status}: ${await res.text()}`)
  return res.json()
}

async function callAnthropic(body: unknown) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)
  return res.json()
}

// ---- Action handlers ----------------------------------------------------
// TODO: Paste your full action dispatch + fallback logic here. Each handler
// receives { userId, supabase, payload } and returns a JSON-serialisable result.

const handlers: Record<string, (ctx: Ctx) => Promise<unknown>> = {
  ping: async () => ({ ok: true, ts: Date.now() }),

  // Example: generic FAL image generation
  'fal.image': async ({ payload }) => {
    const { model, input } = payload as { model: string; input: unknown }
    return await callFal(model, input)
  },

  // Example: generic Wavespeed call
  'wavespeed.run': async ({ payload }) => {
    const { model, input } = payload as { model: string; input: unknown }
    return await callWavespeed(model, input)
  },

  // Example: Claude prompt enhancement
  'anthropic.message': async ({ payload }) => {
    return await callAnthropic(payload)
  },
}

// ---- HTTP entrypoint ----------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: authErr } = await supabase.auth.getClaims(token)
    if (authErr || !claims?.claims) return json({ error: 'Unauthorized' }, 401)
    const userId = claims.claims.sub as string

    const body = await req.json().catch(() => ({}))
    const { action, ...payload } = body ?? {}
    if (!action || typeof action !== 'string') {
      return json({ error: 'Missing action' }, 400)
    }

    const handler = handlers[action]
    if (!handler) return json({ error: `Unknown action: ${action}` }, 400)

    const result = await handler({ userId, supabase, payload })
    return json(result, 200)
  } catch (e) {
    console.error('generate error', e)
    return json({ error: (e as Error).message ?? 'Internal error' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
