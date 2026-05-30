/**
 * videoCompat.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects whether a video file needs transcoding before upload, and performs
 * transcode or trim in-browser via FFmpeg.wasm (H.264 + faststart + yuv420p).
 *
 * Single shared FFmpeg instance — trim and transcode reuse the same loaded WASM.
 *
 * Exports:
 *   checkVideoCompatibility(file) → Promise<{ compatible: boolean, reason: string | null }>
 *   transcodeVideo(file, onProgress) → Promise<File>
 *   trimVideo(file, startSec, endSec, onProgress) → Promise<File>
 */

// ── Codec fingerprints that AI APIs reject ──────────────────────────────────
const INCOMPATIBLE_TYPES = [
  'video/hevc',
  'video/x-hevc',
  'video/vp9',
  'video/av1',
  'video/webm',
]

// TikTok, Instagram Reels and some Samsung exports always need transcoding
const ALWAYS_TRANSCODE_HINTS = [
  'tiktok',
  'douyin',
  'reel',
  'snack',
]

// ── Singleton FFmpeg instance ─────────────────────────────────────────────
let _ffmpegInstance = null

async function _getFFmpeg(onProgress) {
  if (_ffmpegInstance) {
    _ffmpegInstance.off('progress', _ffmpegInstance._lastProgressCb)
    const cb = ({ progress }) => onProgress?.(Math.min(99, Math.round(progress * 100)))
    _ffmpegInstance._lastProgressCb = cb
    _ffmpegInstance.on('progress', cb)
    return _ffmpegInstance
  }

  const { FFmpeg }    = await import('@ffmpeg/ffmpeg')
  const { toBlobURL } = await import('@ffmpeg/util')

  const ff = new FFmpeg()
  const cb = ({ progress }) => onProgress?.(Math.min(99, Math.round(progress * 100)))
  ff._lastProgressCb = cb
  ff.on('progress', cb)

  const base = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  await ff.load({
    coreURL: await toBlobURL(`${base}/ffmpeg-core.js`,   'text/javascript'),
    wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  _ffmpegInstance = ff
  return ff
}

// ── MP4 probe — detects H.265-in-MP4 containers ──────────────────────────
function _probeMp4(file) {
  return new Promise((resolve) => {
    const url   = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted   = true
    video.src     = url

    const cleanup = (result) => {
      URL.revokeObjectURL(url)
      video.src = ''
      resolve(result)
    }

    video.onloadedmetadata = () => cleanup(true)
    video.onerror          = () => cleanup(false)
    setTimeout(() => cleanup(false), 8000)
  })
}

/**
 * Probes a video file to determine if it needs transcoding.
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

  // 3. Browser canPlayType probe
  const video    = document.createElement('video')
  const canPlay  = video.canPlayType(type || 'video/mp4')
  if (canPlay === '') {
    return { compatible: false, reason: 'Video format not supported by browser — converting' }
  }

  // 4. MP4 container sanity check (catches H.265-in-MP4)
  if (type === 'video/mp4' || name.endsWith('.mp4')) {
    const safe = await _probeMp4(file)
    if (!safe) {
      return { compatible: false, reason: 'MP4 container may use unsupported codec — converting to H.264' }
    }
  }

  return { compatible: true, reason: null }
}

/**
 * Transcodes a video file to H.264 MP4.
 * yuv420p + BT.709 + faststart — broadest AI API compatibility.
 */
export async function transcodeVideo(file, onProgress) {
  const { fetchFile } = await import('@ffmpeg/util')
  const ff = await _getFFmpeg(onProgress)

  const inputName  = 'tc_input'
  const outputName = 'tc_output.mp4'

  await ff.writeFile(inputName, await fetchFile(file))

  await ff.exec([
    '-i',               inputName,
    '-c:v',             'libx264',
    '-preset',          'fast',
    '-crf',             '23',
    '-vf',              'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-colorspace',      'bt709',
    '-color_trc',       'bt709',
    '-color_primaries', 'bt709',
    '-c:a',             'aac',
    '-movflags',        '+faststart',
    outputName,
  ])

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName).catch(() => {})
  await ff.deleteFile(outputName).catch(() => {})

  const safeName = file.name.replace(/\.[^.]+$/, '_converted.mp4')
  return new File([data.buffer], safeName, { type: 'video/mp4' })
}

/**
 * Trims a video file to [startSec, endSec].
 * Re-encodes to H.264 MP4 for clean keyframes and API compatibility.
 */
export async function trimVideo(file, startSec, endSec, onProgress) {
  const { fetchFile } = await import('@ffmpeg/util')
  const ff = await _getFFmpeg(onProgress)

  const inputName  = 'trim_input'
  const outputName = 'trim_output.mp4'

  await ff.writeFile(inputName, await fetchFile(file))

  await ff.exec([
    '-ss',                String(startSec),
    '-to',                String(endSec),
    '-i',                 inputName,
    '-c:v',               'libx264',
    '-preset',            'ultrafast',
    '-crf',               '18',
    '-vf',                'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
    '-c:a',               'aac',
    '-avoid_negative_ts', 'make_zero',
    '-movflags',          '+faststart',
    outputName,
  ])

  const data = await ff.readFile(outputName)
  await ff.deleteFile(inputName).catch(() => {})
  await ff.deleteFile(outputName).catch(() => {})

  const trimmedName = file.name.replace(/\.[^.]+$/, '') + '_trim.mp4'
  return new File([data.buffer], trimmedName, { type: 'video/mp4' })
}
