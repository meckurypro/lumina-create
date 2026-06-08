// supabase/functions/process-video-for-motion/index.ts
//
// Pre-processes a user's source video for Copy Motion:
//   • Trims to [startTime, startTime + targetDuration]
//   • Center-crops + scales to the model's required aspect ratio
//   • Re-encodes to H.264 mp4
//   • Uploads result to the `assets` storage bucket (private)
//   • Inserts an `assets` row with source = 'copy_motion_prep'
//   • Returns the created asset record
//
// Uses ffmpeg.wasm (single-threaded build) so it runs entirely inside Deno
// without a subprocess — consistent with the rest of the edge functions
// which call out to external HTTP services rather than spawning binaries.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { FFmpeg } from 'npm:@ffmpeg/ffmpeg@0.12.10'
import { fetchFile } from 'npm:@ffmpeg/util@0.12.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY')!

const admin = createClient(SUPABASE_URL, SERVICE_KEY)

// Target output resolutions per aspect ratio (kept modest to bound encode time)
const TARGET_RES: Record<string, { w: number; h: number }> = {
  '9:16':  { w: 720,  h: 1280 },
  '16:9':  { w: 1280, h: 720  },
  '1:1':   { w: 720,  h: 720  },
  '3:4':   { w: 720,  h: 960  },
  '4:3':   { w: 960,  h: 720  },
  '4:5':   { w: 720,  h: 900  },
}

interface Payload {
  sourceUrl:         string
  targetAspectRatio: string
  targetDuration:    number
  startTime?:        number
  originalFilename?: string
}

function badRequest(msg: string) {
  return new Response(
    JSON.stringify({ success: false, error: msg }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}

function serverError(msg: string) {
  return new Response(
    JSON.stringify({ success: false, error: msg }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ── Auth: validate caller's JWT and resolve userId from the token ──────
  const authHeader = req.headers.get('Authorization') || ''
  const token      = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) return badRequest('Missing Authorization header')

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData?.user) return badRequest('Invalid session')
  const userId = userData.user.id

  // ── Parse + validate body ──────────────────────────────────────────────
  let body: Payload
  try { body = await req.json() } catch { return badRequest('Invalid JSON body') }

  const {
    sourceUrl,
    targetAspectRatio,
    targetDuration,
    startTime        = 0,
    originalFilename = 'video.mp4',
  } = body || {}

  if (!sourceUrl || typeof sourceUrl !== 'string') return badRequest('sourceUrl is required')
  if (!TARGET_RES[targetAspectRatio])              return badRequest(`Unsupported aspect ratio: ${targetAspectRatio}`)
  if (!Number.isFinite(targetDuration) || targetDuration <= 0 || targetDuration > 60)
    return badRequest('targetDuration must be 1–60 seconds')
  if (!Number.isFinite(startTime) || startTime < 0) return badRequest('startTime must be ≥ 0')

  const { w: outW, h: outH } = TARGET_RES[targetAspectRatio]

  try {
    // ── Run ffmpeg.wasm: trim → center-crop → scale → H.264 ─────────────
    const ffmpeg = new FFmpeg()
    await ffmpeg.load()

    const inputBytes = await fetchFile(sourceUrl)
    await ffmpeg.writeFile('input', inputBytes)

    // Filter chain:
    //   crop=min(iw, ih*outW/outH):min(ih, iw*outH/outW)  → center-crop to target ratio
    //   scale=outW:outH                                   → scale to target resolution
    const vf =
      `crop='min(iw,ih*${outW}/${outH})':'min(ih,iw*${outH}/${outW})',` +
      `scale=${outW}:${outH}`

    await ffmpeg.exec([
      '-ss',     String(startTime),
      '-i',      'input',
      '-t',      String(targetDuration),
      '-vf',     vf,
      '-c:v',    'libx264',
      '-preset', 'ultrafast',
      '-crf',    '26',
      '-pix_fmt','yuv420p',
      '-an',     // strip audio — motion-transfer models don't use it
      '-movflags', '+faststart',
      '-f',      'mp4',
      'output.mp4',
    ])

    const outData = await ffmpeg.readFile('output.mp4') as Uint8Array
    await ffmpeg.deleteFile('input').catch(() => {})
    await ffmpeg.deleteFile('output.mp4').catch(() => {})

    // ── Upload to private `assets` bucket ────────────────────────────────
    const assetId  = crypto.randomUUID()
    const filePath = `${userId}/${assetId}.mp4`

    const { error: upErr } = await admin.storage
      .from('assets')
      .upload(filePath, outData, {
        contentType: 'video/mp4',
        upsert:      false,
        cacheControl:'3600',
      })
    if (upErr) throw new Error('Storage upload failed: ' + upErr.message)

    const { data: signed, error: signErr } = await admin.storage
      .from('assets')
      .createSignedUrl(filePath, 60 * 60 * 24 * 7) // 7 days
    if (signErr) throw new Error('Could not sign URL: ' + signErr.message)

    // Strip extension off the display name
    const baseName = (originalFilename || 'video').replace(/\.[^.]+$/, '')
    const displayName = `${baseName} (Copy Motion · ${targetAspectRatio} · ${targetDuration}s)`

    const { data: asset, error: insertErr } = await admin
      .from('assets')
      .insert({
        user_id:    userId,
        name:       displayName,
        file_path:  filePath,
        file_url:   signed.signedUrl,
        mime_type:  'video/mp4',
        size_bytes: outData.byteLength,
        source:     'copy_motion_prep',
      })
      .select()
      .single()

    if (insertErr) {
      // best-effort cleanup so we don't orphan storage
      await admin.storage.from('assets').remove([filePath]).catch(() => {})
      throw new Error('Could not save asset: ' + insertErr.message)
    }

    return new Response(
      JSON.stringify({ success: true, asset }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[process-video-for-motion] failed:', err)
    return serverError(err instanceof Error ? err.message : 'Conversion failed')
  }
})