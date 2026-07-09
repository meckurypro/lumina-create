// src/components/media/AssetsPage.jsx
//
// DESIGN REFACTOR — key changes (on top of the earlier perf overhaul, which
// is fully preserved):
//
//  1. AssetActionSheet REBUILT on the same primitives as the Generations
//     ActionSheet: a 3-column icon grid for the "do something new" actions
//     (Polish/Upscale/Edit/Animate/Lipsync/Set to Motion for images;
//     Edit/Lipsync/Motion/Extract End Frame/Upscale for videos), a grouped
//     rows container for utility actions (Rename, Download), an isolated
//     Delete group, and an explicit Cancel row. This matches Apple's own
//     share-sheet layout and the grouped-list pattern from HIG, and gives
//     visual/behavioral consistency with the Generations ActionSheet.
//
//  2. TYPE FILTER (All/Images/Videos): the unlabeled colored-dot row is
//     replaced with labeled FilterPill buttons (imported from
//     MediaCardComponents, same component MediaPageCore now uses for its
//     status filter) — icons: ImageIcon / VideoIcon.
//
//  3. Everything else — fallback banner, lazy thumbnails, upload flow,
//     rename, extract-end-frame flow, pagination — is UNCHANGED.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate }                              from 'react-router-dom'
import { motion, AnimatePresence }                  from 'framer-motion'
import { useAuth }                                  from '@/context/AuthContext'
import { supabase }                                 from '@/lib/supabase'
import toast                                        from 'react-hot-toast'
import {
  Plus, Search, X, MoreHorizontal,
  Download, Trash2, Film, Pencil, Check,
  ImageIcon, VideoIcon, FolderOpen,
  Sparkles, Wand2, Mic2, Clapperboard, ScanLine, Zap, Maximize,
} from 'lucide-react'
import {
  uploadAsset, listAssets, renameAsset,
  deleteAsset, isVideoAsset, formatBytes,
} from '@/lib/assets.js'
import { FallbackBanner, FilterPill } from './MediaCardComponents.jsx'
import { EXTRACT_END_FRAME_COST } from '@/lib/videoFrame'
import FrameExtractModal from './FrameExtractModal.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCEPTED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
]
const MAX_FILE_MB = 50
const MAX_FILE_B  = MAX_FILE_MB * 1024 * 1024
const PAGE_SIZE   = 12

const LS_FALLBACK_DISMISSED   = 'meckury_assets_fallback_dismissed_date'

// SessionStorage keys
const SS_IMAGE_POLISH      = 'meckury_polish_image'
const SS_IMAGE_EDIT        = 'meckury_create_images'
const SS_VIDEO_START       = 'meckury_video_start_frame'
const SS_TH_SUBJECT_IMG    = 'meckury_th_subject_img'
const SS_TH_SUBJECT_VID    = 'meckury_th_subject_vid'
const SS_COPY_SUBJECT      = 'meckury_copymotion_subject'
const SS_COPY_MOTION_VIDEO = 'meckury_copymotion_video_asset'
const SS_VIDEO_OMNI_REF    = 'meckury_video_omni_ref'
const SS_IMAGE_UPSCALE = 'meckury_upscale_image'
const SS_VIDEO_UPSCALE = 'meckury_upscale_video'

const TIME_FILTERS = [
  { label: 'Today',      value: 'today'      },
  { label: 'This Week',  value: 'this_week'  },
  { label: 'This Month', value: 'this_month' },
  { label: 'All',        value: 'all'        },
]

