// src/pages/CinematicResultPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams }                   from 'react-router-dom'
import { motion, AnimatePresence }                  from 'framer-motion'
import {
  ArrowLeft, Download, RefreshCw,
  ChevronDown, Film, CheckCircle, Loader2,
  AlertCircle,
} from 'lucide-react'
import {
  supabase,
  generations    as generationsDb,
  cinematicProjects,
  cinematicClips,
} from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import toast       from 'react-hot-toast'

const POLL_MS = 4000

// ── Status helpers ────────────────────────────────────────
const statusColor = (s) =>
  s === 'completed' ? '#10b981'
  : s === 'failed'  ? '#ef4444'
  : '#eab308'

const StatusIcon = ({ status, size = 16 }) => {
  if (status === 'completed') return <CheckCircle size={size} style={{ color: '#10b981' }} />
  if (status === 'failed')    return <AlertCircle  size={size} style={{ color: '#ef4444' }} />
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
    >
      <Loader2 size={size} style={{ color: '#eab308' }} />
    </motion.div>
  )
}

// ── Version Dropdown ──────────────────────────────────────
const VersionDropdown = ({ versions, activeId, onSelect }) => {
  const [open, setOpen] = useState(false)
  const active = versions.find(v => v.id === activeId)

  if (versions.length <= 1) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
      >
        v{active?.version_number ?? '?'}
        <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-1 rounded-2xl overflow-hidden z-40"
              style={{
                minWidth:   120,
                background: 'var(--bg-card)',
                border:     '1px solid var(--border-color)',
                boxShadow:  '0 8px 24px rgba(0,0,0,0.4)',
              }}
            >
              {versions.map((v, i) => (
                <button
                  key={v.id}
                  onClick={() => { onSelect(v.id); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-3"
                  style={{
                    background:   v.id === activeId ? 'var(--bg-elevated)' : 'transparent',
                    borderBottom: i < versions.length - 1 ? '1px solid var(--border-color)' : 'none',
                    color:        v.id === activeId ? 'var(--brand)' : 'var(--text-primary)',
                  }}
                >
                  <span>Version {v.version_number}</span>
                  <StatusIcon status={v.generations?.status} size={12} />
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Clip Card ─────────────────────────────────────────────
const ClipCard = ({ clip, slotIndex, activeVersionId, onVersionChange, onRegenerate, onDownloadClip }) => {
  const versions      = clip.cinematic_clip_versions || []
  const activeVersion = versions.find(v => v.id === activeVersionId)
  const gen           = activeVersion?.generations
  const status        = gen?.status || clip.status || 'pending'
  const outputUrl     = gen?.output_url

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ delay: slotIndex * 0.06 }}
      className="rounded-3xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Preview */}
      <div
        className="relative w-full flex items-center justify-center"
        style={{ aspectRatio: '9/16', background: '#000', maxHeight: 320 }}
      >
        {outputUrl ? (
          <video
            src={outputUrl}
            controls autoPlay={false} loop playsInline muted
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <StatusIcon status={status} size={32} />
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {status === 'failed' ? 'Failed' : 'Generating…'}
            </p>
          </div>
        )}

        {/* Clip label */}
        <div
          className="absolute top-3 left-3 px-2 py-1 rounded-xl text-xs font-bold"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(6px)' }}
        >
          Clip {slotIndex + 1}
        </div>

        {/* Status pill */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-xl text-xs font-bold"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', color: statusColor(status) }}
        >
          <StatusIcon status={status} size={11} />
          {status}
        </div>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2 p-3">
        <VersionDropdown
          versions={versions}
          activeId={activeVersionId}
          onSelect={(id) => onVersionChange(clip.id, id)}
        />
        <div className="flex-1" />
        {outputUrl && (
          <button
            onClick={() => onDownloadClip(outputUrl, slotIndex)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          >
            <Download size={13} />
            Save
          </button>
        )}
        <button
          onClick={() => onRegenerate(clip, slotIndex)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw size={13} />
          Redo
        </button>
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function CinematicResultPage() {
  const navigate         = useNavigate()
  const { projectId }    = useParams()
  const { user, credits, profile, isStaff, isAdmin, refreshProfile } = useAuth()

  const [project,        setProject]        = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [activeVersions, setActiveVersions] = useState({})

  const pollRef = useRef(null)

  const isPromptIQ = (isStaff || isAdmin) && project?.templates?.visibility === 'promptiq'

  // ── Load project ────────────────────────────────────────
  const loadProject = useCallback(async () => {
    const { data, error } = await cinematicProjects.getById(projectId)
    if (error || !data) { toast.error('Project not found'); navigate(-1); return }
    setProject(data)
    setLoading(false)

    setActiveVersions(prev => {
      const next = { ...prev }
      for (const clip of (data.cinematic_clips || [])) {
        if (next[clip.id]) continue
        const versions = clip.cinematic_clip_versions || []
        const active   = versions.find(v => v.is_active) || versions[0]
        if (active) next[clip.id] = active.id
      }
      return next
    })
  }, [projectId, navigate])

  useEffect(() => { loadProject() }, [loadProject])

  // ── Polling while clips are pending ─────────────────────
  useEffect(() => {
    const clips      = project?.cinematic_clips || []
    const hasPending = clips.some(c => c.status === 'pending' || c.status === 'processing')
    if (hasPending) {
      pollRef.current = setInterval(loadProject, POLL_MS)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [project, loadProject])

  // ── Version change ───────────────────────────────────────
  const handleVersionChange = (clipId, versionId) => {
    setActiveVersions(prev => ({ ...prev, [clipId]: versionId }))
  }

  // ── Single clip download ─────────────────────────────────
  const handleDownloadClip = async (url, slotIndex) => {
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `${project.name}-clip-${slotIndex + 1}.mp4`
      a.click()
      URL.revokeObjectURL(a.href)
      toast.success('Downloaded')
    } catch {
      window.open(url, '_blank')
    }
  }

  // ── DISABLED: Download Full Video via FFmpeg WASM ────────
  // FFmpeg merge is unstable — use individual clip Save buttons above instead.
  // Re-enable handleDownloadFull + DownloadOverlay + canDownloadFull CTA
  // once FFmpeg WASM concat is confirmed working in production.

  // ── Regenerate a single clip ─────────────────────────────
  const handleRegenerate = async (clip, slotIndex) => {
    if (!project || !user) return
    const dbTemplate = project.templates
    if (!dbTemplate) return toast.error('Template not found')

    const clipCreditCost = dbTemplate.credit_cost || 10
    const canAfford = isPromptIQ || credits >= clipCreditCost
    if (!canAfford) return toast.error('Not enough credits')

    try {
      const transition = clip.cinematic_transitions
      const prompt     = transition?.prompt_text || ''

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:             user.id,
        template_id:         dbTemplate.id,
        generation_type:     'start_end_frame',
        status:              'pending',
        prompt,
        model:               dbTemplate.default_model || 'kling_2_5',
        aspect_ratio:        project.aspect_ratio,
        duration:            clip.duration,
        credits_charged:     isPromptIQ ? 0 : clipCreditCost,
        is_staff_generation: isPromptIQ,
        with_sound:          project.with_sound,
        start_frame_url:     clip.start_frame_url,
        end_frame_url:       clip.end_frame_url,
        output_type:         'video',
        title:               `${project.name} — Clip ${slotIndex + 1} (redo)`,
      })
      if (genErr || !genRow) throw new Error('Failed to create generation')

      if (isPromptIQ) {
        const { data: pool } = await supabase.rpc('deduct_staff_pool', {
          p_staff_id:      user.id,
          p_generation_id: genRow.id,
          p_amount:        clipCreditCost,
          p_template_id:   dbTemplate.id,
        })
        if (!pool?.success) throw new Error(pool?.error || 'Pool error')
      } else {
        const { data: deduct } = await generationsDb.deductCredits(user.id, clipCreditCost, genRow.id)
        if (!deduct?.success) throw new Error(deduct?.error || 'Insufficient credits')
      }

      const versions    = clip.cinematic_clip_versions || []
      const nextVersion = (versions.length || 0) + 1
      await cinematicClips.addVersion(clip.id, genRow.id, nextVersion)
      await cinematicClips.update(clip.id, { status: 'processing' })

      supabase.functions.invoke('video-generate', { body: { generationId: genRow.id } })
        .catch(e => console.error('regen invoke error', e))

      refreshProfile()
      toast.success(`Clip ${slotIndex + 1} regenerating…`)
      await loadProject()

    } catch (err) {
      toast.error(err.message || 'Regeneration failed')
    }
  }

  // ── Render ───────────────────────────────────────────────
 if (loading) return (
    <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
        className="w-8 h-8 rounded-full border-2"
        style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'var(--brand)' }}
      />
    </div>
  )

  const clips      = [...(project?.cinematic_clips || [])].sort((a, b) => a.slot_index - b.slot_index)
  const allDone    = clips.length > 0 && clips.every(c => c.status === 'completed')
  const anyPending = clips.some(c => c.status === 'pending' || c.status === 'processing')

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14"
        style={{
          background:           'color-mix(in srgb, var(--bg-primary) 90%, transparent)',
          backdropFilter:       'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderBottom:         '1px solid var(--border-color)',
        }}
      >
        <button
          onClick={() => navigate('/create/cinematic-transition')}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-black truncate" style={{ color: 'var(--text-primary)' }}>
            {project?.name}
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {anyPending
              ? `Processing ${clips.filter(c => c.status !== 'completed').length} clip(s)…`
              : allDone
              ? `${clips.length} clip${clips.length !== 1 ? 's' : ''} ready`
              : `${clips.length} clip${clips.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {allDone && (
          <span
            className="text-xs px-2 py-1 rounded-full font-bold"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
          >
            Complete
          </span>
        )}
      </div>

      {/* Clips */}
      <div
        className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-5"
        style={{ paddingBottom: 'calc(var(--bottom-nav-height) + 32px)' }}
      >
        {clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Film size={32} style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No clips yet</p>
          </div>
        ) : (
          clips.map((clip, i) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              slotIndex={i}
              activeVersionId={activeVersions[clip.id]}
              onVersionChange={handleVersionChange}
              onRegenerate={handleRegenerate}
              onDownloadClip={handleDownloadClip}
            />
          ))
        )}

        <button
          onClick={() => navigate('/create/cinematic-transition')}
          className="w-full text-center text-xs py-3"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back to projects
        </button>
      </div>

      {/* ── DISABLED: Download Full Video CTA (FFmpeg WASM merge) ──────────────
      Removed until FFmpeg WASM concat is stable in production.
      Individual clip Save buttons above remain fully functional.

      <AnimatePresence>
        {canDownloadFull && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0  }}
            exit={{    opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="fixed left-0 right-0 px-4 pt-3"
            style={{
              bottom:        'calc(56px + env(safe-area-inset-bottom, 0px))',
              background:    'var(--bg-primary)',
              borderTop:     '1px solid var(--border-color)',
              paddingBottom: '12px',
              zIndex:        20,
            }}
          >
            <div className="mx-auto max-w-xl">
              <button
                onClick={handleDownloadFull}
                disabled={downloading}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
                style={{
                  background: 'var(--gradient-brand)',
                  color:      '#ffffff',
                  opacity:    downloading ? 0.5 : 1,
                }}
              >
                <Clapperboard size={15} />
                Download Full Video · {clips.length} clip{clips.length !== 1 ? 's' : ''}
              </button>
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Clips stitched locally in your browser via FFmpeg
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      ── END DISABLED ── */}

    </div>
  )
}
