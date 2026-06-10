// src/pages/CinematicTransitionPage.jsx
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate, useLocation }                          from 'react-router-dom'
import { motion, AnimatePresence }                           from 'framer-motion'
import { ArrowLeft, Plus, Trash2, ChevronDown, Zap, Film, Settings2 } from 'lucide-react'
import { useAuth }                                           from '@/context/AuthContext'
import { promptiqAccess }                                    from '@/lib/promptiq'
import {
  supabase,
  templates      as templatesDb,
  generations    as generationsDb,
  cinematicProjects,
  cinematicClips,
  cinematicTransitions,
} from '@/lib/supabase'
import { TopBar }      from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────
const SLUG      = 'cinematic-transition'
const TOOL_KEY  = 'cinematic_transition'
const ASPECT_OPTS = ['9:16', '16:9', '1:1']

// ── Credit cost helper (mirrors CreateVideoPage logic) ────
//
// frame_to_frame models bill as:
//   credit_cost_per_second × max(duration, min_billable_seconds)
//
// Some older/flat-rate models may fall back to credit_cost_t2i.
// We never fall below 1 credit.
function deriveClipCost(model, durationStr) {
  if (!model) return 0
  const dur = parseInt(durationStr || '5', 10)

  if (model.credit_cost_per_second) {
    const billable = Math.max(dur, model.min_billable_seconds ?? 1)
    return Math.ceil(model.credit_cost_per_second * billable)
  }

  // flat-rate fallback (e.g. hailuo_02_pro, veo3_1_lite_s2e)
  if (model.is_flat_rate) {
    return model.credit_cost_t2i || model.credit_cost_i2i || 0
  }

  // last-resort: t2i cost × duration
  const cps = model.credit_cost_t2i || model.credit_cost_i2i || 0
  return Math.ceil(cps * dur)
}

// ── Helpers ───────────────────────────────────────────────
const uploadFile = async (file, userId) => {
  const contentType =
    file.type && file.type !== '' ? file.type
    : file.name?.match(/\.png$/i)  ? 'image/png'
    : file.name?.match(/\.webp$/i) ? 'image/webp'
    : 'image/jpeg'
  const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const path = `${userId}/cinematic/${crypto.randomUUID()}.${ext}`
  const { data, error } = await supabase.storage
    .from('generation-uploads')
    .upload(path, file, { upsert: false, cacheControl: '3600', contentType })
  if (error) throw new Error(`Upload failed: ${error.message}`)
  return supabase.storage.from('generation-uploads').getPublicUrl(data.path).data.publicUrl
}

const detectAspectRatio = (file) =>
  new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight
      if (ratio > 1.2)       resolve('16:9')
      else if (ratio < 0.85) resolve('9:16')
      else                   resolve('1:1')
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => resolve('9:16')
    img.src = URL.createObjectURL(file)
  })

const useDebounce = (fn, delay) => {
  const timer = useRef(null)
  return useCallback((...args) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay])
}

// ── Sub-components ────────────────────────────────────────

const FrameSlot = ({ index, frame, onUpload, onRemove }) => (
  <div className="flex flex-col items-center gap-1.5">
    <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
      Frame {index + 1}
    </p>
    {frame?.url ? (
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ width: 80, height: 80, background: 'var(--bg-elevated)', flexShrink: 0 }}
      >
        {frame.uploading && (
          <div className="absolute inset-0 flex items-center justify-center z-10"
               style={{ background: 'rgba(0,0,0,0.5)' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              className="w-5 h-5 rounded-full border-2"
              style={{ borderColor: 'rgba(255,255,255,0.2)', borderTopColor: '#fff' }}
            />
          </div>
        )}
        <img src={frame.url} alt={`frame ${index + 1}`} className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
        >
          ✕
        </button>
      </div>
    ) : (
      <label
        className="flex flex-col items-center justify-center rounded-2xl cursor-pointer"
        style={{
          width: 80, height: 80, flexShrink: 0,
          border:     '1.5px dashed var(--border-color)',
          background: 'var(--bg-card)',
        }}
      >
        <input
          type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
        />
        <Plus size={20} style={{ color: 'var(--text-muted)' }} />
      </label>
    )}
  </div>
)

