import { useState, useEffect, useRef }  from 'react'
import { createPortal }                  from 'react-dom'
import { motion, AnimatePresence }       from 'framer-motion'
import {
  Film, Image as ImageIcon,
  Download, RefreshCw, Trash2,
  MoreHorizontal, ChevronDown,
  Copy, Check, Sparkles, Zap,
  Pencil, Bookmark, ScanLine,
} from 'lucide-react'

export const EST_DURATION = {
  text_to_image:   12_000,
  image_to_image:  15_000,
  text_to_video:   90_000,
  image_to_video:  90_000,
  start_end_frame: 100_000,
  end_frame_text:  100_000,
  template:        90_000,
  default:         60_000,
}

export function getFakeProgress(gen) {
  if (gen.status === 'completed') return 100
  if (gen.status === 'failed')    return 0
  const est     = EST_DURATION[gen.generation_type] || EST_DURATION.default
  const elapsed = Date.now() - new Date(gen.created_at).getTime()
  return Math.min(Math.floor((elapsed / est) * 92), 92)
}

export function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// getCardTitle
//
// gen.is_system_prompt gates use of the raw prompt as a fallback title.
// Defaults to TRUE at the DB level (fail-closed) — prompts are hidden
// unless the originating page explicitly set is_system_prompt: false
// (user-typed-prompt pages like CreateVideoPage / CreateImagePage /
// CreateTalkingHeadPage). System/template pages (Photo Polish, Video
// Upscaler, Cinematic Transition, future templates) need no per-page
// change since true is already the default.
export function getCardTitle(gen) {
  if (gen.ugc_scene_prompt) return gen.ugc_scene_prompt
  if (gen.templates?.name)  return gen.templates.name
  if (gen.title)            return gen.title
  if (!gen.is_system_prompt && gen.prompt) {
    return gen.prompt.slice(0, 45) + (gen.prompt.length > 45 ? '…' : '')
  }
  return 'Generation'
}

export function getFriendlyError(raw) {
  if (!raw) return null

  if (
    /content_policy_violation/i.test(raw)               ||
    /OutputVideoSensitiveContentDetected/i.test(raw)    ||
    /OutputAudioSensitiveContentDetected/i.test(raw)    ||
    /sensitive content/i.test(raw)                      ||
    /PolicyViolation/i.test(raw)                        ||
    /copyright/i.test(raw)                              ||
    /nsfw|moderat|violat|policy|blocked|inappropriate/i.test(raw)
  ) {
    const clean   = raw.replace(/^[A-Za-z]+:\s*/, '')
    const trimmed = clean.length > 120 ? clean.slice(0, 117) + '…' : clean
    return `⚠️ ${trimmed}`
  }

  if (/real person|human face|real face/i.test(raw))
    return '⚠️ Real faces not permitted — use illustrated or AI-generated characters'

  if (/no_media_generated/i.test(raw))
    return '⚠️ Model produced no output — try rephrasing your prompt'

  if (/image_too_small/i.test(raw))     return 'Input image too small — use a larger image'
  if (/image_too_large/i.test(raw))     return 'Input image too large — resize before uploading'
  if (/image_load_error/i.test(raw))    return 'Could not load input image — check the URL'
  if (/file_download_error/i.test(raw)) return 'Could not download input file — ensure URL is public'
  if (/unsupported.*format/i.test(raw)) return 'Unsupported file format — check accepted formats'

  if (/model.*not.*found|unsupported model/i.test(raw)) return 'Model unavailable — try another'
  if (/downstream_service_unavailable|downstream_service_error/i.test(raw))
    return 'Provider temporarily unavailable — please try again'

  if (/timed?\s*out|generation_timeout|request_timeout/i.test(raw))
    return 'Timed out — please try again'

  if (/insufficient|not enough|credit/i.test(raw)) return 'Insufficient credits'

  if (/\b1\d{3}\b/.test(raw)) {
    const trimmed = raw.length > 120 ? raw.slice(0, 117) + '…' : raw
    return `⚠️ ${trimmed}`
  }
  if (/\b5\d{3}\b/.test(raw)) return 'Provider error — please try again'

  const trimmed = raw.length > 120 ? raw.slice(0, 117) + '…' : raw
  return `⚠️ ${trimmed}`
}

