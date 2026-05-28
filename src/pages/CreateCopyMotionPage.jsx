// src/pages/CreateCopyMotionPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, Upload, Film, Image as ImageIcon, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── SessionStorage keys ──────────────────────────────────────────────────────
const SS_PROMPT       = 'meckury_copymotion_prompt'
const SS_SUBJECT_IMG  = 'meckury_copymotion_subject'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(secs) {
  if (!secs && secs !== 0) return '—'
  const s = Math.round(Number(secs))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

function detectAspectRatio(width, height) {
  const r = width / height
  if (r > 1.6)  return '16:9'
  if (r < 0.75) return '9:16'
  return '1:1'
}

// Persist file → sessionStorage as base64
const persistFile = (key, file) => {
  if (!file) { try { sessionStorage.removeItem(key) } catch { /* noop */ }; return }
  try {
    const reader = new FileReader()
    reader.onload = (ev) => {
      sessionStorage.setItem(key, JSON.stringify({ base64: ev.target.result, name: file.name, type: file.type }))
    }
    reader.readAsDataURL(file)
  } catch { /* noop */ }
}

const restoreFile = (key) => new Promise((resolve) => {
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

// Extract duration from a video file
const getVideoDuration = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file)
  const vid = document.createElement('video')
  vid.preload = 'metadata'
  vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(vid.duration)) }
  vid.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
  vid.src = url
})

// ─── Sub-components ───────────────────────────────────────────────────────────
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
              className="absolute right-0 top-9 z-50 w-60 rounded-2xl overflow-hidden"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)', maxHeight: '60vh', overflowY: 'auto' }}
            >
              <div className="py-1">
                {unlocked.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { onChange(m.value); setOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                    style={{ background: m.value === value ? 'var(--bg-elevated)' : 'transparent' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.sublabel}</p>
                    </div>
                    {m.value === value && <span style={{ color: 'var(--brand)', fontSize: 14 }}>✓</span>}
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
            background: value === opt.value ? 'var(--text-primary)' : 'var(--bg-elevated)',
            color:      value === opt.value ? 'var(--text-inverse)' : 'var(--text-secondary)',
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

// ── Video upload zone ─────────────────────────────────────────────────────────
const VideoUpload = ({ value, onChange, onRemove }) => {
  const inputRef = useRef(null)

  if (value) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9', background: 'var(--bg-elevated)' }}>
        <video
          src={value.url}
          className="w-full h-full object-cover"
          muted
          loop
          autoPlay
          playsInline
        />
        {/* Duration badge */}
        {value.duration != null && (
          <div
            className="absolute bottom-2 left-2 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
          >
            {formatDuration(value.duration)}
          </div>
        )}
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <label
      className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
      style={{ aspectRatio: '16/9', border: '1.5px dashed var(--border-color)', background: 'var(--bg-card)' }}
    >
      <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={onChange} />
      <Film size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upload motion video</span>
      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>MP4, MOV, WEBM · used as motion reference</span>
    </label>
  )
}

// ── Image upload zone ─────────────────────────────────────────────────────────
const SubjectUpload = ({ value, onChange, onRemove }) => {
  if (value) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}>
        <img src={value.url} alt="Subject" className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <label
      className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
      style={{ aspectRatio: '1/1', border: '1.5px dashed var(--border-color)', background: 'var(--bg-card)' }}
    >
      <input type="file" accept="image/*" className="hidden" onChange={onChange} />
      <ImageIcon size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upload subject</span>
      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>The image that will move</span>
    </label>
  )
}

