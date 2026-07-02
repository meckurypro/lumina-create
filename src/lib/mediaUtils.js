// src/lib/mediaUtils.js
//
// Shared media helpers used across all Create* pages (image, video, talking
// head, copy-motion, upscalers). Centralized here to prevent the local
// copy/paste drift that causes duplicate-declaration build failures.

// ─── aspect ratio ────────────────────────────────────────────────────────────

/**
 * Classifies a width/height pair into one of the three supported
 * generation aspect ratio buckets.
 */
export function detectAspectRatio(width, height) {
  if (!width || !height) return '1:1'
  const ratio = width / height
  if (ratio > 1.6) return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
}

// ─── multi-reference tagging ─────────────────────────────────────────────────

/**
 * Returns the [imgN] tag used to bind a reference image slot into a prompt.
 * idx is 0-indexed; tags are 1-indexed for the user ([img1], [img2], ...).
 */
export function tagForSlot(idx) {
  return `[img${idx + 1}]`
}

// ─── formatting ──────────────────────────────────────────────────────────────

/**
 * Formats a duration in seconds as "12s" or "1m 5s" / "2m".
 * Returns an em dash for null/undefined input.
 */
export function formatDuration(secs) {
  if (secs === null || secs === undefined) return '—'
  const s = Math.round(Number(secs))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

/**
 * Formats a byte count as "512 KB" or "3.4 MB".
 * Returns an empty string for falsy input.
 */
export function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── image compression ────────────────────────────────────────────────────────

/**
 * Compresses an image file down to a max dimension and returns everything
 * a Create page needs to render + upload it:
 *   { file, url, ar, w, h }
 *
 * file: recompressed JPEG File, ready for storage upload
 * url:  local object URL for preview
 * ar:   detected aspect ratio bucket ('16:9' | '9:16' | '1:1')
 * w/h:  final pixel dimensions after scaling
 */
export async function compressImage(file, { maxPx = 1568, quality = 0.92 } = {}) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1.0)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)

      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl)
        if (!blob) {
          reject(new Error('Image compression failed'))
          return
        }
        const compressed = new File(
          [blob],
          file.name.replace(/\.\w+$/, '.jpg'),
          { type: 'image/jpeg' }
        )
        resolve({
          file: compressed,
          url: URL.createObjectURL(blob),
          ar: detectAspectRatio(canvas.width, canvas.height),
          w: canvas.width,
          h: canvas.height,
        })
      }, 'image/jpeg', quality)
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = objectUrl
  })
}

// ─── video metadata ────────────────────────────────────────────────────────────

/**
 * Reads duration/dimensions/aspect ratio from a video file without
 * uploading it. Used by CreateVideoPage, CreateTalkingHeadPage,
 * CreateCopyMotionPage, CreateVideoUpscalerPage.
 *
 * Resolves to { duration, width, height, aspectRatio } — all null on failure.
 */
export function readVideoMetadata(file) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const vid = document.createElement('video')
    vid.preload = 'metadata'

    vid.onloadedmetadata = () => {
      const meta = {
        duration: vid.duration ? Math.round(vid.duration) : null,
        width: vid.videoWidth || null,
        height: vid.videoHeight || null,
        aspectRatio: vid.videoWidth && vid.videoHeight
          ? detectAspectRatio(vid.videoWidth, vid.videoHeight)
          : null,
      }
      URL.revokeObjectURL(objectUrl)
      resolve(meta)
    }

    vid.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ duration: null, width: null, height: null, aspectRatio: null })
    }

    vid.src = objectUrl
  })
}
