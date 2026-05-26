// Image generation pipeline: Claude prompt refinement → WaveSpeed → poll → upload → update.
// Client invokes this fire-and-forget after creating the generation row + deducting credits.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const WAVESPEED_KEY  = Deno.env.get('WAVESPEED_KEY') ?? ''
const ANTHROPIC_KEY  = Deno.env.get('ANTHROPIC_KEY') ?? ''
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Model → WaveSpeed endpoint ────────────────────────────
const MODEL_ENDPOINTS: Record<string, string> = {
  flux_schnell:        'wavespeed-ai/flux-schnell',
  flux_dev_ultra_fast: 'wavespeed-ai/flux-dev-ultra-fast',
  flux_dev:            'black-forest-labs/flux-dev',
  z_image_turbo:       'wavespeed-ai/z-image/turbo',
  z_image_base:        'wavespeed-ai/z-image/base',
  wan_2_7:             'wavespeed-ai/wan-2.2/t2i-a14b',
}

// Aspect ratio → size string
const SIZE_MAP: Record<string, string> = {
  '9:16': '768*1360',
  '16:9': '1360*768',
  '1:1':  '1024*1024',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Claude refinement ──
async function refinePrompt(raw: string): Promise<string> {
  if (!ANTHROPIC_KEY) return raw
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 600,
        system: "You are a professional AI image prompt engineer. Your job is to refine the user's raw prompt to maximize image quality, faithfulness to intent, and visual detail. Understand the user's subject, style intent, mood, and key elements. Expand and enrich the prompt with precise visual language. Never change the core subject or intent. Never add inappropriate content. Return only the refined prompt as plain text — no explanations, no preamble, no quotes.",
        messages: [{ role: 'user', content: raw }],
      }),
    })
    if (!res.ok) return raw
    const data = await res.json()
    const text = data?.content?.[0]?.text?.trim()
    return text || raw
  } catch {
    return raw
  }
}

// ── WaveSpeed submit + poll ──
async function submitWaveSpeed(endpoint: string, body: unknown): Promise<string> {
  const res = await fetch(`https://api.wavespeed.ai/api/v3/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WAVESPEED_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let parsed: any = null
  try { parsed = JSON.parse(text) } catch { /* noop */ }
  if (!res.ok) {
    throw new Error(parsed?.message || parsed?.error || `WaveSpeed ${res.status}: ${text.slice(0, 200)}`)
  }
  const id = parsed?.data?.id || parsed?.id
  if (!id) throw new Error('WaveSpeed: no prediction id returned')
  return id
}

async function pollWaveSpeed(requestId: string): Promise<string> {
  const url = `https://api.wavespeed.ai/api/v3/predictions/${requestId}/result`
  const start = Date.now()
  const TIMEOUT_MS = 5 * 60 * 1000
  while (Date.now() - start < TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 4000))
    const res = await fetch(url, { headers: { Authorization: `Bearer ${WAVESPEED_KEY}` } })
    if (!res.ok) continue
    const json = await res.json()
    const data = json?.data ?? json
    const status = data?.status
    if (status === 'completed' || status === 'succeeded') {
      const out = data?.outputs?.[0] || data?.output?.[0] || data?.output
      if (!out) throw new Error('WaveSpeed: completed without output')
      return out
    }
    if (status === 'failed' || status === 'error') {
      const err = (data?.error || data?.message || 'Generation failed').toString()
      throw new Error(err)
    }
  }
  throw new Error('Generation timed out')
}

// ── Refund on failure ──
async function refundCredits(userId: string, generationId: string, amount: number) {
  try {
    await admin.rpc('refund_credits', {
      p_user_id: userId,
      p_generation_id: generationId,
      p_amount: amount,
      p_description: 'Refund — image generation failed',
    })
  } catch (e) {
    console.error('refund failed', e)
  }
}

// ── Pipeline ──
async function runPipeline(generationId: string) {
  const { data: gen, error } = await admin.from('generations').select('*').eq('id', generationId).single()
  if (error || !gen) return

  const startedAt = Date.now()
  let refined = gen.prompt as string

  try {
    // 1. Refine prompt via Claude
    refined = await refinePrompt(gen.prompt)
    await admin.from('generations').update({ enhanced_prompt: refined, status: 'processing' }).eq('id', generationId)

    // 2. Submit to WaveSpeed
    const endpoint = MODEL_ENDPOINTS[gen.model]
    if (!endpoint) throw new Error(`Unsupported model: ${gen.model}`)

    const size = SIZE_MAP[gen.aspect_ratio] || SIZE_MAP['1:1']
    const body: Record<string, unknown> = {
      prompt: refined,
      size,
      enable_sync_mode: false,
      output_format: 'jpeg',
    }
    if (gen.start_frame_url) {
      body.image = gen.start_frame_url
      body.images = [gen.start_frame_url]
    }

    const reqId = await submitWaveSpeed(endpoint, body)
    await admin.from('generations').update({ fal_request_id: reqId }).eq('id', generationId)

    // 3. Poll for result
    const outputUrl = await pollWaveSpeed(reqId)

    // 4. Download + upload to our storage
    let storedUrl = outputUrl
    try {
      const imgRes = await fetch(outputUrl)
      if (imgRes.ok) {
        const buf = new Uint8Array(await imgRes.arrayBuffer())
        const path = `${gen.user_id}/${generationId}.jpg`
        const { error: upErr } = await admin.storage.from('generations').upload(path, buf, {
          contentType: 'image/jpeg', upsert: true, cacheControl: '31536000',
        })
        if (!upErr) {
          const { data: { publicUrl } } = admin.storage.from('generations').getPublicUrl(path)
          storedUrl = publicUrl
        }
      }
    } catch (e) {
      console.error('storage upload failed, keeping wavespeed url', e)
    }

    await admin.from('generations').update({
      status: 'completed',
      output_url: storedUrl,
      output_thumbnail_url: storedUrl,
      output_type: 'image',
      generation_time_ms: Date.now() - startedAt,
    }).eq('id', generationId)
  } catch (err) {
    const raw = (err as Error)?.message || 'Generation failed'
    const isPolicy = /content|policy|nsfw|safety|moderat|blocked|inappropriate/i.test(raw)
    const errorMessage = isPolicy ? 'Content blocked: violates usage policy' : raw
    await admin.from('generations').update({
      status: 'failed',
      error_message: errorMessage,
      generation_time_ms: Date.now() - startedAt,
    }).eq('id', generationId)
    if (gen.credits_charged > 0) {
      await refundCredits(gen.user_id, generationId, Number(gen.credits_charged))
    }
  }
}

// ── HTTP entrypoint ──
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes, error: uErr } = await userClient.auth.getUser()
    if (uErr || !userRes?.user) return json({ error: 'Unauthorized' }, 401)
    const userId = userRes.user.id

    const body = await req.json().catch(() => ({}))
    const generationId = body?.generationId
    if (!generationId || typeof generationId !== 'string') return json({ error: 'generationId required' }, 400)

    // Ownership check
    const { data: gen } = await admin.from('generations').select('id,user_id').eq('id', generationId).single()
    if (!gen || gen.user_id !== userId) return json({ error: 'Not found' }, 404)

    // Kick off async pipeline; respond immediately
    // @ts-ignore - EdgeRuntime is provided by Supabase runtime
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runPipeline(generationId))
    } else {
      runPipeline(generationId).catch((e) => console.error('pipeline error', e))
    }

    return json({ queued: true, generationId }, 202)
  } catch (e) {
    console.error('image-generate error', e)
    return json({ error: (e as Error).message ?? 'Internal error' }, 500)
  }
})