import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Tool accent
const ACCENT     = 'var(--tool-video)'
const ACCENT_SUB = 'var(--tool-video-subtle)'
const ACCENT_BDR = 'var(--tool-video-border)'

const SS_PROMPT      = 'meckury_video_prompt'
const SS_START_FRAME = 'meckury_video_start_frame'
const SS_END_FRAME   = 'meckury_video_end_frame'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

function getModelCaps(model) {
  if (!model) return {
    supportsStartFrame:    true,
    supportsEndFrame:      false,
    supportsFrameToFrame:  false,
    supportedDurations:    ['5', '8', '10'],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    supportsSound:         false,
  }
  return {
    supportsStartFrame:    model.supports_start_frame    ?? true,
    supportsEndFrame:      model.supports_end_frame      ?? false,
    supportsFrameToFrame:  model.supports_frame_to_frame ?? false,
    supportedDurations:    model.supported_durations     ?? ['5', '8', '10'],
    supportedAspectRatios: model.supported_aspect_ratios ?? ['9:16', '16:9', '1:1'],
    supportsSound:         model.supports_sound          ?? false,
  }
}

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
            background: value === opt.value ? ACCENT    : 'var(--bg-elevated)',
            color:      value === opt.value ? '#ffffff' : 'var(--text-secondary)',
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
                {unlocked.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { onChange(m.value); setOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                    style={{ background: m.value === value ? ACCENT_SUB : 'transparent' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.aka || m.label}</p>
<p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.sublabel}</p>
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

const persistFrame = (key, file) => {
  if (!file) { try { sessionStorage.removeItem(key) } catch { /* noop */ }; return }
  try {
    const reader = new FileReader()
    reader.onload = (ev) => {
      sessionStorage.setItem(key, JSON.stringify({ base64: ev.target.result, name: file.name, type: file.type }))
    }
    reader.readAsDataURL(file)
  } catch { /* noop */ }
}

const restoreFrame = (key) => new Promise((resolve) => {
  try {
    const saved = sessionStorage.getItem(key)
    if (!saved) return resolve(null)
    const { base64, name, type } = JSON.parse(saved)
    const byteString = atob(base64.split(',')[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type })
    resolve({ file: new File([blob], name, { type }), url: URL.createObjectURL(blob) })
  } catch { resolve(null) }
})

const FrameUpload = ({ label, value, onChange, onRemove, disabled = false, inactive = false }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
    {value ? (
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: '1/1', opacity: inactive ? 0.6 : 1 }}
      >
        <img
          src={value.url}
          alt={label}
          className="w-full h-full object-cover"
          style={{ filter: inactive ? 'blur(4px)' : 'none', pointerEvents: inactive ? 'none' : 'auto' }}
        />
        {inactive && (
          <div
            className="absolute inset-0 flex items-center justify-center px-3"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            <p className="text-xs font-semibold text-center" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
              Not supported<br />by this model
            </p>
          </div>
        )}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', zIndex: 10 }}
        >
          <X size={13} />
        </button>
      </div>
    ) : (
      <label
        className="flex flex-col items-center justify-center w-full rounded-2xl transition-all"
        style={{
          aspectRatio: '1/1',
          border:      `1.5px dashed ${ACCENT_BDR}`,
          background:  ACCENT_SUB,
          cursor:      disabled ? 'not-allowed' : 'pointer',
          opacity:     disabled ? 0.3 : 1,
        }}
      >
        <input type="file" accept="image/*" className="hidden" onChange={onChange} disabled={disabled} />
        <ImagePlus size={20} style={{ color: ACCENT, marginBottom: 6 }} />
        <span className="text-xs font-medium" style={{ color: ACCENT }}>
          {disabled ? 'Not supported' : 'Upload'}
        </span>
      </label>
    )}
  </div>
)

