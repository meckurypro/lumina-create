// src/lib/videoFrame.js
//
// Shared video-frame extraction helper. Used by AssetsPage (extracting the
// end frame of an uploaded video asset) and MediaPageCore (extracting the
// end frame of a completed video generation, or an arbitrary user-picked
// frame via the frame-picker slider).

export const EXTRACT_END_FRAME_COST  = 3
export const LS_SKIP_EXTRACT_CONFIRM = 'meckury_extract_frame_skip_confirm'

const FRAME_STEP_SECONDS = 1 / 24 // conservative default frame duration assumption
const POSTER_MAX_PX      = 240
const POSTER_QUALITY     = 0.72

// ─────────────────────────────────────────────────────────────────────────────
// captureFrameFromVideoElement
//
// Shared canvas-capture step. Draws whatever frame the given <video> element
// is currently paused/seeked to, at full native resolution, and resolves a
// PNG blob. Used by both extractLastFrame and extractFrameAt so the actual
// pixel-capture code path is identical between them.
// ─────────────────────────────────────────────────────────────────────────────

function captureFrameFromVideoElement(video) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas')
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight

      if (!canvas.width || !canvas.height) {
        reject(new Error('Video has no decodable dimensions'))
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
        if (pngBlob) resolve(pngBlob)
        else reject(new Error('Canvas toBlob failed'))
      }, 'image/png')
    } catch (err) {
      reject(err)
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// extractLastFrame
//
// UNCHANGED BEHAVIOR from the original implementation — still crawls forward
// in quarter-frame increments from (duration - FRAME_STEP_SECONDS) until the
// seek stops advancing, which is the most reliable way to land on the true
// final decodable frame across browsers/codecs. Only the final canvas-capture
// step now delegates to the shared helper above.
// ─────────────────────────────────────────────────────────────────────────────

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
      captureFrameFromVideoElement(video).then((pngBlob) => {
        settled = true
        cleanup()
        resolve(pngBlob)
      }).catch(fail)
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
// extractFrameAt
//
// Extracts the frame at an arbitrary, user-chosen timestamp — powers the
// frame-picker slider. Unlike extractLastFrame, a single direct seek is
// reliable here (only seeking to the very end of a video is flaky across
// browsers), so this does one seek + one capture, no crawl needed.
//
// targetSeconds is clamped to [0, duration] once metadata is known.
// ─────────────────────────────────────────────────────────────────────────────

export async function extractFrameAt(videoUrl, targetSeconds) {
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

    const safetyTimer = setTimeout(() => fail(new Error('Frame extraction timed out')), 30_000)
    const clearSafety = () => clearTimeout(safetyTimer)

    video.onloadedmetadata = () => {
      const duration = video.duration
      if (!isFinite(duration) || duration <= 0) {
        clearSafety()
        fail(new Error('Video has no readable duration'))
        return
      }
      const clamped = Math.min(Math.max(0, targetSeconds), duration)

      video.onseeked = () => {
        if (settled) return
        clearSafety()
        captureFrameFromVideoElement(video).then((pngBlob) => {
          settled = true
          cleanup()
          resolve(pngBlob)
        }).catch(fail)
      }

      video.currentTime = clamped
    }

    video.src = objUrl
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// extractCroppedFrameAt
//
// Powers the reframe/crop picker. Seeks to timeSeconds (single direct seek —
// safe for any non-end timestamp, same reasoning as extractFrameAt) then
// draws only the given native-pixel source rectangle to an output canvas,
// i.e. a real crop at full source resolution — not a downscaled screenshot
// of whatever preview size the UI happened to render at.
//
// crop: { sx, sy, sWidth, sHeight } — all in native video pixel coordinates,
// as computed by the crop UI from its current pan/zoom state.
// ─────────────────────────────────────────────────────────────────────────────

export async function extractCroppedFrameAt(videoUrl, timeSeconds, crop) {
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

    const safetyTimer = setTimeout(() => fail(new Error('Frame extraction timed out')), 30_000)
    const clearSafety = () => clearTimeout(safetyTimer)

    video.onloadedmetadata = () => {
      const duration = video.duration
      if (!isFinite(duration) || duration <= 0) {
        clearSafety()
        fail(new Error('Video has no readable duration'))
        return
      }
      const clamped = Math.min(Math.max(0, timeSeconds), duration)

      video.onseeked = () => {
        if (settled) return
        clearSafety()
        try {
          const { sx, sy, sWidth, sHeight } = crop
          const canvas = document.createElement('canvas')
          canvas.width  = Math.max(1, Math.round(sWidth))
          canvas.height = Math.max(1, Math.round(sHeight))

          let ctx
          try { ctx = canvas.getContext('2d', { colorSpace: 'srgb' }) } catch { ctx = null }
          if (!ctx) ctx = canvas.getContext('2d')

          ctx.drawImage(
            video,
            sx, sy, sWidth, sHeight,       // source rect (native video px)
            0, 0, canvas.width, canvas.height, // dest rect (output canvas)
          )

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

      video.currentTime = clamped
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
// Distinct from extractLastFrame/extractFrameAt, which capture at full
// resolution for the user-facing frame-extraction feature.
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
