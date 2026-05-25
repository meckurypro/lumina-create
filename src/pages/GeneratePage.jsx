// src/pages/GeneratePage.jsx
import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronDown, Zap } from 'lucide-react'
import { useGenerate } from '@/hooks/useGenerate'
import { useAuth } from '@/context/AuthContext'
import { ImageUpload, MultiImageUpload } from '@/components/ui/ImageUpload'
import { Textarea } from '@/components/ui/Input'
import { Loader } from '@/components/ui/Modal'
import { calculateCreditCost } from '@/lib/creditUtils'
import toast from 'react-hot-toast'

// ─── Setting Chips ────────────────────────────────────────

const SettingChips = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    <p
      className="text-xs font-semibold mb-2.5 uppercase tracking-widest"
      style={{ color: 'var(--text-muted)' }}
    >
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

const VIDEO_TYPES = new Set([
  'text_to_video',
  'image_to_video',
  'start_end_frame',
  'end_frame_text',
  'template',
])

// ─── Generate Page ────────────────────────────────────────

export default function GeneratePage() {
  const navigate                        = useNavigate()
  const location                        = useLocation()
  const { credits }                     = useAuth()
  const { generate, status, isLoading } = useGenerate()

  const state = location.state || {}
  const {
    type,
    templateId,
    templateSlug,
    templateName,
    templateDescription,
    toolLabel,
    minImages          = 2,
    maxImages          = 2,
    creditCostPerImage,
  } = state

  const isTemplate      = type === 'template'
  const isMemoryLane    = templateSlug === 'memory-lane'
  const isHandover      = templateSlug === 'office-handover'
  const needsStartFrame = ['image_to_video', 'start_end_frame', 'image_to_image'].includes(type) || isHandover
  const needsEndFrame   = ['start_end_frame', 'end_frame_text'].includes(type) || isHandover
  const needsPrompt     = !isTemplate && type !== 'start_end_frame'
  const isVideoType     = VIDEO_TYPES.has(type)
  const showModelPicker = isVideoType && !isTemplate

  const [prompt,       setPrompt]       = useState(state.prompt || '')
  const [startFrame,   setStartFrame]   = useState(null)
  const [endFrame,     setEndFrame]     = useState(null)
  const [imageFrames,  setImageFrames]  = useState([])
  const [aspectRatio,  setAspectRatio]  = useState(state.aspectRatio || '9:16')
  const [duration,     setDuration]     = useState(state.duration || '5')
  const [model,        setModel]        = useState(state.model || 'kling_2_5')
  const [showSettings, setShowSettings] = useState(false)

  const estimatedCredits = creditCostPerImage
    ? creditCostPerImage * Math.max(imageFrames.length, minImages)
    : calculateCreditCost(
        isTemplate ? `template_${templateSlug?.replace(/-/g, '_')}` : type,
        { duration, imageCount: imageFrames.length || 1 }
      )

  const canAfford = credits >= parseFloat(estimatedCredits)

  if (!type) return <Navigate to="/create" replace />

  const handleGenerate = async () => {
    if (needsStartFrame && !startFrame)                 return toast.error('Upload the first image')
    if (needsEndFrame && !endFrame)                     return toast.error('Upload the second image')
    if (isMemoryLane && imageFrames.length < minImages) return toast.error(`Upload at least ${minImages} photos`)
    if (needsPrompt && !prompt.trim())                  return toast.error('Enter a prompt')
    if (!canAfford)                                     return toast.error('Not enough credits')

    const result = await generate({
      type, templateId, templateSlug,
      prompt, startFrame, endFrame,
      imageFrames: isMemoryLane ? imageFrames : null,
      aspectRatio, duration, model,
    })

    if (result) {
      navigate(`/result/${result.generationId}`, {
        state: { outputUrl: result.outputUrl, outputType: result.outputType },
      })
    }
  }

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {isTemplate ? templateName : toolLabel}
        </h1>

        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
          {Math.floor(credits)}
        </div>
      </div>

      {/* ── Loading overlay ── */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-5">

          {/* Template description */}
          {isTemplate && templateDescription && (
            <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {templateDescription}
            </p>
          )}

          {/* Memory Lane multi-upload */}
          {isMemoryLane && (
            <MultiImageUpload
              values={imageFrames}
              onChange={setImageFrames}
              minImages={minImages}
              maxImages={maxImages}
            />
          )}

          {/* Start / End frame uploads */}
          {!isMemoryLane && (needsStartFrame || needsEndFrame) && (
            <div className={needsStartFrame && needsEndFrame ? 'grid grid-cols-2 gap-3' : ''}>
              {needsStartFrame && (
                <ImageUpload
                  sublabel={needsEndFrame ? 'Start frame' : 'Upload image'}
                  value={startFrame}
                  onChange={setStartFrame}
                  onRemove={() => setStartFrame(null)}
                />
              )}
              {needsEndFrame && (
                <ImageUpload
                  sublabel="End frame"
                  value={endFrame}
                  onChange={setEndFrame}
                  onRemove={() => setEndFrame(null)}
                />
              )}
            </div>
          )}

          {/* Prompt */}
          {needsPrompt && (
            <Textarea
              label="Prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to create…"
              rows={3}
              maxLength={500}
            />
          )}

          {/* Settings toggle */}
          <div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center justify-between w-full py-3 px-4 rounded-2xl"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              <span className="text-sm font-medium">Settings</span>
              <motion.div animate={{ rotate: showSettings ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} />
              </motion.div>
            </button>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-5 px-1">
                    <SettingChips
                      label="Aspect Ratio"
                      options={[
                        { label: '9:16',  value: '9:16'  },
                        { label: '16:9',  value: '16:9'  },
                        { label: '1:1',   value: '1:1'   },
                      ]}
                      value={aspectRatio}
                      onChange={setAspectRatio}
                    />
                    {isVideoType && (
                      <SettingChips
                        label="Duration"
                        options={[
                          { label: '5s',  value: '5'  },
                          { label: '8s',  value: '8'  },
                          { label: '10s', value: '10' },
                        ]}
                        value={duration}
                        onChange={setDuration}
                      />
                    )}
                    {showModelPicker && (
                      <SettingChips
                        label="Model"
                        options={[
                          { label: 'Kling 2.5', value: 'kling_2_5'    },
                          { label: 'Seedance',  value: 'seedance_1_5' },
                        ]}
                        value={model}
                        onChange={setModel}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* ── Generate button ── */}
      <div
        className="flex-shrink-0 px-4 lg:px-8 py-4"
        style={{ borderTop: '1px solid var(--border-color)' }}
      >
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">
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
            {isLoading ? 'Generating…' : `Generate  ·  ${estimatedCredits} cr`}
          </button>

          {!canAfford && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button
                onClick={() => navigate('/profile')}
                className="font-semibold"
                style={{ color: 'var(--text-primary)' }}
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
