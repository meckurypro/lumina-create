// src/pages/UGCMediaPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal }                              from 'react-dom'
import { useNavigate, useParams }                    from 'react-router-dom'
import { motion, AnimatePresence }                   from 'framer-motion'
import {
  ArrowLeft, Zap, User, Sparkles,
  Film, Image as ImageIcon, Download, RefreshCw, Trash2,
  MoreHorizontal, ChevronDown, Copy, Check,
  Grid2X2, List,
} from 'lucide-react'
import { useAuth }                                   from '@/context/AuthContext'
import { ugcProfiles, ugcGenerations }               from '@/lib/ugc'
import { supabase, generations as generationsDb }    from '@/lib/supabase'
import toast                                         from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const PAGE_SIZE = 20
const POLL_MS   = 4000

const EST_DURATION = {
  text_to_image:   12000,
  image_to_image:  15000,
  text_to_video:   90000,
  image_to_video:  90000,
  start_end_frame: 100000,
  end_frame_text:  100000,
  template:        90000,
  default:         60000,
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getFakeProgress(gen) {
  if (gen.status === 'completed') return 100
  if (gen.status === 'failed')    return 0
  const est     = EST_DURATION[gen.generation_type] || EST_DURATION.default
  const elapsed = Date.now() - new Date(gen.created_at).getTime()
  return Math.min(Math.floor((elapsed / est) * 92), 92)
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function getCardTitle(gen) {
  if (gen.ugc_scene_prompt) return gen.ugc_scene_prompt
  if (gen.prompt)           return gen.prompt.slice(0, 45) + (gen.prompt.length > 45 ? '…' : '')
  return 'Generation'
}

function getFriendlyError(raw) {
  if (!raw) return null
  if (/content|policy|blocked|nsfw|moderat/i.test(raw)) return '⚠️ Content blocked'
  if (/model.*not.*found|unsupported model/i.test(raw)) return 'Model unavailable — try another'
  if (/timed? ?out/i.test(raw))                         return 'Timed out — please try again'
  if (/insufficient|not enough|credit/i.test(raw))      return 'Insufficient credits'
  return 'Generation failed — please try again'
}

function getModelDisplayLabel(modelValue, modelsList) {
  if (!modelValue) return null
  const found = modelsList?.find((m) => m.value === modelValue)
  if (found) return found.aka || found.label
  return modelValue.replace(/^(fal-ai\/|fal\/|replicate\/|runway-)/i, '')
}

// ── Fetch UGC generations for a profile ───────────────────────────────────

async function fetchUGCGenerations(profileId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from('ugc_generations')
    .select(
      `
      id,
      output_type,
      filter_applied,
      scene_prompt,
      aspect_ratio,
      created_at,
      generation:generations (
        id,
        status,
        output_url,
        output_thumbnail_url,
        output_type,
        prompt,
        model,
        credits_charged,
        aspect_ratio,
        duration,
        created_at,
        updated_at,
        error_message,
        input_image_urls,
        generation_type,
        skip_prompt_refinement,
        prompt_engineering_used,
        provider_request_id
      )
      `,
      { count: 'exact' }
    )
    .eq('ugc_profile_id', profileId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { data: [], count: 0, error }

  const flat = (data || [])
    .filter((r) => r.generation)
    .map((r) => ({
      ...r.generation,
      ugc_generation_id:  r.id,
      ugc_scene_prompt:   r.scene_prompt,
      ugc_filter_applied: r.filter_applied,
      ugc_aspect_ratio:   r.aspect_ratio,
    }))

  return { data: flat, count: count || 0, error: null }
}

// ── Status pill ────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  completed:  { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Done'       },
  processing: { bg: `${ACCENT_SUB}`,         color: ACCENT,    label: 'Processing' },
  pending:    { bg: `${ACCENT_SUB}`,         color: ACCENT,    label: 'Pending'    },
  failed:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', label: 'Failed'     },
}

const StatusPill = ({ status }) => {
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

// ── Progress overlay ───────────────────────────────────────────────────────

const ProgressOverlay = ({ gen }) => {
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
          style={{ background: ACCENT }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ── Copy prompt button ─────────────────────────────────────────────────────

const CopyPromptButton = ({ prompt }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e.stopPropagation()
    if (!prompt) return
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
      style={{ background: 'var(--bg-elevated)' }}
      title="Copy scene prompt"
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{    scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Check size={13} style={{ color: '#10b981' }} />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{    scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Copy size={13} style={{ color: 'var(--text-muted)' }} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

// ── Portal dropup (model picker) ───────────────────────────────────────────

const PortalDropup = ({ triggerRef, open, models, value, originalModel, onSelect, onClose }) => {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (open && triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
  }, [open, triggerRef])

  if (!open || !rect) return null

  const bottomPx = window.innerHeight - rect.top + 8
  const leftPx   = rect.left
  const widthPx  = rect.width

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onClick={onClose}
        onTouchStart={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1    }}
        exit={{    opacity: 0, y: 8, scale: 0.97 }}
        transition={{ duration: 0.15 }}
        style={{
          position:                'fixed',
          bottom:                  bottomPx,
          left:                    leftPx,
          width:                   widthPx,
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
            className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
            style={{
              background:   m.value === value ? 'var(--bg-elevated)' : 'transparent',
              borderBottom: i < models.length - 1 ? '1px solid var(--border-color)' : 'none',
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.aka || m.label}</p>
              {m.sublabel && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.sublabel}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {m.value === originalModel && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: ACCENT_SUB, color: ACCENT, fontSize: 10, whiteSpace: 'nowrap' }}
                >
                  original
                </span>
              )}
              {m.value === value && (
                <span style={{ color: ACCENT, fontSize: 14 }}>✓</span>
              )}
            </div>
          </button>
        ))}
      </motion.div>
    </>,
    document.body
  )
}

// ── Regenerate sheet ───────────────────────────────────────────────────────

const RegenerateSheet = ({ gen, models, credits, onClose, onConfirm }) => {
  const originalModel           = gen.model || ''
  const [model, setModel]       = useState(originalModel)
  const [dropOpen, setDropOpen] = useState(false)
  const triggerRef              = useRef(null)

  const isVideo = ['text_to_video', 'image_to_video', 'start_end_frame', 'end_frame_text', 'motion_transfer', 'template']
    .includes(gen.generation_type)

  const relevantModels = models.filter((m) => !m.is_locked && m.supports_multi_image === true)
  const selectedModel  = relevantModels.find((m) => m.value === model) || relevantModels[0]
  const creditCost     = selectedModel
    ? (selectedModel.credit_cost_t2i || 0) * (isVideo ? parseInt(gen.duration || 5) : 1)
    : 0
  const canAfford = credits >= creditCost

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => { if (dropOpen) { setDropOpen(false); return } onClose() }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{    y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full rounded-t-3xl pb-8"
        style={{ background: 'var(--bg-card)', maxWidth: 480, border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>

        <div className="px-4 pb-4">
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Regenerate</p>
          <div className="flex items-start gap-2 mt-0.5">
            <p className="text-xs flex-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
              {gen.ugc_scene_prompt || gen.prompt || 'No scene description'}
            </p>
            {(gen.ugc_scene_prompt || gen.prompt) && (
              <CopyPromptButton prompt={gen.ugc_scene_prompt || gen.prompt} />
            )}
          </div>
          {gen.ugc_filter_applied && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {gen.ugc_filter_applied === 'cinematic' ? '🎬 Cinematic' : '📱 Hyper Realistic'} · same style will be reused
              </span>
            </div>
          )}
        </div>

        <div className="px-4 mb-4">
          <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Model
          </p>
          <button
            ref={triggerRef}
            onClick={(e) => { e.stopPropagation(); setDropOpen((v) => !v) }}
            className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedModel?.aka || selectedModel?.label || model}
              </p>
              {selectedModel?.sublabel && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{selectedModel.sublabel}</p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {model === originalModel && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: ACCENT_SUB, color: ACCENT }}>
                  original
                </span>
              )}
              <ChevronDown
                size={16}
                style={{
                  color:      'var(--text-muted)',
                  transform:  dropOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </div>
          </button>

          <AnimatePresence>
            {dropOpen && (
              <PortalDropup
                triggerRef={triggerRef}
                open={dropOpen}
                models={relevantModels}
                value={model}
                originalModel={originalModel}
                onSelect={(v) => setModel(v)}
                onClose={() => setDropOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>

        <div className="px-4 flex flex-col gap-2">
          <button
            onClick={() => canAfford && selectedModel && onConfirm(model, creditCost, selectedModel)}
            disabled={!canAfford || !selectedModel}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: ACCENT,
              color:      '#ffffff',
              opacity:    (!canAfford || !selectedModel) ? 0.5 : 1,
            }}
          >
            <RefreshCw size={15} />
            {!canAfford ? 'Not enough credits' : `Regenerate · ${creditCost} cr`}
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Action sheet ───────────────────────────────────────────────────────────

const ActionSheet = ({ gen, onClose, onDelete, onRegenerate, onRefresh, onDownload, onAnimate, refreshLoading }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end justify-center"
    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0,  opacity: 1 }}
      exit={{    y: 80, opacity: 0 }}
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
        {gen.ugc_filter_applied && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {gen.ugc_filter_applied === 'cinematic' ? '🎬 Cinematic' : '📱 Hyper Realistic'}
            {gen.aspect_ratio ? ` · ${gen.aspect_ratio}` : ''}
          </p>
        )}
      </div>

      {gen.output_url && (
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 160 }}>
          {gen.output_type === 'video'
            ? <video src={gen.output_url} className="w-full h-full object-cover" muted autoPlay loop playsInline />
            : <img src={gen.output_url} alt="preview" className="w-full h-full object-cover" />
          }
        </div>
      )}

      <div className="px-4 flex flex-col gap-2">
        {gen.status === 'completed' && (
          <button
            onClick={onDownload}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-colors"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <Download size={18} style={{ color: 'var(--text-primary)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Download</span>
          </button>
        )}

        {gen.status === 'completed' && gen.output_type === 'image' && (
          <button
            onClick={onAnimate}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-colors"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <Film size={18} style={{ color: 'var(--text-primary)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Animate</span>
          </button>
        )}

        <button
          onClick={onRegenerate}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-colors"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <RefreshCw size={18} style={{ color: 'var(--text-primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Regenerate</span>
        </button>

        {/* ── Refresh button — only for stuck processing/pending rows ── */}
        {(gen.status === 'processing' || gen.status === 'pending') && gen.provider_request_id && (
          <button
            onClick={onRefresh}
            disabled={refreshLoading}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all active:scale-[0.98]"
            style={{
              background: 'rgba(59,130,246,0.08)',
              opacity:    refreshLoading ? 0.6 : 1,
            }}
          >
            <motion.div
              animate={refreshLoading ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshLoading ? { repeat: Infinity, duration: 0.9, ease: 'linear' } : {}}
            >
              <RefreshCw size={18} style={{ color: '#3b82f6' }} />
            </motion.div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold" style={{ color: '#3b82f6' }}>
                {refreshLoading ? 'Checking…' : 'Refresh'}
              </span>
              <span className="text-xs" style={{ color: 'rgba(59,130,246,0.65)' }}>
                Check if complete on provider
              </span>
            </div>
          </button>
        )}

        <button
          onClick={onDelete}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-colors"
          style={{ background: 'rgba(239,68,68,0.08)' }}
        >
          <Trash2 size={18} style={{ color: '#ef4444' }} />
          <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>Delete</span>
        </button>
      </div>
    </motion.div>
  </motion.div>
)

