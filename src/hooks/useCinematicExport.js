// src/hooks/useCinematicExport.js
//
// Downloads all completed clips as individual numbered files.
// FFmpeg WASM approach was dropped — requires SharedArrayBuffer/COOP headers
// that Vercel does not serve, causing consistent load failures.

import { useState, useCallback } from 'react'
import { supabase }              from '@/lib/supabase'

export function useCinematicExport() {
  const [exporting,      setExporting]      = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportError,    setExportError]    = useState(null)

  const exportProject = useCallback(async (projectId, projectName = 'cinematic') => {
    setExporting(true)
    setExportProgress(0)
    setExportError(null)

    try {
      // 1. Fetch completed clips ordered by slot_index
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

      // 2. Resolve latest version output_url per clip
      const videoUrls = clips.map((clip) => {
        const versions = clip.cinematic_clip_versions || []
        const latest   = versions.sort((a, b) => b.version_number - a.version_number)[0]
        const url      = latest?.generations?.output_url
        if (!url) throw new Error(`Clip ${clip.slot_index + 1} has no output URL.`)
        return url
      })

      const slug = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

      // 3. Download each clip sequentially with progress
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

        // Small delay between downloads so browser doesn't block them
        if (i < videoUrls.length - 1) await new Promise(r => setTimeout(r, 600))
      }

      setExportProgress(100)
      return true

    } catch (err) {
      console.error('[useCinematicExport]', err)
      setExportError(err.message || 'Export failed')
      return false
    } finally {
      setExporting(false)
    }
  }, [])

  return { exportProject, exporting, exportProgress, exportError }
}
