// src/pages/UGCGeneratePage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, User, Sparkles,
  ImageIcon, VideoIcon, ChevronDown, Info,
  X, ImagePlus, Maximize2, Plus, Crown,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcProfiles, ugcGenerations } from '@/lib/ugc'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

const MAX_REF_IMAGES = 4

// ─── image utilities ──────────────────────────────────────────────────────────

function tagForSlot(idx) {
  return `[img${idx + 1}]`
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const MAX_PX = 1568
      const scale  = Math.min(MAX_PX / img.width, MAX_PX / img.height, 1.0)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        const compressed = new File(
          [blob],
          file.name.replace(/\.\w+$/, '.jpg'),
          { type: 'image/jpeg' }
        )
        resolve({
          file: compressed,
          url:  URL.createObjectURL(blob),
          w:    canvas.width,
          h:    canvas.height,
        })
      }, 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

// ── Setting chips ──────────────────────────────────────────────
const SettingChips = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
      {label}
    </p>
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => !opt.disabled && onChange(opt.value)}
          disabled={opt.disabled}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: value === opt.value ? ACCENT            : 'var(--bg-elevated)',
            color:      value === opt.value ? '#ffffff'         : 'var(--text-secondary)',
            opacity:    opt.disabled ? 0.3 : 1,
            cursor:     opt.disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)

