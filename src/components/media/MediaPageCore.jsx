// src/components/media/MediaPageCore.jsx
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
  FilterPill,
} from './MediaCardComponents.jsx'
import FrameExtractModal from './FrameExtractModal.jsx'
import { Film, Loader2, CheckCircle2, XCircle, Clock, Image as ImageIcon } from 'lucide-react'
import { uploadAsset, uploadGenerationThumbnail } from '@/lib/assets'
import { extractPosterFrame, EXTRACT_END_FRAME_COST } from '@/lib/videoFrame'

async function extractImageThumbnail(imageUrl, maxSize = 400, quality = 0.6) {
  const res  = await fetch(imageUrl)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob)

  const scale  = Math.min(maxSize / bitmap.width, maxSize / bitmap.height, 1)
  const w      = Math.round(bitmap.width  * scale)
  const h      = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (thumbBlob) => thumbBlob ? resolve(thumbBlob) : reject(new Error('Canvas toBlob failed')),
      'image/jpeg',
      quality,
    )
  })
}

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

const STATUS_FILTER_CONFIG = {
  completed:   { icon: CheckCircle2, tone: '#10b981' },
  failed:      { icon: XCircle,      tone: '#ef4444' },
  in_progress: { icon: Clock,        tone: '#eab308' },
  all:         { icon: null,         tone: 'var(--text-primary)' },
}

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
  return g.status === 'pending' || g.status === 'queued' || g.status === 'processing'
}
export function isPreDispatchFailure(g) {
  return g.status === 'failed' && g.error_message === 'pre_dispatch_failure'
}

// Queued jobs sitting in the render-window pod queue can be pushed to
// the model's RunPod serverless endpoint instead of waiting their turn —
// but only if that model actually has serverless dispatch enabled.
function canProcessNow(gen, modelsList) {
  if (!gen || gen.status !== 'queued') return false
  const model = modelsList.find((m) => m.value === gen.model)
  return !!model?.supports_serverless
}

