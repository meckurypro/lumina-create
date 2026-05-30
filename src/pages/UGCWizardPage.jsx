// src/pages/UGCWizardPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, X,
  User, Camera, AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcProfiles } from '@/lib/ugc'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const STEPS = [
  { id: 1, label: 'Identity'    },
  { id: 2, label: 'Personality' },
  { id: 3, label: 'Background'  },
  { id: 4, label: 'Style'       },
  { id: 5, label: 'Photos'      },
]

const PHOTO_SLOTS = [
  { key: 'photo_face_front',         label: 'Face — Front',      hint: 'Looking directly at camera'   },
  { key: 'photo_face_three_quarter', label: 'Face — ¾ Profile',  hint: '45° angle, both eyes visible' },
  { key: 'photo_face_side_90',       label: 'Face — Side 90°',   hint: 'Perfect side profile'         },
  { key: 'photo_body_front',         label: 'Full Body — Front', hint: 'Head to toe, facing camera'   },
  { key: 'photo_body_side',          label: 'Full Body — Side',  hint: 'Head to toe, 90° side'        },
  { key: 'photo_body_back',          label: 'Full Body — Back',  hint: 'Head to toe, back to camera'  },
]

// ── DB-safe enum options ──────────────────────────────────────
// ugc_gender enum
const GENDER_OPTIONS = [
  { value: 'male',   label: 'Male'   },
  { value: 'female', label: 'Female' },
]

// ugc_socioeconomic_status enum — DB only has 3 values
const SOCIOECONOMIC_OPTIONS = [
  { value: 'struggling',    label: 'Struggling'    },
  { value: 'working_class', label: 'Working Class' },
  { value: 'comfortable',   label: 'Comfortable'   },
]

// ugc_education_level enum
const EDUCATION_OPTIONS = [
  { value: 'no_formal_education', label: 'No Formal Education' },
  { value: 'primary_school',      label: 'Primary School'      },
  { value: 'secondary_school',    label: 'Secondary School'    },
  { value: 'vocational_training', label: 'Vocational Training' },
  { value: 'some_college',        label: 'Some College'        },
  { value: 'bachelors_degree',    label: "Bachelor's Degree"   },
  { value: 'masters_degree',      label: "Master's Degree"     },
  { value: 'phd_or_doctorate',    label: 'PhD / Doctorate'     },
  { value: 'self_taught',         label: 'Self-Taught'         },
]

const CONTENT_ENERGY_OPTIONS = [
  { value: 'aspirational', label: '✨ Aspirational' },
  { value: 'relatable',    label: '🙌 Relatable'    },
  { value: 'edgy',         label: '🔥 Edgy'         },
  { value: 'soft',         label: '🌸 Soft'         },
  { value: 'intellectual', label: '🧠 Intellectual' },
  { value: 'funny',        label: '😂 Funny'        },
  { value: 'motivational', label: '💪 Motivational' },
  { value: 'mysterious',   label: '🌙 Mysterious'   },
  { value: 'luxurious',    label: '💎 Luxurious'    },
  { value: 'raw',          label: '🎙 Raw'          },
]

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok'    },
  { value: 'youtube',   label: 'YouTube'   },
  { value: 'twitter',   label: 'Twitter/X' },
  { value: 'other',     label: 'Other'     },
]

const VIBE_SUGGESTIONS = [
  'Chill', 'Ambitious', 'Grounded', 'Charismatic', 'Mysterious',
  'Playful', 'Confident', 'Authentic', 'Hustler', 'Nomadic',
  'Intellectual', 'Bold', 'Soft', 'Gritty', 'Elegant',
]

// ── Form primitives ───────────────────────────────────────────
const Label = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
    {children}
  </p>
)

const Input = ({ label, ...props }) => (
  <div className="mb-5">
    {label && <Label>{label}</Label>}
    <input
      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
      style={{
        background: 'var(--bg-elevated)',
        border:     '1px solid var(--border-color)',
        color:      'var(--text-primary)',
      }}
      {...props}
    />
  </div>
)