// ── Model dropdown ─────────────────────────────────────────────
const ModelDropdown = ({ models, value, onChange }) => {
  const [open, setOpen] = useState(false)
  const unlocked = models.filter((m) => !m.is_locked)
  const locked   = models.filter((m) =>  m.is_locked)
  const selected = models.find((m) => m.value === value) || unlocked[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
      >
       <span>{selected?.label || 'Model'}</span>
        <ChevronDown
          size={10}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute right-0 top-9 z-50 w-56 rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border:     '1px solid var(--border-color)',
                boxShadow:  '0 8px 32px rgba(0,0,0,0.28)',
                maxHeight:  '60vh',
                overflowY:  'auto',
              }}
            >
              <div className="py-1">
                {unlocked.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { onChange(m.value); setOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                    style={{ background: m.value === value ? ACCENT_SUB : 'transparent' }}
                  >
                   <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {m.label}
                      </p>
                      {m.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.description}</p>}
                    </div>
                    {m.value === value && <span style={{ color: ACCENT, fontSize: 14 }}>✓</span>}
                  </button>
                ))}
              </div>
              {locked.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 12px' }} />
                  <div className="py-1">
                    {locked.map((m) => (
                      <div key={m.value} className="flex items-center justify-between px-4 py-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                          {m.label}
                        </p>
                        <span style={{ fontSize: 11, opacity: 0.4 }}>🔒</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Multi-image grid (Master only) ─────────────────────────────
// FIX: dynamic visibleSlots — show one empty slot at a time, not all at once
const MultiImageGrid = ({ images, maxImages, onAdd, onRemove, onTagInsert, onFullscreen }) => {
  const filledCount  = images.filter(Boolean).length
  const visibleSlots = filledCount < maxImages ? filledCount + 1 : filledCount
  const slots        = Array.from({ length: visibleSlots }, (_, i) => images[i] || null)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Add up to {maxImages} reference images. Tap{' '}
        {Array.from({ length: Math.min(maxImages, 4) }, (_, i) => (
          <span key={i}>
            <button
              onClick={() => onTagInsert(tagForSlot(i))}
              className="px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              {tagForSlot(i)}
            </button>
            {i < Math.min(maxImages, 4) - 1 ? ' ' : ''}
          </span>
        ))}{' '}
        to reference each in your scene description. Character photos are included automatically.
      </p>

      <div className="flex flex-wrap gap-3">
        {slots.map((img, idx) => {
          const isNextSlot = idx === filledCount
          return (
            <div key={idx} style={{ width: 'calc(25% - 9px)', minWidth: 64 }} className="flex flex-col gap-1.5">
              {img ? (
                <div className="relative group">
                  <div
                    className="relative overflow-hidden rounded-xl cursor-pointer"
                    style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
                    onClick={() => onFullscreen(idx)}
                  >
                    <img src={img.url} alt={`ref ${idx + 1}`} className="w-full h-full" style={{ objectFit: 'cover' }} />
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.45)' }}
                    >
                      <Maximize2 size={16} color="white" />
                    </div>
                  </div>
                  <button
                    onClick={() => onTagInsert(tagForSlot(idx))}
                    className="w-full py-1 rounded-lg text-xs font-mono font-semibold transition-all"
                    style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
                  >
                    {tagForSlot(idx)}
                  </button>
                  <button
                    onClick={() => onRemove(idx)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center z-10"
                    style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : isNextSlot ? (
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onAdd(e, idx)} />
                  <div
                    className="flex flex-col items-center justify-center rounded-xl transition-all"
                    style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
                  >
                    <Plus size={18} style={{ color: ACCENT, marginBottom: 4 }} />
                    <span className="text-xs font-medium" style={{ color: ACCENT }}>img{idx + 1}</span>
                  </div>
                  <div
                    className="w-full mt-1.5 py-1 rounded-lg text-xs font-mono font-semibold text-center"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', opacity: 0.4 }}
                  >
                    {tagForSlot(idx)}
                  </div>
                </label>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function UGCGeneratePage() {
  const { profileId }                                            = useParams()
  const navigate                                                 = useNavigate()
  const { user, profile: userProfile, credits, refreshProfile } = useAuth()
  const textareaRef                                              = useRef(null)

  const isMaster = userProfile?.user_tier === 'master'

  const [profile,        setProfile]        = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [models,         setModels]         = useState([])
  const [modelsLoading,  setModelsLoading]  = useState(true)
  const [model,          setModel]          = useState('')

  const [outputType,    setOutputType]    = useState('image')
  const [filter,        setFilter]        = useState('hyper_realistic')
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [duration,      setDuration]      = useState('5')
  const [scene,         setScene]         = useState('')
  const [withSound,     setWithSound]     = useState(true)
  const [submitting,    setSubmitting]    = useState(false)

  // Master-only ref images state
  const [refImages,     setRefImages]     = useState([])
  const [fullscreenIdx, setFullscreenIdx] = useState(null)

  const skipRefinement = !(userProfile?.ai_prompt_refinement ?? true)

  useEffect(() => {
    loadProfile()
    loadModels()
  }, [profileId, userProfile?.user_tier])

  const loadProfile = async () => {
    setProfileLoading(true)
    const { data, error } = await ugcProfiles.getById(profileId)
    if (error || !data) {
      toast.error('Character not found')
      navigate('/create/ugc')
      return
    }
    setProfile(data)
    setProfileLoading(false)
  }

const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .eq('supports_multi_image', true)
      .order('sort_order')
    const isMaster     = userProfile?.user_tier === 'master'
    const tierFiltered = (data || []).filter((m) => isMaster || m.tier_required !== 'master')
    setModels(tierFiltered)
    const firstUnlocked = tierFiltered.find((m) => !m.is_locked && m.type === 'image')
    setModel(firstUnlocked?.value || '')
    setModelsLoading(false)
  }, [userProfile?.user_tier])

  const filteredModels = models.filter((m) => m.type === outputType)
  const selectedModel  = filteredModels.find((m) => m.value === model) || filteredModels[0]

  useEffect(() => {
    const first = filteredModels.find((m) => !m.is_locked)
    if (first) setModel(first.value)
  }, [outputType])

  // Clear ref images when switching output type
  useEffect(() => {
    setRefImages([])
  }, [outputType])

  const caps = selectedModel ? {
    supportedDurations:    selectedModel.supported_durations     ?? ['5', '8', '10'],
    supportedAspectRatios: selectedModel.supported_aspect_ratios ?? ['9:16', '16:9', '1:1'],
    isFlatRate:            selectedModel.is_flat_rate            ?? false,
  } : {
    supportedDurations:    ['5'],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    isFlatRate:            false,
  }

  const creditCost = (() => {
    if (!selectedModel) return 0
    const base = outputType === 'image'
      ? selectedModel.credit_cost_t2i || 0
      : caps.isFlatRate
        ? selectedModel.credit_cost_t2i || 0
        : (selectedModel.credit_cost_t2i || 0) * parseInt(duration)
    return Math.ceil(base)
  })()

  const canAfford   = credits >= creditCost
  const sceneEmpty  = !scene.trim()
  const btnDisabled = sceneEmpty || !canAfford || submitting || !selectedModel || profileLoading

  // ── ref image handlers (Master only) ─────────────────────────────────────

  const handleAddRefImage = async (e, slotIdx) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setRefImages((prev) => {
      const next = [...prev]
      next[slotIdx] = compressed
      return next.filter((_, i) => i <= slotIdx || next[i] != null)
    })
  }

  const handleRemoveRefImage = (idx) => {
    setRefImages((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleTagInsert = (tag) => {
    const el = textareaRef.current
    if (!el) {
      setScene((p) => p ? `${p} ${tag}` : tag)
      return
    }
    const start      = el.selectionStart
    const end        = el.selectionEnd
    const before     = scene.slice(0, start)
    const after      = scene.slice(end)
    const needsSpace = before.length > 0 && !before.endsWith(' ')
    const inserted   = `${needsSpace ? ' ' : ''}${tag} `
    const next       = before + inserted + after
    setScene(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + inserted.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  // ── generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (sceneEmpty)     return toast.error('Describe the scene')
    if (!selectedModel) return toast.error('Pick a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      // Character reference photos (always included)
      const characterPhotos = [
        profile.photo_face_front,
        profile.photo_face_three_quarter,
        profile.photo_face_side_90,
        profile.photo_body_front,
        profile.photo_body_side,
        profile.photo_body_back,
      ].filter(Boolean)

      // Master: upload any extra ref images, then append after character photos
      let extraUrls = []
      if (isMaster && refImages.length > 0) {
        for (const img of refImages) {
          if (!img?.file) continue
          const contentType = img.file.type || 'image/jpeg'
          const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`
          const { data: uploadData, error: upErr } = await supabase.storage
            .from('generation-uploads')
            .upload(path, img.file, { upsert: false, cacheControl: '3600', contentType })
          if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
          const { data: { publicUrl } } = supabase.storage
            .from('generation-uploads')
            .getPublicUrl(uploadData.path)
          extraUrls.push(publicUrl)
        }
      }

      const allInputImages = [...extraUrls, ...characterPhotos]

const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        outputType === 'image' ? 'text_to_image' : 'text_to_video',
        status:                 'pending',
        prompt:                 scene,
        model:                  selectedModel.value,
        aspect_ratio:           aspectRatio,
        duration:               outputType === 'video' ? duration : undefined,
        credits_charged:        creditCost,
        output_type:            outputType,
        skip_prompt_refinement: skipRefinement,
        input_image_urls:       allInputImages.length ? allInputImages : null,
        generation_metadata:    outputType === 'video' ? { with_sound: withSound } : undefined,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      await ugcGenerations.create({
        generation_id:   genRow.id,
        ugc_profile_id:  profileId,
        user_id:         user.id,
        output_type:     outputType,
        filter_applied:  filter,
        scene_prompt:    scene,
        refined_prompt:  null,
        selected_photos: [],
        aspect_ratio:    aspectRatio,
      })

      const fn = outputType === 'image' ? 'image-generate' : 'video-generate'
      const { data: invokeData, error: invokeErr } = await supabase.functions
        .invoke(fn, { body: { generationId: genRow.id } })

      if (invokeErr || invokeData?.error) {
        const msg = invokeData?.error || invokeErr?.message || 'Generation blocked'
        toast.error(msg)
        await refreshProfile()
        return
      }

      refreshProfile()
      toast.success(
        <span>
          Generating! View in{' '}
          <button
            className="font-bold underline"
            onClick={() => navigate(`/create/ugc/${profileId}/media`)}
          >
            {profile?.name}'s Media
          </button>
        </span>,
        { duration: 5000 }
      )
      setScene('')
      setRefImages([])
      setWithSound(true)

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const fullscreenImage = fullscreenIdx !== null ? refImages[fullscreenIdx] : null

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
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Generating overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{
              backdropFilter:       'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              background:           'rgba(0,0,0,0.4)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>Generating…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen ref image viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)' }}
            onClick={() => setFullscreenIdx(null)}
          >
            <button
              onClick={() => setFullscreenIdx(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              <X size={18} />
            </button>
            <motion.img
              initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              src={fullscreenImage.url} alt="Reference"
              className="rounded-2xl"
              style={{ maxWidth: '100%', maxHeight: '90dvh', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => navigate('/create/ugc', { state: { tab: 'characters' } })}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>

        <button onClick={() => navigate('/create/ugc', { state: { tab: 'characters' } })} className="flex items-center gap-2.5">
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
              {profile?.name?.length > 15 ? `${profile.name.slice(0, 15)}…` : profile?.name}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {!modelsLoading && (
            <ModelDropdown
              models={filteredModels}
              value={selectedModel?.value || ''}
              onChange={setModel}
            />
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-1">

          {/* Output type toggle */}
          <div className="flex gap-1 p-1 rounded-2xl mb-5" style={{ background: 'var(--bg-elevated)' }}>
            {[
              { value: 'image', label: 'Image', Icon: ImageIcon },
              { value: 'video', label: 'Video', Icon: VideoIcon },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setOutputType(value)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: outputType === value ? 'var(--bg-card)'      : 'transparent',
                  color:      outputType === value ? 'var(--text-primary)'  : 'var(--text-muted)',
                  boxShadow:  outputType === value ? 'var(--shadow)'        : 'none',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Master-only: extra reference images */}
          {isMaster && selectedModel?.supports_multi_image && (
            <div className="mb-5">
              <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Reference Images
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — optional</span>
              </p>
              <MultiImageGrid
                images={refImages}
                maxImages={MAX_REF_IMAGES}
                onAdd={handleAddRefImage}
                onRemove={handleRemoveRefImage}
                onTagInsert={handleTagInsert}
                onFullscreen={(idx) => setFullscreenIdx(idx)}
              />
            </div>
          )}

          {/* Scene description */}
          <div className="mb-5">
            <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Scene Description
            </p>
            <textarea
              ref={textareaRef}
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder={`Describe what ${profile?.name} is doing, where they are, the vibe of the moment…`}
              rows={4}
              maxLength={100000}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border:     '1px solid var(--border-color)',
                color:      'var(--text-primary)',
                lineHeight: 1.6,
              }}
            />
                       {!isMaster && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                <Crown size={10} style={{ display: 'inline', marginRight: 3, color: ACCENT }} />
                <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Upgrade to Master</button>
                {' '}to attach reference images to your generations.
              </p>
            )}
          </div>

          {/* Style filter */}
          <SettingChips
            label="Style Filter"
            options={[
              { value: 'hyper_realistic', label: '📱 Hyper Realistic' },
              { value: 'cinematic',       label: '🎬 Cinematic'       },
            ]}
            value={filter}
            onChange={setFilter}
          />

          {/* Aspect ratio */}
          <SettingChips
            label="Aspect Ratio"
            options={ALL_ASPECT_RATIOS.map((o) => ({
              ...o,
              disabled: !caps.supportedAspectRatios.includes(o.value),
            }))}
            value={aspectRatio}
            onChange={setAspectRatio}
          />

     {/* Duration + Sound (video only) */}
          {outputType === 'video' && (
            <>
              <SettingChips
                label="Duration"
                options={caps.supportedDurations.map((d) => ({ label: `${d}s`, value: d }))}
                value={duration}
                onChange={setDuration}
              />
              <div className="mb-5">
                <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Sound
                </p>
                <div className="flex gap-2">
                  {[
                    { value: false, label: '🔇 No Sound'   },
                    { value: true,  label: '🔊 With Sound' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setWithSound(opt.value)}
                      className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: withSound === opt.value ? ACCENT : 'var(--bg-elevated)',
                        color:      withSound === opt.value ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Refinement off notice */}
          {skipRefinement && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl mt-1"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            >
              <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                AI prompt refinement is off. Your scene description will be sent to the model as-is.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Generate button */}
      <div
        className="flex-shrink-0 px-4 lg:px-8 py-4"
        style={{ borderTop: `1px solid ${ACCENT_BDR}` }}
      >
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">
          <button
            onClick={handleGenerate}
            disabled={btnDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: btnDisabled ? 'var(--bg-elevated)' : ACCENT,
              color:      btnDisabled ? 'var(--text-muted)'  : '#ffffff',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {!canAfford && !sceneEmpty
              ? 'Not enough credits'
              : `Generate${creditCost ? ` · ${creditCost} cr` : ''}`}
          </button>

          {!canAfford && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button
                onClick={() => navigate('/profile')}
                className="font-semibold"
                style={{ color: ACCENT }}
              >
                Top up
              </button>
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
