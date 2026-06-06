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

// ─────────────────────────────────────────────────────────────────────────────
// AssetsPage
// ─────────────────────────────────────────────────────────────────────────────

export default function AssetsPage() {
  const navigate     = useNavigate()
  const { user }     = useAuth()
  const fileInputRef = useRef(null)
  const debounceRef  = useRef(null)

  const [assets,        setAssets]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [uploads,       setUploads]       = useState([])   // { id, name, progress, error }
  const [activeAsset,   setActiveAsset]   = useState(null)
  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [renamingId,    setRenamingId]    = useState(null)
  const [renameValue,   setRenameValue]   = useState('')

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

    const slots = fileList.map((f) => ({
      id: crypto.randomUUID(), name: f.name.replace(/\.[^.]+$/, ''), progress: 0, error: null,
    }))
    setUploads((prev) => [...prev, ...slots])

    await Promise.all(fileList.map(async (file, i) => {
      const slotId = slots[i].id
      try {
        const asset = await uploadAsset(
          user.id,
          file,
          file.name.replace(/\.[^.]+$/, ''),
          (pct) => setUploads((prev) =>
            prev.map((u) => u.id === slotId ? { ...u, progress: pct } : u)
          ),
        )
        setAssets((prev) => [asset, ...prev])
        setUploads((prev) => prev.filter((u) => u.id !== slotId))
      } catch (err) {
        setUploads((prev) =>
          prev.map((u) => u.id === slotId ? { ...u, error: err.message } : u)
        )
        toast.error(err.message || 'Upload failed')
        setTimeout(() => setUploads((prev) => prev.filter((u) => u.id !== slotId)), 3000)
      }
    }))
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const openSheet  = (asset) => { setActiveAsset(asset); setSheetOpen(true)  }
  const closeSheet = ()      => { setActiveAsset(null);  setSheetOpen(false) }

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

  const handleAnimate = (asset) => {
    closeSheet()
    fetch(asset.file_url)
      .then((r) => r.blob())
      .then((blob) => {
        const file   = new File([blob], `${asset.name}.png`, { type: blob.type || 'image/png' })
        const reader = new FileReader()
        reader.onload = (ev) => {
          sessionStorage.setItem('meckury_video_start_frame', JSON.stringify({
            base64: ev.target.result, name: file.name, type: file.type,
          }))
          sessionStorage.removeItem('meckury_video_end_frame')
          navigate('/create/video')
        }
        reader.readAsDataURL(file)
      })
      .catch(() => toast.error('Failed to load asset'))
  }

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

      {/* ── Slim upload progress bar — fixed at top, non-blocking ── */}
      <AnimatePresence>
        {uploads.some((u) => !u.error) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="sticky top-0 z-30 px-4 py-2 flex flex-col gap-1.5"
            style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}
          >
            {uploads.filter((u) => !u.error).map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                {/* track */}
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: '#5B6EF7' }}
                    animate={{ width: `${u.progress}%` }}
                    transition={{ ease: 'linear', duration: 0.15 }}
                  />
                </div>
                <span className="text-xs tabular-nums flex-shrink-0" style={{ color: 'var(--text-muted)', minWidth: '2.5rem', textAlign: 'right' }}>
                  {u.progress < 100 ? `${u.progress}%` : 'Saving…'}
                </span>
                <span className="text-xs truncate flex-shrink-0 max-w-[120px]" style={{ color: 'var(--text-muted)' }}>
                  {u.name}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-5">

        {/* ── Search + upload button row ── */}
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

          {/* + upload button */}
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

        ) : assets.length === 0 && !uploads.length ? (
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
                    onMore={() => openSheet(asset)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Action sheet ── */}
      <AnimatePresence>
        {sheetOpen && activeAsset && (
          <AssetActionSheet
            asset={activeAsset}
            onClose={closeSheet}
            onRename={() => { closeSheet(); startRename(activeAsset) }}
            onDownload={() => handleDownload(activeAsset)}
            onAnimate={!isVideoAsset(activeAsset) ? () => handleAnimate(activeAsset) : undefined}
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
// AssetCard
// ─────────────────────────────────────────────────────────────────────────────

function AssetCard({ asset, isRenaming, renameValue, setRenameValue, onStartRename, onCommitRename, onMore }) {
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
      {/* Thumbnail */}
      <div
        className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        {isVideo ? (
          <VideoIcon size={20} style={{ color: 'var(--text-muted)' }} />
        ) : imgErr ? (
          <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <img
            src={asset.file_url}
            alt={asset.name}
            className="w-full h-full object-cover"
            onError={() => setImgErr(true)}
          />
        )}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  onCommitRename()
                if (e.key === 'Escape') onCommitRename()
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
            isVideo ? 'Video' : 'Image',
            formatBytes(asset.size_bytes),
            asset.created_at
              ? new Date(asset.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
              : null,
          ].filter(Boolean).join(' · ')}
        </p>
      </div>

      {/* More */}
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

function AssetActionSheet({ asset, onClose, onRename, onDownload, onAnimate, onDelete }) {
  const actions = [
    { icon: Pencil,   label: 'Rename',   onClick: onRename   },
    { icon: Download, label: 'Download', onClick: onDownload },
    ...(onAnimate ? [{ icon: Film, label: 'Animate', sub: 'Send to video generator', onClick: onAnimate }] : []),
    { icon: Trash2,   label: 'Delete',   danger: true, onClick: onDelete },
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