const TextArea = ({ label, ...props }) => (
  <div className="mb-5">
    {label && <Label>{label}</Label>}
    <textarea
      className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
      style={{
        background:  'var(--bg-elevated)',
        border:      '1px solid var(--border-color)',
        color:       'var(--text-primary)',
        lineHeight:  1.6,
      }}
      rows={4}
      {...props}
    />
  </div>
)

const Select = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    {label && <Label>{label}</Label>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none transition-all"
      style={{
        background: 'var(--bg-elevated)',
        border:     '1px solid var(--border-color)',
        color:      value ? 'var(--text-primary)' : 'var(--text-muted)',
      }}
    >
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
)

const Chips = ({ label, options, value = [], onChange, max }) => (
  <div className="mb-5">
    {label && <Label>{label}{max ? ` (up to ${max})` : ''}</Label>}
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt.value)
        const disabled = !selected && max && value.length >= max
        return (
          <button
            key={opt.value}
            onClick={() => {
              if (disabled) return
              onChange(selected ? value.filter((v) => v !== opt.value) : [...value, opt.value])
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
            style={{
              background: selected ? ACCENT              : 'var(--bg-elevated)',
              color:      selected ? '#ffffff'           : 'var(--text-secondary)',
              opacity:    disabled ? 0.35               : 1,
              border:     selected ? `1px solid ${ACCENT_BDR}` : '1px solid var(--border-color)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  </div>
)

const Slider = ({ label, value, onChange, min = 1, max = 10 }) => (
  <div className="mb-5">
    {label && <Label>{label}</Label>}
    <div className="flex items-center gap-4">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1"
        style={{ accentColor: ACCENT }}
      />
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
      >
        {value}
      </div>
    </div>
    <div className="flex justify-between mt-1.5">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Very Basic</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Extremely Stylish</span>
    </div>
  </div>
)

// ── Vibe tag input ────────────────────────────────────────────
const VibeTags = ({ value = [], onChange }) => {
  const [input, setInput] = useState('')

  const addTag = (tag) => {
    const clean = tag.trim()
    if (!clean || value.length >= 3 || value.includes(clean)) return
    onChange([...value, clean])
    setInput('')
  }
  const removeTag = (tag) => onChange(value.filter((t) => t !== tag))

  return (
    <div className="mb-5">
      <Label>Vibe — 3 words that define them</Label>
      <div className="flex flex-wrap gap-2 mb-3">
        {value.map((tag) => (
          <div
            key={tag}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: ACCENT, color: '#ffffff' }}
          >
            {tag}
            <button onClick={() => removeTag(tag)}><X size={10} /></button>
          </div>
        ))}
        {value.length < 3 && (
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
            }}
            placeholder={value.length === 0 ? 'Type a word and press Enter…' : 'Add more…'}
            className="px-3 py-1.5 rounded-xl text-xs outline-none flex-1 min-w-24"
            style={{
              background: 'var(--bg-elevated)',
              border:     '1px solid var(--border-color)',
              color:      'var(--text-primary)',
            }}
          />
        )}
      </div>
      {value.length < 3 && (
        <div className="flex flex-wrap gap-1.5">
          {VIBE_SUGGESTIONS.filter((s) => !value.includes(s)).slice(0, 8).map((s) => (
            <button
              key={s}
              onClick={() => addTag(s)}
              className="px-2.5 py-1 rounded-lg text-xs transition-all"
              style={{
                background: 'var(--bg-elevated)',
                color:      'var(--text-muted)',
                border:     '1px solid var(--border-color)',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Photo slot ────────────────────────────────────────────────
const PhotoSlot = ({ slot, value, onChange, onRemove, uploading }) => {
  const PLACEHOLDER = {
    photo_face_front:         '/headfront.png',
    photo_face_three_quarter: '/headthreequarter.png',
    photo_face_side_90:       '/headside.png',
    photo_body_front:         '/bodyfront.png',
    photo_body_side:          '/bodyside.png',
    photo_body_back:          '/bodyback.png',
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{slot.label}</p>
      <p className="text-xs -mt-1.5 mb-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{slot.hint}</p>

      {value?.url ? (
        <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }}>
          <img src={value.url} alt={slot.label} className="w-full h-full object-cover" />
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-6 h-6 rounded-full border-2"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }}
              />
            </div>
          ) : (
            <button
              onClick={() => onRemove(slot.key)}
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      ) : (
        <label
          className="relative flex flex-col items-center justify-center rounded-2xl overflow-hidden transition-all cursor-pointer"
          style={{ aspectRatio: '3/4', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
        >
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(slot.key, e.target.files?.[0])} />
          <img
            src={PLACEHOLDER[slot.key]}
            alt={slot.label}
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="relative z-10 flex flex-col items-center gap-1.5">
            <Camera size={18} style={{ color: ACCENT }} />
            <span className="text-xs font-medium" style={{ color: ACCENT }}>Upload</span>
          </div>
        </label>
      )}
    </div>
  )
}

// ── Step validation ───────────────────────────────────────────
const stepIsValid = (step, form) => {
  switch (step) {
    case 1: return form.name?.trim() && form.age && form.gender && form.nationality?.trim() && form.ethnic_background?.trim()
    case 2: return form.vibe_tags?.length > 0 && form.interests?.trim() && form.socioeconomic_status && form.content_energy?.length > 0
    case 3: return form.backstory?.trim() && form.education_level && form.occupation?.trim()
    case 4: return form.fashion_score && form.style_direction?.trim() && form.platforms?.length > 0
    case 5: return form.photo_face_front && form.photo_face_three_quarter && form.photo_face_side_90
    default: return false
  }
}

// ── Main wizard ───────────────────────────────────────────────
export default function UGCWizardPage() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user }   = useAuth()

const resumeId = location.state?.resumeProfileId || null
  const editId   = location.state?.editProfileId   || null
  const loadId   = resumeId || editId
  const isEdit   = !!editId

  const [step,          setStep]          = useState(1)
  const [profileId,     setProfileId]     = useState(loadId)
  const [saving,        setSaving]        = useState(false)
  const [uploadingSlot, setUploadingSlot] = useState(null)

  const [form, setForm] = useState({
    name: '', age: '', gender: '', nationality: '', ethnic_background: '',
    vibe_tags: [], interests: '', socioeconomic_status: '', content_energy: [],
    backstory: '', education_level: '', occupation: '',
    fashion_score: 5, style_direction: '', platforms: [],
    photo_face_front: null, photo_face_three_quarter: null, photo_face_side_90: null,
    photo_body_front: null, photo_body_side: null, photo_body_back: null,
  })

// Load profile if resuming a draft or editing an active character
  useEffect(() => {
    if (!loadId) return
    const load = async () => {
      const { data } = await ugcProfiles.getById(loadId)
      if (data) {
        setForm((prev) => ({
          ...prev,
          ...data,
          photo_face_front:         data.photo_face_front         ? { url: data.photo_face_front }         : null,
          photo_face_three_quarter: data.photo_face_three_quarter ? { url: data.photo_face_three_quarter } : null,
          photo_face_side_90:       data.photo_face_side_90       ? { url: data.photo_face_side_90 }       : null,
          photo_body_front:         data.photo_body_front         ? { url: data.photo_body_front }         : null,
          photo_body_side:          data.photo_body_side          ? { url: data.photo_body_side }          : null,
          photo_body_back:          data.photo_body_back          ? { url: data.photo_body_back }          : null,
        }))
      }
    }
    load()
  }, [loadId])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

const buildPayload = () => ({
  name:                 form.name,
  age:                  parseInt(form.age),
  gender:               form.gender               || null,
  nationality:          form.nationality,
  ethnic_background:    form.ethnic_background,
  vibe_tags:            form.vibe_tags,
  interests:            form.interests,
  socioeconomic_status: form.socioeconomic_status  || null,
  content_energy:       form.content_energy,
  backstory:            form.backstory,
  education_level:      form.education_level       || null,
  occupation:           form.occupation,
  fashion_score:        form.fashion_score,
  style_direction:      form.style_direction,
  platforms:            form.platforms,
  photo_face_front:         form.photo_face_front?.url         || null,
  photo_face_three_quarter: form.photo_face_three_quarter?.url || null,
  photo_face_side_90:       form.photo_face_side_90?.url       || null,
  photo_body_front:         form.photo_body_front?.url         || null,
  photo_body_side:          form.photo_body_side?.url          || null,
  photo_body_back:          form.photo_body_back?.url          || null,
})

  const saveStep = async (nextStep) => {
    setSaving(true)
    try {
      const payload = buildPayload()
      if (!profileId) {
        const { data, error } = await ugcProfiles.create(user.id, payload)
        if (error) throw error
        setProfileId(data.id)
      } else {
        const { error } = await ugcProfiles.update(profileId, payload)
        if (error) throw error
      }
      setStep(nextStep)
    } catch (err) {
      toast.error(err.message || 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handlePhotoUpload = async (slotKey, file) => {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    set(slotKey, { file, url: previewUrl })

    let pid = profileId
    if (!pid) {
      setSaving(true)
      try {
        const { data, error } = await ugcProfiles.create(user.id, { ...buildPayload(), [slotKey]: null })
        if (error) throw error
        pid = data.id
        setProfileId(pid)
      } catch (err) {
        toast.error('Could not initialise profile')
        setSaving(false)
        return
      } finally {
        setSaving(false)
      }
    }

    setUploadingSlot(slotKey)
    try {
      const publicUrl = await ugcProfiles.uploadPhoto(user.id, pid, slotKey, file)
      set(slotKey, { file, url: publicUrl })
      await ugcProfiles.update(pid, { [slotKey]: publicUrl })
    } catch (err) {
      toast.error(err.message || 'Upload failed')
      set(slotKey, null)
    } finally {
      setUploadingSlot(null)
    }
  }

  const handlePhotoRemove = async (slotKey) => {
    set(slotKey, null)
    if (profileId) {
      await ugcProfiles.update(profileId, { [slotKey]: null })
      await ugcProfiles.deletePhoto(user.id, profileId, slotKey)
    }
  }

const handleFinish = async () => {
    setSaving(true)
    try {
      if (isEdit) {
        const { error } = await ugcProfiles.edit(profileId, buildPayload())
        if (error) throw error
        toast.success('Character updated!')
        navigate(`/create/ugc/${profileId}`, { replace: true })
      } else if (!profileId) {
        const { data, error } = await ugcProfiles.create(user.id, { ...buildPayload(), status: 'active' })
        if (error) throw error
        toast.success('Character created! Ready to generate.')
        navigate(`/create/ugc/${data.id}`, { replace: true })
      } else {
        const { error } = await ugcProfiles.activate(profileId)
        if (error) throw error
        toast.success('Character created! Ready to generate.')
        navigate(`/create/ugc/${profileId}`, { replace: true })
      }
    } catch (err) {
      toast.error(err.message || 'Could not finish setup')
    } finally {
      setSaving(false)
    }
  }

  const valid = stepIsValid(step, form)

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Character' : resumeId ? 'Complete Character' : 'New Character'}
          </h1>
          <span className="text-xs" style={{ color: ACCENT }}>Step {step} of {STEPS.length}</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 flex gap-1 px-4 py-3">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              background: s.id <= step ? ACCENT : 'var(--bg-elevated)',
              opacity:    s.id < step ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      {/* Step label */}
      <div className="flex-shrink-0 px-4 pb-4">
        <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
          {STEPS[step - 1].label}
        </p>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0  }}
              exit={{    opacity: 0, x: -20}}
              transition={{ duration: 0.18 }}
            >

              {/* Step 1: Identity */}
              {step === 1 && (
                <>
                  <Input label="Character Name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Amara" />
                  <Input label="Age" type="number" min={18} max={100} value={form.age} onChange={(e) => set('age', e.target.value)} placeholder="e.g. 24" />
                  <Select label="Gender" options={GENDER_OPTIONS} value={form.gender} onChange={(v) => set('gender', v)} />
                  <Input label="Nationality" value={form.nationality} onChange={(e) => set('nationality', e.target.value)} placeholder="e.g. Nigerian" />
                  <Input label="Ethnic Background" value={form.ethnic_background} onChange={(e) => set('ethnic_background', e.target.value)} placeholder="e.g. Yoruba" />
                </>
              )}

              {/* Step 2: Personality */}
              {step === 2 && (
                <>
                  <VibeTags value={form.vibe_tags} onChange={(v) => set('vibe_tags', v)} />
                  <TextArea label="Interests & Hobbies" value={form.interests} onChange={(e) => set('interests', e.target.value)} placeholder="What do they love? What fills their time?" rows={3} />
                  <Select label="Socioeconomic Status" options={SOCIOECONOMIC_OPTIONS} value={form.socioeconomic_status} onChange={(v) => set('socioeconomic_status', v)} />
                  <Chips label="Content Energy" options={CONTENT_ENERGY_OPTIONS} value={form.content_energy} onChange={(v) => set('content_energy', v)} />
                </>
              )}

              {/* Step 3: Background */}
              {step === 3 && (
                <>
                  <TextArea
                    label="Backstory"
                    value={form.backstory}
                    onChange={(e) => set('backstory', e.target.value)}
                    placeholder="Who are they, where are they from, what have they been through?"
                    rows={5}
                  />
                  <Select label="Education Level" options={EDUCATION_OPTIONS} value={form.education_level} onChange={(v) => set('education_level', v)} />
                  <Input label="Current Occupation / Hustle" value={form.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder="e.g. Freelance photographer, startup founder" />
                </>
              )}

              {/* Step 4: Style & Platform */}
              {step === 4 && (
                <>
                  <Slider label="Fashion Score" value={form.fashion_score} onChange={(v) => set('fashion_score', v)} />
                  <Input
                    label="Style Direction"
                    value={form.style_direction}
                    onChange={(e) => set('style_direction', e.target.value)}
                    placeholder="e.g. Afro-streetwear, vintage thrift, quiet luxury"
                  />
                  <Chips label="Platforms" options={PLATFORM_OPTIONS} value={form.platforms} onChange={(v) => set('platforms', v)} />
                </>
              )}

              {/* Step 5: Photos */}
              {step === 5 && (
                <>
                  <div
                    className="flex items-start gap-3 p-3 rounded-xl mb-5"
                    style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                  >
                    <AlertCircle size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Face photos are required. Body photos improve full-body generation accuracy.
                      Upload clear, unobstructed shots with neutral backgrounds where possible.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {PHOTO_SLOTS.map((slot) => (
                      <PhotoSlot
                        key={slot.key}
                        slot={slot}
                        value={form[slot.key]}
                        onChange={handlePhotoUpload}
                        onRemove={handlePhotoRemove}
                        uploading={uploadingSlot === slot.key}
                      />
                    ))}
                  </div>
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex-shrink-0 px-4 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={step === STEPS.length ? handleFinish : () => saveStep(step + 1)}
            disabled={!valid || saving || !!uploadingSlot}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: (!valid || saving) ? 'var(--bg-elevated)' : ACCENT,
              color:      (!valid || saving) ? 'var(--text-muted)'  : '#ffffff',
            }}
          >
         {saving ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#ffffff' }}
              />
            ) : step === STEPS.length ? (
              isEdit
                ? <><Check size={15} /> Save Changes</>
                : <><Check size={15} /> Finish Setup</>
            ) : (
              <>Continue <ArrowRight size={15} /></>
            )}
          </button>
        </div>
      </div>

    </div>
  )
}
