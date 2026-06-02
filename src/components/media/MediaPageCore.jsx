// src/components/media/MediaPageCore.jsx
//
// Core logic + layout shared by MediaPage and UGCMediaPage.
// Neither page should duplicate polling, filtering, pagination,
// or action handlers — all of that lives here.
//
// Props contract:
//
//   fetcher(user, { limit, offset, timeRange, statusFilter })
//     → Promise<{ data: Gen[], count: number }>
//     Injected by the page. Knows how to query generations OR ugc_generations.
//
//   onRegenerate(gen, chosenModel, creditCost, selectedModelObj, { supabase, user, generationsDb, refreshProfile, setItems, setTotalCount })
//     → Promise<void>
//     Injected by the page. Encapsulates page-specific regenerate logic.
//
//   filterRelevantModels(models, gen) → Model[]
//     Injected by the page. Decides which models are valid for this gen type.
//
//   computeCreditCost(selectedModel, gen) → number
//     Injected by the page.
//
//   onCardClick(gen, navigate) → void
//     Injected by the page. Navigate to result or open lightbox.
//
//   headerSlot  — ReactNode rendered above the filter bar (page-specific header)
//   footerSlot  — ReactNode rendered below the list (e.g. UGC "Generate New" CTA)
//   emptySlot   — ReactNode rendered when list is empty (page-specific empty state)
//
//   accentColor, accentSubtle, accentBorder
//     CSS colour strings for theming (UGC uses brand purple/teal, Media uses defaults)
//
//   extraStatusFilters  — e.g. [{ label: '📱 Image', value: 'image' }, ...]
//     When provided, renders a second filter row for output_type (UGC only)
//
//   isNovice  — bool, shows 7-day storage warning when true

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate }                               from 'react-router-dom'
import { motion, AnimatePresence }                   from 'framer-motion'
import { supabase, generations as generationsDb }    from '@/lib/supabase'
import { useAuth }                                   from '@/context/AuthContext'
import toast                                         from 'react-hot-toast'
import {
  MediaCard, GridCard, SkeletonCard,
  ActionSheet, RegenerateSheet,
  FallbackBanner,
} from './MediaCardComponents'
import { Film, Grid2X2, List } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const POLL_MS   = 4_000

// Time-range filter definitions
export const TIME_FILTERS = [
  { label: 'Today',      value: 'today'     },
  { label: 'This Week',  value: 'this_week' },
  { label: 'This Month', value: 'this_month'},
  { label: 'All',        value: 'all'       },
]

