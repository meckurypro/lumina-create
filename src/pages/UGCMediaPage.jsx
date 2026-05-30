// src/pages/UGCMediaPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams }                   from 'react-router-dom'
import { motion, AnimatePresence }                  from 'framer-motion'
import {
  ArrowLeft, Zap, User, Film, Image as ImageIcon,
  Download, RefreshCw, Trash2, MoreHorizontal,
  Sparkles, Grid2X2, List, ChevronDown,
} from 'lucide-react'
import { useAuth }                                  from '@/context/AuthContext'
import { ugcProfiles }                              from '@/lib/ugc'
import { supabase, generations as generationsDb }   from '@/lib/supabase'
import toast                                        from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const PAGE_SIZE = 24

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function getModelDisplayLabel(modelValue, modelsList) {
  if (!modelValue) return null
  const found = modelsList?.find((m) => m.value === modelValue)
  if (found) return found.aka || found.label
  return modelValue.replace(/^(fal-ai\/|fal\/|replicate\/|runway-)/i, '')
}

// ── Fetch UGC generations for a specific profile ───────────────────────────
// Joins ugc_generations → generations, filters by ugc_profile_id, completed only

async function fetchUGCGenerations(profileId, { limit = PAGE_SIZE, offset = 0 } = {}) {
  const { data, error, count } = await supabase
    .from('ugc_generations')
    .select(
      `
      id,
      output_type,
      filter_applied,
      scene_prompt,
      aspect_ratio,
      created_at,
      generation:generations (
        id,
        status,
        output_url,
        output_thumbnail_url,
        output_type,
        prompt,
        model,
        credits_charged,
        aspect_ratio,
        duration,
        created_at,
        error_message,
        input_image_urls,
        generation_type,
        skip_prompt_refinement,
        prompt_engineering_used
      )
    `,
      { count: 'exact' }
    )
    .eq('ugc_profile_id', profileId)
    .eq('generation.status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { data: [], count: 0, error }

  // Flatten: merge ugc_generation metadata with generation row
  const flat = (data || [])
    .filter((r) => r.generation) // skip if join returned null (non-completed filtered out)
    .map((r) => ({
      ...r.generation,
      ugc_scene_prompt:    r.scene_prompt,
      ugc_filter_applied:  r.filter_applied,
      ugc_generation_id:   r.id,
    }))

  return { data: flat, count: count || 0, error: null }
}

// ── Empty state ────────────────────────────────────────────────────────────

const EmptyGrid = ({ profileName, onGenerate }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 gap-6 text-center"
  >
    <div
      className="w-20 h-20 rounded-3xl flex items-center justify-center"
      style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
    >
      <Sparkles size={32} style={{ color: ACCENT, opacity: 0.7 }} />
    </div>
    <div>
      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
        No generations yet
      </p>
      <p className="text-sm mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
        Create your first image or video featuring {profileName}.
      </p>
    </div>
    <button
      onClick={onGenerate}
      className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
      style={{ background: ACCENT, color: '#ffffff' }}
    >
      <Zap size={15} fill="currentColor" />
      Generate
    </button>
  </motion.div>
)

// ── Skeleton ───────────────────────────────────────────────────────────────

const SkeletonGrid = () => (
  <div className="grid grid-cols-2 gap-2.5">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="rounded-2xl animate-pulse"
        style={{ aspectRatio: '9/16', background: 'var(--bg-elevated)' }}
      />
    ))}
  </div>
)

const SkeletonList = () => (
  <div className="flex flex-col gap-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="h-20 rounded-2xl animate-pulse"
        style={{ background: 'var(--bg-elevated)' }}
      />
    ))}
  </div>
)

// ── Action sheet ────────────────────────────────────────────────────────────

