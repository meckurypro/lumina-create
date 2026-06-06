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

// ── SessionStorage keys (must match destination pages) ────────────────────────
const SS_IMAGE_POLISH    = 'meckury_polish_image'          // CreatePhotoPolishPage
const SS_IMAGE_EDIT      = 'meckury_create_images'         // CreateImagePage  (array)
const SS_VIDEO_START     = 'meckury_video_start_frame'     // CreateVideoPage  start frame
const SS_TH_SUBJECT_IMG  = 'meckury_th_subject_img'        // CreateTalkingHeadPage face
const SS_TH_SUBJECT_VID  = 'meckury_th_subject_vid'        // CreateTalkingHeadPage video
const SS_COPY_SUBJECT    = 'meckury_copymotion_subject'    // CreateCopyMotionPage subject image
const SS_VIDEO_OMNI_REF  = 'meckury_video_omni_ref'        // CreateVideoPage  omni video ref (plain URL)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Fetch a remote URL → base64 data-URL string */
async function urlToBase64(url) {
  const res  = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Extract the very last frame of a remote video at native resolution.
 * Returns a Blob (image/png) — lossless, no quality change.
 */
async function extractLastFrame(videoUrl) {
  // 1. Fetch video into an object URL so the browser can decode it
  const res     = await fetch(videoUrl)
  const blob    = await res.blob()
  const objUrl  = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const video        = document.createElement('video')
    video.muted        = true
    video.preload      = 'auto'
    video.crossOrigin  = 'anonymous'

    video.onerror = () => {
      URL.revokeObjectURL(objUrl)
      reject(new Error('Could not load video for frame extraction'))
    }

    video.onloadedmetadata = () => {
      // Seek to last possible frame (duration - tiny epsilon)
      video.currentTime = Math.max(0, video.duration - 0.001)
    }

    video.onseeked = () => {
      const canvas  = document.createElement('canvas')
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (pngBlob) => {
          URL.revokeObjectURL(objUrl)
          if (pngBlob) resolve(pngBlob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/png'   // lossless — exact pixel values preserved
      )
    }

    video.src = objUrl
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// AssetsPage
// ─────────────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const fileInputRef = useRef(null)
  const debounceRef  = useRef(null)

  const [assets,          setAssets]          = useState([])
  const [loading,         setLoading]         = useState(true)
  const [search,          setSearch]          = useState('')
  const [searchQuery,     setSearchQuery]     = useState('')
  const [uploading,       setUploading]       = useState(false)
  const [previewAsset,    setPreviewAsset]    = useState(null)
  const [activeAsset,     setActiveAsset]     = useState(null)
  const [sheetOpen,       setSheetOpen]       = useState(false)
  const [pendingDelete,   setPendingDelete]   = useState(null)
  const [renamingId,      setRenamingId]      = useState(null)
  const [renameValue,     setRenameValue]     = useState('')
  const [extractingId,    setExtractingId]    = useState(null)   // asset.id being extracted

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async (q = searchQuery) => {
    if (!user) return
    setLoading(true)
    try {
      const data = await listAssets(user.id, { search: q })
      setAssets(data)
    } catch (err) {
      toast.error(err.message || 'Failed to load assets')
    } finally {
      setLoading(false)
    }
  }, [user, searchQuery])

  useEffect(() => { load() }, [user])

  // ── Search ─────────────────────────────────────────────────────────────────

  const handleSearchChange = (val) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val)
      load(val)
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

  // ── IMAGE actions ──────────────────────────────────────────────────────────

  /** Polish: preload into CreatePhotoPolishPage */
  const handlePolish = (asset) => {
    closeSheet()
    fetch(asset.file_url)
      .then((r) => r.blob())
      .then((blob) => {
        const file   = new File([blob], `${asset.name}.jpg`, { type: blob.type || 'image/jpeg' })
        const reader = new FileReader()
        reader.onload = (ev) => {
          sessionStorage.setItem(SS_IMAGE_POLISH, JSON.stringify({
            base64: ev.target.result, name: file.name, type: file.type,
          }))
          navigate('/create/photo-polish')
        }
        reader.readAsDataURL(file)
      })
      .catch(() => toast.error('Failed to load asset'))
  }

  /** Edit: preload as reference image into CreateImagePage */
  const handleEditImage = (asset) => {
    closeSheet()
    fetch(asset.file_url)
      .then((r) => r.blob())
      .then((blob) => {
        const file   = new File([blob], `${asset.name}.jpg`, { type: blob.type || 'image/jpeg' })
        const reader = new FileReader()
        reader.onload = (ev) => {
          // SS_IMAGE_EDIT stores an array of images
          sessionStorage.setItem(SS_IMAGE_EDIT, JSON.stringify([{
            base64: ev.target.result, name: file.name, type: file.type,
          }]))
          sessionStorage.removeItem('meckury_create_prompt')
          navigate('/create/image')
        }
        reader.readAsDataURL(file)
      })
      .catch(() => toast.error('Failed to load asset'))
  }

  /** Animate: preload as start frame into CreateVideoPage */
  const handleAnimate = (asset) => {
    closeSheet()
    fetch(asset.file_url)
      .then((r) => r.blob())
      .then((blob) => {
        const file   = new File([blob], `${asset.name}.png`, { type: blob.type || 'image/png' })
        const reader = new FileReader()
        reader.onload = (ev) => {
          sessionStorage.setItem(SS_VIDEO_START, JSON.stringify({
            base64: ev.target.result, name: file.name, type: file.type,
          }))
          sessionStorage.removeItem('meckury_video_end_frame')
          navigate('/create/video')
        }
        reader.readAsDataURL(file)
      })
      .catch(() => toast.error('Failed to load asset'))
  }

  /** Lipsync (image): preload as face photo into CreateTalkingHeadPage */
  const handleLipsyncImage = (asset) => {
    closeSheet()
    fetch(asset.file_url)
      .then((r) => r.blob())
      .then((blob) => {
        const file   = new File([blob], `${asset.name}.jpg`, { type: blob.type || 'image/jpeg' })
        const reader = new FileReader()
        reader.onload = (ev) => {
          sessionStorage.setItem(SS_TH_SUBJECT_IMG, JSON.stringify({
            base64: ev.target.result, name: file.name, type: file.type,
          }))
          sessionStorage.removeItem(SS_TH_SUBJECT_VID)
          navigate('/create/talking-head')
        }
        reader.readAsDataURL(file)
      })
      .catch(() => toast.error('Failed to load asset'))
  }

  /** Set to Motion: preload as subject image into CreateCopyMotionPage */
  const handleSetToMotion = (asset) => {
    closeSheet()
    fetch(asset.file_url)
      .then((r) => r.blob())
      .then((blob) => {
        const file   = new File([blob], `${asset.name}.jpg`, { type: blob.type || 'image/jpeg' })
        const reader = new FileReader()
        reader.onload = (ev) => {
          sessionStorage.setItem(SS_COPY_SUBJECT, JSON.stringify({
            base64: ev.target.result, name: file.name, type: file.type,
          }))
          navigate('/create/copy-motion')
        }
        reader.readAsDataURL(file)
      })
      .catch(() => toast.error('Failed to load asset'))
  }

  // ── VIDEO actions ──────────────────────────────────────────────────────────

  /** Edit (video): preload as omni reference into CreateVideoPage */
  const handleEditVideo = (asset) => {
    closeSheet()
    // Store the plain public URL — CreateVideoPage reads SS_VIDEO_OMNI_REF on mount
    sessionStorage.setItem(SS_VIDEO_OMNI_REF, JSON.stringify({
      url:  asset.file_url,
      name: asset.name,
    }))
    // Clear conflicting frame keys so the page starts clean
    sessionStorage.removeItem(SS_VIDEO_START)
    sessionStorage.removeItem('meckury_video_end_frame')
    sessionStorage.removeItem('meckury_video_ref_images')
    navigate('/create/video')
  }

  /** Lipsync (video): preload as subject video into CreateTalkingHeadPage */
  const handleLipsyncVideo = (asset) => {
    closeSheet()
    fetch(asset.file_url)
      .then((r) => r.blob())
      .then((blob) => {
        const file   = new File([blob], `${asset.name}.mp4`, { type: blob.type || 'video/mp4' })
        const reader = new FileReader()
        reader.onload = (ev) => {
          sessionStorage.setItem(SS_TH_SUBJECT_VID, JSON.stringify({
            base64: ev.target.result, name: file.name, type: file.type,
          }))
          sessionStorage.removeItem(SS_TH_SUBJECT_IMG)
          navigate('/create/talking-head')
        }
        reader.readAsDataURL(file)
      })
      .catch(() => toast.error('Failed to load asset'))
  }

  /** Extract End Frame: canvas-grab last frame → save as PNG asset */
  const handleExtractEndFrame = async (asset) => {
    closeSheet()
    setExtractingId(asset.id)
    try {
      const frameBlob = await extractLastFrame(asset.file_url)
      const frameName = `${asset.name} — end frame`
      await uploadAsset(user.id, frameBlob, frameName)
      await load()   // refresh asset list in place
      toast.success('End frame saved to Assets')
    } catch (err) {
      console.error('Extract end frame error:', err)
      toast.error('Could not extract end frame')
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

      {/* ── Uploading overlay ── */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'rgba(91,110,247,0.3)', borderTopColor: '#5B6EF7' }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Uploading…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Extracting end frame overlay ── */}
      <AnimatePresence>
        {extractingId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.5)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: 'rgba(91,110,247,0.3)', borderTopColor: '#5B6EF7' }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Extracting end frame…</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>This may take a moment</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-5">

        {/* ── Search + upload row ── */}
        <div className="flex items-center gap-2 mb-5">
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

        {/* ── Content ── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-2xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
            ))}
          </div>
        ) : assets.length === 0 ? (
          <AssetsEmpty search={search} onUpload={() => fileInputRef.current?.click()} />
        ) : (
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
        )}
      </div>

      {/* ── Asset preview modal ── */}
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

      {/* ── Action sheet ── */}
      <AnimatePresence>
        {sheetOpen && activeAsset && (
          <AssetActionSheet
            asset={activeAsset}
            onClose={closeSheet}
            onRename={() => { closeSheet(); startRename(activeAsset) }}
            onDownload={() => handleDownload(activeAsset)}
            // image-only
            onPolish={!isVideoAsset(activeAsset)     ? () => handlePolish(activeAsset)       : undefined}
            onEditImage={!isVideoAsset(activeAsset)  ? () => handleEditImage(activeAsset)    : undefined}
            onAnimate={!isVideoAsset(activeAsset)    ? () => handleAnimate(activeAsset)      : undefined}
            onLipsyncImage={!isVideoAsset(activeAsset) ? () => handleLipsyncImage(activeAsset) : undefined}
            onSetToMotion={!isVideoAsset(activeAsset) ? () => handleSetToMotion(activeAsset) : undefined}
            // video-only
            onEditVideo={isVideoAsset(activeAsset)   ? () => handleEditVideo(activeAsset)   : undefined}
            onLipsyncVideo={isVideoAsset(activeAsset) ? () => handleLipsyncVideo(activeAsset) : undefined}
            onExtractEndFrame={isVideoAsset(activeAsset) ? () => handleExtractEndFrame(activeAsset) : undefined}
            onDelete={() => handleDelete(activeAsset)}
          />
        )}
      </AnimatePresence>

      {/* ── Delete confirm ── */}
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
// AssetCard  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function AssetCard({ asset, isRenaming, renameValue, setRenameValue, onStartRename, onCommitRename, onPreview, onMore }) {
  const inputRef = useRef(null)
  const isVideo  = isVideoAsset(asset)
  const [imgErr, setImgErr] = useState(false)

  useEffect(() => {
    if (isRenaming) setTimeout(() => inputRef.current?.focus(), 50)
  }, [isRenaming])

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      <button
        onClick={onPreview}
        className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative group"
        style={{ background: 'var(--bg-primary)' }}
      >
        {isVideo ? (
          <VideoIcon size={20} style={{ color: 'var(--text-muted)' }} />
        ) : imgErr ? (
          <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <img src={asset.file_url} alt={asset.name} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
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

      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') onCommitRename()
              }}
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
            isVideo ? 'Video' : 'Image',
            formatBytes(asset.size_bytes),
            asset.created_at
              ? new Date(asset.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
              : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

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
  // image
  onPolish, onEditImage, onAnimate, onLipsyncImage, onSetToMotion,
  // video
  onEditVideo, onLipsyncVideo, onExtractEndFrame,
}) {
  const isVideo = isVideoAsset(asset)

  const baseActions = [
    { icon: Pencil,   label: 'Rename',   onClick: onRename   },
    { icon: Download, label: 'Download', onClick: onDownload },
  ]

  const imageActions = [
    { icon: Sparkles,    label: 'Polish',        sub: 'AI photo enhancement',      onClick: onPolish       },
    { icon: Wand2,       label: 'Edit',          sub: 'Use as reference image',    onClick: onEditImage    },
    { icon: Film,        label: 'Animate',       sub: 'Send to video generator',   onClick: onAnimate      },
    { icon: Mic2,        label: 'Lipsync',       sub: 'Create talking avatar',     onClick: onLipsyncImage },
    { icon: Clapperboard,label: 'Set to Motion', sub: 'Use in Copy Motion',        onClick: onSetToMotion  },
  ]

  const videoActions = [
    { icon: Wand2,    label: 'Edit',              sub: 'Use as video reference',    onClick: onEditVideo       },
    { icon: Mic2,     label: 'Lipsync',           sub: 'Re-animate with audio',     onClick: onLipsyncVideo    },
    { icon: ScanLine, label: 'Extract End Frame', sub: 'Save last frame as image',  onClick: onExtractEndFrame },
  ]

  const mediaActions = isVideo ? videoActions : imageActions

  const deleteAction = { icon: Trash2, label: 'Delete', danger: true, onClick: onDelete }

  const allActions = [...baseActions, ...mediaActions, deleteAction]

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
            {allActions.map((action) => (
              <button
                key={action.label}
                onClick={action.onClick}
                className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{
                  background: action.danger ? 'rgba(239,68,68,0.08)' : 'var(--bg-primary)',
                  border:     `1px solid ${action.danger ? 'rgba(239,68,68,0.2)' : 'var(--border-color)'}`,
                }}
              >
                <action.icon
                  size={18}
                  style={{ color: action.danger ? '#ef4444' : 'var(--text-secondary)', flexShrink: 0 }}
                />
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
// AssetsEmpty  (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function AssetsEmpty({ search, onUpload }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 gap-4 text-center"
    >
      <FolderOpen size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
      <div>
        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {search ? 'No assets match that search' : 'No assets yet'}
        </p>
        <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
          {search ? 'Try a different name.' : 'Upload images or videos to reuse across your creations.'}
        </p>
      </div>
      {!search && (
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
