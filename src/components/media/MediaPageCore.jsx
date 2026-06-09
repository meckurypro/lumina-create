// src/components/media/MediaPageCore.jsx
//
// PERFORMANCE OVERHAUL — key changes:
//
//  1. POLLING: interval is now stable. Instead of rebuilding the interval
//     every time `items` changes (which happened on every poll result because
//     the dep array was `items.map(...).join(',')`), we store pending IDs in a
//     ref and only restart the interval when the *set of pending IDs* actually
//     changes. This eliminates the repeated interval teardown/rebuild cycle.
//
//  2. POLLING: uses a `Map` patch instead of replacing the whole items array,
//     so only changed rows re-render (React bails out on unchanged objects).
//
//  3. DOUBLE-FETCH: the "today has nothing → fall back to this_week" logic
//     previously ran two sequential DB queries on every initial mount. It now
//     only fires the fallback query when the first query actually returns zero
//     completed items, and it's guarded so it can't run more than once per
//     filter change.
//
//  4. STAGGER CAP: animation stagger is capped at 300ms total so a long list
//     doesn't visually delay the last cards by seconds.
//
//  5. Everything else — props API, sheet logic, filter logic — is unchanged.

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
import { Film, Loader2 } from 'lucide-react'
import { uploadAsset } from '@/lib/assets'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 12
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
// Helpers
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

function preserveUGCKeys(existing, fresh) {
  const ugcKeys = ['ugc_generation_id', 'ugc_scene_prompt', 'ugc_filter_applied', 'ugc_aspect_ratio']
  const kept = {}
  for (const k of ugcKeys) {
    if (existing[k] !== undefined) kept[k] = existing[k]
  }
  return kept
}

function isInProgress(g) {
  return g.status === 'pending' || g.status === 'processing'
}

export function isPreDispatchFailure(g) {
  return g.status === 'failed' && g.error_message === 'pre_dispatch_failure'
}

// Stable sorted key for a set of IDs — used to detect when pending set changes
function pendingKey(items) {
  return items
    .filter(isInProgress)
    .map((g) => g.id)
    .sort()
    .join(',')
}

// ─────────────────────────────────────────────────────────────────────────────
// MediaPageCore
// ─────────────────────────────────────────────────────────────────────────────