const ActionSheet = ({ gen, onClose, onDelete, onDownload, onAnimate }) => (
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
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 340 }}
      className="w-full rounded-t-3xl overflow-hidden pb-8"
      style={{ background: 'var(--bg-card)', maxWidth: 480, border: '1px solid var(--border-color)' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-center pt-3 pb-2">
        <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
      </div>

      {/* Preview */}
      {gen.output_url && (
        <div className="mx-4 mb-4 rounded-2xl overflow-hidden" style={{ height: 160 }}>
          {gen.output_type === 'video'
            ? <video src={gen.output_url} className="w-full h-full object-cover" muted autoPlay loop playsInline />
            : <img src={gen.output_url} alt="preview" className="w-full h-full object-cover" />
          }
        </div>
      )}

      <div className="px-4 pb-3">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {gen.ugc_scene_prompt || gen.prompt || 'Generation'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {formatDate(gen.created_at)} · ⚡ {gen.credits_charged} cr
        </p>
      </div>

      <div className="px-4 flex flex-col gap-2">
        <button
          onClick={onDownload}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <Download size={18} style={{ color: 'var(--text-primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Download</span>
        </button>

        {gen.output_type === 'image' && (
          <button
            onClick={onAnimate}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <Film size={18} style={{ color: 'var(--text-primary)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Animate</span>
          </button>
        )}

        <button
          onClick={onDelete}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left"
          style={{ background: 'rgba(239,68,68,0.08)' }}
        >
          <Trash2 size={18} style={{ color: '#ef4444' }} />
          <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>Delete</span>
        </button>
      </div>
    </motion.div>
  </motion.div>
)

// ── Grid card ──────────────────────────────────────────────────────────────

const GridCard = ({ gen, index, onClick, onMore }) => {
  const isVideo   = gen.output_type === 'video'
  const thumbUrl  = gen.output_thumbnail_url || gen.output_url
  const filterTag = gen.ugc_filter_applied === 'cinematic' ? '🎬' : '📱'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.04 }}
      className="relative rounded-2xl overflow-hidden"
      style={{ aspectRatio: gen.aspect_ratio === '16:9' ? '16/9' : gen.aspect_ratio === '1:1' ? '1/1' : '9/16' }}
    >
      {/* Thumbnail */}
      <button className="w-full h-full block" onClick={onClick}>
        {thumbUrl ? (
          isVideo
            ? <video src={thumbUrl} className="w-full h-full object-cover" muted preload="metadata" />
            : <img src={thumbUrl} alt={gen.ugc_scene_prompt} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)' }}
          >
            {isVideo
              ? <Film size={24} style={{ color: 'var(--text-muted)' }} />
              : <ImageIcon size={24} style={{ color: 'var(--text-muted)' }} />
            }
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 45%)' }}
        />
      </button>

      {/* Bottom metadata */}
      <div className="absolute bottom-0 left-0 right-0 px-2.5 pb-2.5 flex items-end justify-between pointer-events-none">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className="text-xs">{filterTag}</span>
          {isVideo && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.55)' }}
            >
              <Film size={8} className="text-white" />
              <span className="text-white text-xs" style={{ fontSize: 9 }}>
                {gen.duration}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* More button */}
      <button
        onClick={(e) => { e.stopPropagation(); onMore() }}
        className="absolute top-2 right-2 w-7 h-7 rounded-xl flex items-center justify-center pointer-events-auto"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      >
        <MoreHorizontal size={13} style={{ color: 'white' }} />
      </button>
    </motion.div>
  )
}

// ── List card ──────────────────────────────────────────────────────────────

const ListCard = ({ gen, index, modelsList, onClick, onMore }) => {
  const isVideo    = gen.output_type === 'video'
  const thumbUrl   = gen.output_thumbnail_url || gen.output_url
  const modelLabel = getModelDisplayLabel(gen.model, modelsList)
  const filterTag  = gen.ugc_filter_applied === 'cinematic' ? '🎬 Cinematic' : '📱 Hyper Realistic'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-center gap-3 p-3 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Thumb */}
      <button
        onClick={onClick}
        className="relative flex-shrink-0 rounded-xl overflow-hidden"
        style={{ width: 56, height: 56, background: 'var(--bg-elevated)' }}
      >
        {thumbUrl ? (
          isVideo
            ? <video src={thumbUrl} className="w-full h-full object-cover" muted preload="metadata" />
            : <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo
              ? <Film size={20} style={{ color: 'var(--text-muted)' }} />
              : <ImageIcon size={20} style={{ color: 'var(--text-muted)' }} />
            }
          </div>
        )}
        <div
          className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)' }}
        >
          {isVideo
            ? <Film size={8} className="text-white" />
            : <ImageIcon size={8} className="text-white" />
          }
        </div>
      </button>

      {/* Info */}
      <button className="flex-1 min-w-0 text-left" onClick={onClick}>
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {gen.ugc_scene_prompt || gen.prompt || 'Generation'}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {formatDate(gen.created_at)}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: ACCENT_SUB, color: ACCENT }}
          >
            {filterTag}
          </span>
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
      </button>

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

