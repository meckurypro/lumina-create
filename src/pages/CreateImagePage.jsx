import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus, Maximize2, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb, profiles as profilesApi } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-image)'
const ACCENT_SUB = 'var(--tool-image-subtle)'
const ACCENT_BDR = 'var(--tool-image-border)'

const SS_PROMPT = 'meckury_create_prompt'
const SS_IMAGES = 'meckury_create_images'   // replaces SS_IMAGE (now an array)

const MAX_MULTI_IMAGES  = 4
const MAX_SINGLE_IMAGES = 1

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

// ─── helpers ────────────────────────────────────────────────────────────────

function detectAspectRatio(width, height) {
  const ratio = width / height
  if (ratio > 1.6)  return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
}

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
          ar:   detectAspectRatio(canvas.width, canvas.height),
          w:    canvas.width,
          h:    canvas.height,
        })
      }, 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

// ─── sub-components ─────────────────────────────────────────────────────────

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
            background: value === opt.value ? ACCENT       : 'var(--bg-elevated)',
            color:      value === opt.value ? '#ffffff'    : 'var(--text-secondary)',
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
        <span>{selected?.aka || selected?.label || 'Model'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d={open ? 'M2 7l3-4 3 4' : 'M2 3l3 4 3-4'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
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
              className="absolute right-0 top-9 z-50 w-52 rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', maxHeight: '60vh', overflowY: 'auto' }}
            >
              <div className="py-1">
                {unlocked.map((m) => (
                  <button key={m.value} onClick={() => { onChange(m.value); setOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                    style={{ background: m.value === value ? ACCENT_SUB : 'transparent' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.aka}</p>
                      {m.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.description}</p>}
                      {!m.supports_image && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Text only</p>}
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
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{m.aka}</p>
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

// ─── single image slot (original behaviour, unchanged) ───────────────────────

const SingleImageSlot = ({ image, onUpload, onRemove, onFullscreen, modelSupportsImage }) => {
  if (image) {
    const ar = image.w && image.h
      ? `${image.w} / ${image.h}`
      : '1 / 1'
    const maxW = image.w && image.h
      ? image.w > image.h ? '100%' : '200px'
      : '140px'
    return (
      <div className="flex justify-center">
        <div className="relative" style={{ width: '100%', maxWidth: maxW }}>
          <div
            className="relative overflow-hidden rounded-2xl cursor-pointer w-full"
            style={{ aspectRatio: ar, maxHeight: '300px', background: 'var(--bg-elevated)' }}
            onClick={onFullscreen}
          >
            <img src={image.url} alt="Reference" className="w-full h-full" style={{ objectFit: 'contain' }} />
            <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
              <Maximize2 size={11} />
            </div>
            {image.ar && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                {image.ar}
              </div>
            )}
          </div>
          <button onClick={onRemove}
            className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center z-10"
            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <label
        className="flex flex-col items-center justify-center rounded-2xl transition-all"
        style={{
          width: '140px', aspectRatio: '1 / 1',
          border: `1.5px dashed ${ACCENT_BDR}`,
          background: ACCENT_SUB,
          cursor: modelSupportsImage ? 'pointer' : 'not-allowed',
          opacity: modelSupportsImage ? 1 : 0.4,
        }}
      >
        <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={!modelSupportsImage} />
        <ImagePlus size={22} style={{ color: ACCENT, marginBottom: 6 }} />
        <span className="text-xs font-medium" style={{ color: ACCENT }}>
          {modelSupportsImage ? 'Add reference' : 'Not supported'}
        </span>
      </label>
    </div>
  )
}

// ─── multi-image grid ────────────────────────────────────────────────────────

const MultiImageGrid = ({ images, maxImages, onAdd, onRemove, onTagInsert, onFullscreen }) => {
  // images = array of { file, url, ar, w, h } | null for empty slots
  const filledCount = images.filter(Boolean).length
const visibleSlots = filledCount < maxImages ? filledCount + 1 : filledCount
const slots = Array.from({ length: visibleSlots }, (_, i) => images[i] || null)

  return (
    <div className="flex flex-col gap-3">
      {/* Tag hint */}
      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Reference up to {maxImages} images. Insert{' '}
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
        tags into your prompt to describe how each image is used.
      </p>

      {/* Grid */}
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
              style={{
                aspectRatio: '1/1',
                border: `1.5px dashed ${ACCENT_BDR}`,
                background: ACCENT_SUB,
              }}
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

// ─── main page ───────────────────────────────────────────────────────────────

export default function CreateImagePage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()
  const textareaRef = useRef(null)

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [prompt,        setPrompt]        = useState('')
  const [images,        setImages]        = useState([])   // array of { file, url, ar, w, h }
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [autoRatio,     setAutoRatio]     = useState(false)
  const [model,         setModel]         = useState('')
const [resolution,    setResolution]    = useState('1k')
const [fullscreenIdx, setFullscreenIdx] = useState(null)
const [submitting,    setSubmitting]    = useState(false)

  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)

  // ── restore session storage ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedPrompt = sessionStorage.getItem(SS_PROMPT)
      if (savedPrompt) setPrompt(savedPrompt)

      const savedImages = sessionStorage.getItem(SS_IMAGES)
      if (savedImages) {
        const arr = JSON.parse(savedImages)
        Promise.all(arr.map(async ({ base64, name, type }) => {
          const byteString = atob(base64.split(',')[1])
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
          const blob = new Blob([ab], { type })
          const url  = URL.createObjectURL(blob)
          const file = new File([blob], name, { type })
          const ar   = await new Promise((res) => {
            const img = new Image()
            img.onload = () => res(detectAspectRatio(img.width, img.height))
            img.src = url
          })
          return { file, url, ar }
        })).then((restored) => {
          setImages(restored)
          if (restored.length === 1) { setAspectRatio(restored[0].ar); setAutoRatio(true) }
        })
      }
    } catch { /* corrupt storage — ignore */ }
  }, [])

  // ── persist prompt ───────────────────────────────────────────────────────
  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(SS_PROMPT, prompt)
      else        sessionStorage.removeItem(SS_PROMPT)
    } catch { /* noop */ }
  }, [prompt])

  // ── load models ──────────────────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'image')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const isMaster = profile?.user_tier === 'master'
    const list     = (data || []).filter((m) => isMaster || m.tier_required !== 'master')
    setModels(list)
    const unlocked = list.filter((m) => !m.is_locked)
    const preferred = profile?.preferred_model
    const match     = preferred && unlocked.find((m) => m.value === preferred)
    setModel((match || unlocked[0])?.value || '')
    setModelsLoading(false)
  }, []) // eslint-disable-line

  useEffect(() => { loadModels() }, [loadModels])

  // ── derived model caps ───────────────────────────────────────────────────
  const selectedModel       = models.find((m) => m.value === model)
