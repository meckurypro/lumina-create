// src/components/media/AssetsPage.jsx

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate }                              from 'react-router-dom'
import { motion, AnimatePresence }                  from 'framer-motion'
import { useAuth }                                  from '@/context/AuthContext'
import toast                                        from 'react-hot-toast'
import {
  Plus, Search, X, MoreHorizontal,
  Download, Trash2, Film, Pencil, Check,
  ImageIcon, VideoIcon, FolderOpen,
  Sparkles, Wand2, Mic2, Clapperboard, ScanLine,
} from 'lucide-react'
import {
  uploadAsset, listAssets, renameAsset,
  deleteAsset, isVideoAsset, formatBytes,
} from '@/lib/assets.js'

const ACCEPTED_MIME = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
]
const MAX_FILE_MB = 50
const MAX_FILE_B  = MAX_FILE_MB * 1024 * 1024
const PAGE_SIZE   = 20

// ── SessionStorage keys ───────────────────────────────────────────────────────
const SS_IMAGE_POLISH   = 'meckury_polish_image'
const SS_IMAGE_EDIT     = 'meckury_create_images'
const SS_VIDEO_START    = 'meckury_video_start_frame'
const SS_TH_SUBJECT_IMG = 'meckury_th_subject_img'
const SS_TH_SUBJECT_VID = 'meckury_th_subject_vid'
const SS_COPY_SUBJECT   = 'meckury_copymotion_subject'
const SS_VIDEO_OMNI_REF = 'meckury_video_omni_ref'

// ── Time filter config (mirrors MediaPageCore) ────────────────────────────────
const TIME_FILTERS = [
  { label: 'Today',      value: 'today'      },
  { label: 'This Week',  value: 'this_week'  },
  { label: 'This Month', value: 'this_month' },
  { label: 'All',        value: 'all'        },
]

// ── Type filter config ────────────────────────────────────────────────────────
const TYPE_FILTERS = [
  { label: 'All',    value: 'all'   },
  { label: 'Images', value: 'image' },
  { label: 'Videos', value: 'video' },
]

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
// extractLastFrame
// ─────────────────────────────────────────────────────────────────────────────

async function extractLastFrame(videoUrl) {
  const res    = await fetch(videoUrl)
  const blob   = await res.blob()
  const objUrl = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const video       = document.createElement('video')
    video.muted       = true
    video.preload     = 'auto'
    video.crossOrigin = 'anonymous'

    video.onerror = () => {
      URL.revokeObjectURL(objUrl)
      reject(new Error('Could not load video for frame extraction'))
    }

    video.onloadedmetadata = () => {
      video.currentTime = Math.max(0, video.duration - 0.001)
    }

    video.onseeked = () => {
      const canvas  = document.createElement('canvas')
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(objUrl)
        if (pngBlob) resolve(pngBlob)
        else reject(new Error('Canvas toBlob failed'))
      }, 'image/png')
    }

    video.src = objUrl
  })
}

function buildUrlPayload(asset, fallbackType) {
  const type = fallbackType || (isVideoAsset(asset) ? 'video/mp4' : 'image/jpeg')
  return { url: asset.file_url, name: asset.name, type }
}

const _extractedThumbCache = new Map()

// ─────────────────────────────────────────────────────────────────────────────
// VideoThumbFallback
// ─────────────────────────────────────────────────────────────────────────────

