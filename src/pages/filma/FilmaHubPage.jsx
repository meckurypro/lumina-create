// src/pages/filma/FilmaHubPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Film, MoreVertical, Trash2, ArrowLeft, Clapperboard } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { filmaFilms } from '@/lib/filma'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

const STATUS_LABEL = {
  draft:         { label: 'Draft',         color: 'var(--text-muted)' },
  in_production: { label: 'In Production', color: '#E8A020' },
  completed:     { label: 'Completed',     color: '#34D399' },
}

const TYPE_LABEL = {
  feature_film: 'Feature Film', short_film: 'Short Film', epic: 'Epic',
  mini_series: 'Mini-Series', series: 'Series', documentary: 'Documentary',
  anthology: 'Anthology', web_series: 'Web Series', other: 'Film',
}

// ── Skeleton ──────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden animate-pulse"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
    <div style={{ aspectRatio: '16/9', background: 'var(--bg-elevated)' }} />
    <div className="p-4 flex flex-col gap-2">
      <div className="h-4 rounded-full w-2/3" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-3 rounded-full w-1/2" style={{ background: 'var(--bg-elevated)' }} />
    </div>
  </div>
)

// ── Film card ─────────────────────────────────────────────────────────────
const FilmCard = ({ film, index, onOpen, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const status = STATUS_LABEL[film.status] || STATUS_LABEL.draft

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Thumbnail / placeholder */}
      <button onClick={() => onOpen(film)} className="relative w-full overflow-hidden flex-shrink-0"
        style={{ aspectRatio: '16/9', background: 'var(--bg-elevated)' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Clapperboard size={32} style={{ color: ACCENT, opacity: 0.25 }} />
        </div>
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)' }} />
        <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
            {TYPE_LABEL[film.film_type] || film.film_type}
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.8)' }}>
            {film.aspect_ratio}
          </span>
        </div>
      </button>

      {/* Info row */}
      <div className="px-4 py-3 flex items-start justify-between gap-2">
        <button onClick={() => onOpen(film)} className="flex flex-col min-w-0 flex-1 text-left gap-0.5">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {film.title}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: status.color }}>
              {status.label}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
            <span className="text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
              {(film.genre ?? '').split('_').join(' ')}
            </span>
          </div>
        </button>

        <div className="relative flex-shrink-0">
          <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <MoreVertical size={14} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 bottom-8 z-50 rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                    minWidth: 130,
                  }}
                >
                  <button onClick={() => { onDelete(film); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: '#ef4444' }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ── Create card ───────────────────────────────────────────────────────────
const CreateCard = ({ onClick, index }) => (
  <motion.button
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.06 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="rounded-2xl flex flex-col items-center justify-center gap-3 transition-all"
    style={{ aspectRatio: '16/9', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
  >
    <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
      style={{ background: ACCENT_BDR }}>
      <Plus size={20} style={{ color: ACCENT }} />
    </div>
    <span className="text-xs font-semibold" style={{ color: ACCENT }}>New Film</span>
  </motion.button>
)

// ── Main ──────────────────────────────────────────────────────────────────
export default function FilmaHubPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [films,   setFilms]   = useState([])
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(null)

  useEffect(() => {
    if (!user) return
    load()
  }, [user])

  const load = async () => {
    setLoading(true)
    const { data, error } = await filmaFilms.getAll(user.id)
    if (!error) setFilms(data || [])
    setLoading(false)
  }

  const handleOpen = (film) => navigate(`/filma/${film.id}/structure`)
  const handleDelete = (film) => setPending(film)

  const confirmDelete = async () => {
    const film = pending
    setPending(null)
    const { error } = await filmaFilms.delete(film.id)
    if (error) { toast.error('Could not delete film'); return }
    setFilms((prev) => prev.filter((f) => f.id !== film.id))
    toast.success(`"${film.title}" deleted`)
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Filma</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Your Films</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 lg:px-0 py-6">

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : films.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                <Film size={36} style={{ color: ACCENT, opacity: 0.6 }} />
              </div>
              <div className="text-center">
                <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  No films yet
                </p>
                <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  Start your first AI film production on Filma.
                </p>
              </div>
              <button
                onClick={() => navigate('/filma/new')}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: ACCENT, color: '#000' }}
              >
                <Plus size={16} /> New Film
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {films.map((film, i) => (
                <FilmCard key={film.id} film={film} index={i}
                  onOpen={handleOpen} onDelete={handleDelete} />
              ))}
              <CreateCard onClick={() => navigate('/filma/new')} index={films.length} />
            </div>
          )}

        </div>
      </div>

      {/* Delete confirm */}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
            style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={() => setPending(null)}
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
                  Delete &ldquo;{pending?.title}&rdquo;?
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  All scenes, shots and actors will be permanently removed.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPending(null)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)' }}>
                  Cancel
                </button>
                <button onClick={confirmDelete}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                    border: '1px solid rgba(239,68,68,0.3)' }}>
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
