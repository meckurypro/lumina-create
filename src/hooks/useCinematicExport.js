// src/hooks/useCinematicExport.js
//
// Two export modes:
//   1. 'merge'    — concat all clips → single mp4 via FFmpeg WASM
//   2. 'download' — individual numbered mp4s, sequential fetch+download (no FFmpeg)
//
// ── THE DEFINITIVE FIX ────────────────────────────────────────────────────────
// Every CDN approach has failed because:
//   - jsdelivr: not on Meckury's allowed-domain list
//   - cdnjs: strips .wasm binary files entirely (only serves .js)
//   - unpkg: same structural problems
//
// The correct solution for a Vite project is ?url imports, which tell Vite to:
//   1. Resolve the file from node_modules at build time
//   2. Copy it into the build output with a content-hash filename
//   3. Return the hashed /assets/ffmpeg-core-[hash].wasm URL as a string
//   4. Serve it from YOUR OWN ORIGIN with correct MIME types
//
// No CDN. No copying files to /public. No postinstall scripts.
// No domain allowlist issues. Works identically in dev and production.
//
// REQUIRES these two changes to vite.config.js (see below):
//   optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] }
//   assetsInclude: ['**/*.wasm']
//
// The worker is still loaded via classWorkerURL from unpkg, blobified.
// The worker.js from @ffmpeg/ffmpeg doesn't contain binary data (it's pure JS),
// so unpkg serves it fine with the correct MIME type, and we blobify it to
// make it same-origin. Only the .wasm binary must come from your own origin.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react'
import { FFmpeg }                         from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL }           from '@ffmpeg/util'
import { supabase }                       from '@/lib/supabase'

// ?url imports — Vite resolves these at build time from node_modules,
// copies the files into /assets/ with content-hash names, and returns
// the URL string. Served from your own origin with correct MIME types.
import coreJsUrl  from '@ffmpeg/core/dist/esm/ffmpeg-core.js?url'
import coreWasmUrl from '@ffmpeg/core/dist/esm/ffmpeg-core.wasm?url'

// Worker JS from unpkg — pure JS (no binary), blobified to same-origin.
// This is the worker from @ffmpeg/ffmpeg (the orchestrator), NOT @ffmpeg/core.
// Must match your installed @ffmpeg/ffmpeg version.
const WORKER_CDN = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js'

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
  // coreURL  — served from your own origin via Vite ?url import (correct MIME, no CORS)
  // wasmURL  — same, Vite handles the .wasm binary correctly
  // classWorkerURL — pure JS from unpkg, blobified to satisfy same-origin worker rule
  //
  // No SharedArrayBuffer / COOP / COEP needed — single-threaded @ffmpeg/core.
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return ffmpegRef.current

    const ff = new FFmpeg()

    ff.on('progress', ({ progress }) => {
      setExportProgress(Math.round(60 + progress * 35))
    })

    if (import.meta.env.DEV) {
      ff.on('log', ({ message }) => console.debug('[ffmpeg]', message))
    }

    // Blobify the worker JS so the browser treats it as same-origin
    const classWorkerURL = await toBlobURL(WORKER_CDN, 'text/javascript')

    // coreJsUrl and coreWasmUrl are already served from your own origin,
    // so no blobifying needed — pass them directly.
    await ff.load({
      classWorkerURL,
      coreURL: coreJsUrl,
      wasmURL: coreWasmUrl,
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

    const videoUrls = await fetchClips(projectId)
    setExportProgress(5)

    const ff = await ensureLoaded()
    setExportProgress(20)

    const fileNames = []
    for (let i = 0; i < videoUrls.length; i++) {
      const name = `clip_${i}.mp4`
      fileNames.push(name)
      await ff.writeFile(name, await fetchFile(videoUrls[i]))
      setExportProgress(Math.round(20 + ((i + 1) / videoUrls.length) * 38))
    }

    await ff.writeFile('concat.txt', fileNames.map(n => `file '${n}'`).join('\n'))

    // Stream copy — no re-encode, lossless, fast
    await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'concat.txt', '-c', 'copy', 'output.mp4'])

    setExportProgress(95)

    const data   = await ff.readFile('output.mp4')
    const blob   = new Blob([data.buffer], { type: 'video/mp4' })
    const url    = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href     = url
    anchor.download = `${slug}-cinematic.mp4`
    anchor.click()
    URL.revokeObjectURL(url)

    await Promise.allSettled(
      [...fileNames, 'concat.txt', 'output.mp4'].map(name => ff.deleteFile(name))
    )

    setExportProgress(100)
  }, [fetchClips, ensureLoaded])

  // ── Mode 2: Download all clips individually ────────────
  // No FFmpeg at all — pure fetch + download, fast.
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

      if (i < videoUrls.length - 1) await new Promise(r => setTimeout(r, 600))
    }

    setExportProgress(100)
  }, [fetchClips])

  // ── Public entry point ─────────────────────────────────
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