const modelSupportsImage  = selectedModel?.supports_image !== false
const modelRequiresImage  = selectedModel?.requires_image === true
const modelSupportsMulti  = selectedModel?.supports_multi_image === true
const modelMaxRefImages   = selectedModel?.max_ref_images ?? 1
const [multiMode, setMultiMode] = useState(false)

// Reset multiMode when model changes
useEffect(() => { setMultiMode(false); setResolution('1k') }, [model])

const maxImages = (modelSupportsMulti && multiMode)
  ? modelMaxRefImages
  : MAX_SINGLE_IMAGES
  const supportedRatios     = selectedModel?.supported_aspect_ratios ?? ['9:16', '16:9', '1:1']

  // generation type: multi always sends as image_to_image when images present
  const hasImages  = images.length > 0
  const type       = hasImages && modelSupportsImage ? 'image_to_image' : 'text_to_image'
  const resolutionCosts = selectedModel?.credit_cost_resolution ?? null
const creditCost = selectedModel
  ? resolutionCosts
    ? (resolutionCosts[resolution] ?? resolutionCosts['1k'] ?? 0)
    : (hasImages && modelSupportsImage
        ? selectedModel.credit_cost_i2i
        : selectedModel.credit_cost_t2i) || 0
  : 0
  const canAfford      = credits >= creditCost
  const promptEmpty    = !prompt.trim()
  const imageRequired  = modelRequiresImage && !hasImages
