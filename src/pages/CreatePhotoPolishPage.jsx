// src/pages/CreatePhotoPolishPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus, Maximize2, Crown, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, generations as generationsDb, profiles as profilesApi } from '@/lib/supabase'
import { PHOTO_POLISH_PRESETS } from '@/config/photoPolishPresets'
import toast from 'react-hot-toast'

const ACCENT = 'var(--tool-polish)'
const ACCENT_SUB = 'var(--tool-polish-subtle)'
const ACCENT_BDR = 'var(--tool-polish-border)'

// ── Face presets — prepended to PHOTO_POLISH_PRESETS at render time ───────────
export const FACE_PRESETS = [
  {
    id: 'face_shot',
    label: 'Face Shot',
    emoji: '🎯',
    description: 'Tight cinematic close-up from any photo',
    isMaster: false,
    prompt: `Transform this image into an ultra-close hyperrealistic portrait crop.
Reframe tightly on the face from forehead to chin, head and shoulders only, eliminating any body below the chest.
Preserve every facial feature exactly as-is — skin tone, bone structure, eye colour, hair colour and texture, piercings, and all distinguishing marks must remain identical.
Do NOT alter, lighten, or smooth the skin; enhance its natural texture so every pore, micro-detail, and luminous quality is visible at magazine resolution.
Eyes must be razor-sharp with vivid clarity and natural catch-lights.
Render a shallow depth-of-field with the background dissolved into smooth warm bokeh (neutral beige/amber tones).
Apply cinematic golden-hour rim lighting that wraps the face with warm specular highlights without overexposing.
Output as a 2K photorealistic portrait with zero AI smoothing, zero makeup addition, zero skin tone alteration.`,
  },
  {
    id: 'face_90p',
    label: 'Face 90°',
    emoji: '↩️',
    description: 'Rotate any front face to a full side profile',
    isMaster: false,
    prompt: `Edit this photo: rotate this exact person's head to a 90-degree side profile.

This is a photo editing task. Do not create a new person. Do not use this image as a "reference" — edit the actual person in this image.

What to change: turn the head so the face points directly left or right — a true side profile where the nose, lips, jaw, and one ear are visible in silhouette.

What must NOT change:
- This exact person's identity
- Skin tone — do not lighten, darken, or shift undertones by any amount
- Facial bone structure, nose shape, lip shape, jaw shape
- Eye shape and colour
- Hair colour, texture, length, and cut
- Any distinguishing marks, scars, or features
- Background and lighting

Output must be photorealistic. The person in the output must be unmistakably and identically the same individual as in the input photo.`,
  },
  {
    id: 'face_3q',
    label: 'Face ¾',
    emoji: '🔄',
    description: 'Turn a front face into a cinematic ¾ profile',
    isMaster: false,
    prompt: `Edit this photo: rotate this exact person's head to a three-quarter (45-degree) angle.

This is a photo editing task. Do not create a new person. Do not use this image as a "reference" — edit the actual person in this image.

What to change: turn the head approximately 45 degrees from its current position so the near cheekbone, jaw line, and one ear become partially visible. Both eyes should still be visible.

What must NOT change:
- This exact person's identity
- Skin tone — do not lighten, darken, or shift undertones by any amount
- Facial bone structure, nose shape, lip shape, jaw shape
- Eye shape and colour
- Hair colour, texture, length, and cut
- Any distinguishing marks, scars, or features
- Background and lighting

Output must be photorealistic. The person in the output must be unmistakably and identically the same individual as in the input photo.`,
  },
]

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1', value: '1:1' },
]

const OUTPUT_RESOLUTION = 2048 // 2K
const DEFAULT_MODEL_VALUE = 'nano-banana-edit-pro' // nano banana edit pro

// ── helpers ──────────────────────────────────────────────────────────────────
function detectAspectRatio(width, height) {
  const ratio = width / height
  if (ratio > 1.6) return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const MAX_PX = 1568
      const scale = Math.min(MAX_PX / img.width, MAX_PX / img.height, 1.0)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        resolve({
          file: new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }),
          url: URL.createObjectURL(blob),
          ar: detectAspectRatio(canvas.width, canvas.height),
          w: canvas.width,
          h: canvas.height,
        })
      }, 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

