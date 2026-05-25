// src/pages/CreateImagePage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus } from 'lucide-react'
import { useGenerate } from '@/hooks/useGenerate'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Modal'
import { calculateCreditCost } from '@/lib/creditUtils'
import toast from 'react-hot-toast'

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

// Detect aspect ratio from image dimensions
function detectAspectRatio(width, height) {
  const ratio = width / height
  if (ratio > 1.6)  return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
}

export default function CreateImagePage() {
  const navigate                        = useNavigate()
  const { credits }                     = useAuth()
  const { generate, status, isLoading } = useGenerate()

  const [prompt,       setPrompt]       = useState('')
  const [referenceImg, setReferenceImg] = useState(null)
  const [aspectRatio,  setAspectRatio]  = useState('9:16')
  const [autoRatio,    setAutoRatio]    = useState(false)

  const type             = referenceImg ? 'image_to_image' : 'text_to_image'
  const estimatedCredits = calculateCreditCost(type, { imageCount: 1 })
  const canAfford        = credits >= parseFloat(estimatedCredits)

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const detected = detectAspectRatio(img.width, img.height)
      setAspectRatio(detected)
      setAutoRatio(true)
    }
    img.src = url
    setReferenceImg({ file, url })
  }

  const handleRemoveImage = () => {
    setReferenceImg(null)
    setAutoRatio(false)
    setAspectRatio('9:16')
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error('Enter a prompt')
    if (!canAfford)     return toast.error('Not enough credits')

    const result = await generate({
      type,
      prompt,
      startFrame:  referenceImg?.file || null,
      aspectRatio,
      duration:    null,
      model:       null,
    })

    if (result) {
      navigate(`/result/${result.generationId}`, {
        state: { outputUrl: result.outputUrl, outputType: result.outputType },
      })
    }
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Image</h1>
        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
          {Math.floor(credits)}
        </div>
      </div>

      {/* Loading overlay */}
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-5">

          {/* Reference image upload */}
          <div>
            <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Reference Image <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
            </p>

            {referenceImg ? (
              <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                <img src={referenceImg.url} alt="Reference" className="w-full h-full object-cover" />
                <button
                  onClick={handleRemoveImage}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                >
                  <X size={14} />
                </button>
                {autoRatio && (
                  <div
                    className="absolute bottom-3 left-3 px-2 py-1 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                  >
                    {aspectRatio} detected
                  </div>
                )}
              </div>
            ) : (
              <label
                className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
                style={{
                  aspectRatio: '16/9',
                  border:      '1.5px dashed var(--border-color)',
                  background:  'var(--bg-card)',
                }}
              >
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                <ImagePlus size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Add reference image</span>
                <span className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Aspect ratio auto-detected</span>
              </label>
            )}
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

          {/* Settings */}
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

      {/* Generate button */}
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
