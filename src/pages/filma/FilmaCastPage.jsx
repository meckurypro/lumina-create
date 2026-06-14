// src/pages/filma/FilmaCastPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Plus, User, X, ImagePlus,
  Download, ChevronDown, Trash2, Check, AlertCircle, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { filmaActors, filmaFilms, filmaUpload } from '@/lib/filma'
import { ugcProfiles } from '@/lib/ugc'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

const GENDER_OPTIONS   = ['male', 'female', 'non_binary', 'other']
const PHYSIQUE_OPTIONS = ['slim', 'athletic', 'average', 'muscular', 'plus_size', 'petite']
const AGE_RANGES       = ['Child', 'Teen', '20s', '30s', '40s', '50s', '60s', '70+']

// ── Actor card ────────────────────────────────────────────────────────────
const ActorCard = ({ actor, index, onEdit, onDelete, onProfile }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
    className="flex items-center gap-3 px-4 py-3 rounded-2xl"
    style={{
      background: 'var(--bg-card)',
      border: `1px solid ${actor.is_complete ? 'var(--border-color)' : 'rgba(232,160,32,0.35)'}`,
    }}
  >
    {/* Face thumbnail */}
    <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
      style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
      {actor.thumbnail_url || actor.face_reference_url || actor.photo_face_front ? (
        <img src={actor.thumbnail_url || actor.face_reference_url || actor.photo_face_front}
          alt={actor.name} className="w-full h-full object-cover" />
      ) : (
        <User size={20} style={{ color: ACCENT, opacity: 0.6 }} />
      )}
      {actor.is_complete && (
        <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: '#34D399', border: '1.5px solid var(--bg-card)' }}>
          <Check size={9} color="#000" />
        </div>
      )}
    </div>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {actor.name}
        </p>
        {actor.ai_generated && (
          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
            style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
            <Sparkles size={9} /> AI
          </span>
        )}
        {!actor.is_complete && (
          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0"
            style={{ background: 'rgba(232,160,32,0.1)', color: '#E8A020' }}>
            <AlertCircle size={9} /> Incomplete
          </span>
        )}
      </div>
      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {[actor.age_range, actor.gender?.replace('_', ' '), actor.ethnic_background]
          .filter(Boolean).join(' · ')}
      </p>
      {actor.role_description && (
        <p className="text-xs truncate mt-0.5" style={{ color: ACCENT, opacity: 0.8 }}>
          {actor.role_description}
        </p>
      )}
    </div>

    {/* Actions */}
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button onClick={() => onProfile(actor)}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{
          background: actor.is_complete ? ACCENT_SUB : ACCENT,
          color:      actor.is_complete ? ACCENT : '#000',
          border: `1px solid ${actor.is_complete ? ACCENT_BDR : 'transparent'}`,
        }}>
        {actor.is_complete ? 'Profile' : 'Complete'}
      </button>
      <button onClick={() => onEdit(actor)}
        className="px-3 py-1.5 rounded-xl text-xs font-semibold"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)' }}>
        Edit
      </button>
      <button onClick={() => onDelete(actor)}
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
        <Trash2 size={13} />
      </button>
    </div>
  </motion.div>
)

