// src/hooks/useCinematicExport.js
//
// Export modes:
//   'download' — individual numbered mp4s, sequential fetch+download (no FFmpeg)
//
// NOTE: 'merge' mode (FFmpeg WASM concat) is disabled — kept as dead code for
// future revival. Use 'download' mode only.

import { useRef, useState, useCallback } from 'react'
import { supabase }                       from '@/lib/supabase'

export function useCinematicExport() {
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

  // ── DISABLED: Merge & Export via FFmpeg WASM ───────────
  // Kept as reference. Do not call — FFmpeg WASM is not loaded.
  //
  // const ffmpegRef = useRef(null)
  // const loadedRef = useRef(false)
  // const BASE_CORE   = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  // const BASE_WORKER = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm'
  //
  // const ensureLoaded = useCallback(async () => { ... }, [])
  // const mergeAndExport = useCallback(async (projectId, projectName) => { ... }, [])

  // ── Mode: Download all clips individually ──────────────
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
  // 'merge' mode is disabled — both modes route to downloadAll
  const exportProject = useCallback(async (
    projectId,
    projectName = 'cinematic',
    mode = 'download',   // 'merge' silently falls through to 'download'
  ) => {
    setExporting(true)
    setExportProgress(0)
    setExportError(null)

    try {
      // NOTE: merge mode disabled — always use downloadAll
      await downloadAll(projectId, projectName)
      return true
    } catch (err) {
      console.error('[useCinematicExport]', err)
      setExportError(err.message || 'Export failed')
      return false
    } finally {
      setExporting(false)
    }
  }, [downloadAll])

  return { exportProject, exporting, exportProgress, exportError }
}
