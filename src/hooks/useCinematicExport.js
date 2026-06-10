// src/hooks/useCinematicExport.js
//
// Two export modes:
//   1. 'merge'    — concat all clips → single mp4 via FFmpeg WASM
//   2. 'download' — individual numbered mp4s, sequential fetch+download
//                   (NO FFmpeg needed — fast, was working before)
//
// ── WHY THE WORKER USED TO FAIL ──────────────────────────────────────────────
// The original code set:
//   classWorkerURL: '/ffmpeg-worker.js'   ← served from your own origin
//
// On Vercel with a catch-all SPA rewrite, ANY path that doesn't match a real
// static file returns index.html with Content-Type: text/html.
// The browser rejects a <script type="module"> with a non-JS MIME type, so the
// worker dies immediately with:
//   "Failed to load module script: non-JavaScript MIME type of text/html"
//
// ── THE FIX ───────────────────────────────────────────────────────────────────
// Don't rely on your own origin for the worker file at all.
// Both the @ffmpeg/ffmpeg worker (classWorkerURL) AND the @ffmpeg/core assets
// (coreURL / wasmURL) are fetched from jsDelivr and wrapped in Blob URLs via
// toBlobURL(). A Blob URL is same-origin by definition, so the worker loads
// fine regardless of your server's routing rules.
//
// Specifically:
//   classWorkerURL → toBlobURL of @ffmpeg/ffmpeg's worker.js from jsDelivr
//   coreURL        → toBlobURL of @ffmpeg/core's ffmpeg-core.js from jsDelivr
//   wasmURL        → toBlobURL of @ffmpeg/core's ffmpeg-core.wasm from jsDelivr
//
// No files need to be copied into /public. No vercel.json routing exclusions
// needed for worker files. Works identically in dev and production.
//
// ── VERSION PINNING ───────────────────────────────────────────────────────────
// @ffmpeg/ffmpeg  v0.12.10  ← classWorkerURL support added in v0.12.9
// @ffmpeg/core   v0.12.6   ← single-threaded (no SharedArrayBuffer required)
// These must be kept in sync. The CDN worker.js is from the @ffmpeg/ffmpeg
// package, not @ffmpeg/core — they are different files.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react'
import { FFmpeg }                         from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL }           from '@ffmpeg/util'
import { supabase }                       from '@/lib/supabase'

// ── CDN roots ─────────────────────────────────────────────
// Using jsDelivr — better global uptime than unpkg, same files.
const FFMPEG_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm'
const CORE_CDN   = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'

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
  // All three URLs are fetched from jsDelivr and wrapped in Blob URLs.
  // This sidesteps every same-origin / MIME-type / Vercel-rewrite issue:
  //
  //  classWorkerURL  The JS worker spawned by @ffmpeg/ffmpeg itself.
  //                  Must come from the same package version as your
  //                  installed @ffmpeg/ffmpeg — here v0.12.10.
  //                  We blobify it so the browser sees it as same-origin.
  //
  //  coreURL         The Emscripten glue JS for @ffmpeg/core (single-thread).
  //
  //  wasmURL         The compiled WebAssembly binary.
  //
  // No SharedArrayBuffer / COOP / COEP headers required because we use the
  // single-threaded @ffmpeg/core (not core-mt).
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return ffmpegRef.current

    const ff = new FFmpeg()

    ff.on('progress', ({ progress }) => {
      // FFmpeg encode phase mapped to 60–95 % of overall progress
      setExportProgress(Math.round(60 + progress * 35))
    })

    if (import.meta.env.DEV) {
      ff.on('log', ({ message }) => console.debug('[ffmpeg]', message))
    }

    // Fetch all three assets in parallel and blobify them.
    // toBlobURL(url, mimeType) → fetch → Blob → blob: URL
    // The resulting blob: URL is always same-origin, so the browser's
    // worker origin check passes unconditionally.
    const [classWorkerURL, coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${FFMPEG_CDN}/worker.js`,         'text/javascript'),
      toBlobURL(`${CORE_CDN}/ffmpeg-core.js`,      'text/javascript'),
      toBlobURL(`${CORE_CDN}/ffmpeg-core.wasm`,    'application/wasm'),
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

    // 1. Fetch clip URLs
    const videoUrls = await fetchClips(projectId)
    setExportProgress(5)

    // 2. Load FFmpeg (no-op if already loaded)
    const ff = await ensureLoaded()
    setExportProgress(20)

    // 3. Fetch each video into WASM virtual FS
    const fileNames = []
    for (let i = 0; i < videoUrls.length; i++) {
      const name = `clip_${i}.mp4`
      fileNames.push(name)
      await ff.writeFile(name, await fetchFile(videoUrls[i]))
      setExportProgress(Math.round(20 + ((i + 1) / videoUrls.length) * 38))
    }

    // 4. Write concat manifest
    await ff.writeFile('concat.txt', fileNames.map(n => `file '${n}'`).join('\n'))

    // 5. Concat — stream copy (no re-encode, lossless, fast)
    await ff.exec([
      '-f',    'concat',
      '-safe', '0',
      '-i',    'concat.txt',
      '-c',    'copy',
      'output.mp4',
    ])

    setExportProgress(95)

    // 6. Read output and trigger download
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
  // FFmpeg is NOT used here — just fetch + trigger download per clip.
  // This is the fast path that was working before, restored to its
  // original behaviour. No WASM loading, no worker, no MIME issues.
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
