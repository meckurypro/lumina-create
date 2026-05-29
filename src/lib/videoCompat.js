/**
 * videoCompat.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects whether a video file needs transcoding before upload, and performs
 * the transcode in-browser via FFmpeg.wasm (H.264 + faststart + yuv420p).
 *
 * Kept separate so bugs here never touch the generation flow.
 *
 * Exports:
 *   checkVideoCompatibility(file) → Promise<{ compatible: boolean, reason: string | null }>
 *   transcodeVideo(file, onProgress) → Promise<File>
 */

// ── Codec fingerprints that AI APIs reject ──────────────────────────────────
const INCOMPATIBLE_TYPES = [
  'video/hevc',
  'video/x-hevc',
  'video/vp9',
  'video/av1',
  'video/webm',   // often VP9/AV1 under the hood
]

// TikTok, Instagram Reels and some Samsung exports always need transcoding
// regardless of MIME type — they use H.265 inside an .mp4 container
const ALWAYS_TRANSCODE_HINTS = [
  'tiktok',
  'douyin',
  'reel',
  'snack',
]

let _ffmpegInstance = null

async function _getFFmpeg(onProgress) {
  if (_ffmpegInstance) {
    // Re-attach progress listener for this run
    _ffmpegInstance.off('progress', _ffmpegInstance._lastProgressCb)
    const cb = ({ progress }) => onProgress?.(Math.min(99, Math.round(progress * 100)))
    _ffmpegInstance._lastProgressCb = cb
    _ffmpegInstance.on('progress', cb)
    return _ffmpegInstance
  }

  // Dynamic import so the ~30MB WASM is only fetched when needed
  const { FFmpeg }           = await import('@ffmpeg/ffmpeg')
  const { toBlobURL }        = await import('@ffmpeg/util')

  const ff = new FFmpeg()
  const cb = ({ progress }) => onProgress?.(Math.min(99, Math.round(progress * 100)))
  ff._lastProgressCb = cb
  ff.on('progress', cb)

  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  await ff.load({
    coreURL:   await toBlobURL(`${base}/ffmpeg-core.js`,        'text/javascript'),
    wasmURL:   await toBlobURL(`${base}/ffmpeg-core.wasm`,      'application/wasm'),
    workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, 'text/javascript'),
  })

  _ffmpegInstance = ff
  return ff
}

/**
 * Probes a video file to determine if it needs transcoding.
 *
 * Strategy (layered, cheapest checks first):
 *  1. Filename hint (tiktok/reel/etc in the name)
 *  2. MIME type blacklist
 *  3. Browser canPlayType probe — if the browser itself can't decode it,
 *     the file definitely needs transcoding
 *  4. If the file is .mp4 but came from a social platform hint → transcode
 *     anyway (H.265-in-MP4 container is not detectable without demuxing)
 *
 * Returns { compatible: boolean, reason: string | null }
 */
export async function checkVideoCompatibility(file) {
  const name = (file.name || '').toLowerCase()
  const type = (file.type || '').toLowerCase()

  // 1. Filename hint
  if (ALWAYS_TRANSCODE_HINTS.some((h) => name.includes(h))) {
    return { compatible: false, reason: 'Social media video detected — converting to API-safe format' }
  }

  // 2. MIME blacklist
  if (INCOMPATIBLE_TYPES.includes(type)) {
    return { compatible: false, reason: `Codec not supported (${type}) — converting to H.264` }
  }

  // 3. Browser canPlayType — quick synchronous probe
  const video = document.createElement('video')
  const canPlay = video.canPlayType(type || 'video/mp4')
  if (canPlay === '') {
    return { compatible: false, reason: 'Video format not supported by browser — converting' }
  }

  // 4. .mp4 files can hide H.265 — do a short metadata-load sanity check
  if (type === 'video/mp4' || name.endsWith('.mp4')) {
    const safe = await _probeMp4(file)
    if (!safe) {
      return { compatible: false, reason: 'MP4 container may use unsupported codec — converting to H.264' }
    }
  }

  return { compatible: true, reason: null }
}

/**
 * Attempts to load the first 3 seconds of an MP4 in a hidden video element.
 * If it errors or stalls, the file likely has an incompatible codec.
 */
function _probeMp4(file) {
  return new Promise((resolve) => {
    const url   = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload  = 'auto'
    video.muted    = true
    video.src      = url

    const cleanup = (result) => {
      URL.revokeObjectURL(url)
      video.src = ''
      resolve(result)
    }

    // If we can load metadata AND seek a little, codec is almost certainly fine
    video.oncanplay  = () => cleanup(true)
    video.onerror    = () => cleanup(false)

    // 4-second timeout — if it hasn't fired canplay, assume incompatible
    setTimeout(() => cleanup(false), 4000)
  })
}

/**
 * Transcodes a video file to H.264 MP4 with:
 *  - libx264 video codec
 *  - yuv420p pixel format (broadest API compatibility)
 *  - AAC audio
 *  - +faststart (moov atom at front — required by most AI APIs)
 *  - BT.709 colorspace (strips HDR / BT.2020 TikTok metadata)
 *  - Even dimensions enforced (avoids libx264 odd-dimension crash)
 *
 * @param {File}     file        Raw video File from input
 * @param {Function} onProgress  Optional (percent: number) => void
 * @returns {Promise<File>}      New File safe to upload
 */
export async function transcodeVideo(file, onProgress) {
  const { fetchFile } = await import('@ffmpeg/util')
  const ff = await _getFFmpeg(onProgress)

  const inputName  = 'input_src'
  const outputName = 'output.mp4'

  await ff.writeFile(inputName, await fetchFile(file))

  await ff.exec([
    '-i',        inputName,
    '-c:v',      'libx264',
    '-preset',   'fast',
    '-crf',      '23',
    '-vf',       'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-colorspace',      'bt709',
    '-color_trc',       'bt709',
    '-color_primaries', 'bt709',
    '-c:a',      'aac',
    '-movflags', '+faststart',
    outputName,
  ])

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName).catch(() => {})
  await ff.deleteFile(outputName).catch(() => {})

  const safeName = file.name.replace(/\.[^.]+$/, '_converted.mp4')
  return new File([data.buffer], safeName, { type: 'video/mp4' })
}
