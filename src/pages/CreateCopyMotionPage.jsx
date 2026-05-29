import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, Film, Image as ImageIcon, AlertCircle, RefreshCw, Scissors, Play, Pause } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'

// Tool accent
const ACCENT     = 'var(--tool-motion)'
const ACCENT_SUB = 'var(--tool-motion-subtle)'
const ACCENT_BDR = 'var(--tool-motion-border)'

const SS_SUBJECT_IMG = 'meckury_copymotion_subject'
const SS_VIDEO_META  = 'meckury_copymotion_video_meta'

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

const persistImage = (key, file) => {
  if (!file) { try { sessionStorage.removeItem(key) } catch { /* noop */ }; return }
  try {
    const reader = new FileReader()
    reader.onload = (ev) => {
      sessionStorage.setItem(key, JSON.stringify({ base64: ev.target.result, name: file.name, type: file.type }))
    }
    reader.readAsDataURL(file)
  } catch { /* noop */ }
}

const restoreImage = (key) => new Promise((resolve) => {
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

const persistVideoMeta = (name, duration, aspectRatio) => {
  try { sessionStorage.setItem(SS_VIDEO_META, JSON.stringify({ name, duration, aspectRatio })) } catch { /* noop */ }
}

const restoreVideoMeta = () => {
  try { const saved = sessionStorage.getItem(SS_VIDEO_META); return saved ? JSON.parse(saved) : null } catch { return null }
}

const getVideoDuration = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file)
  const vid = document.createElement('video')
  vid.preload = 'metadata'
  vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(vid.duration)) }
  vid.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
  vid.src = url
})

// ── In-browser video trimmer using MediaRecorder ──────────
const trimVideoInBrowser = (sourceFile, startSec, endSec) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(sourceFile)
    const video = document.createElement('video')
    video.src = url
    video.muted = true
    video.preload = 'auto'

    const mimeType = (() => {
      const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
      return candidates.find((m) => MediaRecorder.isTypeSupported(m)) || 'video/webm'
    })()

    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = video.videoWidth  || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')

      const stream = canvas.captureStream(30)
      let recorder
      try {
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 })
      } catch {
        recorder = new MediaRecorder(stream)
      }

      const chunks = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      recorder.onstop = () => {
        URL.revokeObjectURL(url)
        const blob = new Blob(chunks, { type: mimeType })
        const ext  = mimeType.includes('mp4') ? 'mp4' : 'webm'
        const name = sourceFile.name.replace(/\.[^.]+$/, '') + `_trim.${ext}`
        resolve(new File([blob], name, { type: mimeType }))
      }

      let animFrame
      const drawFrame = () => {
        if (video.currentTime >= endSec) {
          cancelAnimationFrame(animFrame)
          recorder.stop()
          return
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        animFrame = requestAnimationFrame(drawFrame)
      }

      video.onseeked = () => {
        recorder.start(100)
        drawFrame()
        video.play().catch(() => {})
      }

      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video seek failed')) }
      video.currentTime = startSec
    }

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load video for trimming')) }
  })

