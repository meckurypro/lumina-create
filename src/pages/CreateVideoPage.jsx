// src/pages/CreateVideoPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb } from '@/lib/supabase'
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
          <path d={open ? 'M2 7l3-4 3 4' : 'M2 3l3 4 3-4'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
              className="absolute right-0 top-9 z-50 w-56 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}
            >
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
                    {model.value === value && <span style={{ color: 'var(--brand)', fontSize: 14 }}>✓</span>}
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

function detectAspectRatio(width, height) {
  const ratio = width / height
  if (ratio > 1.6)  return '16:9'
  if (ratio < 0.75) return '9:16'
  return '1:1'
}

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
        style={{ aspectRatio: '1/1', border: '1.5px dashed var(--border-color)', background: 'var(--bg-card)' }}
      >
        <input type="file" accept="image/*" className="hidden" onChange={onChange} />
        <ImagePlus size={20} style={{ color: 'var(--text-muted)', marginBottom: 6 }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Upload</span>
      </label>
    )}
  </div>
)

export default function CreateVideoPage() {
  const navigate                          = useNavigate()
  const { user, credits, refreshProfile } = useAuth()

  const [prompt,      setPrompt]      = useState('')
  const [startFrame,  setStartFrame]  = useState(null)
  const [endFrame,    setEndFrame]    = useState(null)
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [autoRatio,   setAutoRatio]   = useState(false)
  const [duration,    setDuration]    = useState('5')
  const [withSound,   setWithSound]   = useState(false)
  const [model,       setModel]       = useState('')
  const [models,      setModels]      = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [submitting,  setSubmitting]  = useState(false)

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'video')
      .eq('is_active', true)
      .order('sort_order')
    const list = data || []
    setModels(list)
    const unlocked = list.filter((m) => !m.is_locked)
    setModel(unlocked[0]?.value || '')
    setModelsLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  const type          = deriveVideoType(startFrame, endFrame)
  const selectedModel = models.find((m) => m.value === model)
  const isI2V         = !!(startFrame || endFrame)
  const supportsSound = !!selectedModel?.supports_sound

  // Reset sound toggle when switching to a model that doesn't support it
  useEffect(() => {
    if (!supportsSound) setWithSound(false)
  }, [supportsSound])

  const baseCredits = selectedModel
    ? (isI2V ? selectedModel.credit_cost_i2i : selectedModel.credit_cost_t2i) || 0
    : 0
  const creditCost = withSound && supportsSound
    ? Math.ceil(baseCredits * (selectedModel?.sound_cost_multiplier ?? 1.5))
    : baseCredits

  const canAfford   = credits >= creditCost
  const promptEmpty = !prompt.trim()
  const isLoading   = submitting

  const handleFrameUpload = (setter) => (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
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

  const modeLabel = {
    text_to_video:   'Text to Video',
    image_to_video:  'Image to Video',
    end_frame_text:  'End Frame + Text',
    start_end_frame: 'Start + End Frame',
  }[type]

  const handleGenerate = async () => {
    if (promptEmpty)    return toast.error('Enter a prompt')
    if (!selectedModel) return toast.error('Pick a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      // 1. Upload start frame
      let startFrameUrl = null
      if (startFrame?.file) {
        const ext  = (startFrame.file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, startFrame.file, { upsert: false, cacheControl: '3600', contentType: startFrame.file.type })
        if (upErr) throw new Error('Start frame upload failed')
        const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)
        startFrameUrl = publicUrl
      }

      // 2. Upload end frame
      let endFrameUrl = null
      if (endFrame?.file) {
        const ext  = (endFrame.file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, endFrame.file, { upsert: false, cacheControl: '3600', contentType: endFrame.file.type })
        if (upErr) throw new Error('End frame upload failed')
        const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)
        endFrameUrl = publicUrl
      }

      // 3. Create generation row
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:         user.id,
        generation_type: type,
        status:          'pending',
        prompt,
        model,
        aspect_ratio:    aspectRatio,
        duration,
        credits_charged: creditCost,
        output_type:     'video',
        start_frame_url: startFrameUrl,
        end_frame_url:   endFrameUrl,
        with_sound:      withSound,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // 4. Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // 5. Fire-and-forget pipeline
      supabase.functions.invoke('video-generate', { body: { generationId: genRow.id } })
        .catch((e) => console.error('video-generate invoke error', e))

      refreshProfile()
      toast.success('Your video is being generated. Check your Media page.', { duration: 4000 })
      setPrompt('')
      setStartFrame(null)
      setEndFrame(null)
      setAutoRatio(false)
      setAspectRatio('9:16')
      setWithSound(false)
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
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

          {/* Settings */}
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
            {supportsSound && (
              <SettingChips
                label="Sound"
                options={[
                  { label: '🔇 Silent',     value: 'false' },
                  { label: '🔊 With Sound', value: 'true'  },
                ]}
                value={String(withSound)}
                onChange={(v) => setWithSound(v === 'true')}
              />
            )}
          </div>

        </div>
      </div>

      {/* Generate button */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={handleGenerate}
            disabled={isLoading || !canAfford || promptEmpty || !selectedModel}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: 'var(--text-primary)',
              color:      'var(--text-inverse)',
              opacity:    (isLoading || !canAfford || promptEmpty || !selectedModel) ? 0.5 : 1,
            }}
          >
            <Zap size={15} fill="currentColor" />
            {isLoading ? 'Generating…' : `Generate · ${creditCost} cr`}
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
