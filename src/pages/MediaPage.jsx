// src/pages/MediaPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal }                             from 'react-dom'
import { useNavigate }                              from 'react-router-dom'
import { motion, AnimatePresence }                  from 'framer-motion'
import { Film, Image, Download, RefreshCw, Trash2, MoreHorizontal, ChevronDown, Copy, Check } from 'lucide-react'
import { generations as generationsDb, supabase }  from '@/lib/supabase'
import { useAuth }                                  from '@/context/AuthContext'
import { TopBar }                                   from '@/components/layout/TopBar'
import { PageWrapper }                              from '@/components/layout/PageWrapper'
import { Skeleton, EmptyState }                     from '@/components/ui/Modal'
import toast                                        from 'react-hot-toast'

// ── Constants ──────────────────────────────────────────────

const PAGE_SIZE = 20
const POLL_MS   = 4000
const FILTERS   = ['all', 'completed', 'failed']

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

// ── Helpers ────────────────────────────────────────────────

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
  if (gen.templates?.name) return gen.templates.name
  if (gen.title)           return gen.title
  if (gen.prompt)          return gen.prompt.slice(0, 45) + (gen.prompt.length > 45 ? '…' : '')
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

// ── Status pill ────────────────────────────────────────────

const STATUS_STYLES = {
  completed:  { bg: 'rgba(16,185,129,0.12)', color: '#10b981', label: 'Done'       },
  processing: { bg: 'rgba(234,179,8,0.12)',  color: '#eab308', label: 'Processing' },
  pending:    { bg: 'rgba(234,179,8,0.12)',  color: '#eab308', label: 'Pending'    },
  failed:     { bg: 'rgba(239,68,68,0.12)',  color: '#ef4444', label: 'Failed'     },
}

const StatusPill = ({ status }) => {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

// ── Progress bar overlay ───────────────────────────────────

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
          style={{ background: 'var(--brand)' }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ── Copy Prompt Button ─────────────────────────────────────

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
      title="Copy prompt"
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

// ── Portal Dropup ──────────────────────────────────────────

const PortalDropup = ({ triggerRef, open, models, value, originalModel, onSelect, onClose }) => {
  const [rect, setRect] = useState(null)

  useEffect(() => {
    if (open && triggerRef.current) {
      setRect(triggerRef.current.getBoundingClientRect())
    }
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
          position:  'fixed',
          bottom:    bottomPx,
          left:      leftPx,
          width:     widthPx,
          zIndex:    9999,
          background:   'var(--bg-card)',
          border:       '1px solid var(--border-color)',
          borderRadius: 16,
          boxShadow:    '0 -8px 32px rgba(0,0,0,0.4)',
          maxHeight:    260,
          overflowY:    'auto',
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
                  style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308', fontSize: 10, whiteSpace: 'nowrap' }}
                >
                  original
                </span>
              )}
              {m.value === value && (
                <span style={{ color: 'var(--brand)', fontSize: 14 }}>✓</span>
              )}
            </div>
          </button>
        ))}
      </motion.div>
    </>,
    document.body
  )
}

// ── Regenerate Sheet ───────────────────────────────────────