// ── Lightbox ───────────────────────────────────────────────────────────────

const Lightbox = ({ gen, onClose }) => {
  if (!gen) return null
  const isVideo = gen.output_type === 'video'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="relative max-w-sm w-full rounded-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo
          ? <video src={gen.output_url} className="w-full" controls autoPlay loop playsInline />
          : <img src={gen.output_url} alt="" className="w-full" />
        }
        <div
          className="absolute bottom-0 left-0 right-0 p-4"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)' }}
        >
          <p className="text-white text-sm font-semibold line-clamp-2">
            {gen.ugc_scene_prompt || gen.prompt}
          </p>
          <p className="text-white/60 text-xs mt-1">{formatDate(gen.created_at)}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Filter pills ───────────────────────────────────────────────────────────

const FilterPills = ({ value, onChange }) => {
  const options = [
    { label: 'All',   value: 'all'   },
    { label: '📱 Images', value: 'image' },
    { label: '🎬 Videos', value: 'video' },
  ]
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: value === o.value ? ACCENT            : 'var(--bg-elevated)',
            color:      value === o.value ? '#ffffff'         : 'var(--text-muted)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function UGCMediaPage() {
  const { profileId }               = useParams()
  const navigate                    = useNavigate()
  const { user, credits }           = useAuth()

  const [profile,       setProfile]       = useState(null)
  const [profileLoading,setProfileLoading]= useState(true)
  const [items,         setItems]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const [hasMore,       setHasMore]       = useState(false)
  const [totalCount,    setTotalCount]    = useState(0)
  const [page,          setPage]          = useState(0)
  const [models,        setModels]        = useState([])
  const [viewMode,      setViewMode]      = useState('grid') // 'grid' | 'list'
  const [typeFilter,    setTypeFilter]    = useState('all')
  const [activeGen,     setActiveGen]     = useState(null)
  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [lightboxGen,   setLightboxGen]   = useState(null)

  // Load profile
  useEffect(() => {
    ;(async () => {
      setProfileLoading(true)
      const { data, error } = await ugcProfiles.getById(profileId)
      if (error || !data) {
        toast.error('Character not found')
        navigate('/create/ugc')
        return
      }
      setProfile(data)
      setProfileLoading(false)
    })()
  }, [profileId])

  // Load models for display labels
  useEffect(() => {
    supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .then(({ data }) => setModels(data || []))
  }, [])

  const load = useCallback(async (offset = 0, reset = false) => {
    if (!user) return
    if (offset === 0) setLoading(true)
    else              setLoadingMore(true)

    const { data, count } = await fetchUGCGenerations(profileId, { limit: PAGE_SIZE, offset })
    setTotalCount(count || 0)
    setItems((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
  }, [user, profileId])

  useEffect(() => { load(0, true) }, [load])

  const handleDelete = async (gen) => {
    setSheetOpen(false)
    setActiveGen(null)
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
    setSheetOpen(false)
    setActiveGen(null)
    if (!gen.output_url) return
    try {
      const res  = await fetch(gen.output_url)
      const blob = await res.blob()
      const ext  = gen.output_type === 'video' ? 'mp4' : 'png'
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `ugc-${gen.id.slice(0, 8)}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  const handleAnimate = async (gen) => {
    setSheetOpen(false)
    setActiveGen(null)
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

  const openActions = (gen) => { setActiveGen(gen); setSheetOpen(true) }
  const closeSheet  = ()    => { setSheetOpen(false); setActiveGen(null) }

  // Filtered items
  const filtered = typeFilter === 'all'
    ? items
    : items.filter((g) => g.output_type === typeFilter)

  if (profileLoading) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
        />
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => navigate(`/create/ugc/${profileId}`)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>

        {/* Character info */}
        <button
          onClick={() => navigate(`/create/ugc/${profileId}`)}
          className="flex items-center gap-2.5"
        >
          {profile?.thumbnail_url ? (
            <img
              src={profile.thumbnail_url}
              alt={profile.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              style={{ border: `2px solid ${ACCENT_BDR}` }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT_SUB, border: `2px solid ${ACCENT_BDR}` }}
            >
              <User size={14} style={{ color: ACCENT }} />
            </div>
          )}
          <div className="flex flex-col items-start">
            <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>
              {profile?.name}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles size={9} style={{ color: ACCENT }} />
              <p className="text-xs" style={{ color: ACCENT }}>
                {totalCount} generation{totalCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </button>

        {/* Credits + view toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode((v) => v === 'grid' ? 'list' : 'grid')}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            {viewMode === 'grid' ? <List size={15} /> : <Grid2X2 size={15} />}
          </button>
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-5">

          {/* Filters row */}
          {!loading && items.length > 0 && (
            <div className="flex items-center justify-between mb-5">
              <FilterPills value={typeFilter} onChange={setTypeFilter} />
            </div>
          )}

          {loading ? (
            viewMode === 'grid' ? <SkeletonGrid /> : <SkeletonList />
          ) : filtered.length === 0 && typeFilter !== 'all' ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                No {typeFilter}s found
              </p>
              <button
                onClick={() => setTypeFilter('all')}
                className="text-xs font-semibold underline"
                style={{ color: ACCENT }}
              >
                Show all
              </button>
            </div>
          ) : items.length === 0 ? (
            <EmptyGrid
              profileName={profile?.name}
              onGenerate={() => navigate(`/create/ugc/${profileId}`)}
            />
          ) : viewMode === 'grid' ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                {filtered.map((gen, i) => (
                  <GridCard
                    key={gen.id}
                    gen={gen}
                    index={i}
                    onClick={() => setLightboxGen(gen)}
                    onMore={() => openActions(gen)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((gen, i) => (
                <ListCard
                  key={gen.id}
                  gen={gen}
                  index={i}
                  modelsList={models}
                  onClick={() => setLightboxGen(gen)}
                  onMore={() => openActions(gen)}
                />
              ))}
            </div>
          )}

          {/* Load more */}
          {hasMore && !loadingMore && (
            <button
              onClick={() => {
                const next = page + 1
                setPage(next)
                load(next * PAGE_SIZE)
              }}
              className="w-full mt-5 py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
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
            <div className="flex justify-center py-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
                className="w-6 h-6 rounded-full border-2"
                style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Generate FAB ────────────────────────────────────────────────── */}
      {!loading && items.length > 0 && (
        <div
          className="flex-shrink-0 px-4 lg:px-8 py-4"
          style={{ borderTop: `1px solid ${ACCENT_BDR}` }}
        >
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={() => navigate(`/create/ugc/${profileId}`)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{ background: ACCENT, color: '#ffffff' }}
            >
              <Zap size={15} fill="currentColor" />
              Generate New
            </button>
          </div>
        </div>
      )}

      {/* ── Sheets & Lightbox ───────────────────────────────────────────── */}
      <AnimatePresence>
        {sheetOpen && activeGen && (
          <ActionSheet
            key="sheet"
            gen={activeGen}
            onClose={closeSheet}
            onDelete={() => handleDelete(activeGen)}
            onDownload={() => handleDownload(activeGen)}
            onAnimate={() => handleAnimate(activeGen)}
          />
        )}
        {lightboxGen && (
          <Lightbox
            key="lightbox"
            gen={lightboxGen}
            onClose={() => setLightboxGen(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
