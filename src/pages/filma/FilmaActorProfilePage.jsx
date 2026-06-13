// src/pages/filma/FilmaActorProfilePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Camera, X, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { filmaActors, filmaFilms, filmaUpload } from '@/lib/filma'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

const STEPS = [
  { id: 1, label: 'Face Photos' },
  { id: 2, label: 'Body Photos' },
]

const FACE_SLOTS = [
  { key: 'photo_face_front',         label: 'Face — Front',     hint: 'Looking directly at camera',  placeholder: '/headfront.png',        required: true  },
  { key: 'photo_face_three_quarter', label: 'Face — ¾ Profile', hint: '45° angle, both eyes visible', placeholder: '/headthreequarter.png', required: true  },
  { key: 'photo_face_side_90',       label: 'Face — Side 90°',  hint: 'Perfect side profile',         placeholder: '/headside.png',         required: true  },
]

const BODY_SLOTS = [
  { key: 'photo_body_front', label: 'Full Body — Front', hint: 'Head to toe, facing camera',    placeholder: '/bodyfront.png', required: false },
  { key: 'photo_body_side',  label: 'Full Body — Side',  hint: 'Head to toe, 90° side',         placeholder: '/bodyside.png',  required: false },
  { key: 'photo_body_back',  label: 'Full Body — Back',  hint: 'Head to toe, back to camera',   placeholder: '/bodyback.png',  required: false },
]

// ── Photo slot ─────────────────────────────────────────────────────────────
const PhotoSlot = ({ slot, value, onChange, onRemove, uploading }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
      {slot.label}
      {slot.required && <span style={{ color: ACCENT }}> *</span>}
    </p>
    <p className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{slot.hint}</p>

    {value ? (
      <div className="relative rounded-2xl overflow-hidden"
        style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }}>
        <img src={value} alt={slot.label} className="w-full h-full object-cover" />
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
              className="w-6 h-6 rounded-full border-2"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
            />
          </div>
        ) : (
          <button onClick={() => onRemove(slot.key)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
            <X size={11} />
          </button>
        )}
      </div>
    ) : (
      <label
        className="relative flex flex-col items-center justify-center rounded-2xl overflow-hidden cursor-pointer transition-all"
        style={{ aspectRatio: '3/4', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChange(slot.key, file)
            e.target.value = ''
          }} />
        {slot.placeholder && (
          <img src={slot.placeholder} alt={slot.label}
            className="absolute inset-0 w-full h-full object-cover opacity-20" />
        )}
        <div className="relative z-10 flex flex-col items-center gap-1.5">
          <Camera size={18} style={{ color: ACCENT }} />
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Upload</span>
        </div>
      </label>
    )}
  </div>
)

