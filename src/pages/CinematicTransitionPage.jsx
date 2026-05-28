// src/pages/CinematicTransitionPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate }                 from 'react-router-dom'
import { motion, AnimatePresence }     from 'framer-motion'
import { ArrowLeft, Plus, Trash2, ChevronDown, Zap, Film, Settings2 } from 'lucide-react'
import { useAuth }                     from '@/context/AuthContext'
import {
  supabase,
  templates      as templatesDb,
  generations    as generationsDb,
  cinematicProjects,
  cinematicClips,
  cinematicTransitions,
} from '@/lib/supabase'
import { TopBar }     from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────
const SLUG        = 'cinematic-transition'
const DURATIONS   = ['3', '5', '8', '10']
const ASPECT_OPTS = ['9:16', '16:9', '1:1']

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

/**
 * Reads the natural dimensions of a File/Blob and snaps to the
 * nearest supported aspect ratio: '9:16' | '16:9' | '1:1'
 */
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

// ── Sub-components ────────────────────────────────────────

/**
 * FrameSlot — thumbnail or empty upload zone.
 * The ✕ clear button is kept here only for quickly clearing an
 * accidentally uploaded image. Swap + delete live in the frame row.
 */
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
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', minWidth: 0 }}
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
                        <p className="text-sm font-bold truncate" style={{ color: isSelected ? 'var(--brand)' : 'var(--text-primary)' }}>
                          {t.name}
                        </p>
                      </div>
                      {isSelected && (
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--brand)' }}
                        >
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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

const DurationPicker = ({ value, onChange }) => (
  <div className="flex gap-1.5 flex-wrap">
    {DURATIONS.map(d => (
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
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-elevated)' }}>
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
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <Film size={20} style={{ color: 'var(--brand)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {p.status === 'draft' ? 'Draft' : p.status === 'processing' ? 'Processing…' : 'Completed'}
                {' · '}
                {new Date(p.updated_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </p>
            </div>
            <div
              className="text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0"
              style={{
                background: p.status === 'completed' ? 'rgba(16,185,129,0.12)'
                          : p.status === 'processing' ? 'rgba(234,179,8,0.12)'
                          : 'var(--bg-elevated)',
                color:      p.status === 'completed' ? '#10b981'
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
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
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

// ── Swap Icon SVG ─────────────────────────────────────────
const SwapIcon = ({ size = 14, color = 'var(--text-muted)' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6" />
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M3 22v-6h6" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
)

// ── Editor View ───────────────────────────────────────────
const EditorView = ({
  project, frames, setFrames,
  transitions, slots, setSlots,
  aspectRatio, setAspectRatio,
  withSound, setWithSound,
  creditCost, credits, isPromptIQ,
  onGenerate, submitting, onBack,
}) => {
  const firstFrameUploaded = !!frames[0]?.url
  const canAfford    = isPromptIQ || credits >= creditCost * slots.length
  const clipCount    = frames.length - 1
  const canGenerate  = frames.length >= 2
    && frames.every(f => f?.url)
    && slots.every(s => s.transitionId && s.duration)
    && canAfford
    && !submitting

  const addFrame = () => {
    const newFrames = [...frames, null]
    setFrames(newFrames)
    setSlots(prev => [...prev, { transitionId: prev[0]?.transitionId || null, duration: '5' }])
  }

  const removeFrame = (idx) => {
    if (frames.length <= 2) return
    const newFrames = frames.filter((_, i) => i !== idx)
    const newSlots  = slots.filter((_, i) => i !== idx - 1 || idx === 0)
      .slice(0, newFrames.length - 1)
    setFrames(newFrames)
    setSlots(newSlots.length ? newSlots : [{ transitionId: null, duration: '5' }])
  }

  // Upload handler — detects aspect ratio from frame 0
  const handleFrameUpload = async (file, idx) => {
    const url = URL.createObjectURL(file)
    setFrames(prev => prev.map((f, i) => i === idx ? { file, url } : f))

    if (idx === 0) {
      const detected = await detectAspectRatio(file)
      setAspectRatio(detected)
    }
  }

  return (
    <div className="relative min-h-full" style={{ background: 'var(--bg-primary)' }}>

      {/* Generating overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
            {clipCount > 0 ? `${clipCount} clip${clipCount !== 1 ? 's' : ''}` : 'Add frames below'}
          </p>
        </div>
        {isPromptIQ ? (
          <span className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white brand-gradient">
            <Zap size={10} /> Free
          </span>
        ) : (
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {creditCost * Math.max(clipCount, 0)} cr
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-6"
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Settings row */}
        <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 size={14} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Settings</p>
          </div>

          {/* Aspect ratio */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Aspect ratio</p>
              <AnimatePresence>
                {firstFrameUploaded && (
                  <motion.span
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{    opacity: 0, x: 6 }}
                    className="text-xs font-semibold"
                    style={{ color: 'var(--brand)' }}
                  >
                    auto-detected
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-2">
              {ASPECT_OPTS.map(a => (
                <button
                  key={a}
                  onClick={() => !firstFrameUploaded && setAspectRatio(a)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: aspectRatio === a ? 'var(--brand)' : 'var(--bg-elevated)',
                    color:      aspectRatio === a ? '#fff'         : 'var(--text-muted)',
                    opacity:    firstFrameUploaded && aspectRatio !== a ? 0.35 : 1,
                    cursor:     firstFrameUploaded ? 'default' : 'pointer',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
            {!firstFrameUploaded && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Upload frame 1 to auto-detect
              </p>
            )}
          </div>

          {/* Sound */}
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
        </div>

        {/* Frame + Transition chain */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Frames & Transitions</p>

          {frames.map((frame, idx) => (
            <div key={idx}>
              {/* Frame slot */}
              <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <FrameSlot
                  index={idx}
                  frame={frame}
                  onUpload={(file) => handleFrameUpload(file, idx)}
                  onRemove={() => setFrames(prev => prev.map((f, i) => i === idx ? null : f))}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Frame {idx + 1}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {frame?.url ? 'Uploaded' : idx === 0 ? 'Sets aspect ratio' : 'Tap to upload image'}
                  </p>
                </div>

                {/* Action buttons — swap always visible, delete only on frame 3+ */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Swap / reupload */}
                  <label
                    className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                    title="Swap image"
                  >
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) handleFrameUpload(f, idx)
                      }}
                    />
                    <SwapIcon />
                  </label>

                  {/* Delete — frame 3 and above only */}
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

              {/* Transition row between this frame and next */}
              {idx < frames.length - 1 && (
                <div
                  className="flex items-center gap-2 px-3 py-2 mx-4 rounded-xl my-1"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <div className="w-0.5 self-stretch rounded-full mx-1" style={{ background: 'var(--border-color)' }} />
                  <TransitionPicker
                    value={slots[idx]?.transitionId}
                    transitions={transitions}
                    onChange={(id) => setSlots(prev => prev.map((s, i) => i === idx ? { ...s, transitionId: id } : s))}
                  />
                  <DurationPicker
                    value={slots[idx]?.duration || '5'}
                    onChange={(d) => setSlots(prev => prev.map((s, i) => i === idx ? { ...s, duration: d } : s))}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Add frame button */}
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

      {/* Generate button */}
      <div
        className="fixed left-0 right-0 px-4 pt-3"
        style={{
          bottom:        'calc(56px + env(safe-area-inset-bottom, 0px))',
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
            {submitting ? 'Firing clips…'
              : isPromptIQ ? `Generate ${clipCount} clip${clipCount !== 1 ? 's' : ''}  ·  Free`
              : `Generate ${clipCount} clip${clipCount !== 1 ? 's' : ''}  ·  ${creditCost * clipCount} cr`}
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
  const navigate              = useNavigate()
  const { user, credits, profile, isStaff, isAdmin, refreshProfile } = useAuth()

  const [view,          setView]          = useState('list')
  const [projects,      setProjects]      = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [transitions,   setTransitions]   = useState([])
  const [dbTemplate,    setDbTemplate]    = useState(null)
  const [loadingProj,   setLoadingProj]   = useState(true)
  const [creatingProj,  setCreatingProj]  = useState(false)
  const [showNewModal,  setShowNewModal]  = useState(false)
  const [submitting,    setSubmitting]    = useState(false)

  // Editor state
  const [frames,      setFrames]      = useState([null, null])
  const [slots,       setSlots]       = useState([{ transitionId: null, duration: '5' }])
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [withSound,   setWithSound]   = useState(false)

  const isPromptIQ = (isStaff || isAdmin) && dbTemplate?.visibility === 'promptiq'

  // Load template + transitions + projects
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const [{ data: tmpl }, { data: trans }, { data: projs }] = await Promise.all([
        templatesDb.getBySlug(SLUG),
        cinematicTransitions.getActive(),
        cinematicProjects.getForUser(user.id),
      ])
      setDbTemplate(tmpl || null)
      setTransitions(trans || [])
      setProjects(projs || [])
      setLoadingProj(false)
    })()
  }, [user])

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
      setActiveProject(data)
      setFrames([null, null])
      setSlots([{ transitionId: null, duration: '5' }])
      setAspectRatio('9:16')
      setWithSound(false)
      setShowNewModal(false)
      setView('editor')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCreatingProj(false)
    }
  }

  const handleOpenProject = (project) => {
    setActiveProject(project)
    setFrames([null, null])
    setSlots([{ transitionId: null, duration: '5' }])
    setAspectRatio(project.aspect_ratio || '9:16')
    setWithSound(project.with_sound || false)
    setView('editor')
  }

  const handleGenerate = async () => {
    if (!activeProject || !user || !dbTemplate) return
    const clipCount = frames.length - 1
    setSubmitting(true)

    try {
      // 1. Upload all frames
      const uploadedUrls = []
      for (const frame of frames) {
        if (!frame?.file) {
          uploadedUrls.push(frame?.url || null)
          continue
        }
        const url = await uploadFile(frame.file, user.id)
        uploadedUrls.push(url)
      }

      // 2. Update project status + settings
      await cinematicProjects.update(activeProject.id, {
        status:       'processing',
        aspect_ratio: aspectRatio,
        with_sound:   withSound,
      })

      // 3. Upsert clips
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

      // 4. Fetch transition prompts
      const transitionMap = {}
      transitions.forEach(t => { transitionMap[t.id] = t.prompt_text })

      // 5. Fire all clips in parallel
      const clipCreditCost = dbTemplate.credit_cost || 10

      await Promise.all(
        savedClips.map(async (clip, idx) => {
          const transitionPrompt = transitionMap[slots[idx].transitionId] || ''

          const { data: genRow, error: genErr } = await generationsDb.create({
            user_id:             user.id,
            template_id:         dbTemplate.id,
            generation_type:     'start_end_frame',
            status:              'pending',
            prompt:              transitionPrompt,
            model:               dbTemplate.default_model || 'kling_2_5',
            aspect_ratio:        aspectRatio,
            duration:            slots[idx].duration,
            credits_charged:     isPromptIQ ? 0 : clipCreditCost,
            is_staff_generation: isPromptIQ,
            with_sound:          withSound,
            start_frame_url:     clip.start_frame_url,
            end_frame_url:       clip.end_frame_url,
            output_type:         'video',
            title:               `${activeProject.name} — Clip ${idx + 1}`,
          })
          if (genErr || !genRow) throw new Error(`Clip ${idx + 1}: failed to create generation`)

          if (isPromptIQ) {
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

      setTimeout(() => {
        navigate(`/cinematic/${activeProject.id}`)
      }, 800)

    } catch (err) {
      toast.error(err.message || 'Generation failed')
      await cinematicProjects.update(activeProject.id, { status: 'draft' })
    } finally {
      setSubmitting(false)
    }
  }

  if (view === 'editor' && activeProject) {
    return (
      <EditorView
        project={activeProject}
        frames={frames}           setFrames={setFrames}
        transitions={transitions}
        slots={slots}             setSlots={setSlots}
        aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
        withSound={withSound}     setWithSound={setWithSound}
        creditCost={dbTemplate?.credit_cost || 10}
        credits={credits}
        isPromptIQ={isPromptIQ}
        onGenerate={handleGenerate}
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
          onOpen={handleOpenProject}
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