// ── Model Dropdown ────────────────────────────────────────────────────────────
const ModelDropdown = ({ models, value, onChange }) => {
  const [open, setOpen] = useState(false)
  const unlocked = models.filter((m) => !m.is_locked)
  const locked = models.filter((m) => m.is_locked)
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
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute right-0 top-9 z-50 w-52 rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                maxHeight: '60vh',
                overflowY: 'auto',
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
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.aka || m.label}</p>
                      {m.description && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.description}</p>
                      )}
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
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{m.aka || m.label}</p>
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

// ── Preset Card ───────────────────────────────────────────────────────────────
const PresetCard = ({ preset, selected, onSelect, locked }) => (
  <motion.button
    whileTap={{ scale: locked ? 1 : 0.97 }}
    onClick={() => !locked && onSelect(preset.id)}
    className="relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-all text-center"
    style={{
      background: selected ? ACCENT_SUB : 'var(--bg-elevated)',
      border: `1.5px solid ${selected ? ACCENT : 'var(--border-color)'}`,
      opacity: locked ? 0.6 : 1,
      cursor: locked ? 'not-allowed' : 'pointer',
    }}
  >
    {locked && (
      <div
        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: 'var(--bg-card)' }}
      >
        <Lock size={10} style={{ color: 'var(--brand)' }} />
      </div>
    )}
    {selected && (
      <div
        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: ACCENT }}
      >
        <span style={{ color: 'white', fontSize: 10, fontWeight: 800 }}>✓</span>
      </div>
    )}
    <span style={{ fontSize: 22 }}>{preset.emoji}</span>
    <div>
      <p className="text-xs font-bold" style={{ color: selected ? ACCENT : 'var(--text-primary)' }}>
        {preset.label}
      </p>
      <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
        {preset.description}
      </p>
    </div>
  </motion.button>
)