// Type filter — now rendered with FilterPill (icon + label) instead of an
// unlabeled colored dot.
const TYPE_FILTERS = [
  { label: 'All',    value: 'all',   icon: null      },
  { label: 'Images', value: 'image', icon: ImageIcon },
  { label: 'Videos', value: 'video', icon: VideoIcon },
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

const wasFallbackDismissedToday = () => {
  try { return localStorage.getItem(LS_FALLBACK_DISMISSED) === new Date().toDateString() }
  catch { return false }
}

function buildUrlPayload(asset, fallbackType) {
  const type = fallbackType || (isVideoAsset(asset) ? 'video/mp4' : 'image/jpeg')
  return { url: asset.file_url, name: asset.name, type }
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetThumb
// ─────────────────────────────────────────────────────────────────────────────

function AssetThumb({ asset, onError }) {
  const isVideo = isVideoAsset(asset)

  if (asset.thumbnail_url) {
    return (
      <img
        src={asset.thumbnail_url}
        alt={asset.name}
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        onError={onError}
      />
    )
  }

  if (!isVideo) {
    return (
      <img
        src={asset.file_url}
        alt={asset.name}
        className="w-full h-full object-cover"
        loading="lazy"
        decoding="async"
        onError={onError}
      />
    )
  }

  return <VideoIcon size={20} style={{ color: 'var(--text-muted)' }} />
}

// ─────────────────────────────────────────────────────────────────────────────
// SkeletonCard
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="h-[72px] rounded-2xl animate-pulse"
      style={{ background: 'var(--bg-elevated)' }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetCard
// ─────────────────────────────────────────────────────────────────────────────

function AssetCard({
  asset,
  isRenaming, renameValue, setRenameValue,
  onStartRename, onCommitRename,
  onPreview, onMore,
}) {
  const inputRef            = useRef(null)
  const [imgErr, setImgErr] = useState(false)

  useEffect(() => {
    if (isRenaming) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isRenaming])

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      {/* Thumbnail */}
      <button
        onClick={onPreview}
        className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative group"
        style={{ background: 'var(--bg-primary)' }}
      >
        {imgErr ? (
          <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <AssetThumb asset={asset} onError={() => setImgErr(true)} />
        )}
        <div
          className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.45)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </div>
      </button>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onCommitRename() }}
              className="flex-1 text-sm font-semibold rounded-lg px-2 py-1 outline-none"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid #5B6EF7' }}
            />
            <button
              onClick={onCommitRename}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: '#5B6EF7' }}
            >
              <Check size={13} color="#fff" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 group">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {asset.name}
            </p>
            <button onClick={onStartRename} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <Pencil size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
        )}
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {[
            isVideoAsset(asset) ? 'Video' : 'Image',
            formatBytes(asset.size_bytes),
            asset.created_at
              ? new Date(asset.created_at).toLocaleDateString('en-NG', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
              : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* More button */}
      {!isRenaming && (
        <button
          onClick={onMore}
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-primary)' }}
        >
          <MoreHorizontal size={16} style={{ color: 'var(--text-muted)' }} />
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetsPage
// ─────────────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()
  const fileInputRef                               = useRef(null)
  const debounceRef                                = useRef(null)
  const fallbackFiredFor                           = useRef(null)

  const isMaster = profile?.user_tier === 'master'

  const [assets,       setAssets]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [hasMore,      setHasMore]      = useState(false)
  const [totalCount,   setTotalCount]   = useState(0)
  const [page,         setPage]         = useState(0)

  const [timeFilter,   setTimeFilter]   = useState('today')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [search,       setSearch]       = useState('')
  const [searchQuery,  setSearchQuery]  = useState('')
  const [fallbackMsg,  setFallbackMsg]  = useState(null)

  const [uploading,            setUploading]            = useState(false)
  const [previewAsset,         setPreviewAsset]         = useState(null)
  const [activeAsset,          setActiveAsset]          = useState(null)
  const [sheetOpen,            setSheetOpen]            = useState(false)
  const [pendingDelete,        setPendingDelete]        = useState(null)
  const [renamingId,           setRenamingId]           = useState(null)
  const [renameValue,          setRenameValue]          = useState('')
  const [extractingId,     setExtractingId]     = useState(null)  // asset.id currently uploading — drives busy overlay
  const [extractPickerAsset, setExtractPickerAsset] = useState(null) // asset currently open in the picker

  const dismissFallback = () => {
    try { localStorage.setItem(LS_FALLBACK_DISMISSED, new Date().toDateString()) } catch {}
    setFallbackMsg(null)
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async ({
    offset   = 0,
    reset    = false,
    tFilter  = timeFilter,
    tyFilter = typeFilter,
    q        = searchQuery,
    silent   = false,
  } = {}) => {
    if (!user) return
    if (!silent) {
      offset === 0 ? setLoading(true) : setLoadingMore(true)
    }

    const afterIso = getTimeRangeStart(tFilter)

    try {
      const { data, count } = await listAssets(user.id, {
        search:     q,
        limit:      PAGE_SIZE,
        offset,
        afterIso,
        typeFilter: tyFilter,
      })

      if (
        offset === 0 &&
        tFilter === 'today' &&
        (data || []).length === 0 &&
        fallbackFiredFor.current !== tFilter
      ) {
        fallbackFiredFor.current = tFilter

        const weekAfterIso = getTimeRangeStart('this_week')
        const { data: weekData, count: weekCount } = await listAssets(user.id, {
          search:     q,
          limit:      PAGE_SIZE,
          offset:     0,
          afterIso:   weekAfterIso,
          typeFilter: tyFilter,
        })

        if ((weekData || []).length > 0) {
          if (!wasFallbackDismissedToday()) {
            setFallbackMsg('Nothing uploaded today — showing this week')
          }
          setAssets(weekData || [])
          setTotalCount(weekCount || 0)
          setHasMore(PAGE_SIZE < (weekCount || 0))
          setLoading(false)
          setLoadingMore(false)
          return
        }
      }

      if (!wasFallbackDismissedToday()) setFallbackMsg(null)

      setTotalCount(count || 0)
      setAssets((prev) => reset ? (data || []) : [...prev, ...(data || [])])
      setHasMore((offset + PAGE_SIZE) < (count || 0))
    } catch (err) {
      toast.error(err.message || 'Failed to load assets')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [user, timeFilter, typeFilter, searchQuery])

  useEffect(() => {
    fallbackFiredFor.current = null
    setPage(0)
    setAssets([])
    load({ offset: 0, reset: true, tFilter: timeFilter, tyFilter: typeFilter, q: searchQuery })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, typeFilter, user])

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearchChange = (val) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val)
      fallbackFiredFor.current = null
      setPage(0)
      setAssets([])
      load({ offset: 0, reset: true, tFilter: timeFilter, tyFilter: typeFilter, q: val })
    }, 350)
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  const validateFile = (file) => {
    if (!ACCEPTED_MIME.includes(file.type)) return `${file.name}: unsupported type`
    if (file.size > MAX_FILE_B)             return `${file.name}: exceeds ${MAX_FILE_MB} MB`
    return null
  }

  const handleFiles = async (files) => {
    const fileList = Array.from(files)
    if (!fileList.length) return
    for (const f of fileList) {
      const err = validateFile(f)
      if (err) { toast.error(err); return }
    }
    setUploading(true)
    try {
      const results = await Promise.all(
        fileList.map((file) => uploadAsset(user.id, file, file.name.replace(/\.[^.]+$/, '')))
      )
      setAssets((prev) => [...[...results].reverse(), ...prev])
      setTotalCount((c) => c + results.length)
      toast.success(
        results.length === 1
          ? `${results[0].name} uploaded`
          : `${results.length} assets uploaded`
      )
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ── Sheet helpers ──────────────────────────────────────────────────────────

  const openSheet  = (asset) => { setActiveAsset(asset); setSheetOpen(true)  }
  const closeSheet = ()      => { setActiveAsset(null);  setSheetOpen(false) }

  // ── Download ───────────────────────────────────────────────────────────────

  const handleDownload = async (asset) => {
    closeSheet()
    try {
      const res  = await fetch(asset.file_url)
      const blob = await res.blob()
      const ext  = asset.file_path.split('.').pop()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `${asset.name}.${ext}`; a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded')
    } catch { toast.error('Download failed') }
  }

  // ── Navigate with URL payload ──────────────────────────────────────────────

  const prepareAndNavigate = (asset, key, route, { wrapAsArray = false, alsoRemove = [], fallbackType } = {}) => {
    closeSheet()
    const payload = buildUrlPayload(asset, fallbackType)
    try {
      sessionStorage.setItem(key, JSON.stringify(wrapAsArray ? [payload] : payload))
      for (const k of alsoRemove) sessionStorage.removeItem(k)
    } catch (err) {
      console.error('sessionStorage write failed', err)
      toast.error('Could not pass asset to page — try again')
      return
    }
    navigate(route)
  }

  // ── IMAGE actions ──────────────────────────────────────────────────────────

  const handlePolish       = (asset) => prepareAndNavigate(asset, SS_IMAGE_POLISH,   '/create/photo-polish', { fallbackType: 'image/jpeg' })
  const handleEditImage    = (asset) => prepareAndNavigate(asset, SS_IMAGE_EDIT,     '/create/image',        { wrapAsArray: true, alsoRemove: ['meckury_create_prompt'], fallbackType: 'image/jpeg' })
  const handleAnimate      = (asset) => prepareAndNavigate(asset, SS_VIDEO_START,    '/create/video',        { alsoRemove: ['meckury_video_end_frame'], fallbackType: 'image/png' })
  const handleLipsyncImage = (asset) => prepareAndNavigate(asset, SS_TH_SUBJECT_IMG, '/create/talking-head', { alsoRemove: [SS_TH_SUBJECT_VID], fallbackType: 'image/jpeg' })
  const handleSetToMotion  = (asset) => prepareAndNavigate(asset, SS_COPY_SUBJECT,   '/create/copy-motion',  { fallbackType: 'image/jpeg' })

  // ── VIDEO actions ──────────────────────────────────────────────────────────

  const handleEditVideo = (asset) => {
    closeSheet()
    try {
      sessionStorage.setItem(SS_VIDEO_OMNI_REF, JSON.stringify({ url: asset.file_url, name: asset.name }))
      sessionStorage.removeItem(SS_VIDEO_START)
      sessionStorage.removeItem('meckury_video_end_frame')
      sessionStorage.removeItem('meckury_video_ref_images')
    } catch {}
    navigate('/create/video')
  }

  const handleLipsyncVideo = (asset) =>
    prepareAndNavigate(asset, SS_TH_SUBJECT_VID, '/create/talking-head', {
      alsoRemove: [SS_TH_SUBJECT_IMG], fallbackType: 'video/mp4',
    })

  const handleSetVideoForMotion = (asset) =>
    prepareAndNavigate(asset, SS_COPY_MOTION_VIDEO, '/create/copy-motion', { fallbackType: 'video/mp4' })
  const handleUpscaleImage = (asset) => prepareAndNavigate(asset, SS_IMAGE_UPSCALE, '/create/image-upscaler', { fallbackType: 'image/jpeg' })
  const handleUpscaleVideo = (asset) => prepareAndNavigate(asset, SS_VIDEO_UPSCALE, '/create/video-upscaler', { fallbackType: 'video/mp4' })

  // ── Extract end frame ──────────────────────────────────────────────────────

  const handleOpenFramePicker = (asset) => {
    closeSheet()
    if (!isMaster && credits < EXTRACT_END_FRAME_COST) {
      toast.error(`Not enough credits — extracting a frame costs ${EXTRACT_END_FRAME_COST} credits`)
      return
    }
    setExtractPickerAsset(asset)
  }

  const runExtractFrame = async (blob, { isEndFrame } = {}) => {
    const asset = extractPickerAsset
    if (!asset) return
    setExtractingId(asset.id)   // shows busy overlay; picker modal stays mounted underneath
    try {
      const suffix = isEndFrame ? '_end_frame' : '_frame'
      const label  = isEndFrame ? 'end frame' : 'frame'
      const frameFile = new File(
        [blob],
        `${asset.name.replace(/[^\w\-]+/g, '_')}${suffix}.png`,
        { type: 'image/png' },
      )
      const saved = await uploadAsset(user.id, frameFile, `${asset.name} — ${label}`)
      setAssets((prev) => [saved, ...prev])
      setTotalCount((c) => c + 1)

      if (!isMaster) {
        const { data: deduct, error: dErr } = await supabase.rpc('deduct_credits', {
          p_user_id: user.id, p_amount: EXTRACT_END_FRAME_COST,
          p_generation_id: null, p_description: 'Frame extraction',
        })
        if (dErr || !deduct?.success) {
          toast.success(`Saved ${label} to Assets`)
          toast.error('Credit deduction failed — contact support', { duration: 8000 })
        } else {
          refreshProfile()
          toast.success(`Saved ${label} — ${EXTRACT_END_FRAME_COST} credits used`)
        }
      } else {
        toast.success(`Saved ${label} to Assets`)
      }
    } catch (err) {
      toast.error(err.message || 'Could not extract frame')
    } finally {
      setExtractingId(null)   // hides overlay — picker stays open, same scrub/crop state
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = (asset) => { closeSheet(); setPendingDelete(asset) }

  const confirmDelete = async () => {
    const asset = pendingDelete
    setPendingDelete(null)
    try {
      await deleteAsset(asset)
      setAssets((prev) => prev.filter((a) => a.id !== asset.id))
      setTotalCount((c) => c - 1)
      toast.success('Deleted')
    } catch (err) { toast.error(err.message || 'Delete failed') }
  }

  // ── Rename ─────────────────────────────────────────────────────────────────

  const startRename  = (asset) => { setRenamingId(asset.id); setRenameValue(asset.name) }

  const commitRename = async (asset) => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === asset.name) { setRenamingId(null); return }
    try {
      const updated = await renameAsset(asset.id, trimmed)
      setAssets((prev) => prev.map((a) => a.id === asset.id ? { ...a, name: updated.name } : a))
      toast.success('Renamed')
    } catch (err) { toast.error(err.message || 'Rename failed') }
    finally { setRenamingId(null) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto">

      {/* Uploading overlay */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'rgba(91,110,247,0.3)', borderTopColor: '#5B6EF7' }}
            />
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>Uploading…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Frame extraction busy overlay — sits ABOVE the picker modal
          (z-[70] > picker's z-[60]) so it visually covers it while the
          upload/credit-deduct runs, then disappears back to the picker. */}
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

      <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-5">

        {/* Search + upload row */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-2xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by name…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {search && (
              <button onClick={() => handleSearchChange('')}>
                <X size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
            style={{ background: '#5B6EF7' }}
            title="Upload assets"
          >
            <Plus size={20} color="#fff" strokeWidth={2.5} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_MIME.join(',')}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Fallback banner */}
        <AnimatePresence>
          {fallbackMsg && !wasFallbackDismissedToday() && (
            <FallbackBanner message={fallbackMsg} onDismiss={dismissFallback} />
          )}
        </AnimatePresence>

        {/* Time filter dropdown */}
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
              {TIME_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Type filter — labeled pills (was: unlabeled colored dots) */}
        <div className="flex items-center gap-2 mb-4 justify-end flex-wrap">
          {TYPE_FILTERS.map((f) => (
            <FilterPill
              key={f.value}
              active={typeFilter === f.value}
              onClick={() => setTypeFilter(f.value)}
              label={f.label}
              icon={f.icon}
              tone="#5B6EF7"
            />
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>

        ) : assets.length === 0 ? (
          <AssetsEmpty
            search={search}
            timeFilter={timeFilter}
            typeFilter={typeFilter}
            onUpload={() => fileInputRef.current?.click()}
            onClearFilters={() => {
              fallbackFiredFor.current = null
              setTimeFilter('all')
              setTypeFilter('all')
              handleSearchChange('')
            }}
          />

        ) : (
          <>
            <div className="flex flex-col gap-3">
              <AnimatePresence initial={false}>
                {assets.map((asset, i) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ delay: Math.min(i * 0.025, 0.3) }}
                  >
                    <AssetCard
                      asset={asset}
                      isRenaming={renamingId === asset.id}
                      renameValue={renameValue}
                      setRenameValue={setRenameValue}
                      onStartRename={() => startRename(asset)}
                      onCommitRename={() => commitRename(asset)}
                      onPreview={() => setPreviewAsset(asset)}
                      onMore={() => openSheet(asset)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {hasMore && !loadingMore && (
              <button
                onClick={() => {
                  const next = page + 1
                  setPage(next)
                  load({ offset: next * PAGE_SIZE, tFilter: timeFilter, tyFilter: typeFilter, q: searchQuery })
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
                  style={{ borderColor: 'var(--border-color)', borderTopColor: '#5B6EF7' }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Asset preview modal */}
      <AnimatePresence>
        {previewAsset && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
            onClick={() => setPreviewAsset(null)}
          >
            <button
              onClick={() => setPreviewAsset(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              <X size={18} />
            </button>
            <p
              className="absolute top-5 left-1/2 -translate-x-1/2 text-sm font-semibold truncate max-w-[60vw]"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {previewAsset.name}
            </p>
            {isVideoAsset(previewAsset) ? (
              <motion.video
                key={previewAsset.id}
                initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                src={previewAsset.file_url}
                controls autoPlay playsInline
                className="rounded-2xl"
                style={{ maxWidth: '100%', maxHeight: '85dvh', outline: 'none' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <motion.img
                key={previewAsset.id}
                initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                src={previewAsset.file_url}
                alt={previewAsset.name}
                className="rounded-2xl"
                style={{ maxWidth: '100%', maxHeight: '85dvh', objectFit: 'contain' }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action sheet */}
      <AnimatePresence>
        {sheetOpen && activeAsset && (
          <AssetActionSheet
            asset={activeAsset}
            isMaster={isMaster}
            onClose={closeSheet}
            onRename={() => { closeSheet(); startRename(activeAsset) }}
            onDownload={() => handleDownload(activeAsset)}
            onPolish={!isVideoAsset(activeAsset)           ? () => handlePolish(activeAsset)            : undefined}
            onEditImage={!isVideoAsset(activeAsset)        ? () => handleEditImage(activeAsset)         : undefined}
            onAnimate={!isVideoAsset(activeAsset)          ? () => handleAnimate(activeAsset)           : undefined}
            onLipsyncImage={!isVideoAsset(activeAsset)     ? () => handleLipsyncImage(activeAsset)      : undefined}
            onSetToMotion={!isVideoAsset(activeAsset)      ? () => handleSetToMotion(activeAsset)       : undefined}
            onEditVideo={isVideoAsset(activeAsset)         ? () => handleEditVideo(activeAsset)         : undefined}
            onLipsyncVideo={isVideoAsset(activeAsset)      ? () => handleLipsyncVideo(activeAsset)      : undefined}
            onSetVideoForMotion={isVideoAsset(activeAsset) ? () => handleSetVideoForMotion(activeAsset) : undefined}
            onUpscaleImage={!isVideoAsset(activeAsset) ? () => handleUpscaleImage(activeAsset) : undefined}
            onUpscaleVideo={isVideoAsset(activeAsset)  ? () => handleUpscaleVideo(activeAsset)  : undefined}
            onExtractEndFrame={isVideoAsset(activeAsset) ? () => handleOpenFramePicker(activeAsset) : undefined}
            onDelete={() => handleDelete(activeAsset)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {pendingDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setPendingDelete(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  Delete "{pendingDelete.name}"?
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>This cannot be undone.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPendingDelete(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                >Cancel</button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
                >Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

     {/* Frame picker — stays mounted through extraction; only the
          user's own Cancel closes it. */}
      <AnimatePresence>
        {extractPickerAsset && (
          <FrameExtractModal
            videoUrl={extractPickerAsset.file_url}
            cost={EXTRACT_END_FRAME_COST}
            isMaster={isMaster}
            busy={extractingId === extractPickerAsset.id}
            onExtract={runExtractFrame}
            onCancel={() => setExtractPickerAsset(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetActionSheet — rebuilt on the icon-grid + grouped-rows pattern
// ─────────────────────────────────────────────────────────────────────────────

function AssetActionSheet({
  asset, isMaster, onClose, onRename, onDownload, onDelete,
  onPolish, onEditImage, onAnimate, onLipsyncImage, onSetToMotion,
  onEditVideo, onLipsyncVideo, onSetVideoForMotion, onExtractEndFrame,
  onUpscaleImage, onUpscaleVideo,
}) {
  const isVideo = isVideoAsset(asset)

  // Primary "do something new" actions — rendered as a 3-col icon grid,
  // mirroring Apple's own share sheet layout.
  const gridItems = !isVideo ? [
    { icon: Sparkles,     label: 'Polish',  onClick: onPolish       },
    { icon: Maximize,     label: 'Upscale', onClick: onUpscaleImage },
    { icon: Wand2,        label: 'Edit',    onClick: onEditImage    },
    { icon: Film,         label: 'Animate', onClick: onAnimate      },
    { icon: Mic2,         label: 'Lipsync', onClick: onLipsyncImage },
    { icon: Clapperboard, label: 'Motion',  onClick: onSetToMotion  },
  ] : [
    { icon: Wand2,        label: 'Edit',      onClick: onEditVideo         },
    { icon: Mic2,         label: 'Lipsync',   onClick: onLipsyncVideo      },
    { icon: Clapperboard, label: 'Motion',    onClick: onSetVideoForMotion },
    { icon: ScanLine,     label: 'Frames', onClick: onExtractEndFrame   },
    { icon: Maximize,     label: 'Upscale',   onClick: onUpscaleVideo      },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      >
        <div
          className="w-full max-w-xl rounded-t-3xl px-4 pt-4 pb-10"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
          </div>
          <p className="text-xs font-semibold mb-3 truncate px-1" style={{ color: 'var(--text-muted)' }}>
            {asset.name}
          </p>

          {/* Primary actions — icon grid */}
          <div className="grid grid-cols-3 gap-0.5 mb-3">
            {gridItems.map((it) => (
              <AssetActionGridItem key={it.label} icon={it.icon} label={it.label} onClick={it.onClick} />
            ))}
          </div>

          {/* Utility group — Rename / Download */}
          <div
            className="rounded-2xl overflow-hidden mb-2.5"
            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
          >            <AssetActionRow icon={Pencil} label="Rename" onClick={onRename} />
            <AssetActionRow icon={Download} label="Download" onClick={onDownload} isLast />
          </div>

          {/* Extra context for Extract End Frame cost — shown as a note
              under the grid rather than a subtitle (grid cells stay
              single-word), only for non-master users on video assets. */}
          {isVideo && !isMaster && (
            <p className="text-xs px-1 mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Extracting a frame costs {EXTRACT_END_FRAME_COST} credits · Master plan unlocks it for free.
            </p>
          )}

          {/* Destructive */}
          <div
            className="rounded-2xl overflow-hidden mb-2.5"
            style={{ border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AssetActionRow icon={Trash2} label="Delete" onClick={onDelete} danger isLast />
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  )
}

// Local primitives scoped to this file — same visual language as the
// ActionGridItem/ActionRow primitives in MediaCardComponents.jsx.

function AssetActionGridItem({ icon: Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 py-3 rounded-xl transition-all active:scale-95"
    >
      <div
        className="flex items-center justify-center rounded-xl"
        style={{ width: 46, height: 46, background: 'var(--brand-light)' }}
      >
        <Icon size={20} style={{ color: 'var(--brand)' }} />
      </div>
      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
    </button>
  )
}

function AssetActionRow({ icon: Icon, label, onClick, danger, isLast }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all active:scale-[0.98]"
      style={{
        background:   danger ? 'rgba(239,68,68,0.06)' : 'transparent',
        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
      }}
    >
      <div
        className="flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ width: 32, height: 32, background: danger ? 'rgba(239,68,68,0.12)' : 'var(--bg-elevated)' }}
      >
        <Icon size={15} style={{ color: danger ? '#ef4444' : 'var(--text-secondary)' }} />
      </div>
      <span className="text-sm font-semibold" style={{ color: danger ? '#ef4444' : 'var(--text-primary)' }}>{label}</span>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetsEmpty — unchanged
// ─────────────────────────────────────────────────────────────────────────────

function AssetsEmpty({ search, timeFilter, typeFilter, onUpload, onClearFilters }) {
  const isFiltered = search || timeFilter !== 'all' || typeFilter !== 'all'
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 gap-4 text-center"
    >
      <FolderOpen size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
      <div>
        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {isFiltered ? 'Nothing matches these filters' : 'No assets yet'}
        </p>
        <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
          {isFiltered
            ? 'Try adjusting your filters or search.'
            : 'Upload images or videos to reuse across your creations.'}
        </p>
      </div>
      {isFiltered ? (
        <button onClick={onClearFilters} className="px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
          Clear filters
        </button>
      ) : (
        <button onClick={onUpload} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: '#5B6EF7', color: '#fff' }}>
          <Plus size={15} strokeWidth={2.5} />
          Upload your first asset
        </button>
      )}
    </motion.div>
  )
}
