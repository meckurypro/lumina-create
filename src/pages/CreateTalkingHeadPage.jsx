import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus, VideoIcon, Mic, FileText, Users, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-talking-head)'
const ACCENT_SUB = 'var(--tool-talking-head-subtle)'
const ACCENT_BDR = 'var(--tool-talking-head-border)'

const SS_PROMPT       = 'meckury_th_prompt'
const SS_SUBJECT_IMG  = 'meckury_th_subject_img'
const SS_SUBJECT_VID  = 'meckury_th_subject_vid'
const SS_AUDIO_1      = 'meckury_th_audio_1'
const SS_AUDIO_2      = 'meckury_th_audio_2'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

// ─── caps helper ─────────────────────────────────────────────────────────────
function getModelCaps(model) {
  if (!model) return {
    faceInput:             true,
    videoInput:            false,
    textScript:            false,
    multiChar:             false,
    maxRefImages:          1,
    supportedDurations:    ['5', '10'],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    supportsSound:         false,
    isFlatRate:            false,
  }
  return {
    faceInput:             model.supports_start_frame    ?? true,
    videoInput:            model.supports_video_input    ?? false,
    textScript:            model.supports_text_script    ?? false,
    multiChar:             model.supports_multi_image    ?? false,
    maxRefImages:          model.max_ref_images          ?? 1,
    supportedDurations:    model.supported_durations     ?? ['5', '10'],
    supportedAspectRatios: model.supported_aspect_ratios ?? ['9:16', '16:9', '1:1'],
    supportsSound:         model.supports_sound          ?? false,
    isFlatRate:            model.is_flat_rate            ?? false,
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function detectAspectRatio(w, h) {
  const r = w / h
  if (r > 1.6)  return '16:9'
  if (r < 0.75) return '9:16'
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

const persistFile = (key, file) => {
  if (!file) { try { sessionStorage.removeItem(key) } catch {} ; return }
  try {
    const reader = new FileReader()
    reader.onload = (ev) =>
      sessionStorage.setItem(key, JSON.stringify({ base64: ev.target.result, name: file.name, type: file.type }))
    reader.readAsDataURL(file)
  } catch {}
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

// ─── sub-components ───────────────────────────────────────────────────────────

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
            background: value === opt.value ? ACCENT       : 'var(--bg-elevated)',
            color:      value === opt.value ? '#ffffff'    : 'var(--text-secondary)',
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
              className="absolute right-0 top-9 z-50 w-60 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}
            >
              <div className="py-1">
                {unlocked.map((m) => {
                  const caps = getModelCaps(m)
                  const tags = [
                    caps.faceInput  && 'Face',
                    caps.videoInput && 'Video',
                    caps.multiChar  && '2-char',
                    caps.textScript && 'Text→Speech',
                  ].filter(Boolean)
                  return (
                    <button
                      key={m.value}
                      onClick={() => { onChange(m.value); setOpen(false) }}
                      className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                      style={{ background: m.value === value ? ACCENT_SUB : 'transparent' }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.aka || m.label}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.sublabel}</p>
                        {tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {tags.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-md text-xs font-semibold"
                                style={{ background: ACCENT_SUB, color: ACCENT, fontSize: 10 }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {m.value === value && <span style={{ color: ACCENT, fontSize: 14, flexShrink: 0, marginLeft: 8 }}>✓</span>}
                    </button>
                  )
                })}
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

// ─── Subject slot ─────────────────────────────────────────────────────────────

const SubjectSlot = ({ mode, faceImage, videoFile, onFaceUpload, onVideoUpload, onFaceRemove, onVideoRemove }) => {
  if (mode === 'face') {
    return faceImage ? (
      <div className="relative flex justify-center">
        <div className="relative w-full max-w-[200px]">
          <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}>
            <img src={faceImage.url} alt="Subject" className="w-full h-full object-cover" />
          </div>
          <button onClick={onFaceRemove}
            className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center z-10"
            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}>
            <X size={13} />
          </button>
        </div>
      </div>
    ) : (
      <div className="flex justify-center">
        <label className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all w-full max-w-[200px]"
          style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
          <input type="file" accept="image/*" className="hidden" onChange={onFaceUpload} />
          <ImagePlus size={24} style={{ color: ACCENT, marginBottom: 8 }} />
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload face photo</span>
          <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Clear, front-facing</span>
        </label>
      </div>
    )
  }

  return videoFile ? (
    <div className="relative">
      <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}` }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ACCENT_SUB }}>
          <VideoIcon size={18} style={{ color: ACCENT }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{videoFile.name}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Video subject ready</p>
        </div>
        <button onClick={onVideoRemove} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
          <X size={13} />
        </button>
      </div>
    </div>
  ) : (
    <label className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all"
      style={{ minHeight: 120, border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
      <input type="file" accept="video/*" className="hidden" onChange={onVideoUpload} />
      <VideoIcon size={24} style={{ color: ACCENT, marginBottom: 8 }} />
      <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload subject video</span>
      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>The video will be re-animated</span>
    </label>
  )
}

// ─── Audio slot ───────────────────────────────────────────────────────────────

const AudioSlot = ({ label, audioFile, script, audioMode, onAudioUpload, onAudioRemove, onScriptChange, supportsTextScript, charIndex }) => {
  const charLabel = charIndex !== undefined ? ` · Character ${charIndex + 1}` : ''
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}{charLabel}
      </p>

      {supportsTextScript && (
        <div className="flex gap-1 p-1 rounded-xl self-start" style={{ background: 'var(--bg-elevated)' }}>
          {[
            { value: 'upload', label: 'Audio file', icon: Mic      },
            { value: 'text',   label: 'Script',     icon: FileText },
          ].map(({ value, label: lbl, icon: Icon }) => (
            <button
              key={value}
              onClick={() => onScriptChange(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: audioMode === value ? ACCENT    : 'transparent',
                color:      audioMode === value ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              <Icon size={11} />
              {lbl}
            </button>
          ))}
        </div>
      )}

      {audioMode === 'upload' && (
        audioFile ? (
          <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}` }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ACCENT_SUB }}>
              <Mic size={15} style={{ color: ACCENT }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{audioFile.name}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Audio ready</p>
            </div>
            <button onClick={onAudioRemove} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all"
            style={{ minHeight: 88, border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
            <input type="file" accept="audio/*" className="hidden" onChange={onAudioUpload} />
            <Mic size={20} style={{ color: ACCENT, marginBottom: 6 }} />
            <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload audio / voiceover</span>
            <span className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>MP3, WAV, M4A…</span>
          </label>
        )
      )}

      {audioMode === 'text' && (
        <textarea
          value={script}
          onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Type the script this character will speak…"
          rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm resize-none outline-none transition-all"
          style={{
            background:  'var(--bg-elevated)',
            border:      `1px solid ${ACCENT_BDR}`,
            color:       'var(--text-primary)',
            fontFamily:  'inherit',
            lineHeight:  1.6,
          }}
        />
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function CreateTalkingHeadPage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [model,         setModel]         = useState('')

  // subject
  const [subjectMode,  setSubjectMode]  = useState('face')
  const [faceImage,    setFaceImage]    = useState(null)
  const [videoFile,    setVideoFile]    = useState(null)

  // audio
  const [audioMode1,   setAudioMode1]  = useState('upload')
  const [audioMode2,   setAudioMode2]  = useState('upload')
  const [audioFile1,   setAudioFile1]  = useState(null)
  const [audioFile2,   setAudioFile2]  = useState(null)
  const [script1,      setScript1]     = useState('')
  const [script2,      setScript2]     = useState('')

  // settings
  const [prompt,       setPrompt]      = useState('')
  const [aspectRatio,  setAspectRatio] = useState('9:16')
  const [autoRatio,    setAutoRatio]   = useState(false)
  const [duration,     setDuration]    = useState('5')

  const [submitting,   setSubmitting]  = useState(false)

  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)

  // ── session restore ────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const p = sessionStorage.getItem(SS_PROMPT)
      if (p) setPrompt(p)
    } catch {}
    restoreFile(SS_SUBJECT_IMG).then((f) => {
      if (!f) return
      setFaceImage(f)
      const img = new Image()
      img.onload = () => { setAspectRatio(detectAspectRatio(img.width, img.height)); setAutoRatio(true) }
      img.src = f.url
    })
    restoreFile(SS_SUBJECT_VID).then((f) => { if (f) setVideoFile(f) })
    restoreFile(SS_AUDIO_1).then((f)     => { if (f) setAudioFile1(f) })
    restoreFile(SS_AUDIO_2).then((f)     => { if (f) setAudioFile2(f) })
  }, [])

  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(SS_PROMPT, prompt)
      else        sessionStorage.removeItem(SS_PROMPT)
    } catch {}
  }, [prompt])

  // ── load models ────────────────────────────────────────────────────────────
  // Mirrors the exact same query pattern as CreateImagePage — filter by
  // feature = 'lipsync' (not type, since lipsync models have type = 'video').
  // Make sure rows have is_active = true in the DB; the migration inserts
  // them as false — run: UPDATE models SET is_active = true WHERE feature = 'lipsync'
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('feature', 'lipsync')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const list = data || []
    setModels(list)
    const first = list.find((m) => !m.is_locked)
    setModel(first?.value || '')
    setModelsLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  // ── derive caps from selected model ───────────────────────────────────────
  const selectedModel = models.find((m) => m.value === model)
  const caps          = getModelCaps(selectedModel)

  // ── reset inputs on model change if now-unsupported ───────────────────────
  useEffect(() => {
    if (!selectedModel) return

    if (!caps.faceInput && caps.videoInput)  setSubjectMode('video')
    if (caps.faceInput  && !caps.videoInput) setSubjectMode('face')

    if (!caps.textScript) {
      setAudioMode1('upload')
      setAudioMode2('upload')
    }

    if (!caps.multiChar) {
      setAudioFile2(null)
      setScript2('')
      try { sessionStorage.removeItem(SS_AUDIO_2) } catch {}
    }

    if (!caps.supportedDurations.includes(duration)) {
      setDuration(caps.supportedDurations[0] || '5')
    }

    if (!autoRatio && !caps.supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(caps.supportedAspectRatios[0] || '9:16')
    }
  }, [model]) // eslint-disable-line

  // ── credit cost ────────────────────────────────────────────────────────────
  const creditCost = (() => {
    if (!selectedModel) return 0
    const base = selectedModel.credit_cost_i2i || selectedModel.credit_cost_t2i || 0
    if (caps.isFlatRate) return base
    return Math.ceil(base * parseInt(duration || '5'))
  })()

  const canAfford = credits >= creditCost

  // ── readiness checks ──────────────────────────────────────────────────────
  const hasSubject = subjectMode === 'face' ? !!faceImage : !!videoFile
  const hasAudio1  = audioMode1 === 'upload' ? !!audioFile1 : script1.trim().length > 0
  const hasAudio2  = caps.multiChar
    ? (audioMode2 === 'upload' ? !!audioFile2 : script2.trim().length > 0)
    : true

  const subjectRequired = caps.faceInput || caps.videoInput
  const subjectOk       = !subjectRequired || hasSubject

  const buttonDisabled = submitting || !canAfford || !hasAudio1 || !hasAudio2 || !subjectOk || !selectedModel

  // ── mode label for header ──────────────────────────────────────────────────
  const modeLabel = (() => {
    if (caps.multiChar)                                     return 'Multi-Character Sync'
    if (caps.videoInput && subjectMode === 'video')         return 'Video Lip Sync'
    if (caps.faceInput  && subjectMode === 'face')          return 'Talking Avatar'
    return 'Talking Head'
  })()

  // ── upload handlers ────────────────────────────────────────────────────────
  const handleFaceUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setFaceImage(compressed)
    persistFile(SS_SUBJECT_IMG, compressed.file)
    setAspectRatio(compressed.ar)
    setAutoRatio(true)
  }

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile({ file, name: file.name, url: URL.createObjectURL(file) })
    persistFile(SS_SUBJECT_VID, file)
  }

  const handleAudioUpload = (slot) => (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (slot === 1) { setAudioFile1({ file, name: file.name }); persistFile(SS_AUDIO_1, file) }
    else            { setAudioFile2({ file, name: file.name }); persistFile(SS_AUDIO_2, file) }
  }

  const clearAll = () => {
    setFaceImage(null); setVideoFile(null)
    setAudioFile1(null); setAudioFile2(null)
    setScript1(''); setScript2('')
    setAutoRatio(false); setAspectRatio('9:16')
    setPrompt('')
    try {
      [SS_PROMPT, SS_SUBJECT_IMG, SS_SUBJECT_VID, SS_AUDIO_1, SS_AUDIO_2]
        .forEach((k) => sessionStorage.removeItem(k))
    } catch {}
  }

  // ── upload to storage ──────────────────────────────────────────────────────
  const uploadToStorage = async (file, bucket = 'generation-uploads') => {
    const ext  = (file.name.split('.').pop() || 'bin').toLowerCase()
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return publicUrl
  }

  // ── generate ───────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedModel) return toast.error('Pick a model')
    if (!hasAudio1)     return toast.error('Add audio or script for character 1')
    if (!hasAudio2)     return toast.error('Add audio or script for character 2')
    if (!subjectOk)     return toast.error(subjectMode === 'face' ? 'Upload a face photo' : 'Upload a subject video')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      let startFrameUrl   = null
      let subjectVideoUrl = null

      if (subjectMode === 'face'  && faceImage?.file)  startFrameUrl   = await uploadToStorage(faceImage.file)
      if (subjectMode === 'video' && videoFile?.file)   subjectVideoUrl = await uploadToStorage(videoFile.file)

      let audio1Url = null
      let audio2Url = null

      if (audioMode1 === 'upload' && audioFile1?.file)               audio1Url = await uploadToStorage(audioFile1.file)
      if (caps.multiChar && audioMode2 === 'upload' && audioFile2?.file) audio2Url = await uploadToStorage(audioFile2.file)

      const inputImageUrls = [subjectVideoUrl, audio1Url, audio2Url].filter(Boolean)

      const metadata = {
        lipsync:           true,
        subject_mode:      subjectMode,
        audio_mode_1:      audioMode1,
        audio_mode_2:      audioMode2,
        script_1:          audioMode1 === 'text' ? script1 : null,
        script_2:          audioMode2 === 'text' && caps.multiChar ? script2 : null,
        multi_char:        caps.multiChar,
        audio_1_url:       audio1Url,
        audio_2_url:       audio2Url,
        subject_video_url: subjectVideoUrl,
      }

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        'lipsync',
        status:                 'pending',
        prompt:                 prompt || null,
        model,
        aspect_ratio:           aspectRatio,
        duration,
        credits_charged:        creditCost,
        output_type:            'video',
        start_frame_url:        startFrameUrl,
        end_frame_url:          null,
        input_image_urls:       inputImageUrls.length ? inputImageUrls : null,
        with_sound:             true,
        skip_prompt_refinement: skipRefinement,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      supabase.functions.invoke('talking-head-generate', { body: { generationId: genRow.id, meta: metadata } })
        .catch((e) => console.error('talking-head-generate invoke error', e))

      refreshProfile()
      toast.success('Your talking head video is being generated. Check your Media page.', { duration: 4000 })
      clearAll()

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      console.error('TalkingHead generate error:', err)
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Generating…</p>
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
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Talking Head</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>{modeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && models.length > 0 && (
            <ModelDropdown models={models} value={model} onChange={setModel} />
          )}
          {!modelsLoading && models.length === 0 && (
            <span className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              No models
            </span>
          )}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* ── Subject section ── */}
          {(caps.faceInput || caps.videoInput) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Subject
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — required</span>
                </p>

                {caps.faceInput && caps.videoInput && (
                  <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    {[
                      { value: 'face',  label: 'Photo', icon: User      },
                      { value: 'video', label: 'Video', icon: VideoIcon },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setSubjectMode(value)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: subjectMode === value ? ACCENT    : 'transparent',
                          color:      subjectMode === value ? '#ffffff' : 'var(--text-muted)',
                        }}
                      >
                        <Icon size={11} />
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <SubjectSlot
                mode={subjectMode}
                faceImage={faceImage}
                videoFile={videoFile}
                onFaceUpload={handleFaceUpload}
                onVideoUpload={handleVideoUpload}
                onFaceRemove={() => {
                  setFaceImage(null)
                  setAutoRatio(false)
                  setAspectRatio('9:16')
                  try { sessionStorage.removeItem(SS_SUBJECT_IMG) } catch {}
                }}
                onVideoRemove={() => {
                  setVideoFile(null)
                  try { sessionStorage.removeItem(SS_SUBJECT_VID) } catch {}
                }}
              />
            </div>
          )}

          {/* ── Audio section ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {caps.multiChar ? 'Audio Tracks' : 'Audio'}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — required</span>
              </p>
              {caps.multiChar && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold"
                  style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                  <Users size={11} />
                  2 characters
                </div>
              )}
            </div>

            <AudioSlot
              label="Audio"
              audioFile={audioFile1}
              script={audioMode1 === 'text' ? script1 : ''}
              audioMode={audioMode1}
              onAudioUpload={handleAudioUpload(1)}
              onAudioRemove={() => { setAudioFile1(null); try { sessionStorage.removeItem(SS_AUDIO_1) } catch {} }}
              onScriptChange={(val) => {
                if (val === 'upload' || val === 'text') setAudioMode1(val)
                else setScript1(val)
              }}
              supportsTextScript={caps.textScript}
              charIndex={caps.multiChar ? 0 : undefined}
            />

            {caps.multiChar && (
              <AudioSlot
                label="Audio"
                audioFile={audioFile2}
                script={audioMode2 === 'text' ? script2 : ''}
                audioMode={audioMode2}
                onAudioUpload={handleAudioUpload(2)}
                onAudioRemove={() => { setAudioFile2(null); try { sessionStorage.removeItem(SS_AUDIO_2) } catch {} }}
                onScriptChange={(val) => {
                  if (val === 'upload' || val === 'text') setAudioMode2(val)
                  else setScript2(val)
                }}
                supportsTextScript={caps.textScript}
                charIndex={1}
              />
            )}
          </div>

          {/* ── Prompt (optional) ── */}
          <Textarea
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional: describe pose, expression, background scene…"
            rows={3}
          />

          {/* ── Settings ── */}
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

            {caps.supportedDurations?.length > 1 && (
              <SettingChips
                label="Duration"
                options={caps.supportedDurations.map((d) => ({ label: `${d}s`, value: d }))}
                value={duration}
                onChange={setDuration}
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
            disabled={buttonDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: buttonDisabled ? 'var(--bg-elevated)' : ACCENT,
              color:      buttonDisabled ? 'var(--text-muted)'  : '#ffffff',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {submitting
              ? 'Generating…'
              : !canAfford
                ? 'Not enough credits'
                : `Generate · ${creditCost} cr`}
          </button>
          {!canAfford && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>Top up</button>
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