// ── Skeleton ───────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div
    className="flex items-center gap-3 p-3 rounded-2xl animate-pulse"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div className="flex-shrink-0 rounded-xl" style={{ width: 56, height: 56, background: 'var(--bg-elevated)' }} />
    <div className="flex-1 flex flex-col gap-2">
      <div className="h-3 rounded-full w-2/3" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-2.5 rounded-full w-1/3" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-2.5 rounded-full w-1/2" style={{ background: 'var(--bg-elevated)' }} />
    </div>
  </div>
)

// ── Grid card ──────────────────────────────────────────────────────────────

const GridCard = ({ gen, index, onClick, onMore }) => {
  const isVideo    = gen.output_type === 'video'
  const isPending  = gen.status === 'pending' || gen.status === 'processing'
  const isComplete = gen.status === 'completed'
  const thumbUrl   = gen.output_thumbnail_url || gen.output_url
  const filterEmoji = gen.ugc_filter_applied === 'cinematic' ? '🎬' : '📱'

  const arStyle = gen.aspect_ratio === '16:9' ? '16/9' : gen.aspect_ratio === '1:1' ? '1/1' : '9/16'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className="relative rounded-2xl overflow-hidden"
      style={{ aspectRatio: arStyle, background: 'var(--bg-elevated)' }}
    >
      <button
        className="w-full h-full block"
        onClick={isComplete ? onClick : undefined}
        style={{ cursor: isComplete ? 'pointer' : 'default' }}
      >
        {thumbUrl ? (
          isVideo
            ? <video src={thumbUrl} className="w-full h-full object-cover" muted preload="metadata" />
            : <img   src={thumbUrl} alt={getCardTitle(gen)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo
              ? <Film size={24} style={{ color: 'var(--text-muted)' }} />
              : <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
            }
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 45%)' }}
        />
      </button>

      {isPending && <ProgressOverlay gen={gen} />}

      {gen.status === 'failed' && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.8)', color: '#fff' }}>
            Failed
          </span>
        </div>
      )}

      {!isPending && isComplete && (
        <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 flex items-end justify-between pointer-events-none">
          <div className="flex items-center gap-1">
            <span className="text-xs">{filterEmoji}</span>
            {isVideo && gen.duration && (
              <div
                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.55)' }}
              >
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

// ── List card ──────────────────────────────────────────────────────────────

const ListCard = ({ gen, index, modelsList, onClick, onMore }) => {
  const isVideo       = gen.output_type === 'video'
  const isComplete    = gen.status === 'completed'
  const isPending     = gen.status === 'pending' || gen.status === 'processing'
  const thumbUrl      = gen.output_thumbnail_url || gen.output_url
  const cardTitle     = getCardTitle(gen)
  const friendlyError = gen.status === 'failed' ? getFriendlyError(gen.error_message) : null
  const isPolicy      = friendlyError?.startsWith('⚠️')
  const modelLabel    = getModelDisplayLabel(gen.model, modelsList)
  const filterLabel   = gen.ugc_filter_applied === 'cinematic' ? '🎬 Cinematic' : '📱 Hyper Realistic'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div
        className="relative flex-shrink-0 rounded-xl overflow-hidden"
        style={{ width: 56, height: 56, background: 'var(--bg-elevated)', cursor: isComplete ? 'pointer' : 'default' }}
        onClick={isComplete ? onClick : undefined}
      >
        {thumbUrl ? (
          isVideo
            ? <video src={thumbUrl} className="w-full h-full object-cover" muted preload="metadata" />
            : <img   src={thumbUrl} alt={cardTitle} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo
              ? <Film size={20} style={{ color: 'var(--text-muted)' }} />
              : <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
            }
          </div>
        )}
        {isPending && <ProgressOverlay gen={gen} />}
        {!isPending && (
          <div
            className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            {isVideo
              ? <Film size={8} className="text-white" />
              : <ImageIcon size={8} className="text-white" />
            }
          </div>
        )}
      </div>

      <div
        className="flex-1 min-w-0"
        style={{ cursor: isComplete ? 'pointer' : 'default' }}
        onClick={isComplete ? onClick : undefined}
      >
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {cardTitle}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
          {formatDate(gen.created_at)}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <StatusPill status={gen.status} />
          {gen.ugc_filter_applied && (
            <span className="text-xs px-1.5 py-0.5 rounded-lg font-medium" style={{ background: ACCENT_SUB, color: ACCENT }}>
              {filterLabel}
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ⚡ {gen.credits_charged} cr
          </span>
          {modelLabel && (
            <span className="text-xs px-1.5 py-0.5 rounded-lg font-medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              {modelLabel}
            </span>
          )}
        </div>
        {friendlyError && (
          <p className="text-xs mt-1 truncate" style={{ color: isPolicy ? '#f59e0b' : '#ef4444' }}>
            {friendlyError}
          </p>
        )}
      </div>

      <button
        onClick={onMore}
        className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <MoreHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
      </button>
    </motion.div>
  )
}

// ── Lightbox ───────────────────────────────────────────────────────────────

const Lightbox = ({ gen, onClose }) => {
  if (!gen) return null
  const isVideo = gen.output_type === 'video'
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1,    opacity: 1 }}
        exit={{    scale: 0.92, opacity: 0 }}
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
            {gen.ugc_scene_prompt || gen.prompt}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {formatDate(gen.created_at)}
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────

const EmptyState = ({ profileName, onGenerate }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 gap-6 text-center"
  >
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center"
      style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
    >
      <Sparkles size={32} style={{ color: ACCENT, opacity: 0.7 }} />
    </div>
    <div>
      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No generations yet</p>
      <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
        Create your first image or video featuring {profileName}.
      </p>
    </div>
    <button
      onClick={onGenerate}
      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
      style={{ background: ACCENT, color: '#ffffff' }}
    >
      <Zap size={15} fill="currentColor" />
      Generate
    </button>
  </motion.div>
)

// ── Main page ──────────────────────────────────────────────────────────────

export default function UGCMediaPage() {
  const { profileId }                                                    = useParams()
  const navigate                                                         = useNavigate()
  const { user, credits, refreshProfile, profile: authProfile }         = useAuth()
  const isNovice = authProfile?.user_tier === 'novice'

  const [profile,        setProfile]        = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [items,          setItems]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [hasMore,        setHasMore]        = useState(false)
  const [totalCount,     setTotalCount]     = useState(0)
  const [page,           setPage]           = useState(0)
  const [models,         setModels]         = useState([])
  const [viewMode,       setViewMode]       = useState('list')
  const [typeFilter,     setTypeFilter]     = useState('all')
  const [activeGen,      setActiveGen]      = useState(null)
  const [sheetMode,      setSheetMode]      = useState(null)
  const [lightboxGen,    setLightboxGen]    = useState(null)
  const [regenLoading,   setRegenLoading]   = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)

  const pollRef = useRef(null)

  // ── Load profile ──────────────────────────────────────────────────────────

  useEffect(() => {
    ;(async () => {
      setProfileLoading(true)
      const { data, error } = await ugcProfiles.getById(profileId)
      if (error || !data) {
        toast.error('Character not found')
        navigate('/create/ugc')
        return
      }
      setProfile(data)
      setProfileLoading(false)
    })()
  }, [profileId])

  // ── Load models ───────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
      .then(({ data }) => setModels(data || []))
  }, [])

  // ── Load generations ──────────────────────────────────────────────────────

  const load = useCallback(async (offset = 0, reset = false) => {
    if (!user) return
    if (offset === 0) setLoading(true)
    else              setLoadingMore(true)

    const { data, count } = await fetchUGCGenerations(profileId, { limit: PAGE_SIZE, offset })
    setTotalCount(count || 0)
    setItems((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
  }, [user, profileId])

  useEffect(() => { load(0, true) }, [load])

  // ── Poll for pending/processing ───────────────────────────────────────────

  useEffect(() => {
    const hasPending = items.some((g) => g.status === 'pending' || g.status === 'processing')
    if (hasPending) {
      pollRef.current = setInterval(async () => {
        if (!user) return
        const { data } = await fetchUGCGenerations(profileId, { limit: PAGE_SIZE, offset: 0 })
        if (data) {
          setItems((prev) => {
            const map = new Map(data.map((g) => [g.id, g]))
            return prev.map((g) => map.get(g.id) || g)
          })
        }
      }, POLL_MS)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [items, user, profileId])

  // ── Sheet helpers ─────────────────────────────────────────────────────────

  const openActions    = (gen) => { setActiveGen(gen); setSheetMode('actions')    }
  const openRegenerate = ()    => setSheetMode('regenerate')
  const closeSheet     = ()    => { setActiveGen(null); setSheetMode(null) }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDelete = async (gen) => {
    closeSheet()
    try {
      await generationsDb.delete(gen.id)
      setItems((prev) => prev.filter((g) => g.id !== gen.id))
      setTotalCount((c) => c - 1)
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleDownload = async (gen) => {
    closeSheet()
    if (!gen.output_url) return
    try {
      const res  = await fetch(gen.output_url)
      const blob = await res.blob()
      const ext  = gen.output_type === 'video' ? 'mp4' : 'png'
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `ugc-${gen.id.slice(0, 8)}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  const handleAnimate = async (gen) => {
    closeSheet()
    if (!gen.output_url) return toast.error('No image URL found')
    try {
      const res    = await fetch(gen.output_url)
      const blob   = await res.blob()
      const file   = new File([blob], `frame-${gen.id.slice(0, 8)}.png`, { type: blob.type || 'image/png' })
      const reader = new FileReader()
      reader.onload = (ev) => {
        try {
          sessionStorage.setItem('meckury_video_start_frame', JSON.stringify({
            base64: ev.target.result,
            name:   file.name,
            type:   file.type,
          }))
          sessionStorage.removeItem('meckury_video_end_frame')
          navigate('/create/video')
        } catch {
          toast.error('Could not seed frame')
        }
      }
      reader.readAsDataURL(file)
    } catch {
      toast.error('Failed to load image')
    }
  }

  // ── Refresh — manual cron for stuck generations ───────────────────────────

  const handleRefresh = async (gen) => {
    closeSheet()
    if (!gen?.provider_request_id) {
      toast.error('No provider request ID — cannot refresh')
      return
    }
    setRefreshLoading(true)

    try {
      const { data: pollResult, error: pollErr } = await supabase.functions.invoke(
        'video-poll-single',
        { body: { generationId: gen.id } }
      )
      if (pollErr) throw new Error(pollErr.message || 'Poll failed')

      // Re-fetch the raw generation row and merge UGC metadata back in
      const { data: freshGen } = await supabase
        .from('generations')
        .select('*')
        .eq('id', gen.id)
        .single()

      if (freshGen) {
        const merged = {
          ...freshGen,
          ugc_generation_id:  gen.ugc_generation_id,
          ugc_scene_prompt:   gen.ugc_scene_prompt,
          ugc_filter_applied: gen.ugc_filter_applied,
          ugc_aspect_ratio:   gen.ugc_aspect_ratio,
        }
        setItems((prev) => prev.map((g) => g.id === gen.id ? merged : g))
      }

      const status = pollResult?.status
      if (status === 'completed') {
        toast.success('✅ Generation is complete!')
        refreshProfile()
      } else if (status === 'failed') {
        toast.error(`Failed: ${pollResult?.error_message || 'Unknown error'}`)
      } else {
        toast('Still processing — check back in a moment.', { icon: '⏳' })
      }

    } catch (err) {
      console.error('[handleRefresh]', err)
      toast.error(err.message || 'Refresh failed')
    } finally {
      setRefreshLoading(false)
    }
  }

  const handleRegenerateConfirm = async (chosenModel, creditCost, selectedModelObj) => {
    if (!activeGen || !user) return
    const gen = activeGen
    closeSheet()
    setRegenLoading(true)

    try {
      const isVideo = gen.output_type === 'video'

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        isVideo ? 'text_to_video' : 'text_to_image',
        status:                 'pending',
        prompt:                 gen.prompt,
        model:                  chosenModel,
        aspect_ratio:           gen.aspect_ratio,
        duration:               isVideo ? gen.duration : undefined,
        credits_charged:        creditCost,
        output_type:            gen.output_type,
        input_image_urls:       gen.input_image_urls?.length ? gen.input_image_urls : null,
        skip_prompt_refinement: gen.skip_prompt_refinement ?? false,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      await ugcGenerations.create({
        generation_id:  genRow.id,
        ugc_profile_id: profileId,
        user_id:        user.id,
        output_type:    gen.output_type,
        filter_applied: gen.ugc_filter_applied || 'hyper_realistic',
        scene_prompt:   gen.ugc_scene_prompt || gen.prompt || '',
        refined_prompt: null,
        selected_photos:[],
        aspect_ratio:   gen.aspect_ratio || '9:16',
      })

      const fnName = isVideo ? 'video-generate' : 'image-generate'
      supabase.functions.invoke(fnName, { body: { generationId: genRow.id } })
        .catch((e) => console.error(`${fnName} invoke error`, e))

      const optimistic = {
        ...genRow,
        ugc_generation_id:  null,
        ugc_scene_prompt:   gen.ugc_scene_prompt || gen.prompt || '',
        ugc_filter_applied: gen.ugc_filter_applied || 'hyper_realistic',
        ugc_aspect_ratio:   gen.aspect_ratio || '9:16',
      }
      setItems((prev) => [optimistic, ...prev])
      setTotalCount((c) => c + 1)
      refreshProfile()
      toast.success('Regenerating! Check back in a moment.', { duration: 4000 })
    } catch (err) {
      toast.error(err.message || 'Regeneration failed')
    } finally {
      setRegenLoading(false)
    }
  }

  const handleCardClick = (gen) => {
    if (gen.status !== 'completed') return
    setLightboxGen(gen)
  }

  // ── Derived state ─────────────────────────────────────────────────────────

  const filtered = typeFilter === 'all'
    ? items
    : items.filter((g) => g.output_type === typeFilter)

  // ── Loading screen ────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
        />
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => navigate(`/create/ugc/${profileId}`)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>

        <button
          onClick={() => navigate(`/create/ugc/${profileId}`)}
          className="flex items-center gap-2.5"
        >
          {profile?.thumbnail_url ? (
            <img
              src={profile.thumbnail_url}
              alt={profile.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              style={{ border: `2px solid ${ACCENT_BDR}` }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT_SUB, border: `2px solid ${ACCENT_BDR}` }}
            >
              <User size={14} style={{ color: ACCENT }} />
            </div>
          )}
          <div className="flex flex-col items-start">
            <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>
              {profile?.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles size={9} style={{ color: ACCENT }} />
              <p className="text-xs" style={{ color: ACCENT }}>
                {totalCount} generation{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode((v) => v === 'list' ? 'grid' : 'list')}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            {viewMode === 'list' ? <Grid2X2 size={15} /> : <List size={15} />}
          </button>
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-5">

          {isNovice && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4 text-xs"
              style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308' }}
            >
              <span>⚠️</span>
              Your outputs are stored for 7 days only. Download and save them before they expire.
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="flex gap-2 mb-5">
              {[
                { label: 'All',      value: 'all'   },
                { label: '📱 Image', value: 'image' },
                { label: '🎬 Video', value: 'video' },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => setTypeFilter(o.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: typeFilter === o.value ? ACCENT    : 'var(--bg-elevated)',
                    color:      typeFilter === o.value ? '#ffffff' : 'var(--text-muted)',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>

          ) : items.length === 0 ? (
            <EmptyState
              profileName={profile?.name}
              onGenerate={() => navigate(`/create/ugc/${profileId}`)}
            />

          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                No {typeFilter}s found
              </p>
              <button
                onClick={() => setTypeFilter('all')}
                className="text-xs font-semibold underline"
                style={{ color: ACCENT }}
              >
                Show all
              </button>
            </div>

          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-2.5">
              {filtered.map((gen, i) => (
                <GridCard
                  key={gen.id}
                  gen={gen}
                  index={i}
                  onClick={() => handleCardClick(gen)}
                  onMore={() => openActions(gen)}
                />
              ))}
            </div>

          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((gen, i) => (
                <motion.div
                  key={gen.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0  }}
                  transition={{ delay: i * 0.03 }}
                >
                  <ListCard
                    gen={gen}
                    index={i}
                    modelsList={models}
                    onClick={() => handleCardClick(gen)}
                    onMore={() => openActions(gen)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {hasMore && !loadingMore && (
            <button
              onClick={() => {
                const next = page + 1
                setPage(next)
                load(next * PAGE_SIZE)
              }}
              className="w-full mt-5 py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: 'var(--bg-elevated)',
                color:      'var(--text-secondary)',
                border:     '1px solid var(--border-color)',
              }}
            >
              Load more
            </button>
          )}

          {loadingMore && (
            <div className="flex justify-center py-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                className="w-6 h-6 rounded-full border-2"
                style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
              />
            </div>
          )}

        </div>
      </div>

      {/* ── Generate CTA ──────────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div
          className="flex-shrink-0 px-4 lg:px-8 py-4"
          style={{ borderTop: `1px solid ${ACCENT_BDR}` }}
        >
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={() => navigate(`/create/ugc/${profileId}`)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{ background: ACCENT, color: '#ffffff' }}
            >
              <Zap size={15} fill="currentColor" />
              Generate New
            </button>
          </div>
        </div>
      )}

      {/* ── Sheets & Lightbox ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeGen && sheetMode === 'actions' && (
          <ActionSheet
            key="actions"
            gen={activeGen}
            onClose={closeSheet}
            onDelete={() => handleDelete(activeGen)}
            onRegenerate={openRegenerate}
            onRefresh={() => handleRefresh(activeGen)}
            onDownload={() => handleDownload(activeGen)}
            onAnimate={() => handleAnimate(activeGen)}
            refreshLoading={refreshLoading}
          />
        )}
        {activeGen && sheetMode === 'regenerate' && (
          <RegenerateSheet
            key="regenerate"
            gen={activeGen}
            models={models}
            credits={credits}
            onClose={closeSheet}
            onConfirm={handleRegenerateConfirm}
          />
        )}
        {lightboxGen && (
          <Lightbox
            key="lightbox"
            gen={lightboxGen}
            onClose={() => setLightboxGen(null)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
