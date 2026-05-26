// src/pages/CreateImagePage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus, Maximize2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb, profiles as profilesApi } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ── Session storage keys ───────────────────────────────────
const SS_PROMPT = 'meckury_create_prompt'
const SS_IMAGE  = 'meckury_create_image'

// ── Setting Chips ──────────────────────────────────────────
const SettingChips = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
      {label}
    </p>
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: value === opt.value ? 'var(--text-primary)' : 'var(--bg-elevated)',
            color:      value === opt.value ? 'var(--text-inverse)' : 'var(--text-secondary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)

// ── Helpers ────────────────────────────────────────────────
function detectAspectRatio(width, height) {
  const ratio = width / height
  if (ratio > 1.6)  return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
}

// ── Model Dropdown ─────────────────────────────────────────
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
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
      >
        <span>{selected?.label ?? 'Model'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d={open ? 'M2 7l3-4 3 4' : 'M2 3l3 4 3-4'}
            stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"
          />
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
              style={{
                background: 'var(--bg-card)',
                border:     '1px solid var(--border-color)',
                boxShadow:  '0 8px 32px rgba(0,0,0,0.28)',
              }}
            >
              {/* Unlocked models */}
              <div className="py-1">
                {unlocked.map((model) => (
                  <button
                    key={model.value}
                    onClick={() => { onChange(model.value); setOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                    style={{ background: model.value === value ? 'var(--bg-elevated)' : 'transparent' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{model.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{model.sublabel}</p>
                      {!model.supports_image && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Text only</p>
                      )}
                    </div>
                    {model.value === value && (
                      <span style={{ color: 'var(--brand)', fontSize: 14 }}>✓</span>
                    )}
                  </button>
                ))}
              </div>

              {locked.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 12px' }} />
                  <div className="py-1">
                    {locked.map((model) => (
                      <div key={model.value} className="flex items-center justify-between px-4 py-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{model.label}</p>
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

// ── Main Page ──────────────────────────────────────────────
export default function CreateImagePage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [prompt,        setPrompt]        = useState('')
  const [referenceImg,  setReferenceImg]  = useState(null)
  const [imgDimensions, setImgDimensions] = useState(null)
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [autoRatio,     setAutoRatio]     = useState(false)
  const [model,         setModel]         = useState('')
  const [fullscreen,    setFullscreen]    = useState(false)
  const [submitting,    setSubmitting]    = useState(false)

  // ── Restore persisted state on mount ──────────────────────
  useEffect(() => {
    try {
      const savedPrompt = sessionStorage.getItem(SS_PROMPT)
      if (savedPrompt) setPrompt(savedPrompt)

      const savedImage = sessionStorage.getItem(SS_IMAGE)
      if (savedImage) {
        const { base64, name, type } = JSON.parse(savedImage)
        const byteString = atob(base64.split(',')[1])
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
        const blob = new Blob([ab], { type })
        const url  = URL.createObjectURL(blob)
        const file = new File([blob], name, { type })
        const img  = new Image()
        img.onload = () => {
          setAspectRatio(detectAspectRatio(img.width, img.height))
          setAutoRatio(true)
          setImgDimensions({ width: img.width, height: img.height })
        }
        img.src = url
        setReferenceImg({ file, url })
      }
    } catch { /* corrupt storage — silently ignore */ }
  }, [])

  // ── Persist prompt on every change ────────────────────────
  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(SS_PROMPT, prompt)
      else        sessionStorage.removeItem(SS_PROMPT)
    } catch { /* noop */ }
  }, [prompt])

  // ── Load models ───────────────────────────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'image')
      .eq('is_active', true)
      .order('sort_order')
    const list = data || []
    setModels(list)
    const unlocked  = list.filter((m) => !m.is_locked)
    const preferred = profile?.preferred_model
    const match     = preferred && unlocked.find((m) => m.value === preferred)
    setModel((match || unlocked[0])?.value || '')
    setModelsLoading(false)
  }, [profile?.preferred_model])

  useEffect(() => { loadModels() }, [loadModels])

  const selectedModel     = models.find((m) => m.value === model)
  const modelSupportsImage = selectedModel?.supports_image !== false

  const type          = referenceImg && modelSupportsImage ? 'image_to_image' : 'text_to_image'
  const creditCost    = selectedModel
    ? (referenceImg && modelSupportsImage ? selectedModel.credit_cost_i2i : selectedModel.credit_cost_t2i) || 0
    : 0
  const canAfford      = credits >= creditCost
  const promptEmpty    = !prompt.trim()
  const buttonDisabled = promptEmpty || !canAfford || submitting || !selectedModel

  // ── When model changes to one that doesn't support images,
  //    clear any attached reference image ────────────────────
  useEffect(() => {
    if (!modelSupportsImage && referenceImg) {
      handleRemoveImage()
    }
  }, [model])

  // ── Persist preferred model when user changes it ──────────
  const handleModelChange = async (value) => {
    setModel(value)
    if (user && value && value !== profile?.preferred_model) {
      try { await profilesApi.update(user.id, { preferred_model: value }) } catch { /* noop */ }
    }
  }

  // ── Image upload ──────────────────────────────────────────
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setAspectRatio(detectAspectRatio(img.width, img.height))
      setAutoRatio(true)
      setImgDimensions({ width: img.width, height: img.height })
    }
    img.src = url
    setReferenceImg({ file, url })
    try {
      const reader = new FileReader()
      reader.onload = (ev) => {
        sessionStorage.setItem(SS_IMAGE, JSON.stringify({
          base64: ev.target.result,
          name:   file.name,
          type:   file.type,
        }))
      }
      reader.readAsDataURL(file)
    } catch { /* noop */ }
  }

  // ── Remove image ──────────────────────────────────────────
  const handleRemoveImage = () => {
    setReferenceImg(null)
    setImgDimensions(null)
    setAutoRatio(false)
    setAspectRatio('9:16')
    try { sessionStorage.removeItem(SS_IMAGE) } catch { /* noop */ }
  }

  // ── Generate ──────────────────────────────────────────────
  const handleGenerate = async () => {
    if (promptEmpty)    return toast.error('Enter a prompt')
    if (!selectedModel) return toast.error('Pick a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)

    try {
      // 1. Upload reference image (if any) to generation-uploads bucket
      let startFrameUrl = null
      if (referenceImg?.file && modelSupportsImage) {
        const file = referenceImg.file

        const contentType =
          (file.type && file.type !== '') ? file.type
          : file.name?.match(/\.png$/i)   ? 'image/png'
          : file.name?.match(/\.webp$/i)  ? 'image/webp'
          : 'image/jpeg'

        const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`

        const { data: uploadData, error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, file, {
            upsert:       false,
            cacheControl: '3600',
            contentType,
          })

        if (upErr) throw new Error(`Reference upload failed: ${upErr.message}`)

        const { data: { publicUrl } } = supabase.storage
          .from('generation-uploads')
          .getPublicUrl(uploadData.path)

        startFrameUrl = publicUrl
      }

      // 2. Create the generation row
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:         user.id,
        generation_type: type,
        status:          'pending',
        prompt,
        model,
        aspect_ratio:    aspectRatio,
        credits_charged: creditCost,
        output_type:     'image',
        start_frame_url: startFrameUrl,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // 3. Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // 4. Kick off generation pipeline (fire-and-forget)
      supabase.functions.invoke('image-generate', { body: { generationId: genRow.id } })
        .catch((e) => console.error('image-generate invoke error', e))

      // 5. Reset state
      refreshProfile()
      toast.success('Your image is being generated. Check your Media page.', { duration: 4000 })
      setPrompt('')
      handleRemoveImage()
      try {
        sessionStorage.removeItem(SS_PROMPT)
        sessionStorage.removeItem(SS_IMAGE)
      } catch { /* noop */ }

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      console.error('Generate error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const cardAspectRatio = imgDimensions
    ? `${imgDimensions.width} / ${imgDimensions.height}`
    : '1 / 1'

  const cardMaxWidth = imgDimensions
    ? imgDimensions.width > imgDimensions.height ? '100%' : '200px'
    : '140px'

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Image</h1>

        <div className="flex items-center gap-2">
          {!modelsLoading && (
            <ModelDropdown models={models} value={model} onChange={handleModelChange} />
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

      {/* ── Fullscreen viewer ── */}
      <AnimatePresence>
        {fullscreen && referenceImg && (
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
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{    scale: 0.93, opacity: 0 }}
              src={referenceImg.url}
              alt="Reference full"
              className="rounded-2xl"
              style={{ maxWidth: '100%', maxHeight: '90dvh', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-5">

          {/* Reference image */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Reference Image{' '}
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
            </p>
            <div className="flex justify-center">
              {referenceImg ? (
                <div className="relative" style={{ width: '100%', maxWidth: cardMaxWidth }}>
                  <div
                    className="relative overflow-hidden rounded-2xl cursor-pointer w-full"
                    style={{ aspectRatio: cardAspectRatio, maxHeight: '300px', background: 'var(--bg-elevated)' }}
                    onClick={() => setFullscreen(true)}
                  >
                    <img src={referenceImg.url} alt="Reference" className="w-full h-full" style={{ objectFit: 'contain' }} />
                    <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                      <Maximize2 size={11} />
                    </div>
                    {autoRatio && (
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                        {aspectRatio}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleRemoveImage}
                    className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center z-10"
                    style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <label
                  className="flex flex-col items-center justify-center rounded-2xl transition-all"
                  style={{
                    width:       '140px',
                    aspectRatio: '1 / 1',
                    border:      '1.5px dashed var(--border-color)',
                    background:  'var(--bg-card)',
                    cursor:      modelSupportsImage ? 'pointer' : 'not-allowed',
                    opacity:     modelSupportsImage ? 1 : 0.4,
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={!modelSupportsImage}
                  />
                  <ImagePlus size={22} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    {modelSupportsImage ? 'Add reference' : 'Not supported'}
                  </span>
                </label>
              )}
            </div>

            {/* Tooltip when model doesn't support image */}
            {!modelSupportsImage && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                This model is text-only. Switch models to use a reference image.
              </p>
            )}
          </div>

          {/* Prompt */}
          <Textarea
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="What are we creating today?"
            rows={4}
          />

          {/* Aspect ratio */}
          <div className="pt-1">
            <SettingChips
              label="Aspect Ratio"
              options={[
                { label: '9:16', value: '9:16' },
                { label: '16:9', value: '16:9' },
                { label: '1:1',  value: '1:1'  },
              ]}
              value={aspectRatio}
              onChange={(v) => { setAspectRatio(v); setAutoRatio(false) }}
            />
          </div>

        </div>
      </div>

      {/* ── Generate button ── */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={handleGenerate}
            disabled={buttonDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: 'var(--text-primary)',
              color:      'var(--text-inverse)',
              opacity:    buttonDisabled ? 0.5 : 1,
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
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Top up
              </button>
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
