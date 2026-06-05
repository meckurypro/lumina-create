// src/pages/CreatePhotoPolishPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus, Maximize2, Crown, Lock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import { PHOTO_POLISH_PRESETS } from '@/config/photoPolishPresets'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-polish)'
const ACCENT_SUB = 'var(--tool-polish-subtle)'
const ACCENT_BDR = 'var(--tool-polish-border)'

// Fixed model for Photo Polish — best image-to-image enhancement model
const POLISH_MODEL = 'nano_banana_pro_edit'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

// ── helpers ──────────────────────────────────────────────────────────────────

function detectAspectRatio(width, height) {
  const ratio = width / height
  if (ratio > 1.6)  return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
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
        resolve({
          file: new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }),
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

// ── Preset Card ───────────────────────────────────────────────────────────────

const PresetCard = ({ preset, selected, onSelect, locked }) => (
  <motion.button
    whileTap={{ scale: locked ? 1 : 0.97 }}
    onClick={() => !locked && onSelect(preset.id)}
    className="relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-all text-center"
    style={{
      background: selected
        ? ACCENT_SUB
        : 'var(--bg-elevated)',
      border: `1.5px solid ${selected ? ACCENT : 'var(--border-color)'}`,
      opacity: locked ? 0.6 : 1,
      cursor: locked ? 'not-allowed' : 'pointer',
    }}
  >
    {/* Lock badge */}
    {locked && (
      <div
        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ background: 'var(--bg-card)' }}
      >
        <Lock size={10} style={{ color: 'var(--brand)' }} />
      </div>
    )}

    {/* Selected indicator */}
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

      {/* Slider container */}
      <div
        className="relative overflow-hidden rounded-2xl select-none"
        style={{ width: '100%', maxWidth: 400, aspectRatio: '3/4', cursor: 'ew-resize' }}
        onMouseMove={(e) => dragging && handleMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onMouseDown={() => setDragging(true)}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
      >
        {/* After (bottom layer) */}
        <img src={result} alt="After" className="absolute inset-0 w-full h-full object-cover" />

        {/* Before (clipped top layer) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderX}%` }}>
          <img src={original} alt="Before" className="absolute inset-0 h-full object-cover" style={{ width: `${100 / (sliderX / 100)}%`, maxWidth: 'none' }} />
        </div>

        {/* Divider line */}
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

        {/* Labels */}
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
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()
  const isMaster = profile?.user_tier === 'master'

  const [photo,          setPhoto]          = useState(null)   // { file, url, ar, w, h }
  const [selectedPreset, setSelectedPreset] = useState('hyperrealistic')
  const [aspectRatio,    setAspectRatio]    = useState('9:16')
  const [autoRatio,      setAutoRatio]      = useState(false)
  const [submitting,     setSubmitting]     = useState(false)
  const [fullscreen,     setFullscreen]     = useState(false)
  const [resultUrl,      setResultUrl]      = useState(null)
  const [showCompare,    setShowCompare]    = useState(false)
  const [model,          setModel]          = useState(null)
  const [creditCost,     setCreditCost]     = useState(0)

  // Load the polish model to get credit cost
  useEffect(() => {
    supabase
      .from('models')
      .select('*')
      .eq('value', POLISH_MODEL)
      .single()
      .then(({ data }) => {
        if (data) {
          setModel(data)
          setCreditCost(data.credit_cost_i2i || 16)
        }
      })
  }, [])

  const preset      = PHOTO_POLISH_PRESETS.find((p) => p.id === selectedPreset)
  const canAfford   = credits >= creditCost
  const canGenerate = !!photo && !!preset && canAfford && !submitting

  // ── upload handler ────────────────────────────────────────────────────────
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
    if (!photo)   return toast.error('Upload a photo first')
    if (!preset)  return toast.error('Select a preset')
    if (!canAfford) return toast.error('Not enough credits')
    if (!user)    return toast.error('Please sign in')

    // Master gate
    if (preset.isMaster && !isMaster) {
      toast.error('This preset requires Master plan')
      return
    }

    setSubmitting(true)
    setResultUrl(null)

    try {
      // Upload photo
      const contentType = photo.file.type || 'image/jpeg'
      const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { data: uploadData, error: upErr } = await supabase.storage
        .from('generation-uploads')
        .upload(path, photo.file, { upsert: false, cacheControl: '3600', contentType })
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
      const { data: { publicUrl } } = supabase.storage
        .from('generation-uploads')
        .getPublicUrl(uploadData.path)

      // Create generation
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        'image_to_image',
        status:                 'pending',
        prompt:                 preset.prompt,
        model:                  POLISH_MODEL,
        aspect_ratio:           aspectRatio,
        credits_charged:        creditCost,
        output_type:            'image',
        input_image_urls:       [publicUrl],
        skip_prompt_refinement: true,   // preset prompts are already optimised
        title:                  `Photo Polish — ${preset.label}`,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // Fire edge function
      supabase.functions.invoke('image-generate', { body: { generationId: genRow.id } })
        .catch((e) => console.error('image-generate invoke error', e))

      refreshProfile()
      toast.success('Polishing your photo… Check your Media page.', { duration: 4000 })

      // Poll for result to show before/after
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
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>
              Polishing…
            </p>
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
              src={photo.url} alt="Original"
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
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Photo Polish</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>AI Photo Enhancement</span>
        </div>
        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
          {Math.floor(credits)}
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
                <div style={{ width: '100%', maxWidth: photo.w > photo.h ? '100%' : '220px' }}>
                  <div
                    className="relative overflow-hidden rounded-2xl cursor-pointer"
                    style={{ aspectRatio: `${photo.w} / ${photo.h}`, maxHeight: '320px', background: 'var(--bg-elevated)' }}
                    onClick={() => setFullscreen(true)}
                  >
                    <img src={photo.url} alt="Upload" className="w-full h-full" style={{ objectFit: 'contain' }} />
                    <div
                      className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                    >
                      <Maximize2 size={11} />
                    </div>

                    {/* Result ready badge */}
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
                style={{
                  height: '180px',
                  border: `1.5px dashed ${ACCENT_BDR}`,
                  background: ACCENT_SUB,
                }}
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
              {PHOTO_POLISH_PRESETS.map((p) => {
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
                    background: aspectRatio === opt.value ? ACCENT       : 'var(--bg-elevated)',
                    color:      aspectRatio === opt.value ? '#ffffff'    : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {autoRatio && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Auto-set from your photo
              </p>
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
              color:      canGenerate ? '#ffffff' : 'var(--text-muted)',
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
