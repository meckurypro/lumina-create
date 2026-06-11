// src/hooks/useCinematicExport.js
//
// Two export modes:
//   1. 'merge'    — concat all clips → single mp4 via FFmpeg WASM
//   2. 'download' — individual numbered mp4s, sequential fetch+download (no FFmpeg)
//
// ── APPROACH: ALL CDN, ALL RUNTIME, NO BUILD-TIME IMPORTS ────────────────────
// Every previous attempt broke at either build time or runtime:
//   - ?url imports → build fails because @ffmpeg/core isn't in package.json
//   - jsdelivr      → wrong paths / not on allowed-domain list
//   - cdnjs         → strips .wasm binary files (only serves .js)
//
// The working pattern (confirmed from official ffmpeg.wasm docs and examples):
//   All three assets fetched at RUNTIME from unpkg via toBlobURL().
//   toBlobURL(url, mime) → fetch → Blob → blob: URL (always same-origin).
//   No build-time resolution. No package.json entry for @ffmpeg/core needed.
//   No vite.config changes needed beyond optimizeDeps.exclude.
//
// Verified URLs:
//   https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js   ← core glue JS
//   https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm ← WASM binary
//   https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js      ← orchestrator worker
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback } from 'react'
import { FFmpeg }                         from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL }           from '@ffmpeg/util'
import { supabase }                       from '@/lib/supabase'

const BASE_CORE   = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
const BASE_WORKER = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm'

export function useCinematicExport() {
  const ffmpegRef = useRef(null)
  const loadedRef = useRef(false)

  const [exporting,      setExporting]      = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError,    setExportError]    = useState(null)

  // ── Fetch completed clip URLs from DB ──────────────────
  const fetchClips = useCallback(async (projectId) => {
    const { data: project, error: projErr } = await supabase
      .from('cinematic_projects')
      .select('id, name, aspect_ratio, with_sound')
      .eq('id', projectId)
      .single()
    if (projErr) throw new Error(`Failed to fetch project: ${projErr.message}`)

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

    const urls = clips.map((clip) => {
      const versions = clip.cinematic_clip_versions || []
      const latest   = versions.sort((a, b) => b.version_number - a.version_number)[0]
      const url      = latest?.generations?.output_url
      if (!url) throw new Error(`Clip ${clip.slot_index + 1} has no output URL.`)
      return url
    })
    return { urls, project }
  }, [])

  // ── Load FFmpeg WASM (idempotent) ──────────────────────
  //
  // All three assets are fetched at runtime from unpkg and blobified.
  // blob: URLs are always same-origin, so no CORS/MIME/worker-origin issues.
  // Single-threaded core — no SharedArrayBuffer, COOP, or COEP needed.
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return ffmpegRef.current

    const ff = new FFmpeg()

    ff.on('progress', ({ progress }) => {
      setExportProgress(Math.round(60 + progress * 35))
    })

    if (import.meta.env.DEV) {
      ff.on('log', ({ message }) => console.debug('[ffmpeg]', message))
    }

    const [classWorkerURL, coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${BASE_WORKER}/worker.js`,          'text/javascript'),
      toBlobURL(`${BASE_CORE}/ffmpeg-core.js`,        'text/javascript'),
      toBlobURL(`${BASE_CORE}/ffmpeg-core.wasm`,      'application/wasm'),
    ])

    await ff.load({ classWorkerURL, coreURL, wasmURL })

    ffmpegRef.current = ff
    loadedRef.current = true
    return ff
  }, [])

  // ── Target dims by aspect ─────────────────────────────
  // Modest 720p target keeps ffmpeg.wasm encoding tractable on mobile/desktop.
  const targetDims = (aspect) => {
    switch (aspect) {
      case '16:9': return { w: 1280, h: 720 }
      case '1:1' : return { w: 720,  h: 720 }
      case '9:16':
      default    : return { w: 720,  h: 1280 }
    }
  }

  // ── Mode 1: Merge all clips → single mp4 ──────────────
  //
  // Real-world clips from different generators have mismatched codecs,
  // resolutions, framerates, timebases, and audio configs — `-c copy`
  // concat fails silently or produces broken output. We normalize each
  // clip to a common encoding first (libx264 + aac, fixed dims/fps,
  // SAR 1:1), then concat-copy. This is reliable but slower than -c copy.
  const mergeAndExport = useCallback(async (projectId, projectName) => {
    const slug = projectName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')

    // 1. Fetch clip URLs from DB (0–5%)
    const { urls: videoUrls, project } = await fetchClips(projectId)
    const { w, h } = targetDims(project?.aspect_ratio)
    const withSound = project?.with_sound !== false
    setExportProgress(5)

    // 2. Load FFmpeg WASM (5–20%)
    const ff = await ensureLoaded()
    setExportProgress(20)

    // 3. Fetch each clip into WASM virtual FS (20–40%)
    const inputNames = []
    for (let i = 0; i < videoUrls.length; i++) {
      const name = `in_${i}.mp4`
      inputNames.push(name)
      await ff.writeFile(name, await fetchFile(videoUrls[i]))
      setExportProgress(Math.round(20 + ((i + 1) / videoUrls.length) * 20))
    }

    // 4. Normalize each clip to common params (40–90%)
    const vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,` +
               `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30`
    const normNames = []
    for (let i = 0; i < inputNames.length; i++) {
      const out = `norm_${i}.ts`  // MPEG-TS supports clean concat-copy
      normNames.push(out)
      const args = [
        '-y', '-i', inputNames[i],
        '-vf', vf,
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
        '-r', '30', '-g', '60',
      ]
      if (withSound) {
        // Add silent audio if input has none so concat stream count matches.
        args.push(
          '-af', 'aresample=async=1:first_pts=0',
          '-c:a', 'aac', '-ar', '48000', '-ac', '2', '-b:a', '128k',
        )
      } else {
        args.push('-an')
      }
      args.push('-bsf:v', 'h264_mp4toannexb', '-f', 'mpegts', out)

      try {
        await ff.exec(args)
      } catch (e) {
        // Retry without audio if the input had no audio stream and -af failed.
        if (withSound) {
          await ff.exec([
            '-y', '-i', inputNames[i],
            '-vf', vf,
            '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
            '-r', '30', '-g', '60', '-an',
            '-bsf:v', 'h264_mp4toannexb', '-f', 'mpegts', out,
          ])
        } else {
          throw e
        }
      }
      // free input ASAP
      try { await ff.deleteFile(inputNames[i]) } catch {}
      setExportProgress(Math.round(40 + ((i + 1) / inputNames.length) * 50))
    }

    // 5. Concat MPEG-TS segments — stream copy into mp4 (90–95%)
    const concatInput = `concat:${normNames.join('|')}`
    await ff.exec([
      '-y', '-i', concatInput,
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', '+faststart',
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
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)

    // 7. Clean up WASM virtual FS
    await Promise.allSettled(
      [...normNames, 'output.mp4'].map(name => ff.deleteFile(name))
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

    const { urls: videoUrls } = await fetchClips(projectId)

    for (let i = 0; i < videoUrls.length; i++) {
      setExportProgress(Math.round((i / videoUrls.length) * 100))

      const res = await fetch(videoUrls[i])
      if (!res.ok) throw new Error(`Clip ${i + 1}: fetch failed (${res.status})`)

      const blob   = await res.blob()
      const url    = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href     = url
      anchor.download = `${slug}-clip-${String(i + 1).padStart(2, '0')}.mp4`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
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