// ── Video Trim Slider ─────────────────────────────────────
const VideoTrimSlider = ({ duration, targetDuration, trimStart, trimEnd, onTrimChange, videoUrl }) => {
  const trackRef      = useRef(null)
  const previewRef    = useRef(null)
  const [playing, setPlaying]         = useState(false)
  const [currentTime, setCurrentTime] = useState(trimStart)
  const [dragging, setDragging]       = useState(null)

  const trimmedDuration = trimEnd - trimStart

  useEffect(() => {
    const vid = previewRef.current
    if (!vid) return
    vid.currentTime = trimStart
    setCurrentTime(trimStart)
    setPlaying(false)
  }, [trimStart, trimEnd])

  useEffect(() => {
    const vid = previewRef.current
    if (!vid) return
    const onTime = () => {
      setCurrentTime(vid.currentTime)
      if (vid.currentTime >= trimEnd) {
        vid.pause()
        vid.currentTime = trimStart
        setPlaying(false)
      }
    }
    vid.addEventListener('timeupdate', onTime)
    return () => vid.removeEventListener('timeupdate', onTime)
  }, [trimStart, trimEnd])

  const togglePlay = () => {
    const vid = previewRef.current
    if (!vid) return
    if (playing) { vid.pause(); setPlaying(false) }
    else {
      if (vid.currentTime >= trimEnd || vid.currentTime < trimStart) vid.currentTime = trimStart
      vid.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const getPosFromEvent = (e) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return ratio * duration
  }

  const onPointerDown = (e, handle) => {
    e.preventDefault()
    setDragging(handle)
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      const pos = getPosFromEvent(e)
      if (dragging === 'start') {
        const newStart = Math.max(0, Math.min(pos, trimEnd - 1))
        // Lock the window size to targetDuration
        const newEnd = Math.min(duration, newStart + targetDuration)
        onTrimChange(Math.round(newStart), Math.round(newEnd))
      } else {
        const newEnd   = Math.min(duration, Math.max(pos, trimStart + 1))
        // Lock the window size to targetDuration
        const newStart = Math.max(0, newEnd - targetDuration)
        onTrimChange(Math.round(newStart), Math.round(newEnd))
      }
    }
    const onUp = () => setDragging(null)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragging, trimStart, trimEnd, duration, targetDuration]) // eslint-disable-line react-hooks/exhaustive-deps

  const startPct    = (trimStart / duration) * 100
  const endPct      = (trimEnd   / duration) * 100
  const playheadPct = (currentTime / duration) * 100

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}`, padding: '12px 14px 14px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Scissors size={13} style={{ color: ACCENT }} />
          <span className="text-xs font-bold" style={{ color: ACCENT }}>Select {targetDuration}s Clip</span>
        </div>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          Video <strong style={{ color: 'var(--text-primary)' }}>{duration}s</strong> · Selected{' '}
          <strong style={{ color: ACCENT }}>{trimStart}s → {trimEnd}s</strong>
        </span>
      </div>

      {/* Mini preview + play */}
      <div className="flex gap-3 mb-3 items-center">
        <div className="relative rounded-xl overflow-hidden flex-shrink-0" style={{ width: 72, height: 72, background: 'var(--bg-elevated)' }}>
          <video
            ref={previewRef}
            src={videoUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: playing ? 'rgba(0,0,0,0.0)' : 'rgba(0,0,0,0.4)' }}
          >
            {playing
              ? <Pause size={16} style={{ color: '#fff', opacity: 0 }} />
              : <Play  size={16} style={{ color: '#fff' }} />}
          </button>
        </div>
        <div className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <p>Your video is <strong style={{ color: 'var(--text-primary)' }}>{duration}s</strong> — drag the handles to choose which <strong style={{ color: ACCENT }}>{targetDuration}s</strong> to use.</p>
          <p className="mt-1">The selection window is locked to <strong style={{ color: ACCENT }}>{targetDuration}s</strong>.</p>
        </div>
      </div>

      {/* Timeline track */}
      <div
        ref={trackRef}
        className="relative select-none"
        style={{ height: 44, cursor: 'default' }}
      >
        {/* Background full bar */}
        <div
          className="absolute inset-y-0 rounded-xl"
          style={{ left: 0, right: 0, background: 'var(--bg-elevated)', top: '30%', bottom: '30%', borderRadius: 6 }}
        />

        {/* Dimmed left region */}
        <div
          className="absolute"
          style={{
            left: 0,
            width: `${startPct}%`,
            top: '30%', bottom: '30%',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: '6px 0 0 6px',
          }}
        />

        {/* Selected region */}
        <div
          className="absolute"
          style={{
            left:   `${startPct}%`,
            width:  `${endPct - startPct}%`,
            top: '20%', bottom: '20%',
            background: ACCENT,
            borderRadius: 4,
            opacity: 0.85,
          }}
        />

        {/* Dimmed right region */}
        <div
          className="absolute"
          style={{
            left: `${endPct}%`,
            right: 0,
            top: '30%', bottom: '30%',
            background: 'rgba(0,0,0,0.35)',
            borderRadius: '0 6px 6px 0',
          }}
        />

        {/* Playhead */}
        <div
          className="absolute"
          style={{
            left: `${playheadPct}%`,
            top: '10%', bottom: '10%',
            width: 2,
            background: '#ffffff',
            borderRadius: 2,
            transform: 'translateX(-50%)',
            opacity: 0.8,
            pointerEvents: 'none',
          }}
        />

        {/* Start handle */}
        <div
          onMouseDown={(e) => onPointerDown(e, 'start')}
          onTouchStart={(e) => onPointerDown(e, 'start')}
          className="absolute flex items-center justify-center"
          style={{
            left: `${startPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 22, height: 36,
            background: ACCENT,
            borderRadius: 6,
            cursor: 'ew-resize',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            zIndex: 10,
            touchAction: 'none',
          }}
        >
          <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
        </div>

        {/* End handle */}
        <div
          onMouseDown={(e) => onPointerDown(e, 'end')}
          onTouchStart={(e) => onPointerDown(e, 'end')}
          className="absolute flex items-center justify-center"
          style={{
            left: `${endPct}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 22, height: 36,
            background: ACCENT,
            borderRadius: 6,
            cursor: 'ew-resize',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            zIndex: 10,
            touchAction: 'none',
          }}
        >
          <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
        </div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between mt-2">
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>0s</span>
        <span className="text-xs font-mono font-bold" style={{ color: ACCENT }}>
          {trimStart}s → {trimEnd}s
        </span>
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{duration}s</span>
      </div>
    </div>
  )
}

// ── Duration Chips (same pattern as CreateVideoPage SettingChips) ──
const DurationChips = ({ durations, value, onChange }) => (
  <div className="mb-5">
    <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
      Duration
    </p>
    <div className="flex gap-2 flex-wrap">
      {durations.map((d) => (
        <button
          key={d}
          onClick={() => onChange(Number(d))}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: value === Number(d) ? ACCENT    : 'var(--bg-elevated)',
            color:      value === Number(d) ? '#ffffff' : 'var(--text-secondary)',
            cursor:     'pointer',
          }}
        >
          {d}s
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
        <span>{selected?.label ?? 'Model'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d={open ? 'M2 7l3-4 3 4' : 'M2 3l3 4 3-4'}
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
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
              className="absolute right-0 top-9 z-50 w-60 rounded-2xl overflow-hidden"
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

const VideoUploadZone = ({ value, ghostMeta, onUpload, onRemove }) => {
  if (value) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}>
        <video src={value.url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
        {value.duration != null && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
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

  if (ghostMeta) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}>
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-3 text-center">
          <RefreshCw size={20} style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Re-upload video</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{ghostMeta.name}</p>
          {ghostMeta.duration != null && (
            <p className="text-xs" style={{ color: ACCENT }}>{formatDuration(ghostMeta.duration)}</p>
          )}
        </div>
        <label className="absolute inset-0 cursor-pointer">
          <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
        </label>
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', zIndex: 10 }}
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <label
      className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
      style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
    >
      <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
      <Film size={24} style={{ color: ACCENT, marginBottom: 8 }} />
      <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload video</span>
      <span className="text-xs mt-1 text-center px-4" style={{ color: 'var(--text-muted)' }}>MP4 · MOV · WEBM</span>
    </label>
  )
}

const ImageUploadZone = ({ value, onUpload, onRemove }) => {
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
      style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
    >
      <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
      <ImageIcon size={24} style={{ color: ACCENT, marginBottom: 8 }} />
      <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload image</span>
      <span className="text-xs mt-1 text-center px-4" style={{ color: 'var(--text-muted)' }}>The image that moves</span>
    </label>
  )
}

const NoModelsState = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 gap-4 text-center"
  >
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
      <AlertCircle size={26} style={{ color: ACCENT }} />
    </div>
    <div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No models available yet</p>
      <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
        Copy Motion models are being set up. Check back soon — this feature is coming!
      </p>
    </div>
  </motion.div>
)

export default function CreateCopyMotionPage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()

  const [motionVideo,    setMotionVideo]    = useState(null)
  const [videoGhostMeta, setVideoGhostMeta] = useState(null)
  const [subjectImage,   setSubjectImage]   = useState(null)
  const [aspectRatio,    setAspectRatio]    = useState('9:16')
  const [withSound,      setWithSound]      = useState(false)
  const [model,          setModel]          = useState('')
  const [models,         setModels]         = useState([])
  const [modelsLoading,  setModelsLoading]  = useState(true)
  const [submitting,     setSubmitting]     = useState(false)
  const [trimming,       setTrimming]       = useState(false)

  // ── Duration selection — driven by model's supported_durations ──
  const [selectedDuration, setSelectedDuration] = useState(null) // number, in seconds

  // ── Trim state — start/end within the video, locked to selectedDuration ──
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd,   setTrimEnd]   = useState(0)

  useEffect(() => {
    restoreImage(SS_SUBJECT_IMG).then((f) => { if (f) setSubjectImage(f) })
    const meta = restoreVideoMeta()
    if (meta) { setVideoGhostMeta(meta); if (meta.aspectRatio) setAspectRatio(meta.aspectRatio) }
  }, [])

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

  const selectedModel         = models.find((m) => m.value === model)
  const supportedAspectRatios = selectedModel?.supported_aspect_ratios ?? ['9:16', '16:9', '1:1']
  const supportsSound         = selectedModel?.supports_sound ?? false

  // All durations this model supports, as numbers, sorted ascending
  const modelDurations = selectedModel?.supported_durations
    ? selectedModel.supported_durations.map(Number).sort((a, b) => a - b)
    : []
  const modelMinDuration = modelDurations[0] ?? 5
  const modelMaxDuration = modelDurations[modelDurations.length - 1] ?? 30

  // ── When model changes: reset selectedDuration to first available ──
  useEffect(() => {
    if (modelDurations.length > 0) {
      setSelectedDuration(modelDurations[0])
    }
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── When selectedDuration or video changes: reset trim window ──
  useEffect(() => {
    if (!selectedDuration || !motionVideo?.duration) return
    setTrimStart(0)
    setTrimEnd(Math.min(motionVideo.duration, selectedDuration))
  }, [selectedDuration, motionVideo?.duration]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!supportsSound) setWithSound(false) }, [supportsSound])

  useEffect(() => {
    if (selectedModel && !supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(supportedAspectRatios[0] ?? '9:16')
    }
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived video status ──────────────────────────────────
  const videoDuration = motionVideo?.duration ?? null

  // Video is too short for any duration the model supports
  const videoTooShort = videoDuration != null && videoDuration < modelMinDuration

  // For the selected duration: does the video need to be trimmed?
  const needsTrim = !videoTooShort &&
    videoDuration != null &&
    selectedDuration != null &&
    videoDuration > selectedDuration

  // For the selected duration: does the video fit exactly (no trim needed)?
  const videoFits = !videoTooShort &&
    videoDuration != null &&
    selectedDuration != null &&
    videoDuration <= selectedDuration

  // The duration we'll actually send to the generation record
  // If video fits or is shorter: use selectedDuration (enum-safe)
  // If trimming: also selectedDuration (trim window is exactly selectedDuration)
  const effectiveDuration = selectedDuration

  // ── Credit calculation ────────────────────────────────────
  const durationMultiplier = (() => {
    if (!effectiveDuration) return 1
    if (effectiveDuration <= 5)  return 1
    if (effectiveDuration <= 8)  return 1.6
    if (effectiveDuration <= 10) return 2
    if (effectiveDuration <= 12) return 2.4
    if (effectiveDuration <= 15) return 3
    if (effectiveDuration <= 20) return 4
    if (effectiveDuration <= 30) return 6
    return Math.ceil(effectiveDuration / 5)
  })()

  const baseCredits = selectedModel?.credit_cost_i2i ?? 0
  const baseWithDur = baseCredits * durationMultiplier
  const creditCost  = withSound && supportsSound
    ? Math.ceil(baseWithDur * (selectedModel?.sound_cost_multiplier ?? 1.5))
    : Math.ceil(baseWithDur)

  const canAfford       = credits >= creditCost
  const hasVideo        = !!motionVideo
  const hasVideoOrGhost = hasVideo || !!videoGhostMeta
  const hasSubject      = !!subjectImage

  // Can generate: must have video, subject, afford credits, valid model, not submitting,
  // and video must not be too short
  const canGenerate = hasVideo && hasSubject && canAfford && !!selectedModel &&
    !submitting && !trimming && !videoTooShort && !!selectedDuration

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url      = URL.createObjectURL(file)
    const duration = await getVideoDuration(file)
    let detectedRatio = aspectRatio
    await new Promise((resolve) => {
      const vid = document.createElement('video')
      vid.preload = 'metadata'
      vid.onloadedmetadata = () => {
        if (vid.videoWidth && vid.videoHeight) {
          detectedRatio = detectAspectRatio(vid.videoWidth, vid.videoHeight)
          setAspectRatio(detectedRatio)
        }
        URL.revokeObjectURL(vid.src)
        resolve()
      }
      vid.onerror = resolve
      vid.src = URL.createObjectURL(file)
    })
    setMotionVideo({ file, url, duration })
    setVideoGhostMeta(null)
    persistVideoMeta(file.name, duration, detectedRatio)
  }

  const handleSubjectUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubjectImage({ file, url: URL.createObjectURL(file) })
    persistImage(SS_SUBJECT_IMG, file)
  }

  const handleRemoveVideo = () => {
    if (motionVideo?.url) URL.revokeObjectURL(motionVideo.url)
    setMotionVideo(null)
    setVideoGhostMeta(null)
    try { sessionStorage.removeItem(SS_VIDEO_META) } catch { /* noop */ }
  }

  const handleRemoveSubject = () => {
    if (subjectImage?.url) URL.revokeObjectURL(subjectImage.url)
    setSubjectImage(null)
    try { sessionStorage.removeItem(SS_SUBJECT_IMG) } catch { /* noop */ }
  }

  const handleTrimChange = (start, end) => {
    setTrimStart(start)
    setTrimEnd(end)
  }

  const handleGenerate = async () => {
    if (!hasVideo)      return toast.error('Upload a motion reference video')
    if (!hasSubject)    return toast.error('Upload a subject image')
    if (!selectedModel) return toast.error('Pick a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')
    if (videoTooShort)  return toast.error(`Video is too short. Minimum is ${modelMinDuration}s for this model.`)

    setSubmitting(true)
    try {
      // ── Step 1: Trim if needed ────────────────────────────
      let videoFileToUpload = motionVideo.file
      let finalDuration     = motionVideo.duration

      if (needsTrim) {
        setTrimming(true)
        toast.loading('Trimming video…', { id: 'trim' })
        try {
          const trimmedFile = await trimVideoInBrowser(motionVideo.file, trimStart, trimEnd)
          videoFileToUpload = trimmedFile
          finalDuration     = trimEnd - trimStart
          toast.dismiss('trim')
        } catch (trimErr) {
          toast.dismiss('trim')
          throw new Error('Could not trim video. Please try a shorter clip.')
        } finally {
          setTrimming(false)
        }
      }

      // ── Step 2: Upload video ──────────────────────────────
      const vidExt  = (videoFileToUpload.name.split('.').pop() || 'webm').toLowerCase()
      const vidPath = `${user.id}/${crypto.randomUUID()}.${vidExt}`
      const { error: vidErr } = await supabase.storage
        .from('generation-uploads')
        .upload(vidPath, videoFileToUpload, { upsert: false, cacheControl: '3600', contentType: videoFileToUpload.type })
      if (vidErr) throw new Error('Video upload failed')
      const { data: { publicUrl: motionVideoUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(vidPath)

      // ── Step 3: Upload image ──────────────────────────────
      const imgExt  = (subjectImage.file.name.split('.').pop() || 'jpg').toLowerCase()
      const imgPath = `${user.id}/${crypto.randomUUID()}.${imgExt}`
      const { error: imgErr } = await supabase.storage
        .from('generation-uploads')
        .upload(imgPath, subjectImage.file, { upsert: false, cacheControl: '3600', contentType: subjectImage.file.type })
      if (imgErr) throw new Error('Image upload failed')
      const { data: { publicUrl: subjectImageUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(imgPath)

      // ── Step 4: Create generation record ─────────────────
      // duration is always a string matching one of the model's supported_durations enum values
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        'motion_transfer',
        status:                 'pending',
        prompt:                 null,
        model,
        aspect_ratio:           aspectRatio,
        duration:               String(selectedDuration),
        credits_charged:        creditCost,
        output_type:            'video',
        start_frame_url:        subjectImageUrl,
        input_image_urls:       [motionVideoUrl],
        with_sound:             withSound,
        skip_prompt_refinement: true,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // ── Step 5: Deduct credits ────────────────────────────
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      supabase.functions.invoke('video-generate', { body: { generationId: genRow.id } })
        .catch((e) => console.error('video-generate invoke error', e))

      refreshProfile()
      toast.success('Copy Motion is being generated. Check your Media page.', { duration: 4000 })
      handleRemoveVideo()
      handleRemoveSubject()
      setWithSound(false)

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
      setTrimming(false)
    }
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Generating / Trimming overlay */}
      <AnimatePresence>
        {(submitting || trimming) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
              {trimming ? 'Trimming video…' : 'Generating…'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
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
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Copy Motion</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Motion Transfer</span>
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
            <div className="flex flex-col gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="w-full rounded-2xl animate-pulse" style={{ height: 200, background: 'var(--bg-elevated)' }} />
              ))}
            </div>
          ) : models.length === 0 ? (
            <NoModelsState />
          ) : (
            <>
              {/* Explainer */}
              <div
                className="rounded-2xl px-4 py-3 flex gap-3 items-start"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
              >
                <Film size={16} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Upload a <strong style={{ color: 'var(--text-primary)' }}>motion reference video</strong> and a{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>subject image</strong>. The AI copies the
                  motion from the video onto your image — dances, gestures, camera moves.
                </p>
              </div>

              {/* Upload grid */}
              <div>
                <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Inputs
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Motion Video</p>
                    <VideoUploadZone
                      value={motionVideo}
                      ghostMeta={videoGhostMeta}
                      onUpload={handleVideoUpload}
                      onRemove={handleRemoveVideo}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Subject Image</p>
                    <ImageUploadZone
                      value={subjectImage}
                      onUpload={handleSubjectUpload}
                      onRemove={handleRemoveSubject}
                    />
                  </div>
                </div>

                {/* Video too short warning */}
                <AnimatePresence>
                  {videoTooShort && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{    opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: '#ef4444' }}>
                        Video is only <strong>{videoDuration}s</strong> — this model needs at least{' '}
                        <strong>{modelMinDuration}s</strong>. Please upload a longer video.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Video fits note — shown when no trim needed */}
                {videoFits && !videoTooShort && motionVideo && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Video is <strong style={{ color: 'var(--text-primary)' }}>{videoDuration}s</strong> — fits within the selected{' '}
                    <strong style={{ color: ACCENT }}>{selectedDuration}s</strong> slot. Full video will be used.
                  </p>
                )}
              </div>

              {/* ── Duration Chips — always visible when model is loaded ── */}
              {modelDurations.length > 0 && (
                <DurationChips
                  durations={modelDurations}
                  value={selectedDuration}
                  onChange={(d) => setSelectedDuration(d)}
                />
              )}

              {/* ── Trim slider — shown only when video exceeds selected duration ── */}
              <AnimatePresence>
                {needsTrim && motionVideo && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{    opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <VideoTrimSlider
                      duration={motionVideo.duration}
                      targetDuration={selectedDuration}
                      trimStart={trimStart}
                      trimEnd={trimEnd}
                      onTrimChange={handleTrimChange}
                      videoUrl={motionVideo.url}
                    />
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Clip: <strong style={{ color: ACCENT }}>{trimStart}s → {trimEnd}s</strong>
                      {' '}({trimEnd - trimStart}s) · will be trimmed before upload
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Settings */}
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

      {/* Generate button */}
      {models.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{
                background: canGenerate ? ACCENT    : 'var(--bg-elevated)',
                color:      canGenerate ? '#ffffff' : 'var(--text-muted)',
                cursor:     canGenerate ? 'pointer' : 'not-allowed',
              }}
            >
              {needsTrim
                ? <Scissors size={15} />
                : <Zap size={15} fill="currentColor" />}
              {submitting
                ? (trimming ? 'Trimming…' : 'Generating…')
                : needsTrim
                  ? `Trim & Generate · ${creditCost} cr · ${selectedDuration}s`
                  : `Generate · ${creditCost} cr · ${selectedDuration}s`}
            </button>

            {/* Helper messages below button */}
            {videoTooShort && (
              <p className="text-xs text-center mt-2" style={{ color: '#ef4444' }}>
                Video too short — minimum {modelMinDuration}s required
              </p>
            )}
            {!videoTooShort && !hasVideoOrGhost && !hasSubject && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Upload both a motion video and a subject image to continue
              </p>
            )}
            {!videoTooShort && (hasVideoOrGhost || hasSubject) && (!hasVideoOrGhost || !hasSubject) && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                {!hasVideoOrGhost ? 'Still need a motion reference video' : 'Still need a subject image'}
              </p>
            )}
            {!videoTooShort && videoGhostMeta && !motionVideo && hasSubject && (
              <p className="text-xs text-center mt-2" style={{ color: ACCENT }}>
                Re-upload your motion video to generate
              </p>
            )}
            {!videoTooShort && hasVideo && hasSubject && !canAfford && (
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