const RegenerateSheet = ({ gen, models, credits, onClose, onConfirm }) => {
  const originalModel           = gen.model || ''
  const [model, setModel]       = useState(originalModel)
  const [dropOpen, setDropOpen] = useState(false)
  const triggerRef              = useRef(null)

  const isUGC            = gen.prompt_engineering_used && gen.input_image_urls?.length > 0
  const isMotionTransfer = gen.generation_type === 'motion_transfer'
  const isVideo          = ['text_to_video','image_to_video','start_end_frame','end_frame_text','motion_transfer','template'].includes(gen.generation_type)

  const relevantModels = models.filter((m) => {
    if (m.is_locked) return false
    if (isUGC)            return m.supports_multi_image === true
    if (isMotionTransfer) return m.type === 'video' && m.feature === 'motion_transfer'
    if (isVideo)          return m.type === 'video' && m.feature !== 'motion_transfer'
    return m.type === 'image'
  })
  const selectedModel = relevantModels.find((m) => m.value === model) || relevantModels[0]
  const creditCost    = selectedModel
    ? (gen.start_frame_url ? selectedModel.credit_cost_i2i : selectedModel.credit_cost_t2i) || 0
    : 0
  const canAfford = credits >= creditCost

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => {
        if (dropOpen) { setDropOpen(false); return }
        onClose()
      }}
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
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>

        {/* Title + prompt + copy button */}
        <div className="px-4 pb-4">
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Regenerate</p>

          {/* Prompt row */}
          <div className="flex items-start gap-2 mt-0.5">
            <p className="text-xs flex-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
              {gen.prompt || 'No prompt'}
            </p>
            {gen.prompt && <CopyPromptButton prompt={gen.prompt} />}
          </div>

          {gen.start_frame_url && (
            <div className="mt-2 flex items-center gap-1.5">
              <Image size={11} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Reference image will be reused</span>
            </div>
          )}
        </div>

        {/* Model selector */}
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
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308' }}
                >
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

        {/* CTA */}
        <div className="px-4 flex flex-col gap-2">
          <button
            onClick={() => canAfford && onConfirm(model, creditCost, selectedModel)}
            disabled={!canAfford || !selectedModel}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: 'var(--text-primary)',
              color:      'var(--text-inverse)',
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

// ── Action sheet ───────────────────────────────────────────

