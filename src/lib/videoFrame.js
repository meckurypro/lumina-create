// src/lib/videoFrame.js
//
// Shared video-frame extraction helper. Used by AssetsPage (extracting the
// end frame of an uploaded video asset) and MediaPageCore (extracting the
// end frame of a completed video generation).

export const EXTRACT_END_FRAME_COST  = 3
export const LS_SKIP_EXTRACT_CONFIRM = 'meckury_extract_frame_skip_confirm'

const FRAME_STEP_SECONDS = 1 / 24 // conservative default frame duration assumption
const POSTER_MAX_PX      = 240
const POSTER_QUALITY     = 0.72

export async function extractLastFrame(videoUrl) {
  const res    = await fetch(videoUrl)
  const blob   = await res.blob()
  const objUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const video       = document.createElement('video')
    video.muted       = true
    video.preload     = 'auto'
    video.crossOrigin = 'anonymous'
    video.playsInline = true

    let settled = false
    const cleanup = () => URL.revokeObjectURL(objUrl)
    const fail = (err) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    video.onerror = () => fail(new Error('Could not load video for frame extraction'))

    const captureCurrentFrame = () => {
      if (settled) return
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight

        if (!canvas.width || !canvas.height) {
          fail(new Error('Video has no decodable dimensions'))
          return
        }

        let ctx
        try {
          ctx = canvas.getContext('2d', { colorSpace: 'srgb' })
        } catch {
          ctx = null
        }
        if (!ctx) ctx = canvas.getContext('2d')

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        canvas.toBlob((pngBlob) => {
          settled = true
          cleanup()
          if (pngBlob) resolve(pngBlob)
          else reject(new Error('Canvas toBlob failed'))
        }, 'image/png')
      } catch (err) {
        fail(err)
      }
    }

    // Safety timeout — corrupt file / stalled network shouldn't hang the UI.
    const safetyTimer = setTimeout(() => {
      fail(new Error('Frame extraction timed out'))
    }, 30_000)
    const clearSafety = () => clearTimeout(safetyTimer)

    video.onloadedmetadata = () => {
      const duration = video.duration
      if (!isFinite(duration) || duration <= 0) {
        clearSafety()
        fail(new Error('Video has no readable duration'))
        return
      }

      const target = Math.max(0, duration - FRAME_STEP_SECONDS)
      let lastSeekTime = -1

      video.onseeked = () => {
        const reachedEnd    = video.currentTime >= duration - 0.0005
        const noFurtherMove = video.currentTime <= lastSeekTime
        if (reachedEnd || noFurtherMove) {
          clearSafety()
          captureCurrentFrame()
          return
        }
        lastSeekTime = video.currentTime
        video.currentTime = Math.min(duration, video.currentTime + FRAME_STEP_SECONDS / 4)
      }

      video.currentTime = target
    }

video.src = objUrl
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// extractPosterFrame
//
// Grabs an early frame (default: 10% into the clip, capped at 1s) and
// downsizes it to a small WebP — used to backfill output_thumbnail_url for
// completed video generations that don't have one (see MediaPageCore.jsx).
// Distinct from extractLastFrame, which is used for the user-facing
// "Extract End Frame" feature and grabs the final frame at full resolution.
// ─────────────────────────────────────────────────────────────────────────────

export async function extractPosterFrame(videoUrl, seekSeconds = null) {
  const res    = await fetch(videoUrl)
  const blob   = await res.blob()
  const objUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const video       = document.createElement('video')
    video.muted       = true
    video.preload     = 'auto'
    video.crossOrigin = 'anonymous'
    video.playsInline = true

    let settled = false
    const cleanup = () => URL.revokeObjectURL(objUrl)
    const fail = (err) => {
      if (settled) return
      settled = true
      cleanup()
      reject(err)
    }

    video.onerror = () => fail(new Error('Could not load video for thumbnail extraction'))

    const safetyTimer = setTimeout(() => fail(new Error('Thumbnail extraction timed out')), 20_000)
    const clearSafety = () => clearTimeout(safetyTimer)

    video.onloadedmetadata = () => {
      const duration = video.duration
      if (!isFinite(duration) || duration <= 0) {
        clearSafety()
        fail(new Error('Video has no readable duration'))
        return
      }
      video.currentTime = seekSeconds ?? Math.min(1, duration * 0.1)
    }

    video.onseeked = () => {
      if (settled) return
      clearSafety()
      try {
        const scale  = Math.min(POSTER_MAX_PX / video.videoWidth, POSTER_MAX_PX / video.videoHeight, 1.0)
        const w      = Math.max(1, Math.round(video.videoWidth  * scale))
        const h      = Math.max(1, Math.round(video.videoHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width  = w
        canvas.height = h
        canvas.getContext('2d').drawImage(video, 0, 0, w, h)
        canvas.toBlob((webpBlob) => {
          settled = true
          cleanup()
          if (webpBlob) resolve(webpBlob)
          else reject(new Error('Canvas toBlob failed'))
        }, 'image/webp', POSTER_QUALITY)
      } catch (err) {
        fail(err)
      }
    }

    video.src = objUrl
  })
}
