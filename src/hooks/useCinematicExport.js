// src/hooks/useCinematicExport.js
//
// Two export modes:
//   1. mergeAndExport  — single merged mp4 via FFmpeg WASM
//   2. downloadAll     — individual numbered mp4s, sequential download
//
// ── ROOT CAUSE OF "failed to import ffmpeg-core.js" ───────────────────────────
// Vite mis-bundles the internal `new Worker(new URL(...))` call inside
// @ffmpeg/ffmpeg, so the classWorker (ffmpeg.wasm's own JS worker thread) can
// never be found. Fix: copy worker.js from node_modules into /public and pass
// its URL explicitly via `classWorkerURL`.
//
// SETUP REQUIRED (one-time):
//   1. Copy the worker file into your public folder so it's served from your origin:
//        cp node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js public/ffmpeg-worker.js
//   2. If you have a postinstall/build script, automate this:
//        "postinstall": "cp node_modules/@ffmpeg/ffmpeg/dist/esm/worker.js public/ffmpeg-worker.js"
//   3. No COOP/COEP headers needed — we use single-threaded @ffmpeg/core (not core-mt).
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react'
import { FFmpeg }                         from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL }           from '@ffmpeg/util'
import { supabase }                       from '@/lib/supabase'

// ── CDN base for single-threaded core ────────────────────
// @ffmpeg/core (NOT core-mt) — no SharedArrayBuffer required.
// Pinned to 0.12.6 (latest confirmed on unpkg as of June 2026).
// Using jsDelivr as primary — better uptime and global CDN than unpkg.
const CORE_CDN = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'

// ── Worker URL ────────────────────────────────────────────
// Must be served from your own origin (same-origin worker requirement).
// This is the worker.js from @ffmpeg/ffmpeg/dist/esm/worker.js
// copied into /public at build time (see SETUP REQUIRED above).
const CLASS_WORKER_URL = '/ffmpeg-worker.js'

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
  // Key fix: pass classWorkerURL so Vite doesn't mis-bundle the worker.
  // toBlobURL is still used for coreURL + wasmURL to handle CORS on the
  // CDN assets — the blob acts as a same-origin proxy for those files.
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return ffmpegRef.current

    const ff = new FFmpeg()

    ff.on('progress', ({ progress }) => {
      // progress covers the FFmpeg encode phase (mapped to 60–95% of total)
      setExportProgress(Math.round(60 + progress * 35))
    })

    ff.on('log', ({ message }) => {
      if (import.meta.env.DEV) console.debug('[ffmpeg]', message)
    })

    // Blobify the CDN assets — required to bypass CORS restrictions on
    // cross-origin JS/WASM files being loaded as worker scripts.
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${CORE_CDN}/ffmpeg-core.js`,   'text/javascript'),
      toBlobURL(`${CORE_CDN}/ffmpeg-core.wasm`, 'application/wasm'),
    ])

    await ff.load({
      coreURL,
      wasmURL,
      // classWorkerURL is the critical fix:
      // Points to the worker.js served from our own origin.
      // Without this, Vite's bundler cannot resolve the internal
      // new Worker(new URL(...)) call and throws "failed to import ffmpeg-core.js".
      classWorkerURL: CLASS_WORKER_URL,
    })

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

    // 3. Fetch each video into the WASM virtual FS
    const fileNames = []
    for (let i = 0; i < videoUrls.length; i++) {
      const name = `clip_${i}.mp4`
      fileNames.push(name)
      const fileData = await fetchFile(videoUrls[i])
      await ff.writeFile(name, fileData)
      setExportProgress(Math.round(20 + ((i + 1) / videoUrls.length) * 38))
    }

    // 4. Write concat manifest
    const concatList = fileNames.map(n => `file '${n}'`).join('\n')
    await ff.writeFile('concat.txt', concatList)

    // 5. Concat — stream copy, no re-encode (fast + lossless)
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
    const cleanupFiles = [...fileNames, 'concat.txt', 'output.mp4']
    await Promise.allSettled(cleanupFiles.map(name => ff.deleteFile(name)))

    setExportProgress(100)
  }, [fetchClips, ensureLoaded])

  // ── Mode 2: Download all clips individually ────────────
  // FFmpeg not needed here — just fetch + trigger download per clip.
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
  // mode: 'merge' (default) | 'download'
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