function pendingKey(items) {
  return items
    .filter(isInProgress)
    .map((g) => g.id)
    .sort()
    .join(',')
}

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
  const navigate                                    = useNavigate()
  const { user, credits, refreshProfile, profile }  = useAuth()

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
  const [processNowLoading, setProcessNowLoading] = useState(false)
  const [pendingDeleteGen, setPendingDeleteGen] = useState(null)
  const [savingAsset,      setSavingAsset]      = useState(false)
  const [extractingId,     setExtractingId]     = useState(null)
  const [extractPickerGen, setExtractPickerGen] = useState(null)   // gen currently in the frame picker

  const isMaster = profile?.user_tier === 'master'

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

  useEffect(() => {
    supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
      .then(({ data }) => setModels(data || []))
  }, [])

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
        setTimeFilter('this_week')
        setLoading(false)
        setLoadingMore(false)
        return
      }
      setItems(data || [])
      setTotalCount(count || 0)
      setHasMore((PAGE_SIZE) < (count || 0))
      setLoading(false)
      setLoadingMore(false)
      return
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

  useEffect(() => {
    const key = pendingKey(items)

    if (key === prevPendingKey.current) return
    prevPendingKey.current = key

    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }

    const pendingIds = items.filter(isInProgress).map((g) => g.id)
    if (!pendingIds.length || !user) return

    pollRef.current = setInterval(async () => {
      const { data, error } = await supabase
        .from('generations')
        .select('id, status, output_url, output_thumbnail_url, error_message, provider_request_id')
        .in('id', pendingIds)

      if (error || !data) return

      const map = new Map(data.map((g) => [g.id, g]))
      setItems((prev) => {
        let changed = false
        const next = prev.map((g) => {
          const fresh = map.get(g.id)
          if (!fresh) return g
          if (fresh.status === g.status && fresh.output_url === g.output_url) return g
          changed = true
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

  const thumbAttemptedRef = useRef(new Set())
  const thumbQueueRef     = useRef([])
  const thumbActiveRef    = useRef(0)
  const THUMB_CONCURRENCY = 2

const runThumbQueue = useCallback(() => {
    if (!user) return
    while (thumbActiveRef.current < THUMB_CONCURRENCY && thumbQueueRef.current.length > 0) {
      const gen = thumbQueueRef.current.shift()
      thumbActiveRef.current += 1
      ;(async () => {
        try {
          const blob = gen.output_type === 'image'
            ? await extractImageThumbnail(gen.output_url)
            : await extractPosterFrame(gen.output_url)
          const thumbUrl = await uploadGenerationThumbnail(user.id, gen.id, blob)
          await supabase.from('generations').update({ output_thumbnail_url: thumbUrl }).eq('id', gen.id)
          setItems((prev) => prev.map((g) => g.id === gen.id ? { ...g, output_thumbnail_url: thumbUrl } : g))
        } catch (err) {
          console.warn('[thumb-backfill] failed for', gen.id, err.message)
        } finally {
          thumbActiveRef.current -= 1
          runThumbQueue()
        }
      })()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

 useEffect(() => {
    if (!user) return
    const newCandidates = items.filter(
      (g) => g.status === 'completed' &&
             (g.output_type === 'video' || g.output_type === 'image') &&
             g.output_url &&
             (!g.output_thumbnail_url || g.output_thumbnail_url === g.output_url) &&
             !thumbAttemptedRef.current.has(g.id)
    )
    if (!newCandidates.length) return

    newCandidates.forEach((g) => thumbAttemptedRef.current.add(g.id))
    thumbQueueRef.current.push(...newCandidates)
    runThumbQueue()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, user, runThumbQueue])

  const openActions    = (gen) => { setActiveGen(gen); setSheetMode('actions')    }
  const openRegenerate = ()    => setSheetMode('regenerate')
  const openEdit       = ()    => setSheetMode('edit')
  const closeSheet     = ()    => { setActiveGen(null); setSheetMode(null) }

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
    try {
      const res  = await fetch(gen.output_url)
      if (!res.ok) throw new Error('Could not fetch media')
      const blob = await res.blob()
      const fallbackType = isVideo ? 'video/mp4' : 'image/png'
      const file = new File([blob], `${displayName}.${ext}`, { type: blob.type || fallbackType })
      await uploadAsset(user.id, file, displayName)
      toast.success('Saved to Assets')
    } catch (e) {
      toast.error(e?.message || 'Failed to save asset')
    } finally {
      setSavingAsset(false)
    }
  }

const handleOpenFramePicker = (gen) => {
    closeSheet()
    if (gen.status !== 'completed' || !gen.output_url) return
    if (!isMaster && credits < EXTRACT_END_FRAME_COST) {
      toast.error(`Not enough credits — extracting a frame costs ${EXTRACT_END_FRAME_COST} credits`)
      return
    }
    setExtractPickerGen(gen)
  }

const runExtractFrame = async (blob, { isEndFrame } = {}) => {
    const gen = extractPickerGen
    if (!gen) return
    setExtractingId(gen.id)
    try {
      const baseName  = `meckury-${gen.id.slice(0, 8)}`
      const suffix    = isEndFrame ? '_end_frame' : '_frame'
      const label     = isEndFrame ? 'end frame' : 'frame'
      const frameFile = new File([blob], `${baseName}${suffix}.png`, { type: 'image/png' })
      await uploadAsset(user.id, frameFile, `${baseName} — ${label}`)

      if (!isMaster) {
        const { data: deduct, error: dErr } = await supabase.rpc('deduct_credits', {
          p_user_id: user.id, p_amount: EXTRACT_END_FRAME_COST,
          p_generation_id: null, p_description: 'Frame extraction',
        })
        if (dErr || !deduct?.success) {
          toast.success(`Saved ${label} to your Assets`)
          toast.error('Credit deduction failed — contact support', { duration: 8000 })
        } else {
          refreshProfile()
          toast.success(`Saved ${label} to Assets — ${EXTRACT_END_FRAME_COST} credits used`)
        }
      } else {
        toast.success(`Saved ${label} to your Assets`)
      }
    } catch (err) {
      toast.error(err.message || 'Could not extract frame')
    } finally {
      setExtractingId(null)
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

  const handleProcessNow = async (gen) => {
    if (!gen) return
    setProcessNowLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('process-now', {
        body: { generationId: gen.id },
      })
      if (error) throw new Error(error.message || 'Process Now failed')
      if (data?.error) throw new Error(data.error)

      setItems((prev) => prev.map((g) =>
        g.id === gen.id ? { ...g, status: 'processing', dispatch_target: 'serverless' } : g
      ))
      refreshProfile()
      toast.success('Sent to serverless — this will be quick!')
      closeSheet()
    } catch (err) {
      toast.error(err.message || 'Could not process now')
    } finally {
      setProcessNowLoading(false)
    }
  }

  const handleRetry = async (gen) => {
    closeSheet()
    if (!onRegenerate) return
    if (gen.is_system_prompt) return
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
    if (activeGen.is_system_prompt) return
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

  const visibleItems = (() => {
    let list = items
    if (statusFilter === 'in_progress')  list = list.filter(isInProgress)
    else if (statusFilter === 'completed') list = list.filter((g) => g.status === 'completed')
    else if (statusFilter === 'failed')    list = list.filter((g) => g.status === 'failed')
    if (extraFilter !== 'all') list = list.filter((g) => g.output_type === extraFilter)
    return list
  })()

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

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

          {/* Status filter — labeled pills (was: unlabeled colored dots) */}
          <div className="flex items-center gap-2 mb-4 justify-end flex-wrap">
            <AnimatePresence initial={false}>
              {visibleStatusFilters.map((f) => {
                const isActive = statusFilter === f.value
                const config   = STATUS_FILTER_CONFIG[f.value] || { icon: null, tone: 'var(--text-primary)' }

                return (
                  <motion.div
                    key={f.value}
                    layout
                    initial={f.dynamic ? { opacity: 0, scale: 0 } : false}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={f.dynamic ? { opacity: 0, scale: 0 } : undefined}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    <FilterPill
                      active={isActive}
                      onClick={() => setStatusFilter(f.value)}
                      label={f.label}
                      icon={config.icon}
                      tone={config.tone}
                      pulse={!!f.dynamic}
                    />
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>

          {/* Extra output-type filter (Image/Video) — same FilterPill */}
          {extraStatusFilters && !loading && items.length > 0 && (
            <div className="flex gap-2 mb-5 justify-end flex-wrap">
              {extraStatusFilters.map((o) => (
                <FilterPill
                  key={o.value}
                  active={extraFilter === o.value}
                  onClick={() => setExtraFilter(o.value)}
                  label={o.label}
                  icon={o.icon}
                  tone={accentColor}
                />
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5">
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
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <MediaCard
                    gen={gen}
                    modelsList={models}
                    accentColor={accentColor}
                    accentSubtle={accentSubtle}
                    onClick={() => onCardClick(gen, navigate)}
                    onMore={() => openActions(gen)}
                    onRetry={isPreDispatchFailure(gen) && !gen.is_system_prompt ? () => handleRetry(gen) : undefined}
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
            onRetry={isPreDispatchFailure(activeGen) && !activeGen.is_system_prompt ? () => handleRetry(activeGen) : undefined}
            onExtractEndFrame={activeGen?.output_type === 'video' ? () => handleOpenFramePicker(activeGen) : undefined}
            onProcessNow={canProcessNow(activeGen, models) ? () => handleProcessNow(activeGen) : undefined}
            extractLoading={extractingId === activeGen?.id}
            refreshLoading={refreshLoading}
            processNowLoading={processNowLoading}
            processNowCost={
              canProcessNow(activeGen, models) && computeCreditCost
                ? computeCreditCost(models.find((m) => m.value === activeGen.model), activeGen)
                : null
            }
          />
        )}
        {activeGen && sheetMode === 'regenerate' && !activeGen.is_system_prompt && (
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
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'rgba(91,110,247,0.3)', borderTopColor: '#5B6EF7' }}
            />
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>Saving to your Assets…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frame extraction busy overlay — sits ABOVE the picker modal
          (z-[70] > modal's z-[60]) so it visually covers the modal while
          the upload/credit-deduct runs, then disappears back to it. */}
      <AnimatePresence>
        {extractingId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'rgba(91,110,247,0.3)', borderTopColor: '#5B6EF7' }}
            />
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>Saving frame…</p>
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

{/* Frame extraction picker — stays mounted through extraction;
          only the user's own Cancel click closes it. */}
      <AnimatePresence>
        {extractPickerGen && (
          <FrameExtractModal
            videoUrl={extractPickerGen.output_url}
            aspectRatio={extractPickerGen.aspect_ratio}
            cost={EXTRACT_END_FRAME_COST}
            isMaster={isMaster}
            busy={extractingId === extractPickerGen.id}
            onExtract={runExtractFrame}
            onCancel={() => setExtractPickerGen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

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
