// supabase/functions/video-generate/index.ts
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const WAVESPEED_KEY = Deno.env.get('WAVESPEED_KEY') ?? ''
const FAL_KEY       = Deno.env.get('FAL_KEY') ?? ''
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_KEY') ?? ''
const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY      = Deno.env.get('SUPABASE_ANON_KEY')!

const VISION_MODEL = Deno.env.get('VISION_MODEL') ?? 'claude-haiku-4-5-20251001'
const PROMPT_MODEL = Deno.env.get('PROMPT_MODEL') ?? 'claude-haiku-4-5-20251001'

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Mode =
  | 'text_to_video'
  | 'image_to_video'
  | 'frame_to_frame'
  | 'start_end_frame'
  | 'end_frame_text'
  | 'motion_transfer'

interface ModelConfig {
  endpoint:              string
  imageKey?:             string
  imagesKey?:            string
  endImageKey?:          string
  videoKey?:             string
  maxRefImages?:         number
  durations:             number[]
  supportsSound:         boolean
  supportsGuidanceScale: boolean
  defaultResolution?:    string
  isFal?:                boolean
  isMotionTransfer?:     boolean
  supportsPrompt?:       boolean
  supportsOrientation?:  boolean
  supportsAspectRatio?:  boolean
  hardcodedResolution?:  string
  hardcodedMode?:        string
  // When true, sound must be disabled if end_image is being used.
  // Applies to Kling models where end_image and sound are mutually exclusive.
  soundDisabledWithEndFrame?: boolean
}