export default function CreateVideoPage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()

  const [prompt,        setPrompt]        = useState('')
  const [startFrame,    setStartFrame]    = useState(null)
  const [endFrame,      setEndFrame]      = useState(null)
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [autoRatio,     setAutoRatio]     = useState(false)
  const [duration,      setDuration]      = useState('5')
  const [withSound,     setWithSound]     = useState(false)
  const [model,         setModel]         = useState('')
  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [submitting,    setSubmitting]    = useState(false)

  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)

  useEffect(() => {
    try {
      const savedPrompt = sessionStorage.getItem(SS_PROMPT)
      if (savedPrompt) setPrompt(savedPrompt)
    } catch { /* noop */ }

    restoreFrame(SS_START_FRAME).then((frame) => {
      if (!frame) return
      setStartFrame(frame)
      const img = new Image()
      img.onload = () => { setAspectRatio(detectAspectRatio(img.width, img.height)); setAutoRatio(true) }
      img.src = frame.url
    })

    restoreFrame(SS_END_FRAME).then((frame) => {
      if (frame) setEndFrame(frame)
    })
  }, [])

  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(SS_PROMPT, prompt)
      else        sessionStorage.removeItem(SS_PROMPT)
    } catch { /* noop */ }
  }, [prompt])

  const selectedModel = models.find((m) => m.value === model)
  const caps          = getModelCaps(selectedModel)

  const activeStartFrame = startFrame && caps.supportsStartFrame                              ? startFrame : null
  const activeEndFrame   = endFrame   && (caps.supportsEndFrame || caps.supportsFrameToFrame) ? endFrame   : null

  const type  = deriveVideoType(activeStartFrame, activeEndFrame)
  const isI2V = !!(activeStartFrame || activeEndFrame)

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'video')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const list = data || []
    setModels(list)
    const firstUnlocked = list.find((m) => !m.is_locked)
    setModel(firstUnlocked?.value || '')
    setModelsLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  useEffect(() => {
    if (!selectedModel) return
    if (!caps.supportedDurations.includes(duration)) {
      setDuration(caps.supportedDurations[0] || '5')
    }
    if (!autoRatio && !caps.supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(caps.supportedAspectRatios[0] || '9:16')
    }
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!caps.supportsSound) setWithSound(false)
  }, [caps.supportsSound])

  const creditsPerSecond = selectedModel
    ? (isI2V ? selectedModel.credit_cost_i2i : selectedModel.credit_cost_t2i) || 0
    : 0
  const isFlatRate = selectedModel?.is_flat_rate ?? false
  const creditCost = (() => {
    if (!selectedModel) return 0
    if (isFlatRate) return creditsPerSecond
    const base = creditsPerSecond * parseInt(duration || '5')
    return withSound && caps.supportsSound
      ? Math.ceil(base * (selectedModel?.sound_cost_multiplier ?? 1.5))
      : Math.ceil(base)
  })()

  const canAfford   = credits >= creditCost
  const promptEmpty = !prompt.trim()

  const handleFrameUpload = (setter, ssKey) => (e) => {
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
    persistFrame(ssKey, file)
  }

  const handleRemoveFrame = (setter, ssKey, isStart) => {
    setter(null)
    try { sessionStorage.removeItem(ssKey) } catch { /* noop */ }
    const otherFrame = isStart ? endFrame : startFrame
    if (!otherFrame) { setAutoRatio(false); setAspectRatio('9:16') }
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
      let startFrameUrl = null
      if (activeStartFrame?.file) {
        const ext  = (activeStartFrame.file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, activeStartFrame.file, { upsert: false, cacheControl: '3600', contentType: activeStartFrame.file.type })
        if (upErr) throw new Error('Start frame upload failed')
        const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)
        startFrameUrl = publicUrl
      }

      let endFrameUrl = null
      if (activeEndFrame?.file) {
        const ext  = (activeEndFrame.file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, activeEndFrame.file, { upsert: false, cacheControl: '3600', contentType: activeEndFrame.file.type })
        if (upErr) throw new Error('End frame upload failed')
        const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)
        endFrameUrl = publicUrl
      }

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        type,
        status:                 'pending',
        prompt,
        model,
        aspect_ratio:           aspectRatio,
        duration,
        credits_charged:        creditCost,
        output_type:            'video',
        start_frame_url:        startFrameUrl,
        end_frame_url:          endFrameUrl,
        with_sound:             withSound,
        skip_prompt_refinement: skipRefinement,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

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
      try {
        sessionStorage.removeItem(SS_PROMPT)
        sessionStorage.removeItem(SS_START_FRAME)
        sessionStorage.removeItem(SS_END_FRAME)
      } catch { /* noop */ }

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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{
              backdropFilter:       'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              background:           'rgba(0,0,0,0.4)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>
              Generating…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header — violet left accent bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{
          borderBottom: '1px solid var(--border-color)',
          borderLeft:   `3px solid ${ACCENT}`,
        }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Video</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>{modeLabel}</span>
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
                onChange={handleFrameUpload(setStartFrame, SS_START_FRAME)}
                onRemove={() => handleRemoveFrame(setStartFrame, SS_START_FRAME, true)}
                disabled={!caps.supportsStartFrame && !startFrame}
                inactive={!!startFrame && !caps.supportsStartFrame}
              />
              <FrameUpload
                label="End Frame"
                value={endFrame}
                onChange={handleFrameUpload(setEndFrame, SS_END_FRAME)}
                onRemove={() => handleRemoveFrame(setEndFrame, SS_END_FRAME, false)}
                disabled={!(caps.supportsEndFrame || caps.supportsFrameToFrame) && !endFrame}
                inactive={!!endFrame && !(caps.supportsEndFrame || caps.supportsFrameToFrame)}
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
              options={ALL_ASPECT_RATIOS.map((o) => ({
                ...o,
                disabled: !caps.supportedAspectRatios.includes(o.value),
              }))}
              value={aspectRatio}
              onChange={(v) => { setAspectRatio(v); setAutoRatio(false) }}
            />
            <SettingChips
              label="Duration"
              options={caps.supportedDurations.map((d) => ({
                label:    `${d}s`,
                value:    d,
                disabled: false,
              }))}
              value={duration}
              onChange={(v) => setDuration(v)}
            />
            {caps.supportsSound && (
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
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={handleGenerate}
            disabled={submitting || !canAfford || promptEmpty || !selectedModel}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: (submitting || !canAfford || promptEmpty || !selectedModel)
                ? 'var(--bg-elevated)' : ACCENT,
              color: (submitting || !canAfford || promptEmpty || !selectedModel)
                ? 'var(--text-muted)' : '#ffffff',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {submitting ? 'Generating…' : `Generate · ${creditCost} cr`}
          </button>
          {!canAfford && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                Top up
              </button>
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