// ── Before/After Preview ──────────────────────────────────────────────────────
const BeforeAfterPreview = ({ original, result, onClose }) => {
  const [sliderX, setSliderX] = useState(50)
  const [dragging, setDragging] = useState(false)

  const handleMove = (clientX, rect) => {
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setSliderX(pct)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(12px)' }}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
      >
        <X size={18} />
      </button>
      <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
        Drag to compare
      </p>
      <div
        className="relative overflow-hidden rounded-2xl select-none"
        style={{ width: '100%', maxWidth: 400, aspectRatio: '3/4', cursor: 'ew-resize' }}
        onMouseMove={(e) => dragging && handleMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
      >
        <img src={result} alt="After" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderX}%` }}>
          <img
            src={original}
            alt="Before"
            className="absolute inset-0 h-full object-cover"
            style={{ width: `${100 / (sliderX / 100)}%`, maxWidth: 'none' }}
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-0.5"
          style={{ left: `${sliderX}%`, background: 'white', transform: 'translateX(-50%)' }}
        >
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
          >
            <span style={{ fontSize: 12, color: '#000', fontWeight: 800 }}>⇔</span>
          </div>
        </div>
        <div className="absolute top-3 left-3 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}>
          Before
        </div>
        <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
          After
        </div>
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CreatePhotoPolishPage() {
  const navigate = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()
  const isMaster = profile?.user_tier === 'master'

  // Merge face presets at the front, then the rest from config
  const ALL_PRESETS = [
    ...FACE_PRESETS,
    ...PHOTO_POLISH_PRESETS.filter((p) => !FACE_PRESETS.some((fp) => fp.id === p.id)),
  ]

  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelValue, setModelValue] = useState('')
  const [photo, setPhoto] = useState(null)
  const [selectedPreset, setSelectedPreset] = useState('face_shot')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [autoRatio, setAutoRatio] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [resultUrl, setResultUrl] = useState(null)
  const [showCompare, setShowCompare] = useState(false)

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try {
        sessionStorage.removeItem('meckury_polish_image')
      } catch {}
    }
  }, [])

  // ── load i2i-capable models ───────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'image')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .eq('supports_image', true)
      .order('sort_order')
    const list = (data || []).filter((m) => isMaster || m.tier_required !== 'master')
    setModels(list)
    const unlocked = list.filter((m) => !m.is_locked)
    const nanoBanana = unlocked.find((m) =>
      m.value === DEFAULT_MODEL_VALUE ||
      m.aka?.toLowerCase().includes('nano banana') ||
      m.label?.toLowerCase().includes('nano banana')
    )
    const preferred = profile?.preferred_model
    const prefMatch = preferred && unlocked.find((m) => m.value === preferred)
    setModelValue((nanoBanana || prefMatch || unlocked[0])?.value || '')
    setModelsLoading(false)
  }, [isMaster, profile?.preferred_model])

  useEffect(() => { loadModels() }, [loadModels])

  // ── Restore photo seeded from Assets page ─────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('meckury_polish_image')
      if (!saved) return
      sessionStorage.removeItem('meckury_polish_image')
      const item = JSON.parse(saved)
      if (item.url && !item.base64) {
        const img = new Image()
        img.onload = () => {
          const ar = detectAspectRatio(img.width, img.height)
          setPhoto({ file: null, url: item.url, ar, w: img.width, h: img.height })
          setAspectRatio(ar)
          setAutoRatio(true)
        }
        img.onerror = () => {
          setPhoto({ file: null, url: item.url, ar: '9:16', w: null, h: null })
        }
        img.src = item.url
      } else if (item.base64) {
        const byteString = atob(item.base64.split(',')[1])
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
        const blob = new Blob([ab], { type: item.type })
        const url = URL.createObjectURL(blob)
        const file = new File([blob], item.name, { type: item.type })
        const imgEl = new Image()
        imgEl.onload = () => {
          const ar = detectAspectRatio(imgEl.width, imgEl.height)
          setPhoto({ file, url, ar, w: imgEl.width, h: imgEl.height })
          setAspectRatio(ar)
          setAutoRatio(true)
        }
        imgEl.src = url
      }
    } catch { /* corrupt storage — ignore */ }
  }, [])

  // ── derived from selected model ───────────────────────────────────────────
  const selectedModel = models.find((m) => m.value === modelValue)
  const creditCost = selectedModel?.credit_cost_i2i ?? 0
  const preset = ALL_PRESETS.find((p) => p.id === selectedPreset)
  const canAfford = credits >= creditCost
  const canGenerate = !!photo && !!preset && canAfford && !submitting && !!selectedModel
    && creditCost > 0
    && !(preset.isMaster && !isMaster)

  // ── model change — persist preference ────────────────────────────────────
  const handleModelChange = async (value) => {
    setModelValue(value)
    if (user && value && value !== profile?.preferred_model) {
      try { await profilesApi.update(user.id, { preferred_model: value }) } catch { /* noop */ }
    }
  }

  // ── upload handler (local file) ───────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setPhoto(compressed)
    setAspectRatio(compressed.ar)
    setAutoRatio(true)
    setResultUrl(null)
  }

  const handleRemove = () => {
    setPhoto(null)
    setAutoRatio(false)
    setAspectRatio('9:16')
    setResultUrl(null)
  }

  // ── generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!photo) return toast.error('Upload a photo first')
    if (!preset) return toast.error('Select a preset')
    if (!selectedModel) return toast.error('Select a model')
    if (!canAfford) return toast.error('Not enough credits')
    if (!user) return toast.error('Please sign in')
    if (preset.isMaster && !isMaster) {
      toast.error('This preset requires Master plan')
      return
    }

    setSubmitting(true)
    setResultUrl(null)

    try {
      // Get the public URL — either direct from Assets or upload the local file
      let publicUrl
      if (!photo.file) {
        publicUrl = photo.url
      } else {
        const contentType = photo.file.type || 'image/jpeg'
        const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { data: uploadData, error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, photo.file, { upsert: false, cacheControl: '3600', contentType })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        ;({ data: { publicUrl } } = supabase.storage
          .from('generation-uploads')
          .getPublicUrl(uploadData.path))
      }

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id: user.id,
        generation_type: 'image_to_image',
        status: 'pending',
        prompt: preset.prompt,
        model: modelValue,
        aspect_ratio: aspectRatio,
        credits_charged: creditCost,
        output_type: 'image',
        input_image_urls: [publicUrl],
        skip_prompt_refinement: false,
        refinement_mode: 'photo_polish',
        title: `Photo Polish — ${preset.label}`,
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
      toast.success('Polishing your photo… Check your Media page.', { duration: 4000 })

      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        if (attempts > 30) { clearInterval(poll); return }
        const { data: gen } = await supabase
          .from('generations')
          .select('status, output_url')
          .eq('id', genRow.id)
          .single()
        if (gen?.status === 'completed' && gen?.output_url) {
          clearInterval(poll)
          setResultUrl(gen.output_url)
          setShowCompare(true)
          toast.success('Done! Drag to compare before & after 🎉', { duration: 5000 })
        } else if (gen?.status === 'failed') {
          clearInterval(poll)
          toast.error('Polish failed — please try again')
        }
      }, 3000)

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Generating overlay */}
      <AnimatePresence>
        {submitting && (
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
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Polishing…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Before/After compare */}
      <AnimatePresence>
        {showCompare && resultUrl && photo && (
          <BeforeAfterPreview
            original={photo.url}
            result={resultUrl}
            onClose={() => setShowCompare(false)}
          />
        )}
      </AnimatePresence>

      {/* Fullscreen original */}
      <AnimatePresence>
        {fullscreen && photo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)' }}
            onClick={() => setFullscreen(false)}
          >
            <button
              onClick={() => setFullscreen(false)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              <X size={18} />
            </button>
            <motion.img
              initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              src={photo.url} alt="Original" className="rounded-2xl"
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
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Photo Polish</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>AI Photo Enhancement</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && (
            <ModelDropdown models={models} value={modelValue} onChange={handleModelChange} />
          )}
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">
          {/* Photo upload */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Your Photo
            </p>
            {photo ? (
              <div className="relative flex justify-center">
                <div style={{ width: '100%', maxWidth: photo.w && photo.h ? (photo.w > photo.h ? '100%' : '220px') : '220px' }}>
                  <div
                    className="relative overflow-hidden rounded-2xl cursor-pointer"
                    style={{
                      aspectRatio: photo.w && photo.h ? `${photo.w} / ${photo.h}` : '1 / 1',
                      maxHeight: '320px',
                      background: 'var(--bg-elevated)',
                    }}
                    onClick={() => setFullscreen(true)}
                  >
                    <img src={photo.url} alt="Upload" className="w-full h-full" style={{ objectFit: 'contain' }} />
                    <div
                      className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                    >
                      <Maximize2 size={11} />
                    </div>
                    {resultUrl && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        onClick={(e) => { e.stopPropagation(); setShowCompare(true) }}
                        className="absolute bottom-2 left-2 px-2 py-1 rounded-lg text-xs font-bold"
                        style={{ background: ACCENT, color: 'white' }}
                      >
                        Compare ⇔
                      </motion.button>
                    )}
                  </div>
                  <button
                    onClick={handleRemove}
                    className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center z-10"
                    style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all"
                style={{ height: '180px', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
              >
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <ImagePlus size={28} style={{ color: ACCENT, marginBottom: 10 }} />
                <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload a photo</span>
                <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Any photo — portrait, product, landscape
                </span>
              </label>
            )}
          </div>

          {/* Preset selector */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Style Filter
              </p>
              {!isMaster && (
                <div className="flex items-center gap-1 text-xs font-medium" style={{ color: 'var(--brand)' }}>
                  <Crown size={11} />
                  <span>Some presets need Master</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {ALL_PRESETS.map((p) => {
                const locked = p.isMaster && !isMaster
                return (
                  <PresetCard
                    key={p.id}
                    preset={p}
                    selected={selectedPreset === p.id}
                    onSelect={setSelectedPreset}
                    locked={locked}
                  />
                )
              })}
            </div>
          </div>

          {/* Aspect ratio */}
          <div>
            <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Aspect Ratio
            </p>
            <div className="flex gap-2 flex-wrap">
              {ALL_ASPECT_RATIOS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setAspectRatio(opt.value); setAutoRatio(false) }}
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                  style={{
                    background: aspectRatio === opt.value ? ACCENT : 'var(--bg-elevated)',
                    color: aspectRatio === opt.value ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {autoRatio && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Auto-set from your photo</p>
            )}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: canGenerate ? ACCENT : 'var(--bg-elevated)',
              color: canGenerate ? '#ffffff' : 'var(--text-muted)',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {!photo
              ? 'Upload a photo to polish'
              : !canAfford
              ? 'Not enough credits'
              : `Polish · ${creditCost} cr`
            }
          </button>
          {preset?.isMaster && !isMaster && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              This preset requires Master plan.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                Upgrade
              </button>
            </p>
          )}
          {!canAfford && photo && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                Top up
              </button>
            </p>
          )}
          {resultUrl && (
            <button
              onClick={() => setShowCompare(true)}
              className="w-full mt-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              View Before & After ⇔
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
