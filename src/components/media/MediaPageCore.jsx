// src/components/media/MediaPageCore.jsx
//
// Core logic + layout shared by MediaPage and UGCMediaPage.
//
// Props contract (additions marked with NEW):
//
//   fetcher(user, { limit, offset, timeRange, statusFilter })
//     → Promise<{ data: Gen[], count: number }>
//
//   onRegenerate(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, ctx)
//     → Promise<void>
//     NOTE: now receives editedPrompt as 5th arg (may differ from gen.prompt)
//
//   filterRelevantModels(models, gen) → Model[]
//
//   computeCreditCost(selectedModel, gen) → number
//
//   onCardClick(gen, navigate) → void
//
//   -- NEW --
//   filterEditModels(models, gen) → Model[]
//     Injected by page. Returns I2I-capable models for the Edit sheet.
//     Defaults to models where supports_image === true and not locked.
//
//   computeEditCreditCost(selectedModel, gen) → number
//     Injected by page. Defaults to credit_cost_i2i.
//
//   onEdit(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, ctx)
//     → Promise<void>
//     Injected by page. Fires an I2I generation using gen.output_url as input.
//   -- END NEW --
//
//   headerSlot, footerSlot, emptySlot
//   accentColor, accentSubtle, accentBorder
//   extraStatusFilters
//   isNovice
//   allowGridView

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate }                               from 'react-router-dom'
import { motion, AnimatePresence }                   from 'framer-motion'
import { supabase, generations as generationsDb }    from '@/lib/supabase'
import { useAuth }                                   from '@/context/AuthContext'
import toast                                         from 'react-hot-toast'
import {
  MediaCard, GridCard, SkeletonCard,
  ActionSheet, RegenerateSheet, EditSheet,
  FallbackBanner,
} from './MediaCardComponents.jsx'
import { Film, Grid2X2, List } from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20
const POLL_MS   = 4_000

