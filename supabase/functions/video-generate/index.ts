// Video generation pipeline: Claude prompt refinement → WaveSpeed → poll → upload → update.
// Client invokes this fire-and-forget after creating the generation row + deducting credits.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const WAVESPEED_KEY = Deno.env.get('WAVESPEED_KEY') ?? ''
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// ── Per-model config ──────────────────────────────────────
type Mode = 'text_to_video' | 'image_to_video' | 'start_end_frame' | 'end_frame_text'

interface ModelConfig {
  t2vEndpoint?:      string
  i2vEndpoint?:      string
  startEndEndpoint?: string
  startEndKeys?:     { start: string; end: string } // defaults to start_image/end_image
  imageKey?:         string // defaults to "image"
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  kling_v3_pro: {
    t2vEndpoint:      'kwaivgi/kling-v3.0-pro/image-to-video',
    i2vEndpoint:      'kwaivgi/kling-v3.0-pro/image-to-video',
    startEndEndpoint: 'kwaivgi/kling-v3.0-pro/image-to-video',
    startEndKeys:     { start: 'image', end: 'end_image' },
  },
  kling_v3_std: {
    t2vEndpoint:      'kwaivgi/kling-v3.0-std/image-to-video',
    i2vEndpoint:      'kwaivgi/kling-v3.0-std/image-to-video',
    startEndEndpoint: 'kwaivgi/kling-v3.0-std/image-to-video',
    startEndKeys:     { start: 'image', end: 'end_image' },
  },
  kling_v2_6_pro: {
    t2vEndpoint:      'kwaivgi/kling-v2.6-pro/image-to-video',
    i2vEndpoint:      'kwaivgi/kling-v2.6-pro/image-to-video',
    startEndEndpoint: 'kwaivgi/kling-v2.6-pro/image-to-video',
    startEndKeys:     { start: 'image', end: 'end_image' },
  },
  veo3_1_fast:      { t2vEndpoint: 'google/veo3.1-fast/text-to-video',      i2vEndpoint: 'google/veo3.1-fast/image-to-video' },
  veo3_1_lite:      { t2vEndpoint: 'google/veo3.1-lite/text-to-video',      i2vEndpoint: 'google/veo3.1-lite/image-to-video', startEndEndpoint: 'google/veo3.1-lite/image-to-video' },
  seedance_2_fast:  { t2vEndpoint: 'bytedance/seedance-v2.0/fast/image-to-video', i2vEndpoint: 'bytedance/seedance-v2.0/fast/image-to-video' },
  seedance_1_5_pro: { t2vEndpoint: 'bytedance/seedance-v1.5-pro/image-to-video',  i2vEndpoint: 'bytedance/seedance-v1.5-pro/image-to-video' },
  wan_2_7:          { t2vEndpoint: 'alibaba/wan-2.7/text-to-video', i2vEndpoint: 'alibaba/wan-2.7/image-to-video', startEndEndpoint: 'alibaba/wan-2.7/image-to-video' },
  wan_2_6:          { t2vEndpoint: 'alibaba/wan-2.6/text-to-video', i2vEndpoint: 'alibaba/wan-2.6/image-to-video' },
  wan_2_5:          { t2vEndpoint: 'alibaba/wan-2.5/text-to-video', i2vEndpoint: 'alibaba/wan-2.5/image-to-video' },
  hailuo_02_pro:    { t2vEndpoint: 'minimax/hailuo-02/pro',         i2vEndpoint: 'minimax/hailuo-02/pro' },
  pixverse_v6:      { t2vEndpoint: 'pixverse/pixverse-v6/text-to-video', i2vEndpoint: 'pixverse/pixverse-v6/image-to-video' },
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Claude refinement (video-tuned) ──
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
        system: "You are a professional AI video prompt engineer. Refine the user's raw prompt to maximize motion quality, temporal coherence, and cinematic feel. Focus on: what moves, how it moves, camera movement (pan, tilt, dolly, tracking, static), action sequencing over time, atmosphere, lighting changes, and pacing. Use vivid motion verbs. Do NOT include still-photography jargon (focal length, depth of field, bokeh). Never change the user's core subject or intent. Never add inappropriate content. Return only the refined prompt as plain text — no preamble, no quotes, no explanations.",
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
    throw new Error(parsed?.message || parsed?.error || `WaveSpeed ${res.status}: ${text.slice(0, 300)}`)
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
      p_description: 'Refund — video generation failed',
    })
  } catch (e) {
    console.error('refund failed', e)
  }
}