const TransitionPicker = ({ value, transitions, onChange }) => {
  const [open, setOpen] = useState(false)
  const selected = transitions.find(t => t.id === value)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex-1 flex items-center justify-between gap-1 px-3 py-2 rounded-xl text-xs font-semibold"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
          minWidth: 0,
        }}
      >
        <span className="truncate">{selected?.name || 'Select transition'}</span>
        <ChevronDown size={12} style={{ flexShrink: 0 }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 360 }}
              className="w-full rounded-t-3xl flex flex-col"
              style={{
                background: 'var(--bg-card)',
                border:     '1px solid var(--border-color)',
                maxHeight:  '75dvh',
                paddingBottom: 'env(safe-area-inset-bottom, 16px)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col items-center px-4 pt-3 pb-2 flex-shrink-0">
                <div className="w-10 h-1 rounded-full mb-3" style={{ background: 'var(--border-color)' }} />
                <div className="flex items-center justify-between w-full">
                  <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>Select Transition</p>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto flex flex-col gap-2 px-4 pb-4 pt-2">
                {transitions.map((t) => {
                  const isSelected = t.id === value
                  return (
                    <button
                      key={t.id}
                      onClick={() => { onChange(t.id); setOpen(false) }}
                      className="w-full text-left px-4 py-4 rounded-2xl flex items-center justify-between gap-3"
                      style={{
                        background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-primary)',
                        border:     `1px solid ${isSelected ? 'var(--brand)' : 'var(--border-color)'}`,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate"
                           style={{ color: isSelected ? 'var(--brand)' : 'var(--text-primary)' }}>
                          {t.name}
                        </p>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                             style={{ background: 'var(--brand)' }}>
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5"
                                  strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

const DurationPicker = ({ value, options, onChange }) => (
  <div className="flex gap-1.5 flex-wrap">
    {options.map(d => (
      <button
        key={d}
        onClick={() => onChange(d)}
        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
        style={{
          background: value === d ? 'var(--brand)' : 'var(--bg-elevated)',
          color:      value === d ? '#fff'          : 'var(--text-muted)',
        }}
      >
        {d}s
      </button>
    ))}
  </div>
)

// ── Model Picker (dropdown, mirrors CreateVideoPage style) ─
const ModelPicker = ({ models, value, onChange }) => {
  const [open, setOpen] = useState(false)
  const selected = models.find(m => m.value === value) || models[0]
  if (!models.length) return null

  return (
    <div className="relative">
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Model</p>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
      >
        <span>{selected?.aka || selected?.label || 'Model'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d={open ? 'M2 7l3-4 3 4' : 'M2 3l3 4 3-4'}
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute left-0 top-10 z-50 w-64 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}
            >
              <div className="py-1">
                {models.map(m => (
                  <button
                    key={m.value}
                    onClick={() => { onChange(m.value); setOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                    style={{ background: m.value === value ? 'var(--bg-elevated)' : 'transparent' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {m.aka || m.label}
                      </p>
                      {m.sublabel && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.sublabel}</p>
                      )}
                    </div>
                    {m.value === value && (
                      <span style={{ color: 'var(--brand)', fontSize: 14 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Project List View ─────────────────────────────────────
const ProjectList = ({ projects, onNew, onOpen, loading }) => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between pt-2 pb-2">
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Cinematic</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Your transition projects</p>
      </div>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold text-white brand-gradient"
      >
        <Plus size={15} />
        New
      </button>
    </div>

    {loading ? (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-2xl" style={{ background: 'var(--bg-card)' }} />
        ))}
      </div>
    ) : projects.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
             style={{ background: 'var(--bg-elevated)' }}>
          <Film size={24} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No projects yet</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tap New to get started</p>
      </div>
    ) : (
      <div className="flex flex-col gap-3">
        {projects.map((p, i) => (
          <motion.button
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onOpen(p)}
            className="flex items-center gap-3 p-4 rounded-2xl text-left w-full"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0"
                 style={{ background: 'var(--bg-elevated)' }}>
              <Film size={20} style={{ color: 'var(--brand)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {p.status === 'draft'       ? 'Draft'
                : p.status === 'processing' ? 'Processing…'
                : 'Completed'}
                {' · '}
                {new Date(p.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </p>
            </div>
            <div
              className="text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0"
              style={{
                background: p.status === 'completed'  ? 'rgba(16,185,129,0.12)'
                          : p.status === 'processing' ? 'rgba(234,179,8,0.12)'
                          : 'var(--bg-elevated)',
                color:      p.status === 'completed'  ? '#10b981'
                          : p.status === 'processing' ? '#eab308'
                          : 'var(--text-muted)',
              }}
            >
              {p.status}
            </div>
          </motion.button>
        ))}
      </div>
    )}
  </div>
)

// ── New Project Modal ─────────────────────────────────────
const NewProjectModal = ({ onConfirm, onClose, loading }) => {
  const [name, setName] = useState('')
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{    y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full rounded-t-3xl p-6 pb-10"
        style={{ background: 'var(--bg-card)', maxWidth: 480, border: '1px solid var(--border-color)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>
        <p className="text-base font-black mb-4" style={{ color: 'var(--text-primary)' }}>New Project</p>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          placeholder="Project name…"
          className="w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none mb-4"
          style={{
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          }}
        />
        <button
          onClick={() => name.trim() && onConfirm(name.trim())}
          disabled={!name.trim() || loading}
          className="w-full py-4 rounded-2xl text-sm font-bold text-white brand-gradient"
          style={{ opacity: !name.trim() || loading ? 0.5 : 1 }}
        >
          {loading ? 'Creating…' : 'Create Project'}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Swap Icon ─────────────────────────────────────────────
const SwapIcon = ({ size = 14, color = 'var(--text-muted)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
)

// ── Editor View ───────────────────────────────────────────
const EditorView = ({
  project, frames, setFrames,
  transitions, slots, setSlots,
  aspectRatio, setAspectRatio,
  withSound, setWithSound,
  model, setModel,
  availableModels,
  selectedModel,          // full model row
  credits, isFree,
  onGenerate, onFrameUpload, submitting, onBack,
}) => {
  // Per-clip cost derived from the selected model + each slot's duration
  const perClipCosts = slots.map(s => deriveClipCost(selectedModel, s.duration))
  const totalCost    = perClipCosts.reduce((a, b) => a + b, 0)

  const clipCount    = frames.length - 1
  const canAfford    = isFree || credits >= totalCost
  const anyUploading = frames.some(f => f?.uploading)

  const canGenerate = frames.length >= 2
    && frames.every(f => f?.url)
    && slots.every(s => s.transitionId && s.duration)
    && canAfford
    && !submitting
    && !anyUploading

  // Duration options from the selected model, fallback to sensible defaults
  const durationOptions = selectedModel?.supported_durations?.length
    ? selectedModel.supported_durations
    : ['3', '5', '8', '10']

  // When model changes, clamp existing slot durations to valid options
  useEffect(() => {
    if (!durationOptions.length) return
    setSlots(prev => prev.map(s => ({
      ...s,
      duration: durationOptions.includes(s.duration) ? s.duration : durationOptions[0],
    })))
  }, [model]) // eslint-disable-line

  const addFrame = () => {
    setFrames(prev => [...prev, null])
    setSlots(prev => [...prev, {
      transitionId: prev[0]?.transitionId || null,
      duration: durationOptions[0] || '5',
    }])
  }

  const removeFrame = (idx) => {
    if (frames.length <= 2) return
    setFrames(prev => prev.filter((_, i) => i !== idx))
    setSlots(prev => {
      const next = [...prev]
      next.splice(idx === 0 ? 0 : idx - 1, 1)
      return next.slice(0, frames.length - 2)
    })
  }

  return (
    <div className="relative min-h-full" style={{ background: 'var(--bg-primary)' }}>

      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: '#ffffff' }}
            />
            <p className="text-sm font-semibold tracking-wide text-white">Firing clips…</p>
            <p className="text-xs text-center px-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Dispatching {clipCount} clip{clipCount !== 1 ? 's' : ''} to the model
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <button onClick={onBack} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {project.name}
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {anyUploading ? 'Saving frames…'
              : clipCount > 0 ? `${clipCount} clip${clipCount !== 1 ? 's' : ''}`
              : 'Add frames below'}
          </p>
        </div>
        {isFree ? (
          <span className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white brand-gradient">
            <Zap size={10} /> Free
          </span>
        ) : (
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {totalCost} cr
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-6"
        style={{ paddingBottom: 'calc(80px + var(--bottom-nav-height))' }}
      >
        {/* Settings card */}
        <div
          className="flex flex-col gap-4 p-4 rounded-2xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Settings2 size={14} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Settings
            </p>
          </div>

          {/* Model picker */}
          <ModelPicker value={model} models={availableModels} onChange={setModel} />

          {/* Aspect ratio */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>Aspect ratio</p>
            <div className="flex gap-2">
              {ASPECT_OPTS.map(a => (
                <button
                  key={a}
                  onClick={() => setAspectRatio(a)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: aspectRatio === a ? 'var(--brand)' : 'var(--bg-elevated)',
                    color:      aspectRatio === a ? '#fff'         : 'var(--text-muted)',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Sound toggle — only when model supports it */}
          {selectedModel?.supports_sound && (
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Audio</p>
              <button
                onClick={() => setWithSound(v => !v)}
                className="relative w-10 h-5 rounded-full transition-all"
                style={{ background: withSound ? 'var(--brand)' : 'var(--bg-elevated)' }}
              >
                <motion.div
                  animate={{ x: withSound ? 20 : 2 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                  className="absolute top-0.5 w-4 h-4 rounded-full"
                  style={{ background: '#fff' }}
                />
              </button>
            </div>
          )}
        </div>

        {/* Frame + Transition chain */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Frames & Transitions
          </p>

          {frames.map((frame, idx) => (
            <div key={idx}>
              <div
                className="flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <FrameSlot
                  index={idx}
                  frame={frame}
                  onUpload={(file) => onFrameUpload(file, idx)}
                  onRemove={() => setFrames(prev => prev.map((f, i) => i === idx ? null : f))}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Frame {idx + 1}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {frame?.uploading ? 'Uploading…'
                      : frame?.url   ? 'Saved'
                      : idx === 0    ? 'Sets aspect ratio'
                      : 'Tap to upload image'}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <label
                    className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                    title="Swap image"
                  >
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) onFrameUpload(f, idx) }} />
                    <SwapIcon />
                  </label>
                  {idx > 1 && (
                    <button
                      onClick={() => removeFrame(idx)}
                      className="w-8 h-8 flex items-center justify-center rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.08)' }}
                    >
                      <Trash2 size={14} style={{ color: '#ef4444' }} />
                    </button>
                  )}
                </div>
              </div>

              {idx < frames.length - 1 && slots[idx] && (
                <div
                  className="flex items-center gap-2 px-3 py-2 mx-4 rounded-xl my-1"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <div className="w-0.5 self-stretch rounded-full mx-1" style={{ background: 'var(--border-color)' }} />
                  <TransitionPicker
                    value={slots[idx]?.transitionId}
                    transitions={transitions}
                    onChange={(id) =>
                      setSlots(prev => prev.map((s, i) => i === idx ? { ...s, transitionId: id } : s))
                    }
                  />
                  {/* Per-slot duration + live cost badge */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <DurationPicker
                      value={slots[idx]?.duration || durationOptions[0]}
                      options={durationOptions}
                      onChange={(d) =>
                        setSlots(prev => prev.map((s, i) => i === idx ? { ...s, duration: d } : s))
                      }
                    />
                    {!isFree && (
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                        {perClipCosts[idx] ?? 0} cr
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          <button
            onClick={addFrame}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-bold transition-all"
            style={{ border: '1.5px dashed var(--border-color)', color: 'var(--text-muted)', background: 'transparent' }}
          >
            <Plus size={16} />
            Add Frame
          </button>
        </div>
      </div>

      {/* Generate bar */}
      <div
        className="fixed left-0 right-0 px-4 pt-3"
        style={{
          bottom:        'var(--bottom-nav-height)',
          background:    'var(--bg-primary)',
          borderTop:     '1px solid var(--border-color)',
          paddingBottom: '12px',
        }}
      >
        <div className="mx-auto max-w-xl">
          <button
            onClick={onGenerate}
            disabled={!canGenerate}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: 'var(--text-primary)',
              color:      'var(--text-inverse)',
              opacity:    !canGenerate ? 0.5 : 1,
            }}
          >
            <Zap size={15} fill="currentColor" />
            {submitting      ? 'Firing clips…'
              : anyUploading ? 'Saving frames…'
              : isFree        ? `Generate ${clipCount} clip${clipCount !== 1 ? 's' : ''}  ·  Free`
              : `Generate ${clipCount} clip${clipCount !== 1 ? 's' : ''}  ·  ${totalCost} cr`}
          </button>
          {!canAfford && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button className="font-semibold" style={{ color: 'var(--text-primary)' }}>Top up</button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function CinematicTransitionPage() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user, credits, profile, refreshProfile } = useAuth()

  const cameFromPromptIQ = location.state?.isPromptIQ === true

  const [view,            setView]           = useState('list')
  const [projects,        setProjects]       = useState([])
  const [activeProject,   setActiveProject]  = useState(null)
  const [transitions,     setTransitions]    = useState([])
  const [availableModels, setAvailableModels] = useState([])
  const [dbTemplate,      setDbTemplate]     = useState(null)
  const [isFree,          setIsFree]         = useState(false)
  const [loadingProj,     setLoadingProj]    = useState(true)
  const [creatingProj,    setCreatingProj]   = useState(false)
  const [showNewModal,    setShowNewModal]   = useState(false)
  const [submitting,      setSubmitting]     = useState(false)

  // Editor state
  const [frames,      setFrames]      = useState([null, null])
  const [slots,       setSlots]       = useState([{ transitionId: null, duration: '5' }])
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [withSound,   setWithSound]   = useState(false)
  const [model,       setModel]       = useState('')

  // Derived: full model row for the currently selected model
  const selectedModel = useMemo(
    () => availableModels.find(m => m.value === model) || null,
    [availableModels, model],
  )

  // ── Load everything on mount ──────────────────────────
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [
        { data: tmpl },
        { data: trans },
        { data: projs },
        { data: modelRows },
        { data: grant },
      ] = await Promise.all([
        templatesDb.getBySlug(SLUG),
        cinematicTransitions.getActive(),
        cinematicProjects.getForUser(user.id),
        // Fetch ALL columns so deriveClipCost has what it needs
        supabase
          .from('models')
          .select('*')
          .eq('feature', 'frame_to_frame')
          .eq('is_active', true)
          .eq('is_user_facing', true)
          .order('sort_order', { ascending: true }),
        supabase.rpc('get_staff_tool_access', {
          p_staff_id:        user.id,
          p_tool_identifier: TOOL_KEY,
        }),
      ])

      setDbTemplate(tmpl || null)
      setTransitions(trans || [])
      setProjects(projs || [])

      const modelList = modelRows || []
      setAvailableModels(modelList)
      setModel(modelList[0]?.value || tmpl?.default_model || '')

      const accessGrant = grant || {}
      setIsFree(cameFromPromptIQ && accessGrant.has_access === true && accessGrant.is_free === true)

      setLoadingProj(false)
    })()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save draft ───────────────────────────────────
  const activeProjectRef = useRef(null)
  useEffect(() => { activeProjectRef.current = activeProject }, [activeProject])

  const persistDraft = useCallback(async (frameUrls, slotsVal, ar, ws) => {
    const proj = activeProjectRef.current
    if (!proj) return
    try {
      await cinematicProjects.update(proj.id, {
        draft_state: { frameUrls, slots: slotsVal, aspectRatio: ar, withSound: ws, model },
      })
    } catch (e) {
      console.warn('Draft save failed:', e)
    }
  }, [model])

  const debouncedPersist = useDebounce(persistDraft, 800)

  const isMounted = useRef(false)
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return }
    if (view !== 'editor') return
    const frameUrls = frames.map(f => f?.url || null)
    debouncedPersist(frameUrls, slots, aspectRatio, withSound)
  }, [frames, slots, aspectRatio, withSound, model]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Frame upload ──────────────────────────────────────
  const handleFrameUpload = useCallback(async (file, idx) => {
    const blobUrl = URL.createObjectURL(file)
    setFrames(prev => prev.map((f, i) => i === idx ? { url: blobUrl, uploading: true } : f))

    const [realUrl, detectedAR] = await Promise.all([
      uploadFile(file, user.id),
      idx === 0 ? detectAspectRatio(file) : Promise.resolve(null),
    ])

    URL.revokeObjectURL(blobUrl)
    setFrames(prev => prev.map((f, i) => i === idx ? { url: realUrl, uploading: false } : f))
    if (detectedAR) setAspectRatio(detectedAR)
  }, [user])

  // ── New project ───────────────────────────────────────
  const handleNewProject = async (name) => {
    if (!user || !dbTemplate) return
    setCreatingProj(true)
    try {
      const { data, error } = await cinematicProjects.create({
        user_id:      user.id,
        template_id:  dbTemplate.id,
        name,
        status:       'draft',
        aspect_ratio: '9:16',
        with_sound:   false,
      })
      if (error || !data) throw new Error(error?.message || 'Failed to create project')
      setProjects(prev => [data, ...prev])
      openEditor(data)
      setShowNewModal(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCreatingProj(false)
    }
  }

  // ── Open project ──────────────────────────────────────
  const openEditor = (project) => {
    isMounted.current = false
    const draft = project.draft_state

    if (draft?.frameUrls?.length >= 2) {
      setFrames(draft.frameUrls.map(url => url ? { url, uploading: false } : null))
      setSlots(draft.slots?.length ? draft.slots : [{ transitionId: null, duration: '5' }])
      setAspectRatio(draft.aspectRatio || '9:16')
      setWithSound(draft.withSound ?? false)
      const savedModel = draft.model
      setModel(prev => {
        const stillAvailable = availableModels.some(m => m.value === savedModel)
        return stillAvailable ? savedModel : (availableModels[0]?.value || dbTemplate?.default_model || prev)
      })
    } else {
      setFrames([null, null])
      setSlots([{ transitionId: null, duration: '5' }])
      setAspectRatio(project.aspect_ratio || '9:16')
      setWithSound(project.with_sound || false)
      setModel(availableModels[0]?.value || dbTemplate?.default_model || '')
    }

    setActiveProject(project)
    setView('editor')
  }

  // ── Generate ──────────────────────────────────────────
  const handleGenerate = async () => {
    if (!activeProject || !user || !dbTemplate) return
    if (!selectedModel) return toast.error('No model selected')

    const clipCount = frames.length - 1
    setSubmitting(true)

    try {
      const uploadedUrls = frames.map(f => f?.url || null)

      await cinematicProjects.update(activeProject.id, {
        status:       'processing',
        aspect_ratio: aspectRatio,
        with_sound:   withSound,
      })

      const clipRows = slots.map((slot, idx) => ({
        project_id:      activeProject.id,
        slot_index:      idx,
        start_frame_url: uploadedUrls[idx],
        end_frame_url:   uploadedUrls[idx + 1],
        transition_id:   slot.transitionId,
        duration:        slot.duration,
        status:          'processing',
      }))
      const { data: savedClips, error: clipErr } = await cinematicClips.upsertForProject(clipRows)
      if (clipErr || !savedClips) throw new Error('Failed to save clips')

      const transitionMap = {}
      transitions.forEach(t => { transitionMap[t.id] = t.prompt_text })

      await Promise.all(
        savedClips.map(async (clip, idx) => {
          // ── Per-clip cost — derived from model + duration ──
          const clipCreditCost = deriveClipCost(selectedModel, slots[idx].duration)
          const transitionPrompt = transitionMap[slots[idx].transitionId] || ''

          const { data: genRow, error: genErr } = await generationsDb.create({
            user_id:             user.id,
            template_id:         dbTemplate.id,
            generation_type:     'start_end_frame',
            status:              'pending',
            prompt:              transitionPrompt,
            model:               model,
            aspect_ratio:        aspectRatio,
            duration:            slots[idx].duration,
            credits_charged:     isFree ? 0 : clipCreditCost,
            is_staff_generation: isFree,
            with_sound:          withSound,
            start_frame_url:     clip.start_frame_url,
            end_frame_url:       clip.end_frame_url,
            output_type:         'video',
            title:               `${activeProject.name} — Clip ${idx + 1}`,
          })
          if (genErr || !genRow) throw new Error(`Clip ${idx + 1}: failed to create generation`)

          if (isFree) {
            const { data: poolResult } = await supabase.rpc('deduct_staff_pool', {
              p_staff_id:      user.id,
              p_generation_id: genRow.id,
              p_amount:        clipCreditCost,
              p_template_id:   dbTemplate.id,
            })
            if (!poolResult?.success) throw new Error(`Clip ${idx + 1}: pool error — ${poolResult?.error}`)
          } else {
            const { data: deduct } = await generationsDb.deductCredits(user.id, clipCreditCost, genRow.id)
            if (!deduct?.success) throw new Error(`Clip ${idx + 1}: ${deduct?.error || 'Insufficient credits'}`)
          }

          const prevVersions = (savedClips[idx]?.cinematic_clip_versions?.length || 0)
          await cinematicClips.addVersion(clip.id, genRow.id, prevVersions + 1)
          await cinematicClips.update(clip.id, { status: 'processing' })

          supabase.functions.invoke('video-generate', { body: { generationId: genRow.id } })
            .catch(e => console.error(`video-generate clip ${idx + 1} error`, e))
        })
      )

      refreshProfile()
      toast.success(`${clipCount} clip${clipCount !== 1 ? 's' : ''} fired! Redirecting…`, { duration: 3000 })
      setTimeout(() => navigate(`/cinematic/${activeProject.id}`), 800)

    } catch (err) {
      toast.error(err.message || 'Generation failed')
      await cinematicProjects.update(activeProject.id, { status: 'draft' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────
  if (view === 'editor' && activeProject) {
    return (
      <EditorView
        project={activeProject}
        frames={frames}             setFrames={setFrames}
        transitions={transitions}
        slots={slots}               setSlots={setSlots}
        aspectRatio={aspectRatio}   setAspectRatio={setAspectRatio}
        withSound={withSound}       setWithSound={setWithSound}
        model={model}               setModel={setModel}
        availableModels={availableModels}
        selectedModel={selectedModel}
        credits={credits}
        isFree={isFree}
        onGenerate={handleGenerate}
        onFrameUpload={handleFrameUpload}
        submitting={submitting}
        onBack={() => setView('list')}
      />
    )
  }

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>
        <ProjectList
          projects={projects}
          loading={loadingProj}
          onNew={() => setShowNewModal(true)}
          onOpen={openEditor}
        />
      </PageWrapper>

      <AnimatePresence>
        {showNewModal && (
          <NewProjectModal
            onConfirm={handleNewProject}
            onClose={() => setShowNewModal(false)}
            loading={creatingProj}
          />
        )}
      </AnimatePresence>
    </>
  )
}