export const TIME_FILTERS = [
  { label: 'Today',      value: 'today'     },
  { label: 'This Week',  value: 'this_week' },
  { label: 'This Month', value: 'this_month'},
  { label: 'All',        value: 'all'       },
]

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
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d.toISOString()
  }
  if (range === 'this_week') {
    const d = new Date(now); d.setDate(d.getDate() - 6); d.setHours(0, 0, 0, 0); return d.toISOString()
  }
  if (range === 'this_month') {
    const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d.toISOString()
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

  // NEW: Edit flow
  filterEditModels      = null,
  computeEditCreditCost = null,
  onEdit                = null,

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

  // Grid toggle (opt-in)
  allowGridView = false,
}) {
  const navigate                                    = useNavigate()
  const { user, credits, refreshProfile }           = useAuth()

  // ── Filter state ─────────────────────────────────────────────────────────
  const [timeFilter,   setTimeFilter]   = useState('today')
  const [statusFilter, setStatusFilter] = useState('completed')
  const [extraFilter,  setExtraFilter]  = useState('all')
  const [viewMode,     setViewMode]     = useState('list')

  // ── Data state ────────────────────────────────────────────────────────────
  const [items,          setItems]          = useState([])
  const [loading,        setLoading]        = useState(true)
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [hasMore,        setHasMore]        = useState(false)
  const [totalCount,     setTotalCount]     = useState(0)
  const [page,           setPage]           = useState(0)
  const [models,         setModels]         = useState([])

  // ── Sheet state ───────────────────────────────────────────────────────────
  const [activeGen,      setActiveGen]      = useState(null)
  // sheetMode: null | 'actions' | 'regenerate' | 'edit'
  const [sheetMode,      setSheetMode]      = useState(null)
  const [regenLoading,   setRegenLoading]   = useState(false)
  const [editLoading,    setEditLoading]    = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)

  // ── Auto-fallback state ───────────────────────────────────────────────────
  const [fallbackMsg,    setFallbackMsg]    = useState(null)

  const pollRef       = useRef(null)
  const loadedFilters = useRef({ timeFilter: null, statusFilter: null })

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

  // ── Core load ─────────────────────────────────────────────────────────────

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
      limit: PAGE_SIZE, offset, afterIso, statusFilter: sFilter,
    })

    // Auto-fallback: Today + Completed → This Week
    if (offset === 0 && tFilter === 'today' && sFilter === 'completed' && (!data || data.length === 0)) {
      const weekAfter = getTimeRangeStart('this_week')
      const { data: weekData, count: weekCount } = await fetcher(user, {
        limit: PAGE_SIZE, offset: 0, afterIso: weekAfter, statusFilter: 'completed',
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

  // ── Polling ───────────────────────────────────────────────────────────────

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
        return { ...fresh, ...preserveUGCKeys(g, fresh) }
      }))

      const anyResolved = data.some((g) => g.status === 'completed' || g.status === 'failed')
      if (anyResolved) refreshProfile()
    }, POLL_MS)

    return () => { clearInterval(pollRef.current); pollRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((g) => g.id + g.status).join(','), user])

  // ── Sheet helpers ─────────────────────────────────────────────────────────

  const openActions    = (gen) => { setActiveGen(gen); setSheetMode('actions')    }
  const openRegenerate = ()    => setSheetMode('regenerate')
  const openEdit       = ()    => setSheetMode('edit')
  const closeSheet     = ()    => { setActiveGen(null); setSheetMode(null) }

  // ── Action handlers ───────────────────────────────────────────────────────

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

  // Regenerate — now receives editedPrompt from the sheet
  const handleRegenerateConfirm = async (chosenModel, creditCost, selectedModelObj, editedPrompt) => {
    if (!activeGen || !user) return
    const gen = activeGen
    closeSheet()
    setRegenLoading(true)
    try {
      await onRegenerate(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
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

  // Edit — uses output as the new I2I input
  const handleEditConfirm = async (chosenModel, creditCost, selectedModelObj, editedPrompt) => {
    if (!activeGen || !user || !onEdit) return
    const gen = activeGen
    closeSheet()
    setEditLoading(true)
    try {
      await onEdit(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
        supabase, user, generationsDb, refreshProfile,
        setItems, setTotalCount,
        navigate,
      })
      toast.success('Edit queued! Check back in a moment.', { duration: 4_000 })
    } catch (err) {
      toast.error(err.message || 'Edit failed')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = extraFilter === 'all'
    ? items
    : items.filter((g) => g.output_type === extraFilter)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {headerSlot && (
        <div className="flex-shrink-0">
          {headerSlot({ viewMode, setViewMode, allowGridView, totalCount, credits, accentColor })}
        </div>
      )}

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

          <AnimatePresence>
            {fallbackMsg && (
              <FallbackBanner
                message={fallbackMsg}
                onDismiss={() => setFallbackMsg(null)}
              />
            )}
          </AnimatePresence>

          {/* Time filter row */}
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

          {/* Status filter row */}
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

          {/* Extra output-type filter (UGC only) */}
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

          {/* Content */}
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>

          ) : filtered.length === 0 ? (
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

      {/* Footer slot */}
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
            onEdit={onEdit ? openEdit : undefined}
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
        {activeGen && sheetMode === 'edit' && onEdit && (
          <EditSheet
            key="edit"
            gen={activeGen}
            models={models}
            credits={credits}
            onClose={closeSheet}
            onConfirm={handleEditConfirm}
            accentColor={accentColor}
            accentSubtle={accentSubtle}
            filterEditModels={filterEditModels}
            computeEditCreditCost={computeEditCreditCost}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function preserveUGCKeys(existing, fresh) {
  const ugcKeys = ['ugc_generation_id', 'ugc_scene_prompt', 'ugc_filter_applied', 'ugc_aspect_ratio']
  const kept = {}
  for (const k of ugcKeys) {
    if (existing[k] !== undefined) kept[k] = existing[k]
  }
  return kept
}

function invertText(accentColor) {
  if (!accentColor || accentColor.startsWith('var(--text')) return 'var(--text-inverse)'
  return '#ffffff'
}

// ─────────────────────────────────────────────────────────────────────────────
// DefaultEmpty
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
