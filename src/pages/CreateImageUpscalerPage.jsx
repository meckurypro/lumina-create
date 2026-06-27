// src/pages/CreateImageUpscalerPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus, Maximize2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-polish)'
const ACCENT_SUB = 'var(--tool-polish-subtle)'
const ACCENT_BDR = 'var(--tool-polish-border)'

const SS_UPSCALE_IMAGE = 'meckury_upscale_image'

// ── helpers ──────────────────────────────────────────────────────────────────

async function readImageMeta(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      resolve({ w: img.width, h: img.height, url })
    }
    img.onerror = () => resolve({ w: null, h: null, url })
    img.src = url
  })
}

// ── Model Dropdown ────────────────────────────────────────────────────────────
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
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
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
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{m.label}</p>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CreateImageUpscalerPage() {
  const navigate = useNavigate()
  const { user, credits, refreshProfile } = useAuth()

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelValue,    setModelValue]    = useState('')
  const [image,         setImage]         = useState(null)   // { file, url, w, h }
  const [quality,       setQuality]       = useState(null)   // key from credit_cost_resolution
  const [submitting,    setSubmitting]    = useState(false)
  const [fullscreen,    setFullscreen]    = useState(false)

  // ── Restore seed from Assets page ─────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SS_UPSCALE_IMAGE)
      if (!saved) return
      sessionStorage.removeItem(SS_UPSCALE_IMAGE)
      const item = JSON.parse(saved)
      if (item.url) {
        const img = new Image()
        img.onload = () => {
          setImage({ file: null, url: item.url, w: img.width, h: img.height })
        }
        img.onerror = () => setImage({ file: null, url: item.url, w: null, h: null })
        img.src = item.url
      }
    } catch { /* corrupt storage */ }
  }, [])

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem(SS_UPSCALE_IMAGE) } catch {}
    }
  }, [])

  // ── Load upscaler models ───────────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'image')
      .eq('feature', 'upscale')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const list = data || []
    setModels(list)
    const first = list.find((m) => !m.is_locked)
    if (first) {
      setModelValue(first.value)
      // default quality to first resolution tier
      const resCosts = first.credit_cost_resolution
      if (resCosts) {
        setQuality(Object.keys(resCosts)[0])
      }
    }
    setModelsLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedModel  = models.find((m) => m.value === modelValue)
  const resCosts       = selectedModel?.credit_cost_resolution ?? null
  const qualityOptions = resCosts ? Object.entries(resCosts) : []

  // When model changes, snap quality to first available tier
  useEffect(() => {
    if (!resCosts) { setQuality(null); return }
    const keys = Object.keys(resCosts)
    if (!quality || !keys.includes(quality)) setQuality(keys[0])
  }, [modelValue]) // eslint-disable-line

  const creditCost = resCosts && quality
    ? (resCosts[quality] ?? 0)
    : (selectedModel?.credit_cost_i2i ?? 0)

  const canAfford     = credits >= creditCost
  const canUpscale    = !!image && canAfford && !submitting && !!selectedModel && creditCost > 0

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const { w, h, url } = await readImageMeta(file)
    setImage({ file, url, w, h })
  }

  const handleRemove = () => setImage(null)

  // ── Model change ──────────────────────────────────────────────────────────
  const handleModelChange = (value) => {
    setModelValue(value)
  }

  // ── Upscale ───────────────────────────────────────────────────────────────
  const handleUpscale = async () => {
    if (!image)         return toast.error('Upload an image first')
    if (!selectedModel) return toast.error('Select a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      // Upload source image
      let publicUrl
      if (!image.file) {
        publicUrl = image.url
      } else {
        const contentType = image.file.type || 'image/jpeg'
        const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { data: uploadData, error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, image.file, { upsert: false, cacheControl: '3600', contentType })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        ;({ data: { publicUrl } } = supabase.storage
          .from('generation-uploads')
          .getPublicUrl(uploadData.path))
      }

      // Create generation row
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        'image_to_image',
        status:                 'pending',
        prompt:                 'upscale',
        model:                  modelValue,
        aspect_ratio:           '1:1',
        resolution:             quality,
        credits_charged:        creditCost,
        output_type:            'image',
        input_image_urls:       [publicUrl],
        skip_prompt_refinement: true,
        title:                  `Image Upscale${quality ? ` · ${quality.toUpperCase()}` : ''}`,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // Invoke edge function
      const { data: invokeData, error: invokeErr } = await supabase.functions
        .invoke('image-upscale', { body: { generationId: genRow.id } })

      if (invokeErr || invokeData?.error) {
        const msg = invokeData?.error || invokeErr?.message || 'Upscale failed'
        toast.error(msg)
        await refreshProfile()
        return
      }

      refreshProfile()
      toast.success('Upscaling your image… Check your Media page.', { duration: 4000 })
      setImage(null)

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
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Upscaling…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen original */}
      <AnimatePresence>
        {fullscreen && image && (
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
              src={image.url} alt="Source"
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
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Image Upscaler</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>AI Super Resolution</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && models.length > 0 && (
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

          {/* Info banner */}
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
          >
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Upload an image and select your target resolution. The AI will enlarge and sharpen it — no prompt needed. Result lands in your{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Media</strong> page.
            </p>
          </div>

          {/* Image upload */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Source Image
            </p>
            {image ? (
              <div className="relative flex justify-center">
                <div style={{ width: '100%', maxWidth: image.w && image.h ? (image.w > image.h ? '100%' : '260px') : '260px' }}>
                  <div
                    className="relative overflow-hidden rounded-2xl cursor-pointer"
                    style={{
                      aspectRatio: image.w && image.h ? `${image.w} / ${image.h}` : '1 / 1',
                      maxHeight:   '340px',
                      background:  'var(--bg-elevated)',
                    }}
                    onClick={() => setFullscreen(true)}
                  >
                    <img src={image.url} alt="Source" className="w-full h-full" style={{ objectFit: 'contain' }} />
                    {image.w && image.h && (
                      <div
                        className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                      >
                        {image.w} × {image.h}
                      </div>
                    )}
                    <div
                      className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                    >
                      <Maximize2 size={11} />
                    </div>
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
                style={{ height: '200px', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
              >
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <ImagePlus size={28} style={{ color: ACCENT, marginBottom: 10 }} />
                <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload an image</span>
                <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  JPG, PNG, WEBP — any size
                </span>
              </label>
            )}
          </div>

          {/* Quality / Resolution picker — dynamic from model */}
          {qualityOptions.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Output Resolution
              </p>
              <div className="flex gap-2 flex-wrap">
                {qualityOptions.map(([key, cost]) => (
                  <button
                    key={key}
                    onClick={() => setQuality(key)}
                    className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                    style={{
                      background: quality === key ? ACCENT : 'var(--bg-elevated)',
                      color:      quality === key ? '#ffffff' : 'var(--text-secondary)',
                    }}
                  >
                    {key.toUpperCase()} · {cost} cr
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No models state */}
          {!modelsLoading && models.length === 0 && (
            <div
              className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            >
              <span style={{ fontSize: 32 }}>🔭</span>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No upscaler models yet</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Upscaler models are being set up. Check back soon.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Upscale button */}
      {models.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={handleUpscale}
              disabled={!canUpscale}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{
                background: canUpscale ? ACCENT : 'var(--bg-elevated)',
                color:      canUpscale ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              <Zap size={15} fill="currentColor" />
              {!image
                ? 'Upload an image to upscale'
                : !canAfford
                  ? 'Not enough credits'
                  : `Upscale${creditCost ? ` · ${creditCost} cr` : ''}`
              }
            </button>
            {!canAfford && image && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Not enough credits.{' '}
                <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                  Top up
                </button>
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