// ── Step validation ────────────────────────────────────────────────────────
const stepIsValid = (step, photos) => {
  if (step === 1) return FACE_SLOTS.every((s) => !s.required || !!photos[s.key])
  if (step === 2) return true // body photos optional
  return false
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function FilmaActorProfilePage() {
  const navigate      = useNavigate()
  const { filmId, actorId } = useParams()
  const { user }      = useAuth()

  const isNew = actorId === 'new'

  const [step,         setStep]        = useState(1)
  const [film,         setFilm]        = useState(null)
  const [actor,        setActor]       = useState(null)
  const [resolvedId,   setResolvedId]  = useState(isNew ? null : actorId)
  const [photos,       setPhotos]      = useState({
    photo_face_front:         null,
    photo_face_three_quarter: null,
    photo_face_side_90:       null,
    photo_body_front:         null,
    photo_body_side:          null,
    photo_body_back:          null,
  })
  const [uploadingSlot, setUploadingSlot] = useState(null)
  const [saving,        setSaving]        = useState(false)

  // ── Load film + actor ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const filmRes = await filmaFilms.getById(filmId)
      if (!filmRes.error) setFilm(filmRes.data)

      if (!isNew) {
        const actorsRes = await filmaActors.getByFilm(filmId)
        const found = (actorsRes.data || []).find((a) => a.id === actorId)
        if (found) {
          setActor(found)
          setPhotos({
            photo_face_front:         found.photo_face_front         || null,
            photo_face_three_quarter: found.photo_face_three_quarter || null,
            photo_face_side_90:       found.photo_face_side_90       || null,
            photo_body_front:         found.photo_body_front         || null,
            photo_body_side:          found.photo_body_side          || null,
            photo_body_back:          found.photo_body_back          || null,
          })
        }
      }
    }
    load()
  }, [filmId, actorId]) // eslint-disable-line

  // ── Upload handler ─────────────────────────────────────────────────────
  const handleUpload = async (slotKey, file) => {
    // Optimistic preview
    const previewUrl = URL.createObjectURL(file)
    setPhotos((prev) => ({ ...prev, [slotKey]: previewUrl }))
    setUploadingSlot(slotKey)

    try {
      const { url } = await filmaUpload(user.id, file, `actors/profile`)

      // If actor row doesn't exist yet (new), create a stub first
      let aid = resolvedId
      if (!aid) {
        // We need at least the actor to exist — grab the first actor for this film
        // OR navigate requires actorId. For 'new', we need the actor created first.
        // We'll create a minimal actor row here if not yet done.
        toast.error('Please create the actor first via New Actor, then open their profile.')
        setPhotos((prev) => ({ ...prev, [slotKey]: null }))
        setUploadingSlot(null)
        return
      }

      // Persist to DB
      await filmaActors.update(aid, { [slotKey]: url })
      setPhotos((prev) => ({ ...prev, [slotKey]: url }))

    } catch (err) {
      toast.error(err.message || 'Upload failed')
      setPhotos((prev) => ({ ...prev, [slotKey]: null }))
    } finally {
      setUploadingSlot(null)
    }
  }

  // ── Remove handler ─────────────────────────────────────────────────────
  const handleRemove = async (slotKey) => {
    setPhotos((prev) => ({ ...prev, [slotKey]: null }))
    if (resolvedId) {
      await filmaActors.update(resolvedId, { [slotKey]: null })
    }
  }

  // ── Finish ─────────────────────────────────────────────────────────────
  const handleFinish = async () => {
    setSaving(true)
    try {
      if (resolvedId) {
        await filmaActors.update(resolvedId, photos)
      }
      toast.success('Actor profile saved!')
      navigate(`/filma/${filmId}/cast`)
    } catch (err) {
      toast.error('Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  const currentSlots = step === 1 ? FACE_SLOTS : BODY_SLOTS
  const valid = stepIsValid(step, photos)
  const actorName = actor?.name || 'New Actor'

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => step === 1 ? navigate(`/filma/${filmId}/cast`) : setStep(step - 1)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold truncate max-w-[180px]"
            style={{ color: 'var(--text-primary)' }}>
            {actorName}
          </h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>
            Actor Profile · Step {step} of {STEPS.length}
          </span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Progress */}
      <div className="flex-shrink-0 flex gap-1 px-4 py-3">
        {STEPS.map((s) => (
          <div key={s.id} className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              background: s.id <= step ? ACCENT : 'var(--bg-elevated)',
              opacity:    s.id < step ? 0.5 : 1,
            }} />
        ))}
      </div>

      {/* Step label */}
      <div className="flex-shrink-0 px-4 pb-2">
        <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
          {STEPS[step - 1].label}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0  }}
              exit={{    opacity: 0, x: -20}}
              transition={{ duration: 0.18 }}
            >
              {/* Hint banner */}
              <div className="flex items-start gap-3 p-3 rounded-xl mb-5"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                <AlertCircle size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {step === 1
                    ? 'All 3 face photos are required. Use clear, unobstructed shots with neutral backgrounds. AI uses these to maintain face consistency across scenes.'
                    : 'Body photos are optional but improve full-body scene accuracy. Upload as many as you have.'}
                </p>
              </div>

              {/* Photo grid */}
              <div className="grid grid-cols-3 gap-3">
                {currentSlots.map((slot) => (
                  <PhotoSlot
                    key={slot.key}
                    slot={slot}
                    value={photos[slot.key]}
                    onChange={handleUpload}
                    onRemove={handleRemove}
                    uploading={uploadingSlot === slot.key}
                  />
                ))}
              </div>

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4"
        style={{ borderTop: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-primary)' }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={step === STEPS.length ? handleFinish : () => setStep(step + 1)}
            disabled={!valid || saving || !!uploadingSlot}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: (valid && !saving && !uploadingSlot) ? ACCENT : 'var(--bg-elevated)',
              color:      (valid && !saving && !uploadingSlot) ? '#000'  : 'var(--text-muted)',
            }}
          >
            {saving ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2"
                style={{ borderColor: 'rgba(0,0,0,0.2)', borderTopColor: '#000' }}
              />
            ) : step === STEPS.length ? (
              <><Check size={15} /> Save Profile</>
            ) : (
              <>Continue <ArrowRight size={15} /></>
            )}
          </button>
        </div>
      </div>

    </div>
  )
}