function VideoThumbFallback({ asset }) {
  const [src,    setSrc]    = useState(() => _extractedThumbCache.get(asset.id) || null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (src || failed) return
    let cancelled = false
    let objUrl    = null

    ;(async () => {
      try {
        const res  = await fetch(asset.file_url)
        if (!res.ok) throw new Error('fetch failed')
        const blob = await res.blob()
        objUrl     = URL.createObjectURL(blob)

        const video = document.createElement('video')
        video.muted       = true
        video.preload     = 'auto'
        video.crossOrigin = 'anonymous'
        video.playsInline = true

        await new Promise((resolve, reject) => {
          video.onloadedmetadata = () => {
            video.currentTime = Math.min(0.1, Math.max(0, (video.duration || 1) * 0.05))
          }
          video.onseeked = resolve
          video.onerror  = () => reject(new Error('video load failed'))
          video.src = objUrl
        })

        const canvas = document.createElement('canvas')
        const maxW   = 240
        const scale  = Math.min(1, maxW / (video.videoWidth || maxW))
        canvas.width  = Math.max(1, Math.round((video.videoWidth  || maxW) * scale))
        canvas.height = Math.max(1, Math.round((video.videoHeight || maxW) * scale))
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.78)
        _extractedThumbCache.set(asset.id, dataUrl)
        if (!cancelled) setSrc(dataUrl)
      } catch {
        if (!cancelled) setFailed(true)
      } finally {
        if (objUrl) URL.revokeObjectURL(objUrl)
      }
    })()

    return () => { cancelled = true }
  }, [asset.id, asset.file_url, src, failed])

  if (src) return <img src={src} alt={asset.name} className="w-full h-full object-cover" />
  return <VideoIcon size={20} style={{ color: 'var(--text-muted)' }} />
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
        onError={onError}
      />
    )
  }

  return <VideoThumbFallback asset={asset} />
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
// AssetsPage
// ─────────────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const fileInputRef = useRef(null)
  const debounceRef  = useRef(null)

  const [assets,       setAssets]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [hasMore,      setHasMore]      = useState(false)
  const [totalCount,   setTotalCount]   = useState(0)
  const [page,         setPage]         = useState(0)

  const [timeFilter,   setTimeFilter]   = useState('all')
  const [typeFilter,   setTypeFilter]   = useState('all')
  const [search,       setSearch]       = useState('')
  const [searchQuery,  setSearchQuery]  = useState('')

  const [uploading,    setUploading]    = useState(false)
  const [previewAsset, setPreviewAsset] = useState(null)
  const [activeAsset,  setActiveAsset]  = useState(null)
  const [sheetOpen,    setSheetOpen]    = useState(false)
  const [pendingDelete,setPendingDelete]= useState(null)
  const [renamingId,   setRenamingId]   = useState(null)
  const [renameValue,  setRenameValue]  = useState('')
  const [extractingId, setExtractingId] = useState(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async ({
    offset     = 0,
    reset      = false,
    tFilter    = timeFilter,
    tyFilter   = typeFilter,
    q          = searchQuery,
    silent     = false,
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

  // Initial load + reload on filter change
  useEffect(() => {
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
      sessionStorage.setItem(SS_VIDEO_OMNI_REF, JSON.stringify({
        url: asset.file_url, name: asset.name,
      }))
      sessionStorage.removeItem(SS_VIDEO_START)
      sessionStorage.removeItem('meckury_video_end_frame')
      sessionStorage.removeItem('meckury_video_ref_images')
    } catch {}
    navigate('/create/video')
  }

  const handleLipsyncVideo = (asset) =>
    prepareAndNavigate(asset, SS_TH_SUBJECT_VID, '/create/talking-head', {
      alsoRemove: [SS_TH_SUBJECT_IMG],
      fallbackType: 'video/mp4',
    })

  const handleExtractEndFrame = async (asset) => {
    closeSheet()
    setExtractingId(asset.id)
    try {
      const frameBlob = await extractLastFrame(asset.file_url)
      const frameFile = new File(
        [frameBlob],
        `${asset.name.replace(/[^\w\-]+/g, '_')}_end_frame.png`,
        { type: 'image/png' },
      )
      const saved = await uploadAsset(user.id, frameFile, `${asset.name} — end frame`)
      setAssets((prev) => [saved, ...prev])
      setTotalCount((c) => c + 1)
      toast.success('End frame saved to Assets')
    } catch (err) {
      console.error('Extract end frame error:', err)
      toast.error(err.message || 'Could not extract end frame')
    } finally {
      setExtractingId(null)
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
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'rgba(91,110,247,0.3)', borderTopColor: '#5B6EF7' }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Uploading…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extracting end frame overlay */}
      <AnimatePresence>
        {extractingId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'rgba(91,110,247,0.3)', borderTopColor: '#5B6EF7' }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Extracting end frame…</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>This may take a moment</p>
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

        {/* Time filter dropdown — right aligned, matches generations */}
        <div className="flex items-center gap-2 mb-3 justify-end">
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 rounded-xl text-sm font-semibold outline-none transition-all cursor-pointer"
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
            <div
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Type filter dots — right aligned, mirrors status dots in generations */}
        <div className="flex items-center gap-3 mb-4 justify-end">
          {TYPE_FILTERS.map((f) => {
            const isActive = typeFilter === f.value
            const dotColor = {
              all:   'var(--text-primary)',
              image: '#3b82f6',
              video: '#a855f7',
            }[f.value]

            return (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                title={f.label}
                className="flex items-center justify-center transition-all active:scale-90"
                style={{ padding: '4px' }}
              >
                <div
                  style={{
                    width:        14,
                    height:       14,
                    borderRadius: 4,
                    background:   dotColor,
                    opacity:      isActive ? 1 : 0.25,
                    boxShadow:    isActive ? `0 0 0 3px ${dotColor}33` : 'none',
                    transition:   'opacity 0.15s, box-shadow 0.15s',
                  }}
                />
              </button>
            )
          })}
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
                    transition={{ delay: i * 0.025 }}
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

            {/* Load more */}
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
            transition={{ duration: 0.2 }}
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
            <p className="absolute top-5 left-1/2 -translate-x-1/2 text-sm font-semibold truncate max-w-[60vw]"
              style={{ color: 'rgba(255,255,255,0.7)' }}>
              {previewAsset.name}
            </p>
            {isVideoAsset(previewAsset) ? (
              <motion.video
                key={previewAsset.id}
                initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                src={previewAsset.file_url} controls autoPlay className="rounded-2xl"
                style={{ maxWidth: '100%', maxHeight: '85dvh', outline: 'none' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <motion.img
                key={previewAsset.id}
                initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                src={previewAsset.file_url} alt={previewAsset.name} className="rounded-2xl"
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
            onClose={closeSheet}
            onRename={() => { closeSheet(); startRename(activeAsset) }}
            onDownload={() => handleDownload(activeAsset)}
            onPolish={!isVideoAsset(activeAsset)         ? () => handlePolish(activeAsset)         : undefined}
            onEditImage={!isVideoAsset(activeAsset)      ? () => handleEditImage(activeAsset)      : undefined}
            onAnimate={!isVideoAsset(activeAsset)        ? () => handleAnimate(activeAsset)        : undefined}
            onLipsyncImage={!isVideoAsset(activeAsset)   ? () => handleLipsyncImage(activeAsset)   : undefined}
            onSetToMotion={!isVideoAsset(activeAsset)    ? () => handleSetToMotion(activeAsset)    : undefined}
            onEditVideo={isVideoAsset(activeAsset)       ? () => handleEditVideo(activeAsset)      : undefined}
            onLipsyncVideo={isVideoAsset(activeAsset)    ? () => handleLipsyncVideo(activeAsset)   : undefined}
            onExtractEndFrame={isVideoAsset(activeAsset) ? () => handleExtractEndFrame(activeAsset): undefined}
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
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetCard
// ─────────────────────────────────────────────────────────────────────────────

function AssetCard({ asset, isRenaming, renameValue, setRenameValue, onStartRename, onCommitRename, onPreview, onMore }) {
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
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{asset.name}</p>
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
              ? new Date(asset.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
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
// AssetActionSheet
// ─────────────────────────────────────────────────────────────────────────────

function AssetActionSheet({
  asset, onClose, onRename, onDownload, onDelete,
  onPolish, onEditImage, onAnimate, onLipsyncImage, onSetToMotion,
  onEditVideo, onLipsyncVideo, onExtractEndFrame,
}) {
  const isVideo = isVideoAsset(asset)

  const actions = [
    { icon: Pencil,   label: 'Rename',   onClick: onRename   },
    { icon: Download, label: 'Download', onClick: onDownload },
    ...(!isVideo ? [
      { icon: Sparkles,     label: 'Polish',        sub: 'AI photo enhancement',    onClick: onPolish       },
      { icon: Wand2,        label: 'Edit',          sub: 'Use as reference image',  onClick: onEditImage    },
      { icon: Film,         label: 'Animate',       sub: 'Send to video generator', onClick: onAnimate      },
      { icon: Mic2,         label: 'Lipsync',       sub: 'Create talking avatar',   onClick: onLipsyncImage },
      { icon: Clapperboard, label: 'Set to Motion', sub: 'Use in Copy Motion',      onClick: onSetToMotion  },
    ] : []),
    ...(isVideo ? [
      { icon: Wand2,    label: 'Edit',              sub: 'Use as video reference',   onClick: onEditVideo       },
      { icon: Mic2,     label: 'Lipsync',           sub: 'Re-animate with audio',    onClick: onLipsyncVideo    },
      { icon: ScanLine, label: 'Extract End Frame', sub: 'Save last frame as image', onClick: onExtractEndFrame },
    ] : []),
    { icon: Trash2, label: 'Delete', danger: true, onClick: onDelete },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      >
        <div
          className="w-full max-w-xl rounded-t-3xl px-4 pt-4 pb-10"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
          </div>
          <p className="text-xs font-semibold mb-3 truncate px-1" style={{ color: 'var(--text-muted)' }}>
            {asset.name}
          </p>
          <div className="flex flex-col gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{
                  background: action.danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-primary)',
                  border:     `1px solid ${action.danger ? 'rgba(239,68,68,0.2)' : 'var(--border-color)'}`,
                }}
              >
                <action.icon size={18} style={{ color: action.danger ? '#ef4444' : 'var(--text-secondary)', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: action.danger ? '#ef4444' : 'var(--text-primary)' }}>
                    {action.label}
                  </p>
                  {action.sub && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{action.sub}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="w-full mt-3 py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetsEmpty
// ─────────────────────────────────────────────────────────────────────────────

function AssetsEmpty({ search, timeFilter, typeFilter, onUpload, onClearFilters }) {
  const isFiltered = search || timeFilter !== 'all' || typeFilter !== 'all'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
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
        <button
          onClick={onClearFilters}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          Clear filters
        </button>
      ) : (
        <button
          onClick={onUpload}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
          style={{ background: '#5B6EF7', color: '#fff' }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Upload your first asset
        </button>
      )}
    </motion.div>
  )
}
