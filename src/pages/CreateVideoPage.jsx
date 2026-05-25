// src/pages/CreateVideoPage.jsx
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

function detectAspectRatio(width, height) {
  const ratio = width / height
  if (ratio > 1.6)  return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
}

// Derive video type from what frames are uploaded
function deriveVideoType(startFrame, endFrame) {
  if (startFrame && endFrame) return 'start_end_frame'
  if (startFrame)             return 'image_to_video'
  if (endFrame)               return 'end_frame_text'
  return 'text_to_video'
}

const FrameUpload = ({ label, value, onChange, onRemove }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
    {value ? (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1' }}>
        <img src={value.url} alt={label} className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
        >
          <X size={13} />
        </button>
      </div>
    ) : (
      <label
        className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
        style={{
          aspectRatio: '1/1',
          border:      '1.5px dashed var(--border-color)',
          background:  'var(--bg-card)',
        }}
      >
        <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        <ImagePlus size={20} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Upload</span>
      </label>
    )}
  </div>
)

export default function CreateVideoPage() {
  const navigate                        = useNavigate()
  const { credits }                     = useAuth()
  const { generate, status, isLoading } = useGenerate()

  const [prompt,      setPrompt]      = useState('')
  const [startFrame,  setStartFrame]  = useState(null)
  const [endFrame,    setEndFrame]    = useState(null)
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [autoRatio,   setAutoRatio]   = useState(false)
  const [duration,    setDuration]    = useState('5')
  const [model,       setModel]       = useState('kling_2_5')

  const type             = deriveVideoType(startFrame, endFrame)
  const estimatedCredits = calculateCreditCost(type, { duration })
  const canAfford        = credits >= parseFloat(estimatedCredits)

  const handleFrameUpload = (setter) => (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    // Auto-detect aspect ratio from first uploaded frame
    if (!startFrame && !endFrame) {
      const img = new Image()
      img.onload = () => {
        setAspectRatio(detectAspectRatio(img.width, img.height))
        setAutoRatio(true)
      }
      img.src = url
    }
    setter({ file, url })
  }

  // Mode label shown to user
  const modeLabel = {
    text_to_video:   'Text to Video',
    image_to_video:  'Image to Video',
    end_frame_text:  'End Frame + Text',
    start_end_frame: 'Start + End Frame',
  }[type]

  const handleGenerate = async () => {
    if (!prompt.trim() && type === 'text_to_video') return toast.error('Enter a prompt')
    if (!canAfford) return toast.error('Not enough credits')

    const result = await generate({
      type,
      prompt,
      startFrame:  startFrame?.file || null,
      endFrame:    endFrame?.file   || null,
      aspectRatio,
      duration,
      model,
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
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Video</h1>
          <span className="text-xs" style={{ color: 'var(--brand)' }}>{modeLabel}</span>
        </div>
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
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* Frame uploads */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Frames <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— upload start, end, or both</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FrameUpload
                label="Start Frame"
                value={startFrame}
                onChange={handleFrameUpload(setStartFrame)}
                onRemove={() => { setStartFrame(null); if (!endFrame) { setAutoRatio(false); setAspectRatio('9:16') } }}
              />
              <FrameUpload
                label="End Frame"
                value={endFrame}
                onChange={handleFrameUpload(setEndFrame)}
                onRemove={() => { setEndFrame(null); if (!startFrame) { setAutoRatio(false); setAspectRatio('9:16') } }}
              />
            </div>
            {autoRatio && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Aspect ratio auto-set to <strong>{aspectRatio}</strong> from uploaded frame
              </p>
            )}
          </div>

          {/* Prompt */}
          <Textarea
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the motion, scene, or action…"
            rows={3}
            maxLength={500}
          />

          {/* Settings — all inline, no accordion */}
          <div>
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
            <SettingChips
              label="Model"
              options={[
                { label: 'Kling 2.5', value: 'kling_2_5'    },
                { label: 'Seedance',  value: 'seedance_1_5' },
              ]}
              value={model}
              onChange={setModel}
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