// Status filter definitions
export const STATUS_FILTERS = [
  { label: 'Completed', value: 'completed' },
  { label: 'All',       value: 'all'       },
  { label: 'Failed',    value: 'failed'    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Time-range → ISO date helper
// ─────────────────────────────────────────────────────────────────────────────

function getTimeRangeStart(range) {
  if (range === 'all') return null
  const now = new Date()
  if (range === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  if (range === 'this_week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  if (range === 'this_month') {
    const d = new Date(now)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// MediaPageCore
// ─────────────────────────────────────────────────────────────────────────────

export default function MediaPageCore({
  // Data
  fetcher,
  onRegenerate,
  filterRelevantModels,
  computeCreditCost,
  onCardClick,

  // Slots
  headerSlot,
  footerSlot,
  emptySlot,

  // Theme
  accentColor  = 'var(--text-primary)',
  accentSubtle = 'var(--bg-elevated)',
  accentBorder = 'var(--border-color)',

  // Extra filters (output_type — UGC only)
  extraStatusFilters = null,

  // Misc
  isNovice = false,

  // Grid toggle (opt-in — UGC uses it, Media doesn't)
  allowGridView = false,
}) {
  const navigate                                    = useNavigate()
  const { user, credits, refreshProfile }           = useAuth()

  // ── Filter state ────────────────────────────────────────────────────────
  const [timeFilter,   setTimeFilter]   = useState('today')
  const [statusFilter, setStatusFilter] = useState('completed')
  const [extraFilter,  setExtraFilter]  = useState('all')   // output_type
  const [viewMode,     setViewMode]     = useState('list')

  // ── Data state ───────────────────────────────────────────────────────────
  const [items,          setItems]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [hasMore,        setHasMore]        = useState(false)
  const [totalCount,     setTotalCount]     = useState(0)
  const [page,           setPage]           = useState(0)
  const [models,         setModels]         = useState([])

  // ── Sheet state ──────────────────────────────────────────────────────────
  const [activeGen,      setActiveGen]      = useState(null)
  const [sheetMode,      setSheetMode]      = useState(null)
  const [regenLoading,   setRegenLoading]   = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)

  // ── Auto-fallback state ──────────────────────────────────────────────────
  // When Today+Completed is empty we silently expand to This Week and show a banner.
  const [fallbackMsg,    setFallbackMsg]    = useState(null)

  const pollRef     = useRef(null)
  const loadedFilters = useRef({ timeFilter: null, statusFilter: null })

  // ── Load models ──────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
      .then(({ data }) => setModels(data || []))
  }, [])

  // ── Core load ────────────────────────────────────────────────────────────

  const load = useCallback(async ({
    offset    = 0,
    reset     = false,
    tFilter   = timeFilter,
    sFilter   = statusFilter,
    silent    = false,
  } = {}) => {
    if (!user) return
    if (!silent) {
      if (offset === 0) setLoading(true)
      else              setLoadingMore(true)
    }

    const afterIso = getTimeRangeStart(tFilter)

    const { data, count } = await fetcher(user, {
      limit:        PAGE_SIZE,
      offset,
      afterIso,
      statusFilter: sFilter,
    })

    // ── Auto-fallback: Today + Completed → This Week ─────────────────────
    if (offset === 0 && tFilter === 'today' && sFilter === 'completed' && (!data || data.length === 0)) {
      const weekAfter = getTimeRangeStart('this_week')
      const { data: weekData, count: weekCount } = await fetcher(user, {
        limit:        PAGE_SIZE,
        offset:       0,
        afterIso:     weekAfter,
        statusFilter: 'completed',
      })
      if (weekData && weekData.length > 0) {
        setFallbackMsg('Nothing completed today — showing this week')
        setItems(weekData)
        setTotalCount(weekCount || 0)
        setHasMore(PAGE_SIZE < (weekCount || 0))
        setLoading(false)
        setLoadingMore(false)
        loadedFilters.current = { timeFilter: 'this_week', statusFilter: 'completed' }
        return
      }
    }

    setFallbackMsg(null)
    setTotalCount(count || 0)
    setItems((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
    loadedFilters.current = { timeFilter: tFilter, statusFilter: sFilter }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetcher, timeFilter, statusFilter])

  // Re-load when filters change
  useEffect(() => {
    setPage(0)
    setItems([])
    load({ offset: 0, reset: true, tFilter: timeFilter, sFilter: statusFilter })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, statusFilter, user])

  // ── Polling ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }

    const pendingIds = items
      .filter((g) => g.status === 'pending' || g.status === 'processing')
      .map((g) => g.id)

    if (!pendingIds.length || !user) return

    pollRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from('generations')
        .select('*')
        .in('id', pendingIds)

      if (error || !data) return

      const map = new Map(data.map((g) => [g.id, g]))

      setItems((prev) => prev.map((g) => {
        const fresh = map.get(g.id)
        if (!fresh) return g
        // Preserve UGC metadata keys that aren't in the generations table
        return { ...fresh, ...preserveUGCKeys(g, fresh) }
      }))

      const anyResolved = data.some((g) => g.status === 'completed' || g.status === 'failed')
      if (anyResolved) refreshProfile()
    }, POLL_MS)

    return () => { clearInterval(pollRef.current); pollRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((g) => g.id + g.status).join(','), user])

  // ── Sheet helpers ────────────────────────────────────────────────────────

  const openActions    = (gen) => { setActiveGen(gen); setSheetMode('actions') }
  const openRegenerate = ()    => setSheetMode('regenerate')
  const closeSheet     = ()    => { setActiveGen(null); setSheetMode(null) }

  // ── Action handlers ──────────────────────────────────────────────────────

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

  const handleRefresh = async (gen) => {
    closeSheet()
    if (!gen?.provider_request_id) {
      toast.error('No provider request ID — cannot refresh this generation')
      return
    }
    setRefreshLoading(true)
    try {
      const { data: pollResult, error: pollErr } = await supabase.functions.invoke(
        'video-poll-single',
        { body: { generationId: gen.id } }
      )
      if (pollErr) throw new Error(pollErr.message || 'Poll failed')

      const { data: fresh } = await supabase
        .from('generations')
        .select('*')
        .eq('id', gen.id)
        .single()

      if (fresh) {
        setItems((prev) => prev.map((g) => g.id === gen.id
          ? { ...fresh, ...preserveUGCKeys(g, fresh) }
          : g
        ))
      }

      const status = pollResult?.status || fresh?.status
      if (status === 'completed') {
        toast.success('✅ Generation is complete!')
        refreshProfile()
      } else if (status === 'failed') {
        toast.error(`Failed: ${fresh?.error_message || 'Unknown error'}`)
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
      await onRegenerate(gen, chosenModel, creditCost, selectedModelObj, {
        supabase, user, generationsDb, refreshProfile,
        setItems, setTotalCount,
        navigate,
      })
      toast.success('Regenerating! Check back in a moment.', { duration: 4_000 })
    } catch (err) {
      toast.error(err.message || 'Regeneration failed')
    } finally {
      setRegenLoading(false)
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  // Extra filter (output_type) applied client-side on the already-fetched page
  const filtered = extraFilter === 'all'
    ? items
    : items.filter((g) => g.output_type === extraFilter)

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Page-specific header */}
      {headerSlot && (
        <div className="flex-shrink-0">
          {headerSlot({ viewMode, setViewMode, allowGridView, totalCount, credits, accentColor })}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-5">

          {/* 7-day warning */}
          {isNovice && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-2xl mb-4 text-xs"
              style={{
                background: 'rgba(234,179,8,0.08)',
                border:     '1px solid rgba(234,179,8,0.2)',
                color:      '#eab308',
              }}
            >
              <span>⚠️</span>
              Your outputs are stored for 7 days only. Download and save them before they expire.
            </div>
          )}

          {/* Auto-fallback banner */}
          <AnimatePresence>
            {fallbackMsg && (
              <FallbackBanner
                message={fallbackMsg}
                onDismiss={() => setFallbackMsg(null)}
              />
            )}
          </AnimatePresence>

          {/* ── Time filter row ── */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {TIME_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTimeFilter(f.value)}
                className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: timeFilter === f.value ? accentColor        : 'var(--bg-elevated)',
                  color:      timeFilter === f.value ? invertText(accentColor) : 'var(--text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ── Status filter row ── */}
          <div className="flex gap-2 mb-4">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
                style={{
                  background: statusFilter === f.value ? 'var(--text-primary)' : 'var(--bg-elevated)',
                  color:      statusFilter === f.value ? 'var(--text-inverse)'  : 'var(--text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* ── Extra output-type filter (opt-in, e.g. UGC) ── */}
          {extraStatusFilters && !loading && items.length > 0 && (
            <div className="flex gap-2 mb-5">
              {extraStatusFilters.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setExtraFilter(o.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: extraFilter === o.value ? accentColor        : 'var(--bg-elevated)',
                    color:      extraFilter === o.value ? '#ffffff'           : 'var(--text-muted)',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Content ── */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>

          ) : filtered.length === 0 ? (
            // Empty state — provided by page or a sensible default
            emptySlot
              ? emptySlot({ timeFilter, statusFilter, setTimeFilter, setStatusFilter })
              : <DefaultEmpty
                  timeFilter={timeFilter}
                  statusFilter={statusFilter}
                  setTimeFilter={setTimeFilter}
                  setStatusFilter={setStatusFilter}
                  accentColor={accentColor}
                />

          ) : allowGridView && viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-2.5">
              {filtered.map((gen, i) => (
                <GridCard
                  key={gen.id}
                  gen={gen}
                  index={i}
                  accentColor={accentColor}
                  onClick={() => onCardClick(gen, navigate)}
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
                  <MediaCard
                    gen={gen}
                    modelsList={models}
                    accentColor={accentColor}
                    accentSubtle={accentSubtle}
                    onClick={() => onCardClick(gen, navigate)}
                    onMore={() => openActions(gen)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && !loadingMore && filtered.length > 0 && (
            <button
              onClick={() => {
                const next = page + 1
                setPage(next)
                load({ offset: next * PAGE_SIZE, tFilter: timeFilter, sFilter: statusFilter })
              }}
              className="w-full mt-4 py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
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
                style={{ borderColor: accentBorder, borderTopColor: accentColor }}
              />
            </div>
          )}

        </div>
      </div>

      {/* Page-specific footer (e.g. UGC "Generate New" CTA) */}
      {footerSlot && !loading && items.length > 0 && (
        <div className="flex-shrink-0">
          {footerSlot()}
        </div>
      )}

      {/* ── Sheets ── */}
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
            accentColor={accentColor}
            accentSubtle={accentSubtle}
            filterRelevantModels={filterRelevantModels}
            computeCreditCost={computeCreditCost}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// Preserve UGC-specific keys when merging a fresh generations row back into items
function preserveUGCKeys(existing, fresh) {
  const ugcKeys = ['ugc_generation_id', 'ugc_scene_prompt', 'ugc_filter_applied', 'ugc_aspect_ratio']
  const kept = {}
  for (const k of ugcKeys) {
    if (existing[k] !== undefined) kept[k] = existing[k]
  }
  return kept
}

// Decide text colour on accent button (white vs inverse token)
function invertText(accentColor) {
  if (!accentColor || accentColor.startsWith('var(--text')) return 'var(--text-inverse)'
  return '#ffffff'
}

// ─────────────────────────────────────────────────────────────────────────────
// DefaultEmpty  (used when page doesn't supply emptySlot)
// ─────────────────────────────────────────────────────────────────────────────

function DefaultEmpty({ timeFilter, statusFilter, setTimeFilter, setStatusFilter, accentColor }) {
  const isTimeConstrained  = timeFilter  !== 'all'
  const isStatusFiltered   = statusFilter !== 'all'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0  }}
      className="flex flex-col items-center justify-center py-20 gap-5 text-center"
    >
      <Film size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
      <div>
        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {isTimeConstrained || isStatusFiltered
            ? 'Nothing matches these filters'
            : 'No creations yet'}
        </p>
        <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
          {isTimeConstrained
            ? 'Try a wider time range, or switch to All.'
            : isStatusFiltered
              ? 'Try switching to All to see everything.'
              : 'Start creating something amazing.'}
        </p>
      </div>
      {(isTimeConstrained || isStatusFiltered) && (
        <div className="flex gap-2">
          {isTimeConstrained && (
            <button
              onClick={() => setTimeFilter('all')}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              Show All Time
            </button>
          )}
          {isStatusFiltered && (
            <button
              onClick={() => setStatusFilter('all')}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              Show All Status
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
