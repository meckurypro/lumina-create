// src/hooks/useCinematicExport.js
//
// Two export modes:
//   1. 'merge'    — concat all clips → single mp4 via FFmpeg WASM
//   2. 'download' — individual numbered mp4s, sequential fetch+download
//                   (NO FFmpeg needed — fast)
//
// ── WHY THE PREVIOUS VERSION HUNG AT 5% ──────────────────────────────────────
// The prior fix used:
//   FFMPEG_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm'
//   CORE_CDN   = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'
//
// Two problems:
//   1. dist/umd does NOT exist for @ffmpeg/core — it's dist/esm. So the
//      toBlobURL() calls for coreURL and wasmURL were silently hanging on
//      a 404, never resolving, freezing ensureLoaded() indefinitely at 5%.
//
//   2. cdn.jsdelivr.net is NOT on Meckury's Vercel allowed-domains list, so
//      the fetches may be blocked entirely at the network level in production.
//
// ── THE FIX ───────────────────────────────────────────────────────────────────
// Switch to cdnjs.cloudflare.com which:
//   a) IS on the allowed-domains list (cdnjs.cloudflare.com is *.cloudflare.com)
//   b) Has both packages at verified, correct paths (confirmed 200 responses)
//   c) Uses a separate package name for the core: 'ffmpeg-core' not '@ffmpeg/core'
//
// Verified working URLs (as of June 2026):
//   worker.js    → cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.12.15/esm/worker.js
//   core JS      → cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.10/esm/ffmpeg-core.js
//   core WASM    → cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.10/esm/ffmpeg-core.wasm
//
// Note: @ffmpeg/ffmpeg is 'ffmpeg' on cdnjs, @ffmpeg/core is 'ffmpeg-core'.
// The worker.js version (0.12.15) is the latest on cdnjs; core is 0.12.10.
// These are cross-compatible — classWorkerURL just needs to be the compiled
// worker from the same major/minor branch as your installed @ffmpeg/ffmpeg.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react'
import { FFmpeg }                         from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL }           from '@ffmpeg/util'
import { supabase }                       from '@/lib/supabase'

// ── CDN URLs (cdnjs.cloudflare.com — on Meckury's allowed domain list) ───────
const WORKER_URL  = 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg/0.12.15/esm/worker.js'
const CORE_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.10/esm/ffmpeg-core.js'
const CORE_WA_URL = 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.10/esm/ffmpeg-core.wasm'

