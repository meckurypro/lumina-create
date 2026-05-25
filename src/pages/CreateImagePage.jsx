// src/pages/CreateImagePage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus, Maximize2 } from 'lucide-react'
import { useGenerate } from '@/hooks/useGenerate'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Modal'
import { calculateCreditCost } from '@/lib/creditUtils'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

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
  const navigate                        = useNavigate()
  const { credits }                     = useAuth()
  const { generate, status, isLoading } = useGenerate()

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [prompt,        setPrompt]        = useState('')
  const [referenceImg,  setReferenceImg]  = useState(null)
  const [imgDimensions, setImgDimensions] = useState(null)
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [autoRatio,     setAutoRatio]     = useState(false)
  const [model,         setModel]         = useState('')
  const [fullscreen,    setFullscreen]    = useState(false)

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
    // Default to first unlocked model
    const firstUnlocked = list.find((m) => !m.is_locked)
    if (firstUnlocked) setModel(firstUnlocked.value)
    setModelsLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  const type             = referenceImg ? 'image_to_image' : 'text_to_image'
  const estimatedCredits = calculateCreditCost(type, { imageCount: 1 })
  const canAfford        = credits >= parseFloat(estimatedCredits)

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
  }

  const handleRemoveImage = () => {
    setReferenceImg(null)
    setImgDimensions(null)
    setAutoRatio(false)
    setAspectRatio('9:16')
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error('Enter a prompt')
    if (!canAfford)     return toast.error('Not enough credits')
    const result = await generate({
      type, prompt,
      startFrame:  referenceImg?.file || null,
      aspectRatio, duration: null, model,
    })
    if (result) {
      toast.success('On its way! Check your Media page.', { duration: 4000 })
      navigate(`/result/${result.generationId}`, {
        state: { outputUrl: result.outputUrl, outputType: result.outputType },
      })
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
            <ModelDropdown models={models} value={model} onChange={setModel} />
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

      {/* ── Loading overlay ── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          >
            <div className="text-center px-8">
              <Loader size="lg" status={status} />
              <div className="mt-5 flex gap-1.5 justify-center">
                {['uploading', 'enhancing', 'generating'].map((s) => (
                  <div
                    key={s}
                    className="h-0.5 rounded-full transition-all duration-500"
                    style={{
                      width:      status === s ? 28 : 8,
                      background: status === s ? 'var(--brand)' : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  className="flex flex-col items-center justify-center cursor-pointer rounded-2xl transition-all"
                  style={{ width: '140px', aspectRatio: '1 / 1', border: '1.5px dashed var(--border-color)', background: 'var(--bg-card)' }}
                >
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  <ImagePlus size={22} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Add reference</span>
                </label>
              )}
            </div>
          </div>

          {/* Prompt */}
          <Textarea
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to create…"
            rows={4}
            maxLength={500}
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
            disabled={isLoading || !canAfford}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: 'var(--text-primary)',
              color:      'var(--text-inverse)',
              opacity:    (isLoading || !canAfford) ? 0.5 : 1,
            }}
          >
            <Zap size={15} fill="currentColor" />
            {isLoading ? 'Generating…' : 'Generate'}
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
