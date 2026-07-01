// src/lib/videoFrame.js
//
// Shared video-frame extraction helper. Used by AssetsPage (extracting the
// end frame of an uploaded video asset) and MediaPageCore (extracting the
// end frame of a completed video generation).

export const EXTRACT_END_FRAME_COST  = 3
export const LS_SKIP_EXTRACT_CONFIRM = 'meckury_extract_frame_skip_confirm'

const FRAME_STEP_SECONDS = 1 / 24 // conservative default frame duration assumption

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