// ── Build request body per mode ──
function buildRequestBody(gen: any, refined: string): { endpoint: string; body: Record<string, unknown> } {
  const cfg = MODEL_CONFIGS[gen.model]
  if (!cfg) throw new Error(`Unsupported video model: ${gen.model}`)

  const mode: Mode = gen.generation_type
  const duration = parseInt(String(gen.duration ?? '5'), 10) || 5
  const aspect   = gen.aspect_ratio || '9:16'

  const base: Record<string, unknown> = {
    prompt: refined,
    duration,
    aspect_ratio: aspect,
  }

  if (mode === 'start_end_frame' && cfg.startEndEndpoint) {
    const keys = cfg.startEndKeys ?? { start: 'start_image', end: 'end_image' }
    return {
      endpoint: cfg.startEndEndpoint,
      body: { ...base, [keys.start]: gen.start_frame_url, [keys.end]: gen.end_frame_url },
    }
  }

  if (mode === 'start_end_frame') {
    // Fallback: i2v with start frame only
    const ep = cfg.i2vEndpoint || cfg.t2vEndpoint!
    return { endpoint: ep, body: { ...base, [cfg.imageKey || 'image']: gen.start_frame_url } }
  }

  if (mode === 'image_to_video') {
    const ep = cfg.i2vEndpoint || cfg.t2vEndpoint!
    return { endpoint: ep, body: { ...base, [cfg.imageKey || 'image']: gen.start_frame_url } }
  }

  if (mode === 'end_frame_text') {
    const ep = cfg.i2vEndpoint || cfg.t2vEndpoint!
    return { endpoint: ep, body: { ...base, end_image: gen.end_frame_url } }
  }

  // text_to_video (default)
  const ep = cfg.t2vEndpoint || cfg.i2vEndpoint!
  const body: Record<string, unknown> = { ...base }
  // Kling/Seedance/Hailuo unified i2v endpoints accept empty image for t2v
  if (ep === cfg.i2vEndpoint && !cfg.t2vEndpoint) {
    body[cfg.imageKey || 'image'] = ''
  }
  return { endpoint: ep, body }
}

// ── Pipeline ──
async function runPipeline(generationId: string) {
  const { data: gen, error } = await admin.from('generations').select('*').eq('id', generationId).single()
  if (error || !gen) return

  const startedAt = Date.now()

  try {
    // 1. Refine prompt
    const refined = await refinePrompt(gen.prompt || '')
    await admin.from('generations').update({ enhanced_prompt: refined, status: 'processing' }).eq('id', generationId)

    // 2. Build + submit
    const { endpoint, body } = buildRequestBody(gen, refined)
    console.log('video-generate dispatch', { generationId, model: gen.model, mode: gen.generation_type, endpoint })
    const reqId = await submitWaveSpeed(endpoint, body)
    await admin.from('generations').update({ fal_request_id: reqId }).eq('id', generationId)

    // 3. Poll
    const outputUrl = await pollWaveSpeed(reqId)

    // 4. Download + upload .mp4 to storage
    let storedUrl = outputUrl
    try {
      const vidRes = await fetch(outputUrl)
      if (vidRes.ok) {
        const buf = new Uint8Array(await vidRes.arrayBuffer())
        const path = `${gen.user_id}/${generationId}.mp4`
        const { error: upErr } = await admin.storage.from('generations').upload(path, buf, {
          contentType: 'video/mp4', upsert: true, cacheControl: '31536000',
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
      output_type: 'video',
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

    const { data: gen } = await admin.from('generations').select('id,user_id').eq('id', generationId).single()
    if (!gen || gen.user_id !== userId) return json({ error: 'Not found' }, 404)

    // @ts-ignore - EdgeRuntime provided by Supabase
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(runPipeline(generationId))
    } else {
      runPipeline(generationId).catch((e) => console.error('pipeline error', e))
    }

    return json({ queued: true, generationId }, 202)
  } catch (e) {
    console.error('video-generate error', e)
    return json({ error: (e as Error).message ?? 'Internal error' }, 500)
  }
})