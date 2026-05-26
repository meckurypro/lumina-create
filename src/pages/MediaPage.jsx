// src/pages/MediaPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate }                              from 'react-router-dom'
import { motion, AnimatePresence }                  from 'framer-motion'
import { Film, Image, Download, RefreshCw, Trash2, MoreHorizontal, X } from 'lucide-react'
import { generations as generationsDb }             from '@/lib/supabase'
import { useAuth }                                  from '@/context/AuthContext'
import { TopBar }                                   from '@/components/layout/TopBar'
import { PageWrapper }                              from '@/components/layout/PageWrapper'
import { Skeleton, EmptyState }                     from '@/components/ui/Modal'
import toast                                        from 'react-hot-toast'

// ── Constants ──────────────────────────────────────────────

const PAGE_SIZE = 20
const POLL_MS   = 4000
const FILTERS   = ['all', 'completed', 'failed']

// Estimated generation time per type (ms) — used for fake progress bar
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

// Returns the best display title for a generation — priority order:
// 1. Template name (if from a template)
// 2. AI-generated title stored in gen.title
// 3. First 45 chars of the raw prompt
// 4. Generic fallback
function getCardTitle(gen) {
  if (gen.templates?.name)                          return gen.templates.name
  if (gen.title)                                    return gen.title
  if (gen.prompt)                                   return gen.prompt.slice(0, 45) + (gen.prompt.length > 45 ? '…' : '')
  return 'Generation'
}

// User-friendly error messages — never show raw API errors
function getFriendlyError(raw) {
  if (!raw) return null
  if (/content|policy|blocked|nsfw|moderat/i.test(raw)) return '⚠️ Content blocked'
  if (/model.*not.*found|unsupported model/i.test(raw)) return 'Model unavailable — try another'
  if (/timed? ?out/i.test(raw))                         return 'Timed out — please try again'
  if (/insufficient|not enough|credit/i.test(raw))      return 'Insufficient credits'
  return 'Generation failed — please try again'
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

// ── Action sheet ───────────────────────────────────────────

const ActionSheet = ({ gen, onClose, onDelete, onRegenerate, onDownload }) => (
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
      {/* Handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
      </div>

      {/* Title + prompt in sheet */}
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

      {/* Preview */}
      {gen.output_url && (
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 160 }}>
          {gen.output_type === 'video'
            ? <video src={gen.output_url} className="w-full h-full object-cover" muted autoPlay loop playsInline />
            : <img   src={gen.output_url} alt="preview" className="w-full h-full object-cover" />
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

        <button
          onClick={onRegenerate}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-colors"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <RefreshCw size={18} style={{ color: 'var(--text-primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Regenerate</span>
        </button>

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

const MediaCard = ({ gen, onClick, onMore }) => {
  const isVideo    = gen.output_type === 'video'
  const isComplete = gen.status === 'completed'
  const isPending  = gen.status === 'pending' || gen.status === 'processing'
  const thumbUrl   = gen.output_thumbnail_url || gen.output_url
  const cardTitle  = getCardTitle(gen)
  const friendlyError = gen.status === 'failed' ? getFriendlyError(gen.error_message) : null
  const isPolicy   = friendlyError?.startsWith('⚠️')

  return (
    <motion.div
      className="flex items-center gap-3 p-3 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Thumbnail */}
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
              ? <Film  size={20} style={{ color: 'var(--text-muted)' }} />
              : <Image size={20} style={{ color: 'var(--text-muted)' }} />
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
              ? <Film  size={8} className="text-white" />
              : <Image size={8} className="text-white" />
            }
          </div>
        )}
      </div>

      {/* Info */}
      <div
        className="flex-1 min-w-0"
        style={{ cursor: isComplete ? 'pointer' : 'default' }}
        onClick={isComplete ? onClick : undefined}
      >
        {/* Title — AI-generated or prompt fallback */}
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {cardTitle}
        </p>

        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
          {formatDate(gen.created_at)}
        </p>

        <div className="flex items-center gap-2 mt-1.5">
          <StatusPill status={gen.status} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ⚡ {gen.credits_charged} cr
          </span>
        </div>

        {/* Friendly error — never raw API message */}
        {friendlyError && (
          <p
            className="text-xs mt-1 truncate"
            style={{ color: isPolicy ? '#f59e0b' : '#ef4444' }}
          >
            {friendlyError}
          </p>
        )}
      </div>

      {/* More button */}
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
  const { user } = useAuth()

  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter,      setFilter]      = useState('all')
  const [page,        setPage]        = useState(0)
  const [hasMore,     setHasMore]     = useState(true)
  const [totalCount,  setTotalCount]  = useState(0)
  const [activeGen,   setActiveGen]   = useState(null)

  const pollRef = useRef(null)

  // ── Load ──

  const load = useCallback(async (offset = 0, reset = false) => {
    if (!user) return
    if (offset === 0) setLoading(true)
    else              setLoadingMore(true)

    const { data, count } = await generationsDb.getUserGenerations(user.id, {
      limit: PAGE_SIZE, offset,
    })

    setTotalCount(count || 0)
    setItems((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
  }, [user])

  useEffect(() => { load(0, true) }, [load])

  // ── Poll for pending/processing ──

  useEffect(() => {
    const hasPending = items.some(g => g.status === 'pending' || g.status === 'processing')
    if (hasPending) {
      pollRef.current = setInterval(async () => {
        if (!user) return
        const { data } = await generationsDb.getUserGenerations(user.id, { limit: PAGE_SIZE, offset: 0 })
        if (data) {
          setItems((prev) => {
            const map = new Map(data.map(g => [g.id, g]))
            return prev.map(g => map.get(g.id) || g)
          })
        }
      }, POLL_MS)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [items, user])

  // ── Actions ──

  const handleDelete = async (gen) => {
    setActiveGen(null)
    try {
      await generationsDb.delete(gen.id)
      setItems((prev) => prev.filter(g => g.id !== gen.id))
      setTotalCount((c) => c - 1)
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleRegenerate = (gen) => {
    setActiveGen(null)
    const isVideo = ['text_to_video','image_to_video','start_end_frame','end_frame_text'].includes(gen.generation_type)
    navigate(isVideo ? '/create/video' : '/create/image', {
      state: {
        prefillPrompt:      gen.prompt,
        prefillAspectRatio: gen.aspect_ratio,
        prefillModel:       gen.model,
        prefillDuration:    gen.duration,
      },
    })
  }

  const handleDownload = async (gen) => {
    setActiveGen(null)
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

  const handleCardClick = (gen) => {
    if (gen.status !== 'completed') return
    navigate(`/result/${gen.id}`)
  }

  // ── Filter ──

  const filtered = filter === 'all'
    ? items
    : items.filter(g => g.status === filter)

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>

        {/* Header */}
        <div className="pt-2 pb-5">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Media</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalCount} generation{totalCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter chips */}
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

        {/* Content */}
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
                  onClick={() => handleCardClick(gen)}
                  onMore={() => setActiveGen(gen)}
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

      {/* Action sheet */}
      <AnimatePresence>
        {activeGen && (
          <ActionSheet
            gen={activeGen}
            onClose={() => setActiveGen(null)}
            onDelete={() => handleDelete(activeGen)}
            onRegenerate={() => handleRegenerate(activeGen)}
            onDownload={() => handleDownload(activeGen)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