export function useCinematicExport() {
  const ffmpegRef = useRef(null)
  const loadedRef = useRef(false)

  const [exporting,      setExporting]      = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError,    setExportError]    = useState(null)

  // ── Fetch completed clip URLs from DB ──────────────────
  const fetchClips = useCallback(async (projectId) => {
    const { data: clips, error } = await supabase
      .from('cinematic_clips')
      .select(`
        id,
        slot_index,
        cinematic_clip_versions (
          generation_id,
          version_number,
          generations (
            id,
            status,
            output_url
          )
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('slot_index', { ascending: true })

    if (error) throw new Error(`Failed to fetch clips: ${error.message}`)
    if (!clips?.length) throw new Error('No completed clips found for this project.')

    return clips.map((clip) => {
      const versions = clip.cinematic_clip_versions || []
      const latest   = versions.sort((a, b) => b.version_number - a.version_number)[0]
      const url      = latest?.generations?.output_url
      if (!url) throw new Error(`Clip ${clip.slot_index + 1} has no output URL.`)
      return url
    })
  }, [])

  // ── Load FFmpeg WASM (idempotent) ──────────────────────
  //
  // All three URLs come from cdnjs.cloudflare.com and are blobified via
  // toBlobURL() so the browser sees them as same-origin — no CORS/MIME
  // issues regardless of server routing rules.
  //
  // No SharedArrayBuffer / COOP / COEP required — we use single-threaded
  // ffmpeg-core (not core-mt).
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return ffmpegRef.current

    const ff = new FFmpeg()

    ff.on('progress', ({ progress }) => {
      // FFmpeg encode phase mapped to 60–95% of overall progress
      setExportProgress(Math.round(60 + progress * 35))
    })

    if (import.meta.env.DEV) {
      ff.on('log', ({ message }) => console.debug('[ffmpeg]', message))
    }

    // Blobify all three assets in parallel.
    // toBlobURL(url, mimeType) → fetch → Blob → blob: URL
    // The resulting blob: URL is always same-origin.
    const [classWorkerURL, coreURL, wasmURL] = await Promise.all([
      toBlobURL(WORKER_URL,  'text/javascript'),
      toBlobURL(CORE_JS_URL, 'text/javascript'),
      toBlobURL(CORE_WA_URL, 'application/wasm'),
    ])

    await ff.load({ classWorkerURL, coreURL, wasmURL })

    ffmpegRef.current = ff
    loadedRef.current = true
    return ff
  }, [])

  // ── Mode 1: Merge all clips → single mp4 ──────────────
  const mergeAndExport = useCallback(async (projectId, projectName) => {
    const slug = projectName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    // 1. Fetch clip URLs (0–5%)
    const videoUrls = await fetchClips(projectId)
    setExportProgress(5)

    // 2. Load FFmpeg WASM (5–20%)
    const ff = await ensureLoaded()
    setExportProgress(20)

    // 3. Fetch each video into WASM virtual FS (20–58%)
    const fileNames = []
    for (let i = 0; i < videoUrls.length; i++) {
      const name = `clip_${i}.mp4`
      fileNames.push(name)
      await ff.writeFile(name, await fetchFile(videoUrls[i]))
      setExportProgress(Math.round(20 + ((i + 1) / videoUrls.length) * 38))
    }

    // 4. Write concat manifest
    await ff.writeFile('concat.txt', fileNames.map(n => `file '${n}'`).join('\n'))

    // 5. Concat — stream copy (no re-encode, lossless, fast) (58–95% via progress event)
    await ff.exec([
      '-f',    'concat',
      '-safe', '0',
      '-i',    'concat.txt',
      '-c',    'copy',
      'output.mp4',
    ])

    setExportProgress(95)

    // 6. Read output and trigger browser download
    const data   = await ff.readFile('output.mp4')
    const blob   = new Blob([data.buffer], { type: 'video/mp4' })
    const url    = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href     = url
    anchor.download = `${slug}-cinematic.mp4`
    anchor.click()
    URL.revokeObjectURL(url)

    // 7. Clean up WASM virtual FS
    await Promise.allSettled(
      [...fileNames, 'concat.txt', 'output.mp4'].map(name => ff.deleteFile(name))
    )

    setExportProgress(100)
  }, [fetchClips, ensureLoaded])

  // ── Mode 2: Download all clips individually ────────────
  // No FFmpeg — just fetch + trigger download per clip.
  // Fast, no WASM loading, no worker, no MIME issues.
  const downloadAll = useCallback(async (projectId, projectName) => {
    const slug = projectName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    const videoUrls = await fetchClips(projectId)

    for (let i = 0; i < videoUrls.length; i++) {
      setExportProgress(Math.round((i / videoUrls.length) * 100))

      const res = await fetch(videoUrls[i])
      if (!res.ok) throw new Error(`Clip ${i + 1}: fetch failed (${res.status})`)

      const blob   = await res.blob()
      const url    = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href     = url
      anchor.download = `${slug}-clip-${String(i + 1).padStart(2, '0')}.mp4`
      anchor.click()
      URL.revokeObjectURL(url)

      // Small delay between downloads to avoid browser blocking them
      if (i < videoUrls.length - 1) await new Promise(r => setTimeout(r, 600))
    }

    setExportProgress(100)
  }, [fetchClips])

  // ── Public entry point ─────────────────────────────────
  // mode: 'merge' | 'download'
  const exportProject = useCallback(async (
    projectId,
    projectName = 'cinematic',
    mode = 'merge',
  ) => {
    setExporting(true)
    setExportProgress(0)
    setExportError(null)

    try {
      if (mode === 'download') {
        await downloadAll(projectId, projectName)
      } else {
        await mergeAndExport(projectId, projectName)
      }
      return true
    } catch (err) {
      console.error('[useCinematicExport]', err)
      setExportError(err.message || 'Export failed')
      return false
    } finally {
      setExporting(false)
    }
  }, [mergeAndExport, downloadAll])

  return { exportProject, exporting, exportProgress, exportError }
}
