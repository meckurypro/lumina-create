// src/lib/mediaUtils.js

export function detectAspectRatio(width, height) {
  const ratio = width / height
  if (ratio > 1.6) return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
}

export function tagForSlot(idx) {
  return `[img${idx + 1}]`
}

export function formatDuration(secs) {
  if (!secs && secs !== 0) return '—'
  const s = Math.round(Number(secs))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

export function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Compresses an image to a max dimension and returns everything a Create
 * page needs to render + upload it. Same behavior as every inline copy
 * that used to live in each page.
 */
export async function compressImage(file, { maxPx = 1568, quality = 0.92 } = {}) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1.0)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
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
    img.src = url
  })
}

/**
 * Reads duration/dimensions/aspect ratio from a video file without
 * uploading it — same as the inline copies in CreateVideoPage,
 * CreateTalkingHeadPage, CreateCopyMotionPage, CreateVideoUpscalerPage.
 */
export function readVideoMetadata(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
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
      URL.revokeObjectURL(url)
      resolve(meta)
    }
    vid.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ duration: null, width: null, height: null, aspectRatio: null })
    }
    vid.src = url
  })
}