// ── No-models empty state ─────────────────────────────────────────────────────
const NoModelsState = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 gap-4 text-center"
  >
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center"
      style={{ background: 'var(--bg-elevated)' }}
    >
      <AlertCircle size={26} style={{ color: 'var(--text-muted)' }} />
    </div>
    <div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No models available yet</p>
      <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
        Copy Motion models are being set up. Check back soon — this feature is coming!
      </p>
    </div>
  </motion.div>
)

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CreateCopyMotionPage() {
  const navigate                                    = useNavigate()
  const { user, profile, credits, refreshProfile }  = useAuth()

  // uploads
  const [motionVideo,    setMotionVideo]    = useState(null)   // { file, url, duration }
  const [subjectImage,   setSubjectImage]   = useState(null)   // { file, url }

  // settings
  const [prompt,         setPrompt]         = useState('')
  const [aspectRatio,    setAspectRatio]    = useState('9:16')
  const [withSound,      setWithSound]      = useState(false)
  const [model,          setModel]          = useState('')
  const [models,         setModels]         = useState([])
  const [modelsLoading,  setModelsLoading]  = useState(true)
  const [submitting,     setSubmitting]     = useState(false)

  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)

  // ── Restore persisted state ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const p = sessionStorage.getItem(SS_PROMPT)
      if (p) setPrompt(p)
    } catch { /* noop */ }

    restoreFile(SS_SUBJECT_IMG).then((f) => { if (f) setSubjectImage(f) })
  }, [])

  // ── Persist prompt ───────────────────────────────────────────────────────
  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(SS_PROMPT, prompt)
      else        sessionStorage.removeItem(SS_PROMPT)
    } catch { /* noop */ }
  }, [prompt])

  // ── Load models — only active motion_transfer models ────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'video')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .eq('feature', 'motion_transfer')
      .order('sort_order')
    const list = data || []
    setModels(list)
    const firstUnlocked = list.find((m) => !m.is_locked)
    setModel(firstUnlocked?.value || '')
    setModelsLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  // ── Selected model helpers ───────────────────────────────────────────────
  const selectedModel = models.find((m) => m.value === model)

  const supportedAspectRatios = selectedModel?.supported_aspect_ratios ?? ['9:16', '16:9', '1:1']
  const supportsSound         = selectedModel?.supports_sound ?? false

  useEffect(() => {
    if (!supportsSound) setWithSound(false)
  }, [supportsSound])

  useEffect(() => {
    if (selectedModel && !supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(supportedAspectRatios[0] ?? '9:16')
    }
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Credit cost ──────────────────────────────────────────────────────────
  // Motion transfer is always image-to-video style, so use credit_cost_i2i.
  // Duration multiplier mirrors CreateVideoPage logic, based on detected video duration.
  const detectedDuration = motionVideo?.duration ?? null

  const durationMultiplier = (() => {
    if (!detectedDuration) return 1
    if (detectedDuration <= 5)  return 1
    if (detectedDuration <= 8)  return 1.6
    if (detectedDuration <= 10) return 2
    if (detectedDuration <= 12) return 2.4
    if (detectedDuration <= 15) return 3
    if (detectedDuration <= 16) return 3.2
    return Math.ceil(detectedDuration / 5)
  })()

  const baseCredits   = selectedModel?.credit_cost_i2i ?? 0
  const baseWithDur   = baseCredits * durationMultiplier
  const creditCost    = withSound && supportsSound
    ? Math.ceil(baseWithDur * (selectedModel?.sound_cost_multiplier ?? 1.5))
    : Math.ceil(baseWithDur)

  const canAfford    = credits >= creditCost
  const hasVideo     = !!motionVideo
  const hasSubject   = !!subjectImage
  const canGenerate  = hasVideo && hasSubject && canAfford && !!selectedModel && !submitting

  // ── Upload handlers ──────────────────────────────────────────────────────
  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url      = URL.createObjectURL(file)
    const duration = await getVideoDuration(file)
    setMotionVideo({ file, url, duration })
    // auto-detect aspect ratio from first frame via video element
    const vid = document.createElement('video')
    vid.preload = 'metadata'
    vid.onloadedmetadata = () => {
      if (vid.videoWidth && vid.videoHeight) {
        setAspectRatio(detectAspectRatio(vid.videoWidth, vid.videoHeight))
      }
      URL.revokeObjectURL(vid.src)
    }
    vid.src = URL.createObjectURL(file)
  }

  const handleSubjectUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setSubjectImage({ file, url })
    persistFile(SS_SUBJECT_IMG, file)
  }

  const handleRemoveVideo = () => {
    if (motionVideo?.url) URL.revokeObjectURL(motionVideo.url)
    setMotionVideo(null)
  }

  const handleRemoveSubject = () => {
    if (subjectImage?.url) URL.revokeObjectURL(subjectImage.url)
    setSubjectImage(null)
    try { sessionStorage.removeItem(SS_SUBJECT_IMG) } catch { /* noop */ }
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!hasVideo)       return toast.error('Upload a motion reference video')
    if (!hasSubject)     return toast.error('Upload a subject image')
    if (!selectedModel)  return toast.error('Pick a model')
    if (!canAfford)      return toast.error('Not enough credits')
    if (!user)           return toast.error('Please sign in')

    setSubmitting(true)
    try {
      // Upload motion video
      const vidExt  = (motionVideo.file.name.split('.').pop() || 'mp4').toLowerCase()
      const vidPath = `${user.id}/${crypto.randomUUID()}.${vidExt}`
      const { error: vidErr } = await supabase.storage
        .from('generation-uploads')
        .upload(vidPath, motionVideo.file, { upsert: false, cacheControl: '3600', contentType: motionVideo.file.type })
      if (vidErr) throw new Error('Video upload failed')
      const { data: { publicUrl: motionVideoUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(vidPath)

      // Upload subject image
      const imgExt  = (subjectImage.file.name.split('.').pop() || 'jpg').toLowerCase()
      const imgPath = `${user.id}/${crypto.randomUUID()}.${imgExt}`
      const { error: imgErr } = await supabase.storage
        .from('generation-uploads')
        .upload(imgPath, subjectImage.file, { upsert: false, cacheControl: '3600', contentType: subjectImage.file.type })
      if (imgErr) throw new Error('Image upload failed')
      const { data: { publicUrl: subjectImageUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(imgPath)

      // Create generation row
      // generation_type = 'motion_transfer'; start_frame_url = subject image;
      // input_image_urls[0] = motion video url (reuse existing column)
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        'motion_transfer',
        status:                 'pending',
        prompt:                 prompt || null,
        model,
        aspect_ratio:           aspectRatio,
        duration:               String(detectedDuration ?? 5),
        credits_charged:        creditCost,
        output_type:            'video',
        start_frame_url:        subjectImageUrl,
        input_image_urls:       [motionVideoUrl],   // [0] = motion reference video
        with_sound:             withSound,
        skip_prompt_refinement: skipRefinement,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // Invoke edge function
      supabase.functions.invoke('video-generate', { body: { generationId: genRow.id } })
        .catch((e) => console.error('video-generate invoke error', e))

      refreshProfile()
      toast.success('Copy Motion is being generated. Check your Media page.', { duration: 4000 })

      // Reset state
      handleRemoveVideo()
      handleRemoveSubject()
      setPrompt('')
      setWithSound(false)
      try {
        sessionStorage.removeItem(SS_PROMPT)
        sessionStorage.removeItem(SS_SUBJECT_IMG)
      } catch { /* noop */ }

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
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
              style={{ borderColor: 'rgba(255,255,255,0.15)', borderTopColor: '#ffffff' }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Generating…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Copy Motion</h1>
          <span className="text-xs" style={{ color: 'var(--brand)' }}>Motion Transfer</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && models.length > 0 && (
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

          {modelsLoading ? (
            // Loading skeleton
            <div className="flex flex-col gap-4">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-full rounded-2xl animate-pulse"
                  style={{ height: i === 0 ? 180 : 80, background: 'var(--bg-elevated)' }}
                />
              ))}
            </div>
          ) : models.length === 0 ? (
            <NoModelsState />
          ) : (
            <>
              {/* ── Explainer ── */}
              <div
                className="rounded-2xl px-4 py-3 flex gap-3 items-start"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
              >
                <Film size={16} style={{ color: 'var(--brand)', marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Upload a <strong style={{ color: 'var(--text-primary)' }}>motion reference video</strong> and a{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>subject image</strong>. The AI will apply the
                  video's motion to your image — camera moves, dance, gestures, etc.
                </p>
              </div>

              {/* ── Uploads ── */}
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Motion Reference Video
                  </p>
                  <VideoUpload
                    value={motionVideo}
                    onChange={handleVideoUpload}
                    onRemove={handleRemoveVideo}
                  />
                  {motionVideo?.duration != null && (
                    <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                      Detected duration:{' '}
                      <strong style={{ color: 'var(--text-primary)' }}>{formatDuration(motionVideo.duration)}</strong>
                      {' '}· credit cost adjusted accordingly
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Subject Image
                  </p>
                  <SubjectUpload
                    value={subjectImage}
                    onChange={handleSubjectUpload}
                    onRemove={handleRemoveSubject}
                  />
                </div>
              </div>

              {/* ── Optional prompt ── */}
              <div>
                <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Prompt <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— optional</span>
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe any extra details about the scene or motion…"
                  rows={3}
                  maxLength={500}
                  className="w-full rounded-2xl px-4 py-3 text-sm resize-none outline-none transition-all"
                  style={{
                    background:  'var(--bg-card)',
                    border:      '1px solid var(--border-color)',
                    color:       'var(--text-primary)',
                    lineHeight:  1.6,
                  }}
                />
              </div>

              {/* ── Settings ── */}
              <div>
                <SettingChips
                  label="Aspect Ratio"
                  options={['9:16', '16:9', '1:1'].map((v) => ({
                    label:    v,
                    value:    v,
                    disabled: !supportedAspectRatios.includes(v),
                  }))}
                  value={aspectRatio}
                  onChange={setAspectRatio}
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
            </>
          )}

        </div>
      </div>

      {/* Generate button — only show when models exist */}
      {models.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{
                background: 'var(--text-primary)',
                color:      'var(--text-inverse)',
                opacity:    canGenerate ? 1 : 0.5,
                cursor:     canGenerate ? 'pointer' : 'not-allowed',
              }}
            >
              <Zap size={15} fill="currentColor" />
              {submitting
                ? 'Generating…'
                : detectedDuration != null
                  ? `Generate · ${creditCost} cr · ${formatDuration(detectedDuration)}`
                  : `Generate · ${creditCost} cr`}
            </button>

            {/* Hint messages */}
            {!hasVideo && !hasSubject && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Upload both a motion video and a subject image to continue
              </p>
            )}
            {(hasVideo || hasSubject) && (!hasVideo || !hasSubject) && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                {!hasVideo ? 'Still need a motion reference video' : 'Still need a subject image'}
              </p>
            )}
            {hasVideo && hasSubject && !canAfford && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Not enough credits.{' '}
                <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: 'var(--text-primary)' }}>
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