export function getModelDisplayLabel(modelValue, modelsList) {
  if (!modelValue) return null
  const found = modelsList?.find((m) => m.value === modelValue)
  if (found) return found.aka || null
  return null
}

const STATUS_STYLES = {
  completed:  { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Done'       },
  processing: { bg: 'rgba(234,179,8,0.12)',  color: '#eab308', label: 'Processing' },
  queued:     { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Queued'     },
  pending:    { bg: 'rgba(234,179,8,0.12)',  color: '#eab308', label: 'Pending'    },
  failed:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', label: 'Failed'     },
}
export const StatusPill = ({ status }) => {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

export const FilterPill = ({ active, onClick, label, icon: Icon, tone, pulse = false }) => {
  const isNeutralTone   = !tone || tone === 'var(--text-primary)'
  const activeTextColor = isNeutralTone ? 'var(--text-inverse)' : '#ffffff'

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
      style={{
        background: active ? (tone || 'var(--text-primary)') : 'var(--bg-elevated)',
        color:      active ? activeTextColor : 'var(--text-muted)',
        border:     `1px solid ${active ? 'transparent' : 'var(--border-color)'}`,
      }}
    >
      {Icon && (
        <motion.span
          className="flex items-center justify-center"
          animate={pulse ? { scale: [1, 1.25, 1] } : {}}
          transition={pulse ? { repeat: Infinity, duration: 1.2, ease: 'easeInOut' } : {}}
        >
          <Icon size={12} />
        </motion.span>
      )}
      {label}
    </button>
  )
}

export const ProgressOverlay = ({ gen, accentColor = 'var(--brand)' }) => {
  const [pct, setPct] = useState(() => getFakeProgress(gen))

  useEffect(() => {
    if (gen.status === 'completed' || gen.status === 'failed') return
    const t = setInterval(() => setPct(getFakeProgress(gen)), 800)
    return () => clearInterval(t)
  }, [gen])

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
    >
      <span className="text-white font-bold text-sm mb-2">{pct}%</span>
      <div className="w-10 rounded-full overflow-hidden" style={{ height: 3, background: 'rgba(255,255,255,0.2)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: accentColor }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

export const CopyPromptButton = ({ prompt }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.stopPropagation()
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard denied */ }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
      style={{ background: 'var(--bg-elevated)' }}
      title="Copy prompt"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span key="check"
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Check size={13} style={{ color: '#10b981' }} />
          </motion.span>
        ) : (
          <motion.span key="copy"
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Copy size={13} style={{ color: 'var(--text-muted)' }} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

export const PortalDropup = ({
  triggerRef, open, models, value, originalModel,
  onSelect, onClose, accentColor = 'var(--brand)', accentSubtle,
}) => {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (open && triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }, [open, triggerRef])

  if (!open || !rect) return null

  const bottomPx = window.innerHeight - rect.top + 8

  return createPortal(
    <>
      <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={onClose} onTouchStart={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{    opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        style={{
          position:                'fixed',
          bottom:                  bottomPx,
          left:                    rect.left,
          width:                   rect.width,
          zIndex:                  9999,
          background:              'var(--bg-card)',
          border:                  '1px solid var(--border-color)',
          borderRadius:            16,
          boxShadow:               '0 -8px 32px rgba(0,0,0,0.4)',
          maxHeight:               260,
          overflowY:               'auto',
          WebkitOverflowScrolling: 'touch',
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {models.map((m, i) => (
          <button
            key={m.value}
            onClick={() => { onSelect(m.value); onClose() }}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            style={{
              background:   m.value === value ? 'var(--bg-elevated)' : 'transparent',
              borderBottom: i < models.length - 1 ? '1px solid var(--border-color)' : 'none',
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.aka}</p>
              {m.description && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {m.value === originalModel && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: accentSubtle || 'rgba(234,179,8,0.12)', color: accentColor, fontSize: 10, whiteSpace: 'nowrap' }}
                >
                  original
                </span>
              )}
              {m.value === value && <span style={{ color: accentColor, fontSize: 14 }}>✓</span>}
            </div>
          </button>
        ))}
      </motion.div>
    </>,
    document.body
  )
}

export const RegenerateSheet = ({
  gen, models, credits,
  onClose, onConfirm,
  accentColor = 'var(--text-primary)',
  accentSubtle,
  filterRelevantModels,
  computeCreditCost,
}) => {
  const originalModel           = gen.model || ''
  const [model, setModel]       = useState(originalModel)
  const [dropOpen, setDropOpen] = useState(false)
  const triggerRef              = useRef(null)

  const initialPrompt              = gen.ugc_scene_prompt || gen.prompt || ''
  const [editedPrompt, setEditedPrompt] = useState(initialPrompt)

  const relevantModels = filterRelevantModels ? filterRelevantModels(models, gen) : models.filter((m) => !m.is_locked)
  const selectedModel  = relevantModels.find((m) => m.value === model) || relevantModels[0]
  const creditCost     = computeCreditCost
    ? computeCreditCost(selectedModel, gen)
    : (gen.start_frame_url ? selectedModel?.credit_cost_i2i : selectedModel?.credit_cost_t2i) || 0
  const canAfford      = credits >= creditCost

  const inputImageUrl = gen.input_image_urls?.[0] || gen.start_frame_url || null

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (dropOpen) { setDropOpen(false); return } onClose() }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full rounded-t-3xl pb-8"
        style={{ background: 'var(--bg-card)', maxWidth: 480, border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>
        <div className="px-4 pb-3">
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Regenerate</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Re-run with the same (or edited) settings</p>
        </div>

        {inputImageUrl && (
          <div className="px-4 mb-3">
            <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Input image (will be reused)
            </p>
            <div className="rounded-2xl overflow-hidden" style={{ height: 140 }}>
              <img
                src={inputImageUrl}
                alt="Original input"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        )}

        <div className="px-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Prompt</p>
            <CopyPromptButton prompt={editedPrompt} />
          </div>
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            rows={3}
            placeholder="Describe what you want to generate…"
            className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', lineHeight: 1.5 }}
          />
        </div>

        {gen.ugc_filter_applied && (
          <div className="px-4 mb-3">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {gen.ugc_filter_applied === 'cinematic' ? '🎬 Cinematic' : '📱 Hyper Realistic'} · same style will be reused
            </span>
          </div>
        )}

        <div className="px-4 mb-4">
          <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Model</p>
          <button
            ref={triggerRef}
            onClick={(e) => { e.stopPropagation(); setDropOpen((v) => !v) }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedModel?.aka}</p>
              {selectedModel?.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedModel.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {model === originalModel && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: accentSubtle || 'rgba(234,179,8,0.12)', color: accentColor }}>
                  original
                </span>
              )}
              <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </div>
          </button>
          <AnimatePresence>
            {dropOpen && (
              <PortalDropup
                triggerRef={triggerRef} open={dropOpen} models={relevantModels}
                value={model} originalModel={originalModel}
                onSelect={(v) => setModel(v)} onClose={() => setDropOpen(false)}
                accentColor={accentColor} accentSubtle={accentSubtle}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="px-4 flex flex-col gap-2">
          <button
            onClick={() => canAfford && selectedModel && onConfirm(model, creditCost, selectedModel, editedPrompt)}
            disabled={!canAfford || !selectedModel}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: accentColor,
              color:      accentColor === 'var(--text-primary)' ? 'var(--text-inverse)' : '#ffffff',
              opacity:    (!canAfford || !selectedModel) ? 0.5 : 1,
            }}
          >
            <RefreshCw size={15} />
            {!canAfford ? 'Not enough credits' : `Regenerate · ${creditCost} cr`}
          </button>
          <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export const EditSheet = ({
  gen, models, credits,
  onClose, onConfirm,
  accentColor = 'var(--text-primary)',
  accentSubtle,
  filterEditModels,
  computeEditCreditCost,
}) => {
  const [dropOpen, setDropOpen] = useState(false)
  const triggerRef              = useRef(null)

  const [editedPrompt, setEditedPrompt] = useState(gen.ugc_scene_prompt || gen.prompt || '')

  const editableModels   = filterEditModels ? filterEditModels(models, gen) : models.filter((m) => !m.is_locked && m.supports_image)
  const [model, setModel] = useState(editableModels[0]?.value || gen.model || '')
  const selectedModel     = editableModels.find((m) => m.value === model) || editableModels[0]

  const creditCost = computeEditCreditCost ? computeEditCreditCost(selectedModel, gen) : selectedModel?.credit_cost_i2i || 0
  const canAfford  = credits >= creditCost
  const outputUrl  = gen.output_url
  const isVideo    = gen.output_type === 'video'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (dropOpen) { setDropOpen(false); return } onClose() }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full rounded-t-3xl pb-8"
        style={{ background: 'var(--bg-card)', maxWidth: 480, border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <Pencil size={15} style={{ color: accentColor }} />
            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Edit</p>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Use the generated output as the new input image</p>
        </div>

        {outputUrl && (
          <div className="px-4 mb-3">
            <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Source (generated output → new input)
            </p>
            <div className="rounded-2xl overflow-hidden relative" style={{ height: 140 }}>
              {isVideo ? (
                <video
                  src={outputUrl}
                  className="w-full h-full object-cover"
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="none"
                />
              ) : (
                <img src={outputUrl} alt="Generated output" className="w-full h-full object-cover" loading="lazy" />
              )}
              <div
                className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
              >
                <ImageIcon size={10} style={{ color: 'rgba(255,255,255,0.7)' }} />
                <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>Will be used as input</span>
              </div>
            </div>
          </div>
        )}

        <div className="px-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Prompt</p>
            <CopyPromptButton prompt={editedPrompt} />
          </div>
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            rows={3}
            placeholder="Describe what changes you want…"
            className="w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', lineHeight: 1.5 }}
          />
        </div>

        <div className="px-4 mb-4">
          <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Model</p>
          <button
            ref={triggerRef}
            onClick={(e) => { e.stopPropagation(); setDropOpen((v) => !v) }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedModel?.aka}</p>
              {selectedModel?.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedModel.description}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>I2I</span>
              <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: dropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
            </div>
          </button>
          <AnimatePresence>
            {dropOpen && (
              <PortalDropup
                triggerRef={triggerRef} open={dropOpen} models={editableModels}
                value={model} originalModel={gen.model}
                onSelect={(v) => setModel(v)} onClose={() => setDropOpen(false)}
                accentColor={accentColor} accentSubtle={accentSubtle}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="px-4 flex flex-col gap-2">
          <button
            onClick={() => canAfford && selectedModel && onConfirm(model, creditCost, selectedModel, editedPrompt)}
            disabled={!canAfford || !selectedModel || !outputUrl}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: accentColor,
              color:      accentColor === 'var(--text-primary)' ? 'var(--text-inverse)' : '#ffffff',
              opacity:    (!canAfford || !selectedModel || !outputUrl) ? 0.5 : 1,
            }}
          >
            <Pencil size={15} />
            {!canAfford ? 'Not enough credits' : `Edit · ${creditCost} cr`}
          </button>
          <button onClick={onClose} className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

const CHIP_TONES = {
  neutral: { bg: 'var(--bg-elevated)',    color: 'var(--text-secondary)' },
  brand:   { bg: 'var(--brand-light)',    color: 'var(--brand)'          },
  danger:  { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444'               },
  info:    { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6'               },
  warn:    { bg: 'rgba(234,179,8,0.12)',  color: '#eab308'               },
}

const ActionIconChip = ({ icon: Icon, tone = 'neutral', size = 36 }) => {
  const t = CHIP_TONES[tone] || CHIP_TONES.neutral
  return (
    <div
      className="flex items-center justify-center rounded-xl flex-shrink-0"
      style={{ width: size, height: size, background: t.bg }}
    >
      <Icon size={Math.round(size * 0.46)} style={{ color: t.color }} />
    </div>
  )
}

const ActionGridItem = ({ icon, label, tone = 'brand', onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex flex-col items-center gap-2 py-3 rounded-2xl transition-all active:scale-95"
    style={{ opacity: disabled ? 0.5 : 1 }}
  >
    <ActionIconChip icon={icon} tone={tone} size={46} />
    <span
      className="text-xs font-semibold text-center leading-tight px-1"
      style={{ color: 'var(--text-primary)' }}
    >
      {label}
    </span>
  </button>
)

const ActionRowGroup = ({ children }) => (
  <div
    className="rounded-2xl overflow-hidden"
    style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
  >
    {children}
  </div>
)

const ActionRow = ({ icon, label, sub, tone = 'neutral', onClick, danger, isLast, loading }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.98]"
    style={{
      background:   danger ? 'rgba(239,68,68,0.05)' : 'transparent',
      borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
      opacity:      loading ? 0.6 : 1,
    }}
  >
    <ActionIconChip icon={icon} tone={danger ? 'danger' : tone} size={32} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold" style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}>
        {label}
      </p>
      {sub && (
        <p className="text-xs" style={{ color: danger ? 'rgba(239,68,68,0.65)' : 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  </button>
)

// ActionSheet
//
// is_system_prompt gating (fail-closed — DB default is TRUE, i.e. hidden):
//   - Regenerate is only added to the primary icon grid when
//     !gen.is_system_prompt. It's built via gridItems.push(...) below
//     rather than being unconditionally present, so a system/template
//     generation simply never gets a Regenerate entry point at all —
//     RegenerateSheet is never invoked from here. Since the column
//     defaults to true, this is the "safe" outcome for anything that
//     forgot to opt out.
//   - The prompt preview line under the title is also suppressed for
//     is_system_prompt generations, matching the getCardTitle() gate.
export const ActionSheet = ({
  gen, onClose,
  onDelete, onRegenerate, onEdit, onRefresh, onDownload, onSaveAsset, onRetry,
  onExtractEndFrame,
  refreshLoading = false,
  extractLoading = false,
}) => {
  const isCompleted     = gen.status === 'completed'
  const isProcessing    = gen.status === 'processing' || gen.status === 'pending'
  const canShowPrompt   = !gen.is_system_prompt

  const gridItems = []
  if (isCompleted && gen.output_url && onEdit) {
    gridItems.push({ icon: Pencil, label: 'Edit', onClick: onEdit })
  }
  if (canShowPrompt) {
    gridItems.push({ icon: RefreshCw, label: 'Regenerate', onClick: onRegenerate })
  }
if (isCompleted && gen.output_type === 'video' && gen.output_url && onExtractEndFrame) {
    gridItems.push({
      icon: ScanLine, label: extractLoading ? 'Extracting…' : 'Frames',
      onClick: onExtractEndFrame, disabled: extractLoading,
    })
  }
  if (onRetry) {
    gridItems.push({ icon: RefreshCw, label: 'Retry', onClick: onRetry, tone: 'warn' })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full rounded-t-3xl overflow-hidden pb-8"
        style={{ background: 'var(--bg-card)', maxWidth: 480, border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>

        <div className="px-4 pb-3">
          <p className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {getCardTitle(gen)}
          </p>
          {gen.ugc_filter_applied ? (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {gen.ugc_filter_applied === 'cinematic' ? '🎬 Cinematic' : '📱 Hyper Realistic'}
              {gen.aspect_ratio ? ` · ${gen.aspect_ratio}` : ''}
            </p>
          ) : (canShowPrompt && gen.prompt) ? (
            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{gen.prompt}</p>
          ) : null}
        </div>

        {/* Preview thumbnail */}
        {gen.output_url && (
          <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 160 }}>
            {gen.output_type === 'video'
              ? <video src={gen.output_url} className="w-full h-full object-cover" muted autoPlay loop playsInline preload="none" />
              : <img   src={gen.output_url} alt="preview" className="w-full h-full object-cover" loading="lazy" />
            }
          </div>
        )}

        {/* Primary actions — icon grid */}
        {gridItems.length > 0 && (
          <div className="px-3 mb-3 grid grid-cols-3 gap-0.5">
            {gridItems.map((it) => (
              <ActionGridItem
                key={it.label}
                icon={it.icon}
                label={it.label}
                tone={it.tone || 'brand'}
                onClick={it.onClick}
                disabled={it.disabled}
              />
            ))}
          </div>
        )}

        {/* Utility group — Download / Save as Asset */}
        {isCompleted && (
          <div className="px-4 mb-2.5">
            <ActionRowGroup>
              <ActionRow
                icon={Download}
                label="Download"
                onClick={onDownload}
                isLast={!(gen.output_url && onSaveAsset)}
              />
              {gen.output_url && onSaveAsset && (
                <ActionRow
                  icon={Bookmark}
                  label="Save as Asset"
                  sub="Add to your Assets library"
                  onClick={onSaveAsset}
                  isLast
                />
              )}
            </ActionRowGroup>
          </div>
        )}

        {/* Contextual group — Refresh (only while processing) */}
        {isProcessing && gen.provider_request_id && (
          <div className="px-4 mb-2.5">
            <ActionRowGroup>
              <ActionRow
                icon={RefreshCw}
                tone="info"
                isLast
                label={refreshLoading ? 'Checking…' : 'Refresh'}
                sub="Check if complete on provider"
                onClick={onRefresh}
                loading={refreshLoading}
              />
            </ActionRowGroup>
          </div>
        )}

        {/* Destructive */}
        <div className="px-4 mb-2.5">
          <ActionRowGroup>
            <ActionRow icon={Trash2} label="Delete" danger onClick={onDelete} isLast />
          </ActionRowGroup>
        </div>

        {/* Cancel — explicit, always present */}
        <div className="px-4">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export const MediaCard = ({ gen, modelsList, onClick, onMore, onRetry, accentColor, accentSubtle }) => {
  const isVideo       = gen.output_type === 'video'
  const isComplete    = gen.status === 'completed'
  const isPending     = gen.status === 'pending' || gen.status === 'processing'
  const [thumbErr, setThumbErr] = useState(false)
  const thumbUrl      = isVideo
    ? (gen.output_thumbnail_url || null)
    : (gen.output_thumbnail_url || gen.output_url || null)
  const cardTitle     = getCardTitle(gen)
  const friendlyError = gen.status === 'failed' ? getFriendlyError(gen.error_message) : null
  const isPolicy      = friendlyError?.startsWith('⚠️')
  const modelLabel    = getModelDisplayLabel(gen.model, modelsList)
  const filterLabel   = gen.ugc_filter_applied === 'cinematic' ? '🎬 Cinematic' : '📱 Hyper Realistic'

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Thumbnail */}
      <div
        className="relative flex-shrink-0 rounded-xl overflow-hidden"
        style={{ width: 56, height: 56, background: 'var(--bg-elevated)', cursor: isComplete ? 'pointer' : 'default' }}
        onClick={isComplete ? onClick : undefined}
      >
        {thumbUrl && !thumbErr ? (
          <img
            src={thumbUrl}
            alt={cardTitle}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setThumbErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo ? <Film size={20} style={{ color: 'var(--text-muted)' }} /> : <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />}
          </div>
        )}
        {isPending && <ProgressOverlay gen={gen} accentColor={accentColor || 'var(--brand)'} />}
        {!isPending && (
          <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
            {isVideo ? <Film size={8} className="text-white" /> : <ImageIcon size={8} className="text-white" />}
          </div>
        )}
      </div>
      {/* Body */}
      <div
        className="flex-1 min-w-0"
        style={{ cursor: isComplete ? 'pointer' : 'default' }}
        onClick={isComplete ? onClick : undefined}
      >
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{cardTitle}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{formatDate(gen.created_at)}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <StatusPill status={gen.status} />
          {gen.ugc_filter_applied && (
            <span className="text-xs px-1.5 py-0.5 rounded-lg font-medium"
              style={{ background: accentSubtle || 'var(--bg-elevated)', color: accentColor || 'var(--text-muted)' }}>
              {filterLabel}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>⚡ {gen.credits_charged} cr</span>
          {modelLabel && (
            <span className="text-xs px-1.5 py-0.5 rounded-lg font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              {modelLabel}
            </span>
          )}
        </div>
        {friendlyError && (
          <p className="text-xs mt-1 line-clamp-2" style={{ color: isPolicy ? '#f59e0b' : '#ef4444' }}>
            {friendlyError}
          </p>
        )}
      </div>

      {/* More / Retry buttons */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        {onRetry && (
          <button
            onClick={onRetry}
            className="h-8 px-3 rounded-xl flex items-center justify-center text-xs font-semibold"
            style={{ background: 'rgba(234,179,8,0.10)', color: '#eab308', border: '1px solid rgba(234,179,8,0.2)' }}
          >
            Retry
          </button>
        )}
        <button
          onClick={onMore}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <MoreHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>
    </div>
  )
}

export const GridCard = ({ gen, index, onClick, onMore, accentColor }) => {
  const isVideo      = gen.output_type === 'video'
  const isPending    = gen.status === 'pending' || gen.status === 'processing'
  const isComplete   = gen.status === 'completed'
  const [thumbErr, setThumbErr] = useState(false)
  const thumbUrl     = isVideo
    ? (gen.output_thumbnail_url || null)
    : (gen.output_thumbnail_url || gen.output_url || null)
  const filterEmoji  = gen.ugc_filter_applied === 'cinematic' ? '🎬' : '📱'
  const arStyle      = gen.aspect_ratio === '16:9' ? '16/9' : gen.aspect_ratio === '1:1' ? '1/1' : '9/16'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className="relative rounded-2xl overflow-hidden"
      style={{ aspectRatio: arStyle, background: 'var(--bg-elevated)' }}
    >
    <button className="w-full h-full block" onClick={isComplete ? onClick : undefined}
        style={{ cursor: isComplete ? 'pointer' : 'default' }}>
        {thumbUrl && !thumbErr ? (
          <img src={thumbUrl} alt={getCardTitle(gen)} className="w-full h-full object-cover" loading="lazy" decoding="async" onError={() => setThumbErr(true)} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo ? <Film size={24} style={{ color: 'var(--text-muted)' }} /> : <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />}
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 45%)' }} />
      </button>

      {isPending && <ProgressOverlay gen={gen} accentColor={accentColor || 'var(--brand)'} />}

      {gen.status === 'failed' && (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
          <span className="text-xs font-semibold px-2 py-1 rounded-lg"
            style={{ background: 'rgba(239,68,68,0.8)', color: '#fff' }}>Failed</span>
        </div>
      )}

      {!isPending && isComplete && (
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 flex items-end justify-between pointer-events-none">
          <div className="flex items-center gap-1">
            <span className="text-xs">{filterEmoji}</span>
            {isVideo && gen.duration && (
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,0,0,0.55)' }}>
                <Film size={8} className="text-white" />
                <span className="text-white" style={{ fontSize: 9 }}>{gen.duration}s</span>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onMore() }}
        className="absolute top-2 right-2 w-7 h-7 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      >
        <MoreHorizontal size={13} style={{ color: 'white' }} />
      </button>
    </motion.div>
  )
}

export const SkeletonCard = () => (
  <div
    className="flex items-center gap-3 p-3 rounded-2xl animate-pulse"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div className="flex-shrink-0 rounded-xl" style={{ width: 56, height: 56, background: 'var(--bg-elevated)' }} />
    <div className="flex-1 flex flex-col gap-2">
      <div className="h-3 rounded-full w-2/3"  style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-2.5 rounded-full w-1/3" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-2.5 rounded-full w-1/2" style={{ background: 'var(--bg-elevated)' }} />
    </div>
  </div>
)

export const MediaEmptyState = ({
  icon: Icon = Sparkles,
  title = 'Nothing here',
  description = '',
  action = null,
  accentColor,
  accentSubtle,
  accentBorder,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 gap-6 text-center"
  >
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center"
      style={{ background: accentSubtle || 'var(--bg-elevated)', border: `1px solid ${accentBorder || 'var(--border-color)'}` }}
    >
      <Icon size={32} style={{ color: accentColor || 'var(--text-muted)', opacity: 0.7 }} />
    </div>
    <div>
      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {description && <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>{description}</p>}
    </div>
    {action}
  </motion.div>
)

export const Lightbox = ({ gen, onClose }) => {
  if (!gen) return null
  const isVideo = gen.output_type === 'video'
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="relative max-w-sm w-full rounded-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo
          ? <video src={gen.output_url} className="w-full" controls autoPlay loop playsInline />
          : <img   src={gen.output_url} alt="" className="w-full" />
        }
        <div
          className="absolute bottom-0 left-0 right-0 p-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
        >
          <p className="text-white text-sm font-semibold line-clamp-2">
            {gen.ugc_scene_prompt || (!gen.is_system_prompt ? gen.prompt : '')}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{formatDate(gen.created_at)}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

export const FallbackBanner = ({ message, onDismiss }) => (
  <motion.div
    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
    className="flex items-center justify-between px-4 py-2.5 rounded-2xl mb-4 text-xs"
    style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.18)', color: '#eab308' }}
  >
    <span>{message}</span>
    {onDismiss && (
      <button onClick={onDismiss} className="ml-3 text-xs underline opacity-70" style={{ color: '#eab308' }}>
        Got it
      </button>
    )}
  </motion.div>
)

export function ExtractEndFrameConfirmModal({ cost, onConfirm, onCancel }) {
  const [skipNext, setSkipNext] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(91,110,247,0.12)' }}>
            <ScanLine size={18} style={{ color: '#5B6EF7' }} />
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Extract End Frame</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
              The last frame of this video will be saved to your Assets.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(91,110,247,0.08)', border: '1px solid rgba(91,110,247,0.18)' }}>
          <Zap size={15} style={{ color: '#5B6EF7', flexShrink: 0 }} />
          <p className="text-sm font-semibold" style={{ color: '#5B6EF7' }}>{cost} credits will be deducted</p>
        </div>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.18)' }}>
          <Sparkles size={15} style={{ color: '#eab308', flexShrink: 0 }} />
          <p className="text-xs" style={{ color: '#eab308', lineHeight: 1.5 }}>
            <span className="font-bold">Master plan</span> unlocks this feature for free.
          </p>
        </div>
        <button onClick={() => setSkipNext((v) => !v)} className="flex items-center gap-2.5 w-fit">
          <div
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
            style={{ background: skipNext ? '#5B6EF7' : 'transparent', border: `1.5px solid ${skipNext ? '#5B6EF7' : 'var(--border-color)'}` }}
          >
            {skipNext && <Check size={10} color="#fff" strokeWidth={3} />}
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Don't ask me again</span>
        </button>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(skipNext)} className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
            style={{ background: '#5B6EF7', color: '#fff' }}>
            Extract · {cost} cr
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