const ActionSheet = ({ gen, onClose, onDelete, onRegenerate, onRefresh, onDownload, onAnimate }) => (
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
        {gen.prompt && (
          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
            {gen.prompt}
          </p>
        )}
      </div>

      {(gen.start_frame_url || gen.output_url) && (
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 160 }}>
          {gen.start_frame_url
            ? <img src={gen.start_frame_url} alt="input" className="w-full h-full object-cover" />
            : gen.output_type === 'video'
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

        {(gen.status === 'processing' || gen.status === 'pending') && gen.provider_request_id && (
          <button
            onClick={onRefresh}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-colors"
            style={{ background: 'rgba(59,130,246,0.08)' }}
          >
            <RefreshCw size={18} style={{ color: '#3b82f6' }} />
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold" style={{ color: '#3b82f6' }}>Refresh</span>
              <span className="text-xs" style={{ color: 'rgba(59,130,246,0.7)' }}>
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

// ── Media Card ─────────────────────────────────────────────

const MediaCard = ({ gen, modelsList, onClick, onMore }) => {
  const isVideo       = gen.output_type === 'video'
  const isComplete    = gen.status === 'completed'
  const isPending     = gen.status === 'pending' || gen.status === 'processing'
  const thumbUrl      = gen.output_thumbnail_url || gen.output_url
  const cardTitle     = getCardTitle(gen)
  const friendlyError = gen.status === 'failed' ? getFriendlyError(gen.error_message) : null
  const isPolicy      = friendlyError?.startsWith('⚠️')
  const modelLabel    = getModelDisplayLabel(gen.model, modelsList)

  return (
    <motion.div
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
            {isVideo ? <Film size={20} style={{ color: 'var(--text-muted)' }} />
                     : <Image size={20} style={{ color: 'var(--text-muted)' }} />}
          </div>
        )}
        {isPending && <ProgressOverlay gen={gen} />}
        {!isPending && (
          <div
            className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            {isVideo ? <Film size={8} className="text-white" /> : <Image size={8} className="text-white" />}
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
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ⚡ {gen.credits_charged} cr
          </span>
          {modelLabel && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-lg font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
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

// ── Media Page ─────────────────────────────────────────────

export default function MediaPage() {
  const navigate = useNavigate()
  const { user, credits, refreshProfile, profile } = useAuth()
  const isNovice = profile?.user_tier === 'novice'

  const [items,          setItems]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [filter,         setFilter]         = useState('all')
  const [page,           setPage]           = useState(0)
  const [hasMore,        setHasMore]        = useState(true)
  const [totalCount,     setTotalCount]     = useState(0)
  const [activeGen,      setActiveGen]      = useState(null)
  const [sheetMode,      setSheetMode]      = useState(null)
  const [models,         setModels]         = useState([])
  const [regenLoading,   setRegenLoading]   = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)

  const pollRef = useRef(null)

  useEffect(() => {
    supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
      .then(({ data }) => setModels(data || []))
  }, [])

  const load = useCallback(async (offset = 0, reset = false) => {
    if (!user) return
    if (offset === 0) setLoading(true)
    else              setLoadingMore(true)

    const { data, count } = await generationsDb.getUserGenerations(user.id, { limit: PAGE_SIZE, offset })

    setTotalCount(count || 0)
    setItems((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
  }, [user])

  useEffect(() => { load(0, true) }, [load])

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }

    const pendingIds = items
      .filter(g => g.status === 'pending' || g.status === 'processing')
      .map(g => g.id)

    if (!pendingIds.length || !user) return

    pollRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .in('id', pendingIds)

      if (error || !data) return

      const map = new Map(data.map(g => [g.id, g]))

      setItems(prev => prev.map(g => map.get(g.id) ?? g))

      const anyResolved = data.some(g => g.status === 'completed' || g.status === 'failed')
      if (anyResolved) refreshProfile()

    }, POLL_MS)

    return () => {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map(g => g.id + g.status).join(','), user])

  const openActions    = (gen) => { setActiveGen(gen); setSheetMode('actions') }
  const openRegenerate = ()    => setSheetMode('regenerate')
  const closeSheet     = ()    => { setActiveGen(null); setSheetMode(null) }

  const handleDelete = async (gen) => {
    closeSheet()
    try {
      await generationsDb.delete(gen.id)
      setItems((prev) => prev.filter(g => g.id !== gen.id))
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
      a.download = `meckury-${gen.id.slice(0, 8)}.${ext}`
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
      const res  = await fetch(gen.output_url)
      const blob = await res.blob()
      const file = new File([blob], `frame-${gen.id.slice(0, 8)}.png`, { type: blob.type || 'image/png' })
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

  const handleRefresh = async (gen) => {
    closeSheet()
    if (!gen?.provider_request_id) {
      toast.error('No provider request ID — cannot refresh this generation')
      return
    }
    setRefreshLoading(true)

    try {
      // 1. Determine provider from models table
      const { data: modelRow } = await supabase
        .from('models')
        .select('provider, value')
        .eq('value', gen.model)
        .single()

      const provider = modelRow?.provider ?? 'wavespeed'

      // 2. Poll the provider directly
      let newStatus  = null
      let outputUrl  = null
      let errorMsg   = null

      if (provider === 'fal') {
        // fal.ai endpoint map — mirrors video-poll FAL_ENDPOINTS
        const FAL_ENDPOINTS = {
          seedance_2_0_i2v: 'bytedance/seedance-2.0/image-to-video',
          seedance_2_0_t2v: 'bytedance/seedance-2.0/text-to-video',
          seedance_2_0_ref: 'bytedance/seedance-2.0/reference-to-video',
        }
        const endpoint = FAL_ENDPOINTS[gen.model]
        if (!endpoint) throw new Error(`No fal endpoint mapped for model "${gen.model}"`)

        // Route through Supabase Edge Function "video-poll-single" to avoid exposing FAL_KEY in browser
        const { data: pollResult, error: pollErr } = await supabase.functions.invoke(
          'video-poll-single',
          { body: { generationId: gen.id } }
        )
        if (pollErr) throw new Error(pollErr.message || 'Poll failed')
        newStatus = pollResult?.status
        outputUrl = pollResult?.output_url
        errorMsg  = pollResult?.error_message

      } else {
        // WaveSpeed — route through Edge Function to avoid exposing WAVESPEED_KEY in browser
        const { data: pollResult, error: pollErr } = await supabase.functions.invoke(
          'video-poll-single',
          { body: { generationId: gen.id } }
        )
        if (pollErr) throw new Error(pollErr.message || 'Poll failed')
        newStatus = pollResult?.status
        outputUrl = pollResult?.output_url
        errorMsg  = pollResult?.error_message
      }

      // 3. Refresh the row from DB (video-poll-single already updated it)
      const { data: fresh } = await supabase
        .from('generations')
        .select('*')
        .eq('id', gen.id)
        .single()

      if (fresh) {
        setItems((prev) => prev.map((g) => g.id === gen.id ? fresh : g))
      }

      if (fresh?.status === 'completed') {
        toast.success('✅ Generation is complete! Refreshed.')
      } else if (fresh?.status === 'failed') {
        toast.error(`Generation failed: ${fresh.error_message || 'Unknown error'}`)
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
      const isVideo = ['text_to_video','image_to_video','start_end_frame','end_frame_text','motion_transfer','template'].includes(gen.generation_type)
      const genType = gen.generation_type

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        genType,
        status:                 'pending',
        prompt:                 gen.prompt,
        model:                  chosenModel,
        aspect_ratio:           gen.aspect_ratio,
        duration:               gen.duration,
        credits_charged:        creditCost,
        output_type:            gen.output_type,
        start_frame_url:        null,
        input_image_urls:       gen.input_image_urls?.length
                                  ? gen.input_image_urls
                                  : gen.start_frame_url
                                    ? [gen.start_frame_url]
                                    : null,
        end_frame_url:          gen.end_frame_url          || null,
        template_id:            gen.template_id            || null,
        skip_prompt_refinement: gen.skip_prompt_refinement ?? false,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      const fnName = isVideo ? 'video-generate' : 'image-generate'
      supabase.functions.invoke(fnName, { body: { generationId: genRow.id } })
        .catch((e) => console.error(`${fnName} invoke error`, e))

      setItems((prev) => [genRow, ...prev])
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
    navigate(`/result/${gen.id}`)
  }

  const filtered = filter === 'all' ? items : items.filter(g => g.status === filter)

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>

        <div className="pt-2 pb-5">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Media</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalCount} generation{totalCount !== 1 ? 's' : ''}
          </p>
        </div>

        {isNovice && (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4 text-xs"
            style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', color: '#eab308' }}
          >
            <span>⚠️</span>
            Your outputs are stored for 7 days only. Download and save them before they expire.
          </div>
        )}

        <div className="flex gap-2 mb-5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
              style={{
                background: filter === f ? 'var(--text-primary)' : 'var(--bg-elevated)',
                color:      filter === f ? 'var(--text-inverse)' : 'var(--text-muted)',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {loading && items.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Film}
            title={filter === 'all' ? 'No creations yet' : `No ${filter} items`}
            description={filter === 'all' ? 'Start creating something.' : 'Nothing here yet'}
            action={
              filter === 'all' && (
                <button
                  onClick={() => navigate('/create')}
                  className="py-3 px-6 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                  style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                >
                  Create something
                </button>
              )
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((gen, i) => (
              <motion.div
                key={gen.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0  }}
                transition={{ delay: i * 0.03 }}
              >
                <MediaCard
                  gen={gen}
                  modelsList={models}
                  onClick={() => handleCardClick(gen)}
                  onMore={() => openActions(gen)}
                />
              </motion.div>
            ))}

            {hasMore && !loadingMore && (
              <button
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  load(next * PAGE_SIZE)
                }}
                className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
              >
                Load more
              </button>
            )}

            {loadingMore && <Skeleton className="h-20 w-full rounded-2xl" />}
          </div>
        )}

      </PageWrapper>

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
      </AnimatePresence>
    </>
  )
}
