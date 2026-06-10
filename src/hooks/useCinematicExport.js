// src/hooks/useCinematicExport.js
//
// Client-side video merge using @ffmpeg/ffmpeg WASM.
// Lazy-loads the WASM binary only when export is triggered.
// Usage:
//   const { exportProject, exporting, exportProgress, exportError } = useCinematicExport()
//   await exportProject(projectId, projectName)
//
// Requires:  npm install @ffmpeg/ffmpeg @ffmpeg/util

import { useRef, useState, useCallback } from 'react'
import { FFmpeg }                         from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL }           from '@ffmpeg/util'
import { supabase }                       from '@/lib/supabase'

// CDN base for the multi-thread WASM core (pinned version for stability)
const FFMPEG_CDN = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'

export function useCinematicExport() {
  const ffmpegRef      = useRef(null)
  const loadedRef      = useRef(false)

  const [exporting,      setExporting]      = useState(false)
  const [exportProgress, setExportProgress] = useState(0)   // 0–100
  const [exportError,    setExportError]    = useState(null)

  // ── Load FFmpeg WASM (idempotent) ────────────────────────
  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current) return ffmpegRef.current

    const ff = new FFmpeg()

    // Progress callback — split into load (0-20%) and encode (20-100%)
    ff.on('progress', ({ progress }) => {
      setExportProgress(Math.round(20 + progress * 80))
    })

    // toBlobURL fetches the asset and wraps it as a blob: URL,
    // which satisfies CORS restrictions inside the WASM sandbox.
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${FFMPEG_CDN}/ffmpeg-core.js`,   'text/javascript'),
      toBlobURL(`${FFMPEG_CDN}/ffmpeg-core.wasm`, 'application/wasm'),
    ])

    await ff.load({ coreURL, wasmURL })

    ffmpegRef.current = ff
    loadedRef.current = true
    return ff
  }, [])

  // ── Main export function ─────────────────────────────────
  const exportProject = useCallback(async (projectId, projectName = 'cinematic') => {
    setExporting(true)
    setExportProgress(0)
    setExportError(null)

    try {
      // 1. Fetch all completed clips for this project ordered by slot_index
      const { data: clips, error: clipsErr } = await supabase
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

      if (clipsErr) throw new Error(`Failed to fetch clips: ${clipsErr.message}`)
      if (!clips?.length) throw new Error('No completed clips found for this project.')

      // Resolve the latest version's output_url for each clip
      const videoUrls = clips.map((clip) => {
        const versions = clip.cinematic_clip_versions || []
        // Pick highest version_number
        const latest = versions.sort((a, b) => b.version_number - a.version_number)[0]
        const url    = latest?.generations?.output_url
        if (!url) throw new Error(`Clip ${clip.slot_index + 1} has no output URL.`)
        return url
      })

      setExportProgress(5)

      // 2. Load FFmpeg WASM
      const ff = await ensureLoaded()
      setExportProgress(20)

      // 3. Fetch each video and write into the virtual FS
      const fileNames = []
      for (let i = 0; i < videoUrls.length; i++) {
        const name = `clip_${i}.mp4`
        fileNames.push(name)
        const fileData = await fetchFile(videoUrls[i])
        await ff.writeFile(name, fileData)
        // Spread fetch progress across 20–60%
        setExportProgress(Math.round(20 + ((i + 1) / videoUrls.length) * 40))
      }

      // 4. Write the concat manifest
      const concatList = fileNames.map(n => `file '${n}'`).join('\n')
      await ff.writeFile('concat.txt', concatList)

      // 5. Run concat demuxer (lossless, no re-encode)
      //    -safe 0  → allows relative paths in the manifest
      await ff.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat.txt',
        '-c', 'copy',          // stream copy — no re-encode, fast
        'output.mp4',
      ])

      setExportProgress(95)

      // 6. Read output and trigger download
      const data   = await ff.readFile('output.mp4')
      const blob   = new Blob([data.buffer], { type: 'video/mp4' })
      const url    = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      const slug   = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      anchor.href     = url
      anchor.download = `${slug}-cinematic.mp4`
      anchor.click()
      URL.revokeObjectURL(url)

      // 7. Clean up virtual FS to free WASM heap
      for (const name of fileNames) {
        try { await ff.deleteFile(name) } catch (_) {}
      }
      try { await ff.deleteFile('concat.txt') } catch (_) {}
      try { await ff.deleteFile('output.mp4') } catch (_) {}

      setExportProgress(100)
      return true

    } catch (err) {
      console.error('[useCinematicExport]', err)
      setExportError(err.message || 'Export failed')
      return false
    } finally {
      setExporting(false)
    }
  }, [ensureLoaded])

  return { exportProject, exporting, exportProgress, exportError }
}