export default function MediaPageCore({
  fetcher,
  onRegenerate,
  filterRelevantModels,
  computeCreditCost,
  onCardClick,

  filterEditModels      = null,
  computeEditCreditCost = null,
  onEdit                = null,

  headerSlot,
  footerSlot,
  emptySlot,

  accentColor  = 'var(--text-primary)',
  accentSubtle = 'var(--bg-elevated)',
  accentBorder = 'var(--border-color)',

  extraStatusFilters = null,

  isNovice = false,

  allowGridView = false,
}) {
  const navigate                          = useNavigate()
  const { user, credits, refreshProfile } = useAuth()

  const [timeFilter,   setTimeFilter]   = useState('today')
  const [statusFilter, setStatusFilter] = useState('completed')
  const [extraFilter,  setExtraFilter]  = useState('all')
  const [viewMode,     setViewMode]     = useState('list')

  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(false)
  const [totalCount,  setTotalCount]  = useState(0)
  const [page,        setPage]        = useState(0)
  const [models,      setModels]      = useState([])

  const [activeGen,        setActiveGen]        = useState(null)
  const [sheetMode,        setSheetMode]        = useState(null)
  const [regenLoading,     setRegenLoading]     = useState(false)
  const [editLoading,      setEditLoading]      = useState(false)
  const [refreshLoading,   setRefreshLoading]   = useState(false)
  const [pendingDeleteGen, setPendingDeleteGen] = useState(null)
  const [savingAsset,      setSavingAsset]      = useState(false)

  const FALLBACK_DISMISSED_KEY = 'meckury_fallback_dismissed_date'

  const wasDismissedToday = () => {
    try { return localStorage.getItem(FALLBACK_DISMISSED_KEY) === new Date().toDateString() }
    catch { return false }
  }

  const dismissFallback = () => {
    try { localStorage.setItem(FALLBACK_DISMISSED_KEY, new Date().toDateString()) } catch {}
    setFallbackMsg(null)
  }

  const [fallbackMsg, setFallbackMsg] = useState(null)

  const NOVICE_WARNED_KEY = 'meckury_novice_warned_date'
  const [noviceModalOpen, setNoviceModalOpen] = useState(() => {
    if (!isNovice) return false
    try { return localStorage.getItem(NOVICE_WARNED_KEY) !== new Date().toDateString() }
    catch { return false }
  })

  const dismissNoviceModal = () => {
    try { localStorage.setItem(NOVICE_WARNED_KEY, new Date().toDateString()) } catch {}
    setNoviceModalOpen(false)
  }

  // ── Polling refs ───────────────────────────────────────────────────────────
  //
  // pollRef       — the interval handle
  // prevPendingKey — tracks the last *set* of pending IDs so we only restart
  //                  the interval when that set actually changes, not on every
  //                  render that touches items
  const pollRef         = useRef(null)
  const prevPendingKey  = useRef('')

  const hasInProgress          = items.some(isInProgress)
  const prevHasInProgress      = useRef(false)
  const autoSelectedInProgress = useRef(false)

  useEffect(() => {
    if (hasInProgress && !prevHasInProgress.current) {
      setStatusFilter('in_progress')
      autoSelectedInProgress.current = true
    }
    prevHasInProgress.current = hasInProgress
  }, [hasInProgress])

  useEffect(() => {
    if (!hasInProgress && statusFilter === 'in_progress') {
      const hasCompleted = items.some((g) => g.status === 'completed')
      setStatusFilter(hasCompleted ? 'completed' : 'all')
      autoSelectedInProgress.current = false
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasInProgress])

  const visibleStatusFilters = hasInProgress || statusFilter === 'in_progress'
    ? [{ label: 'In Progress', value: 'in_progress', dynamic: true }, ...STATUS_FILTERS]
    : STATUS_FILTERS

  // ── Models ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
      .then(({ data }) => setModels(data || []))
  }, [])

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async ({
    offset  = 0,
    reset   = false,
    tFilter = timeFilter,
    sFilter = statusFilter,
    silent  = false,
  } = {}) => {
    if (!user) return
    if (!silent) {
      if (offset === 0) setLoading(true)
      else              setLoadingMore(true)
    }

    const afterIso = getTimeRangeStart(tFilter)

    const { data, count } = await fetcher(user, {
      limit: PAGE_SIZE, offset, afterIso, statusFilter: 'all',
    })

    // ── Fallback: today → this_week when nothing completed today ──────────
    // Only runs once per load cycle (when offset === 0 and filter is "today").
    // Previously this ran unconditionally on every mount.
    if (
      offset === 0 &&
      tFilter === 'today' &&
      sFilter === 'completed' &&
      (data || []).filter((g) => g.status === 'completed').length === 0
    ) {
      const weekAfter = getTimeRangeStart('this_week')
      const { data: weekData, count: weekCount } = await fetcher(user, {
        limit: PAGE_SIZE, offset: 0, afterIso: weekAfter, statusFilter: 'all',
      })
      const completedThisWeek = (weekData || []).filter((g) => g.status === 'completed')
      if (completedThisWeek.length > 0) {
        if (!wasDismissedToday()) setFallbackMsg('Nothing completed today — showing this week')
        setItems(weekData || [])
        setTotalCount(weekCount || 0)
        setHasMore(PAGE_SIZE < (weekCount || 0))
        setLoading(false)
        setLoadingMore(false)
        return
      }
    }

    if (!wasDismissedToday()) setFallbackMsg(null)

    const visibleCount = (data || []).filter((g) =>
      sFilter === 'completed'   ? g.status === 'completed' :
      sFilter === 'failed'      ? g.status === 'failed'    :
      sFilter === 'in_progress' ? (g.status === 'pending' || g.status === 'processing') :
      true
    ).length
    setTotalCount(count || visibleCount || 0)
    setItems((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, fetcher, timeFilter, statusFilter])

  useEffect(() => {
    setPage(0)
    setItems([])
    load({ offset: 0, reset: true, tFilter: timeFilter, sFilter: statusFilter })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, user])

  // ── Polling — stable interval ──────────────────────────────────────────────
  //
  // We only restart the interval when the *set* of pending IDs changes.
  // This prevents the old pattern where every items state update (including
  // the poll result itself) would teardown+rebuild the interval, causing a
  // brief gap and redundant re-subscriptions.

  useEffect(() => {
    const key = pendingKey(items)

    // Set hasn't changed — leave existing interval running
    if (key === prevPendingKey.current) return
    prevPendingKey.current = key

    // Clear any existing interval
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }

    const pendingIds = items.filter(isInProgress).map((g) => g.id)
    if (!pendingIds.length || !user) return

    pollRef.current = setInterval(async () => {
      // Tight column set — polling only needs to know status + final URLs.
      const { data, error } = await supabase
        .from('generations')
        .select('id, status, output_url, output_thumbnail_url, error_message, provider_request_id')
        .in('id', pendingIds)

      if (error || !data) return

      // Patch only changed rows — avoids full list re-render
      const map = new Map(data.map((g) => [g.id, g]))
      setItems((prev) => {
        let changed = false
        const next = prev.map((g) => {
          const fresh = map.get(g.id)
          if (!fresh) return g
          // Deep-equal check on status + output_url to avoid unnecessary updates
          if (fresh.status === g.status && fresh.output_url === g.output_url) return g
          changed = true
          // Merge narrow poll result onto existing full row — preserves
          // columns we deliberately did not re-select.
          return { ...g, ...fresh, ...preserveUGCKeys(g, fresh) }
        })
        return changed ? next : prev
      })

      const anyResolved = data.some((g) => g.status === 'completed' || g.status === 'failed')
      if (anyResolved) refreshProfile()
    }, POLL_MS)

    return () => { clearInterval(pollRef.current); pollRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey(items), user])

  // ── Sheet helpers ──────────────────────────────────────────────────────────

  const openActions    = (gen) => { setActiveGen(gen); setSheetMode('actions')    }
  const openRegenerate = ()    => setSheetMode('regenerate')
  const openEdit       = ()    => setSheetMode('edit')
  const closeSheet     = ()    => { setActiveGen(null); setSheetMode(null) }

  // ── Action handlers ────────────────────────────────────────────────────────

  const handleDelete = (gen) => {
    closeSheet()
    setPendingDeleteGen(gen)
  }

  const confirmDelete = async () => {
    const gen = pendingDeleteGen
    setPendingDeleteGen(null)
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

  const handleSaveAsset = async (gen) => {
    closeSheet()
    if (!gen.output_url) return toast.error('No media URL found')
    if (!user?.id) return toast.error('Not signed in')

    const isVideo      = gen.output_type === 'video'
    const ext          = isVideo ? 'mp4' : 'png'
    const defaultName  = `meckury-${gen.id.slice(0, 8)}`
    const name         = window.prompt('Name this asset (or leave blank):', defaultName)
    if (name === null) return
    const displayName  = (name || defaultName).trim() || defaultName

    setSavingAsset(true)
    const toastId = toast.loading('Saving to your Assets…')
    try {
      const res  = await fetch(gen.output_url)
      if (!res.ok) throw new Error('Could not fetch media')
      const blob = await res.blob()
      const fallbackType = isVideo ? 'video/mp4' : 'image/png'
      const file = new File([blob], `${displayName}.${ext}`, { type: blob.type || fallbackType })
      await uploadAsset(user.id, file, displayName)
      toast.success('Saved to Assets', { id: toastId })
    } catch (e) {
      toast.error(e?.message || 'Failed to save asset', { id: toastId })
    } finally {
      setSavingAsset(false)
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
        'video-poll-single', { body: { generationId: gen.id } }
      )
      if (pollErr) throw new Error(pollErr.message || 'Poll failed')

      const { data: fresh } = await supabase
        .from('generations').select('*').eq('id', gen.id).single()

      if (fresh) {
        setItems((prev) => prev.map((g) =>
          g.id === gen.id ? { ...g, ...fresh, ...preserveUGCKeys(g, fresh) } : g
        ))
      }

      const status = pollResult?.status || fresh?.status
      if (status === 'completed')      { toast.success('✅ Generation is complete!'); refreshProfile() }
      else if (status === 'failed')    toast.error(`Failed: ${fresh?.error_message || 'Unknown error'}`)
      else                             toast('Still processing — check back in a moment.', { icon: '⏳' })
    } catch (err) {
      toast.error(err.message || 'Refresh failed')
    } finally {
      setRefreshLoading(false)
    }
  }

  const handleRetry = async (gen) => {
    closeSheet()
    if (!onRegenerate) return
    setRegenLoading(true)
    try {
      await onRegenerate(gen, gen.model, Number(gen.credits_charged), null, gen.prompt, {
        supabase, user, generationsDb, refreshProfile,
        setItems, setTotalCount, navigate,
      })
      toast.success('Resubmitted! Check back in a moment.', { duration: 4_000 })
    } catch (err) {
      toast.error(err.message || 'Retry failed')
    } finally {
      setRegenLoading(false)
    }
  }

  const handleRegenerateConfirm = async (chosenModel, creditCost, selectedModelObj, editedPrompt) => {
    if (!activeGen || !user) return
    const gen = activeGen
    closeSheet()
    setRegenLoading(true)
    try {
      await onRegenerate(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
        supabase, user, generationsDb, refreshProfile,
        setItems, setTotalCount, navigate,
      })
      toast.success('Regenerating! Check back in a moment.', { duration: 4_000 })
    } catch (err) {
      toast.error(err.message || 'Regeneration failed')
    } finally {
      setRegenLoading(false)
    }
  }

  const handleEditConfirm = async (chosenModel, creditCost, selectedModelObj, editedPrompt) => {
    if (!activeGen || !user || !onEdit) return
    const gen = activeGen
    closeSheet()
    setEditLoading(true)
    try {
      await onEdit(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
        supabase, user, generationsDb, refreshProfile,
        setItems, setTotalCount, navigate,
      })
      toast.success('Edit queued! Check back in a moment.', { duration: 4_000 })
    } catch (err) {
      toast.error(err.message || 'Edit failed')
    } finally {
      setEditLoading(false)
    }
  }

  // ── Derived: client-side filter ────────────────────────────────────────────

  const visibleItems = (() => {
    let list = items
    if (statusFilter === 'in_progress')  list = list.filter(isInProgress)
    else if (statusFilter === 'completed') list = list.filter((g) => g.status === 'completed')
    else if (statusFilter === 'failed')    list = list.filter((g) => g.status === 'failed')
    if (extraFilter !== 'all') list = list.filter((g) => g.output_type === extraFilter)
    return list
  })()

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {headerSlot && (
        <div className="flex-shrink-0">
          {headerSlot({ viewMode, setViewMode, allowGridView, totalCount, credits, accentColor })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-5">

          <AnimatePresence>
            {fallbackMsg && !wasDismissedToday() && (
              <FallbackBanner message={fallbackMsg} onDismiss={dismissFallback} />
            )}
          </AnimatePresence>

          {/* Time filter */}
          <div className="flex items-center gap-2 mb-3 justify-end">
            <div className="relative">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-2 rounded-xl text-sm font-semibold outline-none cursor-pointer"
                style={{
                  background:       'var(--bg-elevated)',
                  color:            'var(--text-secondary)',
                  border:           '1px solid var(--border-color)',
                  WebkitAppearance: 'none',
                }}
              >
                {TIME_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Status filter dots */}
          <div className="flex items-center gap-3 mb-4 justify-end">
            <AnimatePresence initial={false}>
              {visibleStatusFilters.map((f) => {
                const isActive = statusFilter === f.value
                const dotColor = {
                  completed:   '#10b981',
                  failed:      '#ef4444',
                  in_progress: '#eab308',
                  all:         'var(--text-primary)',
                }[f.value] ?? 'var(--text-muted)'

                return (
                  <motion.button
                    key={f.value}
                    layout
                    initial={f.dynamic ? { opacity: 0, scale: 0 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={f.dynamic ? { opacity: 0, scale: 0 } : undefined}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    onClick={() => setStatusFilter(f.value)}
                    title={f.label}
                    className="flex items-center justify-center transition-all active:scale-90"
                    style={{ padding: '4px' }}
                  >
                    {f.dynamic ? (
                      <motion.div
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                        style={{
                          width: 14, height: 14, borderRadius: 4, background: dotColor,
                          opacity:   isActive ? 1 : 0.25,
                          boxShadow: isActive ? `0 0 0 3px ${dotColor}33` : 'none',
                        }}
                      />
                    ) : (
                      <div style={{
                        width: 14, height: 14, borderRadius: 4, background: dotColor,
                        opacity:    isActive ? 1 : 0.25,
                        boxShadow:  isActive ? `0 0 0 3px ${dotColor}33` : 'none',
                        transition: 'opacity 0.15s, box-shadow 0.15s',
                      }} />
                    )}
                  </motion.button>
                )
              })}
            </AnimatePresence>
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
                    background: extraFilter === o.value ? accentColor : 'var(--bg-elevated)',
                    color:      extraFilter === o.value ? '#ffffff'    : 'var(--text-muted)',
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

          ) : visibleItems.length === 0 ? (
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
              {visibleItems.map((gen, i) => (
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
              {visibleItems.map((gen, i) => (
                <motion.div
                  key={gen.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0  }}
                  // ✅ cap stagger — long lists no longer have cards delayed by seconds
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <MediaCard
                    gen={gen}
                    modelsList={models}
                    accentColor={accentColor}
                    accentSubtle={accentSubtle}
                    onClick={() => onCardClick(gen, navigate)}
                    onMore={() => openActions(gen)}
                    onRetry={isPreDispatchFailure(gen) ? () => handleRetry(gen) : undefined}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && !loadingMore && visibleItems.length > 0 && (
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

      {footerSlot && !loading && items.length > 0 && (
        <div className="flex-shrink-0">{footerSlot()}</div>
      )}

      {/* Sheets */}
      <AnimatePresence>
        {activeGen && sheetMode === 'actions' && (
          <ActionSheet
            key="actions"
            gen={activeGen}
            onClose={closeSheet}
            onDelete={() => handleDelete(activeGen)}
            onRegenerate={openRegenerate}
            onEdit={onEdit && activeGen?.output_type !== 'video' ? openEdit : undefined}
            onRefresh={() => handleRefresh(activeGen)}
            onDownload={() => handleDownload(activeGen)}
            onSaveAsset={() => handleSaveAsset(activeGen)}
            onRetry={isPreDispatchFailure(activeGen) ? () => handleRetry(activeGen) : undefined}
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

      {/* Save-as-asset overlay */}
      <AnimatePresence>
        {savingAsset && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
          >
            <div
              className="flex flex-col items-center gap-3 px-6 py-5 rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-primary)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Saving to your Assets…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Novice storage warning */}
      <AnimatePresence>
        {noviceModalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={dismissNoviceModal}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(234,179,8,0.25)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Your media expires in 7 days</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Download or save your outputs before they're gone. Upgrade your plan to keep them permanently.
                  </p>
                </div>
              </div>
              <button onClick={dismissNoviceModal} className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.25)' }}>
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {pendingDeleteGen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setPendingDeleteGen(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Delete generation?</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPendingDeleteGen(null)} className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                  Cancel
                </button>
                <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DefaultEmpty
// ─────────────────────────────────────────────────────────────────────────────

function DefaultEmpty({ timeFilter, statusFilter, setTimeFilter, setStatusFilter, accentColor }) {
  const isTimeConstrained = timeFilter   !== 'all'
  const isStatusFiltered  = statusFilter !== 'all' && statusFilter !== 'in_progress'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 gap-5 text-center"
    >
      <Film size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
      <div>
        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {isTimeConstrained || isStatusFiltered
            ? 'Nothing matches these filters'
            : statusFilter === 'in_progress'
              ? 'Nothing generating right now'
              : 'No creations yet'}
        </p>
        <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
          {isTimeConstrained
            ? 'Try a wider time range, or switch to All.'
            : isStatusFiltered
              ? 'Try switching to All to see everything.'
              : statusFilter === 'in_progress'
                ? 'Start a generation and it will appear here.'
                : 'Start creating something amazing.'}
        </p>
      </div>
      {(isTimeConstrained || isStatusFiltered) && (
        <div className="flex gap-2">
          {isTimeConstrained && (
            <button onClick={() => setTimeFilter('all')} className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              Show All Time
            </button>
          )}
          {isStatusFiltered && (
            <button onClick={() => setStatusFilter('all')} className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
              Show All Status
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