// ── UGC import sheet ──────────────────────────────────────────────────────
const UGCImportSheet = ({ profiles, onImport, onClose }) => (
  <>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose} />
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
    >
      <div className="w-full max-w-xl rounded-t-3xl px-4 pt-4 pb-10"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
          maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>
        <p className="text-sm font-bold mb-3 px-1" style={{ color: 'var(--text-primary)' }}>
          Import UGC Character
        </p>
        <div className="flex-1 overflow-y-auto flex flex-col gap-2">
          {profiles.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
              No UGC characters found.
            </p>
          ) : profiles.map((p) => (
            <button key={p.id} onClick={() => onImport(p)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98]"
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
              <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0"
                style={{ background: ACCENT_SUB }}>
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={16} style={{ color: ACCENT }} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                  {p.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {p.age} · {p.nationality}
                </p>
              </div>
              <Download size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
        <button onClick={onClose}
          className="mt-3 w-full py-3 rounded-2xl text-sm font-semibold"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)' }}>Cancel</button>
      </div>
    </motion.div>
  </>
)

// ── Actor form sheet ──────────────────────────────────────────────────────
const ActorFormSheet = ({ initial, onSave, onClose, userId }) => {
  const [name,            setName]           = useState(initial?.name            || '')
  const [role,            setRole]           = useState(initial?.role_description || '')
  const [gender,          setGender]         = useState(initial?.gender          || '')
  const [physique,        setPhysique]       = useState(initial?.physique        || '')
  const [ageRange,        setAgeRange]       = useState(initial?.age_range       || '')
  const [nationality,     setNationality]    = useState(initial?.nationality     || '')
  const [ethnic,          setEthnic]         = useState(initial?.ethnic_background || '')
  const [faceUrl,         setFaceUrl]        = useState(initial?.face_reference_url || '')
  const [uploading,       setUploading]      = useState(false)
  const fileRef = useRef(null)

  const handleFaceUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await filmaUpload(userId, file, 'actors/face')
      setFaceUrl(url)
    } catch (err) {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const PillRow = ({ options, value, onChange }) => (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} onClick={() => onChange(value === opt ? '' : opt)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all"
          style={{
            background: value === opt ? ACCENT_SUB   : 'var(--bg-primary)',
            color:      value === opt ? ACCENT        : 'var(--text-muted)',
            border:     `1px solid ${value === opt ? ACCENT_BDR : 'var(--border-color)'}`,
          }}>
          {opt.replace('_', ' ')}
        </button>
      ))}
    </div>
  )

  const canSave = name.trim()

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      >
        <div className="w-full max-w-xl rounded-t-3xl px-4 pt-4 pb-10"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
            maxHeight: '85vh', overflowY: 'auto' }}>
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {initial ? 'Edit Actor' : 'New Actor'}
            </p>
            <button onClick={onClose}><X size={18} style={{ color: 'var(--text-muted)' }} /></button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Face upload */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                {faceUrl ? (
                  <img src={faceUrl} alt="face" className="w-full h-full object-cover" />
                ) : (
                  <User size={24} style={{ color: ACCENT, opacity: 0.5 }} />
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-95"
                  style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={handleFaceUpload} />
                  <ImagePlus size={13} />
                  {uploading ? 'Uploading…' : 'Upload Face Reference'}
                </label>
                <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                  Front-facing photo recommended
                </p>
              </div>
            </div>

            {/* Name */}
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Character Name *</p>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kofi Mensah"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-primary)', border: `1.5px solid var(--border-color)`,
                  color: 'var(--text-primary)' }} />
            </div>

            {/* Role */}
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Role / Description</p>
              <input type="text" value={role} onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. The protagonist, a young engineer from Accra"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: 'var(--bg-primary)', border: `1.5px solid var(--border-color)`,
                  color: 'var(--text-primary)' }} />
            </div>

            {/* Gender */}
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Gender</p>
              <PillRow options={GENDER_OPTIONS} value={gender} onChange={setGender} />
            </div>

            {/* Physique */}
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Physique</p>
              <PillRow options={PHYSIQUE_OPTIONS} value={physique} onChange={setPhysique} />
            </div>

            {/* Age range */}
            <div>
              <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Age Range</p>
              <PillRow options={AGE_RANGES} value={ageRange} onChange={setAgeRange} />
            </div>

            {/* Nationality + Ethnic */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Nationality</p>
                <input type="text" value={nationality} onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g. Nigerian"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-primary)', border: `1px solid var(--border-color)`,
                    color: 'var(--text-primary)' }} />
              </div>
              <div>
                <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Ethnic Background</p>
                <input type="text" value={ethnic} onChange={(e) => setEthnic(e.target.value)}
                  placeholder="e.g. Igbo"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-primary)', border: `1px solid var(--border-color)`,
                    color: 'var(--text-primary)' }} />
              </div>
            </div>

            <button onClick={() => onSave({
                name: name.trim(), role_description: role.trim(),
                gender: gender || null, physique: physique || null,
                age_range: ageRange || null, nationality: nationality.trim() || null,
                ethnic_background: ethnic.trim() || null,
                face_reference_url: faceUrl || null,
              })}
              disabled={!canSave}
              className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: canSave ? ACCENT : 'var(--bg-primary)',
                color:      canSave ? '#000'  : 'var(--text-muted)',
                border:     canSave ? 'none'  : '1px solid var(--border-color)',
              }}>
              {initial ? 'Save Changes' : 'Add Actor'}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function FilmaCastPage() {
  const navigate = useNavigate()
  const { filmId } = useParams()
  const { user } = useAuth()

  const [film,         setFilm]        = useState(null)
  const [actors,       setActors]      = useState([])
  const [ugcList,      setUgcList]     = useState([])
  const [loading,      setLoading]     = useState(true)
  const [showForm,     setShowForm]    = useState(false)
  const [editActor,    setEditActor]   = useState(null)
  const [showUGC,      setShowUGC]     = useState(false)
  const [ugcPending,   setUgcPending]  = useState(null) // UGC profile awaiting name/role input
  const [saving,       setSaving]      = useState(false)

  useEffect(() => {
    load()
  }, [filmId])

  const load = async () => {
    setLoading(true)
    const [filmRes, actorsRes] = await Promise.all([
      filmaFilms.getById(filmId),
      filmaActors.getByFilm(filmId),
    ])
    if (!filmRes.error) setFilm(filmRes.data)
    if (!actorsRes.error) setActors(actorsRes.data || [])
    setLoading(false)
  }

  const loadUGC = async () => {
    const { data } = await ugcProfiles.getAll(user.id)
    setUgcList((data || []).filter((p) => p.status === 'active'))
    setShowUGC(true)
  }

  const handleSaveActor = async (payload) => {
    setSaving(true)
    if (editActor) {
      const { data, error } = await filmaActors.update(editActor.id, payload)
      if (error) { toast.error('Could not save'); setSaving(false); return }
      setActors((prev) => prev.map((a) => a.id === editActor.id ? data : a))
      toast.success('Actor updated')
    } else {
      const { data, error } = await filmaActors.create(user.id, filmId, {
        ...payload, sort_order: actors.length
      })
      if (error) { toast.error('Could not add actor'); setSaving(false); return }
      setActors((prev) => [...prev, data])
      toast.success(`${payload.name} added`)
    }
    setSaving(false)
    setShowForm(false)
    setEditActor(null)
  }

  const handleImportUGC = (ugcProfile) => {
    setShowUGC(false)
    setUgcPending(ugcProfile)
    setShowForm(true)
  }

  const handleSaveUGCImport = async (payload) => {
    if (!ugcPending) return handleSaveActor(payload)
    setSaving(true)
    const { data, error } = await filmaActors.importFromUGC(
      user.id, filmId, ugcPending, payload.name, payload.role_description
    )
    // Override with any extra fields user filled in
    if (!error && data) {
      const merged = {
        ...data,
        gender:            payload.gender            || data.gender,
        physique:          payload.physique          || data.physique,
        age_range:         payload.age_range         || data.age_range,
        face_reference_url:payload.face_reference_url|| data.face_reference_url,
      }
      if (JSON.stringify(merged) !== JSON.stringify(data)) {
        const { data: updated } = await filmaActors.update(data.id, merged)
        setActors((prev) => [...prev, updated || merged])
      } else {
        setActors((prev) => [...prev, data])
      }
      toast.success(`${payload.name} imported`)
    } else {
      toast.error('Could not import actor')
    }
    setSaving(false)
    setShowForm(false)
    setUgcPending(null)
  }

  const handleDeleteActor = async (actor) => {
    const { error } = await filmaActors.delete(actor.id)
    if (error) { toast.error('Could not remove actor'); return }
    setActors((prev) => prev.filter((a) => a.id !== actor.id))
    toast.success(`${actor.name} removed`)
  }

  const incompleteCount = actors.filter((a) => !a.is_complete).length

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate(`/filma/${filmId}/story-summary`)} className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {film?.title || 'Cast'}
          </h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Main Cast</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-4">

          {/* Add buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setEditActor(null); setUgcPending(null); setShowForm(true) }}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: ACCENT, color: '#000' }}>
              <Plus size={16} /> New Actor
            </button>
            <button onClick={loadUGC}
              className="flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
              <Download size={15} /> Import UGC
            </button>
          </div>

          {/* Incomplete actors notice */}
          {!loading && incompleteCount > 0 && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)' }}>
              <AlertCircle size={14} style={{ color: '#E8A020', flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                <span style={{ color: '#E8A020', fontWeight: 600 }}>
                  {incompleteCount} character{incompleteCount !== 1 ? 's' : ''}
                </span>{' '}
                {incompleteCount !== 1 ? 'need' : 'needs'} all 3 face photos before {incompleteCount !== 1 ? 'they' : 'it'} can be used in scenes.
                Tap <span style={{ color: ACCENT }}>Complete</span> to add them.
              </p>
            </div>
          )}

          {/* Hint */}
          <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
            Add your main cast here. You can add more actors from within any scene later.
          </p>

          {/* Actor list */}
          {loading ? (
            [...Array(2)].map((_, i) => (
              <div key={i} className="h-[72px] rounded-2xl animate-pulse"
                style={{ background: 'var(--bg-elevated)' }} />
            ))
          ) : actors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                <User size={28} style={{ color: ACCENT, opacity: 0.5 }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
                No actors yet
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {actors.map((actor, i) => (
               <ActorCard key={actor.id} actor={actor} index={i}
                  onEdit={(a) => { setEditActor(a); setUgcPending(null); setShowForm(true) }}
                  onDelete={handleDeleteActor}
                  onProfile={(a) => navigate(`/filma/${filmId}/actor/${a.id}`)} />
              ))}
            </div>
          )}

          <div style={{ height: 80 }} />
        </div>
      </div>

      {/* Continue */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4"
        style={{ borderTop: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-primary)' }}>
        <div className="mx-auto w-full max-w-xl">
          <button onClick={() => navigate(`/filma/${filmId}/structure`)}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: ACCENT, color: '#000' }}>
            <span>Continue to Structure</span><ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Sheets */}
      <AnimatePresence>
        {showUGC && (
          <UGCImportSheet profiles={ugcList} onImport={handleImportUGC}
            onClose={() => setShowUGC(false)} />
        )}
        {showForm && (
          <ActorFormSheet
            initial={editActor ? {
              ...editActor,
              name: editActor.name,
            } : ugcPending ? {
              name: ugcPending.name,
              gender: ugcPending.gender,
              ethnic_background: ugcPending.ethnic_background,
              nationality: ugcPending.nationality,
              face_reference_url: ugcPending.photo_face_front,
              thumbnail_url: ugcPending.thumbnail_url,
            } : null}
            userId={user.id}
            onSave={ugcPending && !editActor ? handleSaveUGCImport : handleSaveActor}
            onClose={() => { setShowForm(false); setEditActor(null); setUgcPending(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