interface ImageAnalysis {
  tag:      string
  analysis: string
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_CONFIGS: Record<string, ModelConfig> = {

  // ── Standard video models ────────────────────────────────────────────────

  kling_v2_5_turbo_pro_s2e: {
    endpoint:              'kwaivgi/kling-v2.5-turbo-pro/image-to-video',
    imageKey:              'image',
    endImageKey:           'last_image',   // confirmed: WaveSpeed docs use last_image
    durations:             [5, 10],
    supportsSound:         false,
    supportsGuidanceScale: true,
    defaultResolution:     '1080p',
  },
  kling_v3_pro: {
    endpoint:                  'kwaivgi/kling-v3.0-pro/image-to-video',
    imageKey:                  'image',
    endImageKey:               'end_image',  // FIX: was 'last_image', WaveSpeed uses 'end_image'
    durations:                 [5, 10, 15],
    supportsSound:             true,
    supportsGuidanceScale:     true,
    defaultResolution:         '1080p',
    soundDisabledWithEndFrame: true,         // end_image and sound are mutually exclusive
  },
  hailuo_02_pro: {
    endpoint:                  'minimax/hailuo-02/pro',
    imageKey:                  'image',
    endImageKey:               'end_image',  // confirmed: WaveSpeed docs use end_image
    durations:                 [5],
    supportsSound:             false,
    supportsGuidanceScale:     false,
    defaultResolution:         '1080p',
    soundDisabledWithEndFrame: true,         // documented: end_image and sound cannot coexist
  },
  seedance_1_5_fast_t2v: {
    endpoint:              'bytedance/seedance-v1.5-pro/text-to-video-fast',
    durations:             [5, 10, 12],
    supportsSound:         true,
    supportsGuidanceScale: false,
    defaultResolution:     '1080p',
  },
  seedance_1_5_fast_i2v: {
    endpoint:              'bytedance/seedance-v1.5-pro/image-to-video-fast',
    imageKey:              'image',
    durations:             [5, 10, 12],
    supportsSound:         true,
    supportsGuidanceScale: false,
    defaultResolution:     '1080p',
  },
  vidu_q3_i2v: {
    endpoint:              'vidu/q3/image-to-video',
    imageKey:              'image',
    durations:             [5, 8, 10, 16],
    supportsSound:         true,
    supportsGuidanceScale: false,
  },
  vidu_q3_pro_s2e: {
    endpoint:              'vidu/q3-pro/start-end-to-video',
    imageKey:              'start_image',
    endImageKey:           'end_image',    // confirmed: vidu uses start_image / end_image
    durations:             [5, 8, 10, 16],
    supportsSound:         true,
    supportsGuidanceScale: false,
  },
  vidu_i2v_q2_turbo: {
    endpoint:              'vidu/image-to-video-q2-turbo',
    imageKey:              'image',
    durations:             [5, 8],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  vidu_q2_pro_s2e_fast: {
    endpoint:              'vidu/q2-pro/start-end-to-video-fast',
    imageKey:              'start_image',
    endImageKey:           'end_image',    // confirmed: vidu uses start_image / end_image
    durations:             [5, 8],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  seedance_v1_lite_i2v: {
    endpoint:              'bytedance/seedance-v1-lite-i2v-720p',
    imageKey:              'image',
    durations:             [5, 8],
    supportsSound:         false,
    supportsGuidanceScale: false,
    defaultResolution:     '720p',
  },
  vidu_s2e: {
    endpoint:              'vidu/start-end-to-video',
    imageKey:              'start_image',
    endImageKey:           'end_image',    // confirmed: vidu uses start_image / end_image
    durations:             [4],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  vidu_s2v_2: {
    endpoint:              'vidu/start-end-to-video-2.0',
    imageKey:              'images',
    durations:             [4],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  wan_2_2_i2v: {
    endpoint:              'wavespeed-ai/wan-2.2/image-to-video',
    imageKey:              'image',
    endImageKey:           'last_image',   // confirmed: wan series uses last_image
    durations:             [5, 8],
    supportsSound:         false,
    supportsGuidanceScale: false,
    defaultResolution:     '720p',
  },
  wan_2_2_i2v_ultra_fast: {
    endpoint:              'wavespeed-ai/wan-2.2/i2v-720p-ultra-fast',
    imageKey:              'image',
    endImageKey:           'last_image',   // confirmed: wan series uses last_image
    durations:             [5, 8],
    supportsSound:         false,
    supportsGuidanceScale: false,
    defaultResolution:     '720p',
  },
  wan_2_7: {
    endpoint:              'alibaba/wan-2.7/image-to-video',
    imageKey:              'image',
    endImageKey:           'last_image',   // confirmed: wan series uses last_image
    durations:             [5, 10, 15],
    supportsSound:         true,
    supportsGuidanceScale: false,
    defaultResolution:     '1080p',
  },

  // ── Seedance 2.0 (fal.ai) ────────────────────────────────────────────────

  seedance_2_0_i2v: {
    endpoint:              'bytedance/seedance-2.0/image-to-video',
    imageKey:              'image_url',
    endImageKey:           'end_image_url', // fal.ai uses image_url / end_image_url
    maxRefImages:          1,
    durations:             [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    supportsSound:         true,
    supportsGuidanceScale: false,
    defaultResolution:     '720p',
    isFal:                 true,
  },
  seedance_2_0_t2v: {
    endpoint:              'bytedance/seedance-2.0/text-to-video',
    maxRefImages:          0,
    durations:             [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    supportsSound:         true,
    supportsGuidanceScale: false,
    defaultResolution:     '720p',
    isFal:                 true,
  },
  seedance_2_0_ref: {
    endpoint:              'bytedance/seedance-2.0/reference-to-video',
    imagesKey:             'image_urls',
    maxRefImages:          9,
    durations:             [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    supportsSound:         true,
    supportsGuidanceScale: false,
    defaultResolution:     '720p',
    isFal:                 true,
  },

  hunyuan_video_i2v: {
    endpoint:              'wavespeed-ai/hunyuan-video/i2v',
    imageKey:              'image',
    durations:             [5],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  grok_video_t2v: {
    endpoint:              'x-ai/grok-imagine-video/text-to-video',
    durations:             [5, 10],
    supportsSound:         false,
    supportsGuidanceScale: false,
    defaultResolution:     '1080p',
  },
  grok_video_i2v: {
    endpoint:              'x-ai/grok-imagine-video/image-to-video',
    imageKey:              'image',
    durations:             [5, 10],
    supportsSound:         false,
    supportsGuidanceScale: false,
    defaultResolution:     '1080p',
  },

  // ── Kling O3 reference-to-video ──────────────────────────────────────────

  grok_video_ref: {
    endpoint:              'kwaivgi/kling-video-o3-std/reference-to-video',
    imagesKey:             'images',
    maxRefImages:          7,
    durations:             [5, 10, 15],
    supportsSound:         true,
    supportsGuidanceScale: false,
    defaultResolution:     '1080p',
  },
  kling_video_o3_pro_ref: {
    endpoint:              'kwaivgi/kling-video-o3-pro/reference-to-video',
    imagesKey:             'images',
    maxRefImages:          7,
    durations:             [5, 10, 15],
    supportsSound:         true,
    supportsGuidanceScale: false,
    defaultResolution:     '1080p',
  },

  veo3_1_lite_s2e: {
    endpoint:              'google/veo3.1-lite/start-end-to-video',
    imageKey:              'start_image',  // FIX: was 'image' — veo3.1 s2e uses start_image
    endImageKey:           'end_image',    // FIX: was 'last_image' — veo3.1 s2e uses end_image
    durations:             [5],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },

  // ── Motion transfer models ───────────────────────────────────────────────

  kling_v3_std_motion: {
    endpoint:              'kwaivgi/kling-v3.0-std/motion-control',
    imageKey:              'image',
    videoKey:              'video',
    durations:             [5, 10, 20, 30],
    supportsSound:         true,
    supportsGuidanceScale: false,
    isMotionTransfer:      true,
    supportsPrompt:        true,
    supportsOrientation:   true,
    supportsAspectRatio:   false,
  },
  kling_v3_pro_motion: {
    endpoint:              'kwaivgi/kling-v3.0-pro/motion-control',
    imageKey:              'image',
    videoKey:              'video',
    durations:             [5, 10, 20, 30],
    supportsSound:         true,
    supportsGuidanceScale: false,
    isMotionTransfer:      true,
    supportsPrompt:        true,
    supportsOrientation:   true,
    supportsAspectRatio:   false,
  },
  dreamactor_v2: {
    endpoint:              'bytedance/dreamactor-v2',
    imageKey:              'image',
    videoKey:              'video',
    durations:             [5, 10, 30],
    supportsSound:         false,
    supportsGuidanceScale: false,
    isMotionTransfer:      true,
    supportsPrompt:        false,
    supportsOrientation:   false,
    supportsAspectRatio:   false,
  },
  wan_2_2_animate: {
    endpoint:              'wavespeed-ai/wan-2.2/animate',
    imageKey:              'image',
    videoKey:              'video',
    durations:             [5, 10, 30],
    supportsSound:         false,
    supportsGuidanceScale: false,
    isMotionTransfer:      true,
    supportsPrompt:        true,
    supportsOrientation:   false,
    supportsAspectRatio:   false,
    hardcodedResolution:   '720p',
    hardcodedMode:         'animate',
  },

  // ── Lipsync models ────────────────────────────────────────────────────────

  infinitetalk_fast: {
    endpoint:              'wavespeed-ai/infinitetalk-fast',
    imageKey:              'image',
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  infinitetalk_fast_multi: {
    endpoint:              'wavespeed-ai/infinitetalk-fast-multi',
    imagesKey:             'images',
    maxRefImages:          2,
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  infinitetalk_video_to_video: {
    endpoint:              'wavespeed-ai/infinitetalk-video-to-video',
    videoKey:              'video',
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  infinitetalk_video_to_video_multi: {
    endpoint:              'wavespeed-ai/infinitetalk-video-to-video-multi',
    videoKey:              'video',
    imagesKey:             'images',
    maxRefImages:          2,
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  infinitetalk_fast_video_to_video_multi: {
    endpoint:              'wavespeed-ai/infinitetalk-fast-video-to-video-multi',
    videoKey:              'video',
    imagesKey:             'images',
    maxRefImages:          2,
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  kling_lipsync_audio_to_video: {
    endpoint:              'kwaivgi/kling-lipsync/audio-to-video',
    videoKey:              'video',
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  kling_v1_ai_avatar_standard: {
    endpoint:              'kwaivgi/kling-v1/ai-avatar-standard',
    imageKey:              'image',
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  lipsync_2: {
    endpoint:              'sync-labs/lipsync-2',
    videoKey:              'video',
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  lipsync_2_pro: {
    endpoint:              'sync-labs/lipsync-2-pro',
    videoKey:              'video',
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
  latentsync: {
    endpoint:              'wavespeed-ai/latentsync',
    videoKey:              'video',
    durations:             [],
    supportsSound:         false,
    supportsGuidanceScale: false,
  },
}

// Lipsync model keys — used for the dedicated buildRequest path.
const LIPSYNC_MODELS = new Set([
  'infinitetalk_fast', 'infinitetalk_fast_multi', 'infinitetalk_video_to_video',
  'infinitetalk_video_to_video_multi', 'infinitetalk_fast_video_to_video_multi',
  'kling_lipsync_audio_to_video', 'kling_v1_ai_avatar_standard',
  'lipsync_2', 'lipsync_2_pro', 'latentsync',
])

// ─────────────────────────────────────────────────────────────────────────────
// ERROR REFRAMING
// ─────────────────────────────────────────────────────────────────────────────

function reframeError(raw: string): string {
  const msg = raw.toLowerCase()
  if (msg.includes('insufficient credits') || msg.includes('insufficient balance')) {
    return 'Generation failed. Please try again shortly.'
  }
  if (msg.includes('risk control')) {
    return 'This image could not be processed. Try a different image or adjust your prompt.'
  }
  if (
    msg.includes('content')      || msg.includes('policy')       ||
    msg.includes('nsfw')         || msg.includes('safety')       ||
    msg.includes('blocked')      || msg.includes('inappropriate') ||
    msg.includes('sensitive')
  ) {
    return 'This content could not be processed. Try a different image or prompt.'
  }
  return 'Generation failed. Please try again.'
}

// ─────────────────────────────────────────────────────────────────────────────
// SAFE BASE64
// ─────────────────────────────────────────────────────────────────────────────

function safeBase64(buffer: ArrayBuffer): string {
  const bytes     = new Uint8Array(buffer)
  let   binary    = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

// ─────────────────────────────────────────────────────────────────────────────
// TAG UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function extractTagRoleHint(prompt: string, tag: string): string {
  if (!prompt.includes(tag)) return ''
  const idx    = prompt.indexOf(tag)
  const before = prompt.slice(Math.max(0, idx - 60), idx).trim()
  const after  = prompt.slice(idx + tag.length, idx + tag.length + 60).trim()
  return [before, tag, after].filter(Boolean).join(' ').trim()
}

function buildImageContextBlock(analyses: ImageAnalysis[], userPrompt: string): string {
  if (!analyses.length) return ''
  return analyses.map(({ tag, analysis }) => {
    const roleHint = extractTagRoleHint(userPrompt, tag)
    const header   = roleHint
      ? `${tag} ANALYSIS (used as: "${roleHint}"):`
      : `${tag} ANALYSIS:`
    return `${header}\n${analysis}`
  }).join('\n\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// VISION ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

async function analyseImage(
  imageUrl:   string,
  userPrompt: string,
  imageTag:   string = '[img1]',
): Promise<string> {
  if (!ANTHROPIC_KEY) return ''

  const headCheck = await fetch(imageUrl, { method: 'HEAD' }).catch(() => null)
  if (!headCheck?.ok) {
    console.warn(`Vision: HEAD check failed for ${imageTag} — skipping`)
    return ''
  }

  try {
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`)

    const imgBuffer = await imgRes.arrayBuffer()
    const base64    = safeBase64(imgBuffer)
    const mime      = (imgRes.headers.get('content-type') || 'image/jpeg')
                        .split(';')[0].trim() as 'image/jpeg' | 'image/png' | 'image/webp'

    const roleHint = extractTagRoleHint(userPrompt, imageTag)

    const analysisPrompt = `You are a senior cinematographer and director of photography analysing reference image ${imageTag} for an AI video generation.

${roleHint ? `ROLE IN PROMPT: This image is used as: "${roleHint}"\n` : ''}USER'S OVERALL REQUEST: "${userPrompt}"

Extract the technical and aesthetic attributes the AI video model needs to animate this reference faithfully.

Analyse and describe:
1. SUBJECT: Who or what is in the frame? For people: describe skin tone (Fitzpatrick scale), hair, build, distinguishing features, age range, expression. For objects/scenes: material, form, colour, structure.
2. VISUAL STYLE: Photography style, colour palette, tonal range, contrast.
3. LIGHTING: Key light direction and quality, shadow placement, colour temperature.
4. COMPOSITION: Framing, angle, depth of field, spatial relationships.
5. MOTION POTENTIAL: What elements would naturally move in this scene? What camera movement would feel cinematic?
6. MUST PRESERVE: The 3 most critical visual attributes that must carry into the generated video.

Write as a DP handing off a shot brief. Technical, specific, concise.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:       VISION_MODEL,
        max_tokens:  1200,
        temperature: 0.3,
        messages: [{
          role:    'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
            { type: 'text',  text:  analysisPrompt }
          ]
        }]
      })
    })

    if (!response.ok) {
      console.error(`Vision API error for ${imageTag}: ${response.status}`)
      return ''
    }

    const data = await response.json()
    return data?.content?.[0]?.text?.trim() || ''

  } catch (err) {
    console.error(`Vision analysis failed for ${imageTag}:`, err)
    return ''
  }
}

async function analyseAllImages(
  imageUrls:  string[],
  userPrompt: string,
): Promise<ImageAnalysis[]> {
  if (!imageUrls.length || !ANTHROPIC_KEY) return []

  const results = await Promise.all(
    imageUrls.map(async (url, idx) => {
      const tag      = `[img${idx + 1}]`
      const analysis = await analyseImage(url, userPrompt, tag)
      return { tag, analysis }
    })
  )

  return results.filter((r) => r.analysis.length > 0)
}

// ─────────────────────────────────────────────────────────────────────────────
// CINEMATIC PROMPT SYSTEMS
// ─────────────────────────────────────────────────────────────────────────────

const CINEMATIC_SYSTEM = `You are a world-class film director and director of photography writing AI video generation prompts. Every prompt you write must feel like a professional shot brief.

CINEMATOGRAPHY PRINCIPLES — always apply these:

FRAMING & COMPOSITION
- Specify shot size: extreme close-up (ECU), close-up (CU), medium close-up (MCU), medium shot (MS), medium wide (MW), wide shot (WS), extreme wide (EWS)
- State the rule of thirds, leading lines, or symmetry when relevant
- Describe foreground/midground/background layering for depth
- Use negative space intentionally

CAMERA MOVEMENT
- Be explicit: static locked-off, slow dolly in/out, tracking shot (left/right), crane/jib up/down, handheld with organic sway, smooth push-in, arc/orbit, whip pan, motivated zoom
- State speed: imperceptibly slow, measured, brisk, urgent

LENS & OPTICS
- Specify focal length feel: wide (24mm feel), standard (50mm), portrait (85mm), telephoto compression (135–200mm)
- Describe depth of field: razor-thin (f/1.4 feel), moderate bokeh (f/2.8), deep focus (f/8)
- Add optical character where earned: subtle lens flare, anamorphic oval bokeh, chromatic aberration

LIGHTING
- Name the lighting setup: motivated key light, Rembrandt, high-key commercial, low-key dramatic, split lighting, silhouette
- Describe quality: hard direct sunlight, soft overcast, diffused practical window, golden hour warmth, blue-hour cool
- State direction: front-lit, side-lit (left/right), back-lit, top-lit, under-lit
- Add texture: volumetric fog, dust motes, god rays, rain-wet surfaces catching light, smoke haze

COLOUR
- State the colour temperature: warm tungsten (3200K), neutral daylight (5600K), cool blue-hour (7000K)
- Name a grade feel when appropriate: teal-and-orange Hollywood grade, desaturated Fincher grey, warm Kodak Portra look, cold clinical blue, vivid saturated Wes Anderson palette

MOTION OF SUBJECTS
- Describe what moves, in which direction, at what speed
- Include secondary motion: hair catching breeze, fabric drape and sway, liquid surface tension, smoke dissipation
- Add environmental motion: cloud drift, light shaft movement, particle float

TEMPORAL FLOW
- State pacing: unhurried and contemplative, measured editorial pace, kinetic and urgent
- Note any transition: rack focus from foreground to background, iris out, natural cut point

SOUND CONTEXT (for models with native audio)
- Briefly note the sonic environment: ambient city hum, quiet interior, rain on glass, crowd murmur — helps audio-aware models sync correctly

OUTPUT FORMAT
- Write as ONE coherent cinematic paragraph — no bullet points, no headers
- Lead with the shot type and composition, then camera movement, then subject motion, then lighting, then colour
- End with a 2-line quality anchor: "Photorealistic, 1080p, cinema-grade output."
- Under 280 words total
- Return ONLY the final prompt, no preamble`

const KLING_REF_SYSTEM = `You are a film director writing identity-consistent video generation prompts for Kling O3 Reference-to-Video.

CRITICAL: When referring to reference images, use "Figure 1", "Figure 2", "Figure 3" notation — this is required by the Kling O3 reference architecture to bind each figure to its identity lock.

${CINEMATIC_SYSTEM}

ADDITIONAL RULES FOR REFERENCE VIDEO:
- Explicitly name each Figure by their role in the scene: "Figure 1 (the woman) walks toward the camera..."
- Describe how Figures interact spatially: proximity, contact, eye-line
- Lock in the identity preservation: "maintaining Figure 1's exact appearance throughout"
- Use cinematographic language to frame each Figure in the composition`

const SEEDANCE_2_SYSTEM = `You are a film director writing multi-shot cinematic prompts for Seedance 2.0 — ByteDance's Hollywood-grade video model with native audio-visual synchronisation.

Seedance 2.0 understands:
- Multi-shot narrative structure with explicit shot labels (Shot 1, Shot 2...)
- Director-level camera instructions (dolly, crane, tracking pan, handheld)
- Native audio sync — describe the sonic environment and it will generate matching audio
- Physics-accurate motion with exceptional temporal stability

${CINEMATIC_SYSTEM}

MULTI-SHOT STRUCTURE (use when user implies a narrative or multiple beats):
Shot 1 | 0s–Xs | [shot type]. [camera]. [subject action]. [lighting]. [sound note].
Shot 2 | Xs–Ys | [shot type]. [camera]. [subject action]. [lighting]. [sound note].

For single-beat prompts, write one rich cinematic paragraph.
Always end with: "Native audio synchronisation. Photorealistic, 1080p, cinema-grade."`

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT ENGINEERING
// ─────────────────────────────────────────────────────────────────────────────

async function buildVideoPrompt(
  gen:      any,
  analyses: ImageAnalysis[],
): Promise<string> {
  if (!ANTHROPIC_KEY) return gen.prompt || ''

  const base       = (gen.prompt || '').trim()
  const mode       = gen.generation_type as Mode
  const isMultiRef = analyses.length > 1

  let systemPrompt = CINEMATIC_SYSTEM
  if (
    gen.model === 'seedance_2_0_i2v' ||
    gen.model === 'seedance_2_0_t2v' ||
    gen.model === 'seedance_2_0_ref'
  ) {
    systemPrompt = SEEDANCE_2_SYSTEM
  } else if (
    gen.model === 'grok_video_ref'         ||
    gen.model === 'kling_video_o3_pro_ref'
  ) {
    systemPrompt = KLING_REF_SYSTEM
  }

  const imageContextBlock = buildImageContextBlock(analyses, base)

  let modeContext = ''
  if (mode === 'motion_transfer') {
    modeContext = 'MODE: Motion transfer — the subject image will be animated with the motion from a reference video. Focus on preserving character appearance and adding cinematic style/atmosphere notes.'
  } else if (mode === 'frame_to_frame' || mode === 'start_end_frame') {
    modeContext = 'MODE: Start-to-end frame interpolation — the camera must move from the first frame composition to the second. Describe a natural, cinematic motion arc connecting the two frames.'
  } else if (mode === 'image_to_video') {
    modeContext = 'MODE: Image-to-video — animate the reference image. Describe what moves in the frame, how the camera moves, and the cinematic progression from static to motion.'
  } else if (mode === 'end_frame_text') {
    modeContext = 'MODE: End-frame text — describe the motion that leads into the final frame. Work backwards from the destination composition.'
  } else {
    modeContext = 'MODE: Text-to-video — create a fully cinematic scene from the prompt.'
  }

  const figureNotation = (
    gen.model === 'grok_video_ref' || gen.model === 'kling_video_o3_pro_ref'
  ) && isMultiRef
    ? `\nFIGURE NOTATION: ${analyses.map((a, i) => `Figure ${i + 1} = ${a.tag}`).join(', ')}. Use "Figure N" notation when referring to each subject.`
    : ''

  const userMessage = imageContextBlock
    ? `${imageContextBlock}

USER'S REQUEST: "${base || 'cinematic video'}"

${modeContext}${figureNotation}
${isMultiRef ? `MULTI-REFERENCE: ${analyses.length} subjects provided. Synthesise ALL into one unified cinematic scene.` : ''}

Aspect ratio: ${gen.aspect_ratio || '9:16'}
Duration: ${gen.duration || 5}s

Write the cinematic video prompt now.`
    : `USER'S REQUEST: "${base || 'cinematic video'}"

${modeContext}
Aspect ratio: ${gen.aspect_ratio || '9:16'}
Duration: ${gen.duration || 5}s

Write the cinematic video prompt now.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type':      'application/json',
      },
      body: JSON.stringify({
        model:       PROMPT_MODEL,
        max_tokens:  500,
        temperature: 0.55,
        system:      systemPrompt,
        messages:    [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      console.error(`Prompt API error: ${response.status}`)
      return base
    }

    const data  = await response.json()
    const built = data?.content?.[0]?.text?.trim()
    return built || base

  } catch (err) {
    console.error('Prompt engineering failed:', err)
    return base
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE URL RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────

async function resolveImageUrls(gen: any, cfg: ModelConfig): Promise<string[]> {
  const all: string[] = [
    ...(Array.isArray(gen.input_image_urls) && gen.input_image_urls.length
      ? gen.input_image_urls
      : []),
    ...(!gen.input_image_urls?.length && gen.start_frame_url
      ? [gen.start_frame_url]
      : []),
  ].filter(Boolean)

  const maxAllowed = cfg.maxRefImages ?? 1
  const trimmed    = all.slice(0, maxAllowed)

  if (all.length > maxAllowed) {
    console.warn(`⚠️  Trimmed ${all.length} → ${maxAllowed} ref images for ${gen.model}`)
  }

  return trimmed
}

// ─────────────────────────────────────────────────────────────────────────────
// REQUEST BUILDER
// Branch order matters — earlier branches must not accidentally swallow later ones.
// Order: motion_transfer → lipsync → seedance_2_0_ref → Kling O3 (imagesKey) →
//        seedance_2_0_t2v → seedance_2_0_i2v → standard
// ─────────────────────────────────────────────────────────────────────────────

function buildRequest(
  gen:       any,
  prompt:    string,
  imageUrls: string[],
  cfg:       ModelConfig,
): { endpoint: string; body: Record<string, unknown> } {

  const mode              = gen.generation_type as Mode
  const requestedDuration = parseInt(String(gen.duration ?? '5'), 10)
  const duration          = cfg.durations.length > 0 && cfg.durations.includes(requestedDuration)
    ? requestedDuration
    : (cfg.durations[0] ?? 5)

  const aspectRatio = gen.aspect_ratio || '9:16'
  const hasImages   = imageUrls.length > 0

  // ── Motion transfer ───────────────────────────────────────────────────────
  if (cfg.isMotionTransfer || mode === 'motion_transfer') {
    if (!cfg.videoKey) throw new Error(`Model "${gen.model}" has no videoKey configured.`)

    const motionVideoUrl  = Array.isArray(gen.input_image_urls) ? gen.input_image_urls[0] : null
    const subjectImageUrl = gen.start_frame_url

    if (!motionVideoUrl)  throw new Error('No motion reference video on generation record.')
    if (!subjectImageUrl) throw new Error('No subject image on generation record.')

    const body: Record<string, unknown> = {
      [cfg.imageKey!]: subjectImageUrl,
      [cfg.videoKey]:  motionVideoUrl,
    }

    if (cfg.supportsPrompt && prompt) body.prompt = prompt
    if (cfg.supportsOrientation)      body.character_orientation = 'video'
    if (cfg.supportsSound)            body.keep_original_sound = gen.with_sound === true
    if (cfg.hardcodedResolution)      body.resolution = cfg.hardcodedResolution
    if (cfg.hardcodedMode)            body.mode = cfg.hardcodedMode

    return { endpoint: cfg.endpoint, body }
  }

  // ── Lipsync models — audio/video passthrough, no prompt engineering ───────
  if (gen.generation_type === 'lipsync' || LIPSYNC_MODELS.has(gen.model)) {
    const body: Record<string, unknown> = {}

    if (gen.audio_url)                body.audio  = gen.audio_url
    if (gen.start_frame_url)          body.image  = gen.start_frame_url
    if (gen.input_image_urls?.[0])    body.image  = gen.input_image_urls[0]
    if (gen.video_input_url)          body.video  = gen.video_input_url
    if (gen.text_script)              body.text   = gen.text_script
    if (gen.with_sound !== undefined) body.keep_original_sound = gen.with_sound

    if (cfg.imagesKey && gen.input_image_urls?.length) {
      body[cfg.imagesKey] = gen.input_image_urls.slice(0, cfg.maxRefImages ?? 2)
    }

    return { endpoint: cfg.endpoint, body }
  }

  // ── Seedance 2.0 Omni Reference (fal.ai) ─────────────────────────────────
  if (gen.model === 'seedance_2_0_ref') {
    let omniPrompt = prompt
    if (imageUrls.length > 0 && !prompt.includes('@Image')) {
      const tags = imageUrls.map((_, i) => `@Image${i + 1}`).join(', ')
      omniPrompt = `${prompt} (Reference images: ${tags})`
    }
    return {
      endpoint: cfg.endpoint,
      body: {
        prompt:         omniPrompt,
        image_urls:     imageUrls,
        duration:       String(duration),
        aspect_ratio:   aspectRatio,
        resolution:     cfg.defaultResolution || '720p',
        generate_audio: gen.with_sound !== false,
      },
    }
  }

  // ── Kling O3 multi-ref path (WaveSpeed) ──────────────────────────────────
  if (cfg.imagesKey && hasImages) {
    const base: Record<string, unknown> = {
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      ...(cfg.defaultResolution ? { resolution: cfg.defaultResolution } : {}),
      ...(cfg.supportsSound     ? { sound: gen.with_sound === true }    : {}),
    }

    if (
      gen.model === 'grok_video_ref'         ||
      gen.model === 'kling_video_o3_pro_ref'
    ) {
      base.keep_original_sound = false
      base.sound               = gen.with_sound === true
    }

    base[cfg.imagesKey] = imageUrls
    return { endpoint: cfg.endpoint, body: base }
  }

  // ── Seedance 2.0 T2V (fal.ai) ────────────────────────────────────────────
  if (gen.model === 'seedance_2_0_t2v') {
    return {
      endpoint: cfg.endpoint,
      body: {
        prompt,
        duration:       String(duration),
        aspect_ratio:   aspectRatio,
        resolution:     cfg.defaultResolution || '720p',
        generate_audio: gen.with_sound !== false,
      },
    }
  }

  // ── Seedance 2.0 I2V single image (fal.ai) ───────────────────────────────
  if (gen.model === 'seedance_2_0_i2v') {
    const primaryImage = imageUrls[0] || gen.start_frame_url
    return {
      endpoint: cfg.endpoint,
      body: {
        prompt,
        image_url:      primaryImage,
        ...(gen.end_frame_url ? { end_image_url: gen.end_frame_url } : {}),
        duration:       String(duration),
        aspect_ratio:   aspectRatio,
        resolution:     cfg.defaultResolution || '720p',
        generate_audio: gen.with_sound !== false,
      },
    }
  }

  // ── Standard video path ───────────────────────────────────────────────────
  const base: Record<string, unknown> = {
    prompt,
    duration,
    aspect_ratio: aspectRatio,
    ...(cfg.defaultResolution     ? { resolution: cfg.defaultResolution } : {}),
    ...(cfg.supportsGuidanceScale && gen.guidance_scale != null
      ? { guidance_scale: gen.guidance_scale }
      : {}),
    ...(cfg.supportsSound
      ? { sound: gen.with_sound === true }
      : {}),
  }

  if (mode === 'frame_to_frame' || mode === 'start_end_frame') {
    if (gen.model === 'vidu_s2v_2') {
      return {
        endpoint: cfg.endpoint,
        body:     { ...base, images: [gen.start_frame_url, gen.end_frame_url] },
      }
    }
    if (!cfg.endImageKey) throw new Error(`Model "${gen.model}" does not support frame-to-frame.`)

    // Guard: some models (e.g. kling_v3_pro, hailuo_02_pro) cannot use
    // sound and end_image simultaneously — disable sound when end frame present.
    if (cfg.soundDisabledWithEndFrame && gen.end_frame_url) {
      base.sound = false
    }

    return {
      endpoint: cfg.endpoint,
      body: {
        ...base,
        [cfg.imageKey!]:   gen.start_frame_url,
        [cfg.endImageKey]: gen.end_frame_url,
      },
    }
  }

  if (mode === 'image_to_video' || mode === 'end_frame_text') {
    const primaryImage = imageUrls[0] || gen.start_frame_url
    return {
      endpoint: cfg.endpoint,
      body:     { ...base, [cfg.imageKey!]: primaryImage },
    }
  }

  // text_to_video — no image key
  return { endpoint: cfg.endpoint, body: base }
}

// ─────────────────────────────────────────────────────────────────────────────
// WAVESPEED SUBMIT
// ─────────────────────────────────────────────────────────────────────────────

async function submitWaveSpeed(endpoint: string, body: unknown): Promise<string> {
  const res = await fetch(`https://api.wavespeed.ai/api/v3/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${WAVESPEED_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let parsed: any
  try { parsed = JSON.parse(text) } catch { /* noop */ }

  if (!res.ok) throw new Error(parsed?.message || parsed?.error || `WaveSpeed ${res.status}: ${text.slice(0, 300)}`)

  const id = parsed?.data?.id || parsed?.id
  if (!id) throw new Error('No prediction ID returned from WaveSpeed.')
  return id
}

// ─────────────────────────────────────────────────────────────────────────────
// FAL.AI SUBMIT
// ─────────────────────────────────────────────────────────────────────────────

async function submitFal(endpoint: string, body: unknown): Promise<string> {
  const res = await fetch(`https://queue.fal.run/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization:  `Key ${FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let parsed: any
  try { parsed = JSON.parse(text) } catch { /* noop */ }

  if (!res.ok) throw new Error(parsed?.detail || parsed?.error || `fal ${res.status}: ${text.slice(0, 300)}`)

  const id = parsed?.request_id
  if (!id) throw new Error('No request_id returned from fal.')
  return id
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE
// ─────────────────────────────────────────────────────────────────────────────

async function runSubmit(generationId: string) {
  const { data: gen } = await admin
    .from('generations')
    .select('*')
    .eq('id', generationId)
    .single()
  if (!gen) return

  const startedAt = Date.now()
  const cfg       = MODEL_CONFIGS[gen.model]

  if (!cfg) {
    await admin.from('generations').update({
      status:        'failed',
      error_message: `Model "${gen.model}" is not configured in video-generate.`,
    }).eq('id', generationId)
    return
  }

  const outputType = cfg.isFal ? 'video' : (gen.output_type ?? 'video')

  try {
    // ── 1. Resolve image URLs ───────────────────────────────────────────────
    const imageUrls  = await resolveImageUrls(gen, cfg)
    const hasImages  = imageUrls.length > 0
    const isMultiRef = imageUrls.length > 1

    console.log(`[video-generate] ${generationId} | model: ${gen.model} | images: ${imageUrls.length} | mode: ${gen.generation_type}`)

    // ── 2. Vision analysis — parallel for all ref images ───────────────────
    // For start_end_frame mode, also analyse the end frame so the engineered
    // prompt can describe the motion arc between both frames accurately.
    let analyses:  ImageAnalysis[] = []
    let visionUsed = false

    if (ANTHROPIC_KEY && !gen.skip_prompt_refinement) {
      const analysisUrls = [...imageUrls]
      if (
        (gen.generation_type === 'start_end_frame' || gen.generation_type === 'frame_to_frame') &&
        gen.end_frame_url &&
        !analysisUrls.includes(gen.end_frame_url)
      ) {
        analysisUrls.push(gen.end_frame_url)
      }

      if (analysisUrls.length > 0) {
        console.log(`👁️  Analysing ${analysisUrls.length} image(s) in parallel...`)
        analyses   = await analyseAllImages(analysisUrls, gen.prompt || '')
        visionUsed = analyses.length > 0
        console.log(`👁️  Vision: ${analyses.length}/${analysisUrls.length} analysed`)
      }
    }

    // ── 3. Cinematic prompt engineering ────────────────────────────────────
    let engineeredPrompt = gen.prompt || ''
    let promptEngineered = false

    if (!gen.skip_prompt_refinement && ANTHROPIC_KEY) {
      console.log(`✍️  Engineering cinematic prompt (${gen.model}, ${isMultiRef ? imageUrls.length + ' refs' : 'single'})...`)
      engineeredPrompt = await buildVideoPrompt(gen, analyses)
      promptEngineered = engineeredPrompt !== gen.prompt
      console.log(`✍️  Prompt: ${engineeredPrompt.length} chars${promptEngineered ? '' : ' [fallback]'}`)
    }

    // ── 4. Update DB with enhanced prompt + output_type ────────────────────
    await admin.from('generations').update({
      enhanced_prompt:         engineeredPrompt || null,
      status:                  'processing',
      output_type:             outputType,
      prompt_engineering_used: promptEngineered,
      vision_analysis_used:    visionUsed,
    }).eq('id', generationId)

    // ── 5. Build and submit request ─────────────────────────────────────────
    const { endpoint, body } = buildRequest(gen, engineeredPrompt, imageUrls, cfg)

    console.log(`🎬  Submitting → ${endpoint} | ${imageUrls.length} ref(s) | ${gen.duration || 5}s | ${gen.aspect_ratio || '9:16'}`)
    console.log(`    Body keys: ${Object.keys(body).join(', ')}`)

    const reqId = cfg.isFal
      ? await submitFal(endpoint, body)
      : await submitWaveSpeed(endpoint, body)

    await admin.from('generations')
      .update({ provider_request_id: reqId })
      .eq('id', generationId)

    console.log(`[video-generate] submitted ${generationId} → ${reqId}`)

  } catch (err: any) {
    const userFacingError = reframeError(err.message ?? '')

    console.error(`[video-generate] pipeline failed for ${generationId}: ${err.message}`)

    await admin.from('generations').update({
      status:             'failed',
      error_message:      userFacingError,
      generation_time_ms: Date.now() - startedAt,
    }).eq('id', generationId)

    const { data: updated } = await admin
      .from('generations')
      .select('provider_request_id, credits_charged')
      .eq('id', generationId)
      .single()

    if (!updated?.provider_request_id && Number(gen.credits_charged) > 0) {
      await admin.rpc('refund_credits', {
        p_user_id:       gen.user_id,
        p_generation_id: generationId,
        p_amount:        Number(gen.credits_charged),
        p_description:   'Refund — generation failed before submission',
      }).catch(() => {})
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userRes } = await userClient.auth.getUser()
    if (!userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { generationId } = await req.json().catch(() => ({}))
    if (!generationId) {
      return new Response(JSON.stringify({ error: 'generationId required' }), { status: 400, headers: corsHeaders })
    }

    const { data: gen } = await admin
      .from('generations')
      .select('user_id')
      .eq('id', generationId)
      .single()

    if (!gen || gen.user_id !== userRes.user.id) {
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: corsHeaders })
    }

    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(runSubmit(generationId))
    } else {
      runSubmit(generationId).catch(console.error)
    }

    return new Response(
      JSON.stringify({ queued: true, generationId }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (e: any) {
    console.error('[video-generate] handler error:', e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders })
  }
})