const buttonDisabled = promptEmpty || !canAfford || submitting || !selectedModel || imageRequired

  // ── enforce aspect ratio when model changes ──────────────────────────────
  useEffect(() => {
    if (!selectedModel) return
    if (!autoRatio && !supportedRatios.includes(aspectRatio)) {
      setAspectRatio(supportedRatios[0] || '9:16')
    }
  }, [model]) // eslint-disable-line

  // ── drop extra images when switching to single-image model ───────────────
  useEffect(() => {
    if (!modelSupportsImage) {
      clearAllImages()
    } else if (!modelSupportsMulti && images.length > 1) {
      // keep only first image
      setImages((prev) => [prev[0]])
      persistImages([images[0]])
    }
  }, [model]) // eslint-disable-line

  // ── model preference save ─────────────────────────────────────────────────
  const handleModelChange = async (value) => {
    setModel(value)
    if (user && value && value !== profile?.preferred_model) {
      try { await profilesApi.update(user.id, { preferred_model: value }) } catch { /* noop */ }
    }
  }

  // ── image persistence helpers ─────────────────────────────────────────────
  const persistImages = (imgs) => {
    try {
      if (!imgs.length) { sessionStorage.removeItem(SS_IMAGES); return }
      const promises = imgs.map(({ file }) => new Promise((res) => {
        const reader = new FileReader()
        reader.onload = (ev) => res({ base64: ev.target.result, name: file.name, type: file.type })
        reader.readAsDataURL(file)
      }))
      Promise.all(promises).then((arr) => sessionStorage.setItem(SS_IMAGES, JSON.stringify(arr)))
    } catch { /* noop */ }
  }

  const clearAllImages = () => {
    setImages([])
    setAutoRatio(false)
    setAspectRatio('9:16')
    try { sessionStorage.removeItem(SS_IMAGES) } catch { /* noop */ }
  }

  // ── add image (single or multi slot) ─────────────────────────────────────
  const handleAddImage = async (e, slotIdx) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)

    setImages((prev) => {
      const next = [...prev]
      next[slotIdx] = compressed
      // trim trailing nulls
      const trimmed = next.filter((_, i) => i <= slotIdx || next[i] != null)
      persistImages(trimmed)
      // auto aspect-ratio from first image only
      if (slotIdx === 0) { setAspectRatio(compressed.ar); setAutoRatio(true) }
      return trimmed
    })
  }

  // ── single image handler (backwards-compat) ───────────────────────────────
  const handleSingleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setImages([compressed])
    persistImages([compressed])
    setAspectRatio(compressed.ar)
    setAutoRatio(true)
  }

  const handleRemoveImage = (idx) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      persistImages(next)
      if (idx === 0 && next.length === 0) { setAutoRatio(false); setAspectRatio('9:16') }
      return next
    })
  }

  // ── tag insertion into textarea ───────────────────────────────────────────
  const handleTagInsert = (tag) => {
    const el = textareaRef.current
    if (!el) {
      setPrompt((p) => p ? `${p} ${tag}` : tag)
      return
    }
    const start = el.selectionStart
    const end   = el.selectionEnd
    const before = prompt.slice(0, start)
    const after  = prompt.slice(end)
    const needsSpace = before.length > 0 && !before.endsWith(' ')
    const inserted = `${needsSpace ? ' ' : ''}${tag} `
    const next = before + inserted + after
    setPrompt(next)
    // restore cursor after React re-render
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + inserted.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  // ── generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (promptEmpty)    return toast.error('Enter a prompt')
    if (!selectedModel) return toast.error('Pick a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      // Upload all reference images to storage
      const uploadedUrls = []
      for (const img of images) {
        if (!img?.file) continue
        const contentType = img.file.type || 'image/jpeg'
        const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { data: uploadData, error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, img.file, { upsert: false, cacheControl: '3600', contentType })
        if (upErr) throw new Error(`Reference upload failed: ${upErr.message}`)
        const { data: { publicUrl } } = supabase.storage
          .from('generation-uploads')
          .getPublicUrl(uploadData.path)
        uploadedUrls.push(publicUrl)
      }

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        type,
        status:                 'pending',
        prompt,
        model,
        aspect_ratio:           aspectRatio,
        resolution:             resolutionCosts ? resolution : null,
        credits_charged:        creditCost,
        output_type:            'image',
        start_frame_url:        null,
        input_image_urls:       uploadedUrls.length ? uploadedUrls : null,
        skip_prompt_refinement: skipRefinement,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      supabase.functions.invoke('image-generate', { body: { generationId: genRow.id } })
        .catch((e) => console.error('image-generate invoke error', e))

      refreshProfile()
      toast.success('Your image is being generated. Check your Media page.', { duration: 4000 })
      setPrompt('')
      clearAllImages()
      try { sessionStorage.removeItem(SS_PROMPT); sessionStorage.removeItem(SS_IMAGES) } catch { /* noop */ }

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      console.error('Generate error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  // ── fullscreen viewer image ───────────────────────────────────────────────
  const fullscreenImage = fullscreenIdx !== null ? images[fullscreenIdx] : null

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Generating overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Generating…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: `1px solid var(--border-color)`, borderLeft: `3px solid ${ACCENT}` }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Image</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Image Generation</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && <ModelDropdown models={models} value={model} onChange={handleModelChange} />}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)' }}
            onClick={() => setFullscreenIdx(null)}
          >
            <button onClick={() => setFullscreenIdx(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              <X size={18} />
            </button>
            <motion.img
              initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              src={fullscreenImage.url} alt="Reference full" className="rounded-2xl"
              style={{ maxWidth: '100%', maxHeight: '90dvh', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-5">

{/* Reference image section */}
<div>
  {/* Header row */}
  <div className="flex items-center justify-between mb-3">
    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
      Reference Image
      <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — optional</span>
    </p>

    {/* Multi-ref toggle — only shown for multi-image capable models */}
    {modelSupportsMulti && modelSupportsImage && (
      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
        {[
          { value: false, label: 'Simple' },
          { value: true,  label: 'Multi-ref' },
        ].map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => {
              setMultiMode(opt.value)
              // switching back to simple: keep only first image
              if (!opt.value && images.length > 1) {
                setImages([images[0]])
                persistImages([images[0]])
              }
            }}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: multiMode === opt.value ? ACCENT       : 'transparent',
              color:      multiMode === opt.value ? '#ffffff'    : 'var(--text-muted)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    )}
  </div>

  {/* Image UI */}
  {(modelSupportsMulti && multiMode) ? (
    <MultiImageGrid
      images={images}
      maxImages={maxImages}
      onAdd={handleAddImage}
      onRemove={handleRemoveImage}
      onTagInsert={handleTagInsert}
      onFullscreen={(idx) => setFullscreenIdx(idx)}
    />
  ) : (
    <SingleImageSlot
      image={images[0] || null}
      onUpload={handleSingleImageUpload}
      onRemove={() => handleRemoveImage(0)}
      onFullscreen={() => setFullscreenIdx(0)}
      modelSupportsImage={modelSupportsImage}
    />
  )}

{!modelSupportsImage && !modelRequiresImage && (
    <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
      This model is text-only. Switch models to use a reference image.
    </p>
  )}
  {modelSupportsImage && modelRequiresImage && !hasImages && (
    <p className="text-xs text-center mt-2" style={{ color: 'var(--tool-image)' }}>
      This model requires a reference image to generate.
    </p>
  )}

          {/* Prompt */}
          <Textarea
            ref={textareaRef}
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
  modelSupportsMulti && multiMode && images.length > 0
    ? `e.g. Person in ${tagForSlot(0)} hugs person in ${tagForSlot(1)}`
    : 'What are we creating today?'
}
            rows={4}
          />

          {/* Aspect ratio */}
          <div className="pt-1">
            <SettingChips
              label="Aspect Ratio"
              options={ALL_ASPECT_RATIOS.map((o) => ({
                ...o,
                disabled: !supportedRatios.includes(o.value),
              }))}
              value={aspectRatio}
              onChange={(v) => { setAspectRatio(v); setAutoRatio(false) }}
            />
          </div>

          {/* Resolution — only shown for models with per-resolution pricing */}
          {resolutionCosts && (
            <div className="pt-1">
              <SettingChips
                label="Quality"
                options={Object.entries(resolutionCosts).map(([key, cost]) => ({
                  label: `${key.toUpperCase()} · ${cost} cr`,
                  value: key,
                }))}
                value={resolution}
                onChange={setResolution}
              />
            </div>
          )}

        </div>
      </div>

      {/* Generate button */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={handleGenerate}
            disabled={buttonDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: buttonDisabled ? 'var(--bg-elevated)' : ACCENT,
              color:      buttonDisabled ? 'var(--text-muted)'  : '#ffffff',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {!canAfford && !promptEmpty
              ? 'Not enough credits'
              : `Generate${creditCost ? ` · ${creditCost} cr` : ''}`}
          </button>
          {!canAfford && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>Top up</button>
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
