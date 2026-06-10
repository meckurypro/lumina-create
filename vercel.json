// src/hooks/useCinematicExport.js
//
// Two export modes:
//   1. mergeAndExport  — single merged mp4 via FFmpeg WASM (single-threaded,
//                        no SharedArrayBuffer required, works with current
//                        vercel.json COEP/COOP settings)
//   2. downloadAll     — individual numbered mp4s, sequential download
//
// The exportProject function accepts a mode param:
//   exportProject(projectId, projectName, 'merge')    → merged mp4
//   exportProject(projectId, projectName, 'download') → individual files
//   exportProject(projectId, projectName)             → defaults to 'merge'

import { useRef, useState, useCallback } from 'react'
import { FFmpeg }                         from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL }           from '@ffmpeg/util'
import { supabase }                       from '@/lib/supabase'

// ── Single-threaded core — no SharedArrayBuffer needed ────
// Use @ffmpeg/core (NOT @ffmpeg/core-mt) for cross-origin compatibility
const FFMPEG_CDN = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

export function useCinematicExport() {
  const ffmpegRef  = useRef(null)
  const loadedRef  = useRef(false)

  const [exporting,      setExporting]      = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError,    setExportError]    = useState(null)

  // ── Fetch clips from DB (shared by both modes) ─────────
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

  // ── Load FFmpeg WASM single-threaded (idempotent) ──────
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return ffmpegRef.current

    const ff = new FFmpeg()

    ff.on('progress', ({ progress }) => {
      // progress covers the encode phase (60–95%)
      setExportProgress(Math.round(60 + progress * 35))
    })

    ff.on('log', ({ message }) => {
      console.debug('[ffmpeg]', message)
    })

    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${FFMPEG_CDN}/ffmpeg-core.js`,   'text/javascript'),
      toBlobURL(`${FFMPEG_CDN}/ffmpeg-core.wasm`, 'application/wasm'),
    ])

    await ff.load({ coreURL, wasmURL })

    ffmpegRef.current = ff
    loadedRef.current = true
    return ff
  }, [])

  // ── Mode 1: Merge all clips into one mp4 ──────────────
  const mergeAndExport = useCallback(async (projectId, projectName) => {
    const slug = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    // 1. Fetch clip URLs
    const videoUrls = await fetchClips(projectId)
    setExportProgress(5)

    // 2. Load FFmpeg
    const ff = await ensureLoaded()
    setExportProgress(20)

    // 3. Fetch each video into WASM virtual FS
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

    // 5. Concat — stream copy, no re-encode
    await ff.exec([
      '-f',    'concat',
      '-safe', '0',
      '-i',    'concat.txt',
      '-c',    'copy',
      'output.mp4',
    ])

    setExportProgress(95)

    // 6. Read and trigger download
    const data   = await ff.readFile('output.mp4')
    const blob   = new Blob([data.buffer], { type: 'video/mp4' })
    const url    = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href     = url
    anchor.download = `${slug}-cinematic.mp4`
    anchor.click()
    URL.revokeObjectURL(url)

    // 7. Clean up WASM virtual FS
    for (const name of fileNames) {
      try { await ff.deleteFile(name) } catch (_) {}
    }
    try { await ff.deleteFile('concat.txt') } catch (_) {}
    try { await ff.deleteFile('output.mp4') } catch (_) {}

    setExportProgress(100)
  }, [fetchClips, ensureLoaded])

  // ── Mode 2: Download all clips individually ────────────
  const downloadAll = useCallback(async (projectId, projectName) => {
    const slug = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

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
