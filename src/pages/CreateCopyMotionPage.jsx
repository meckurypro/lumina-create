import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, X, Film, Image as ImageIcon,
  AlertCircle, RefreshCw, CheckCircle2, Scissors, Play, Pause,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import { checkVideoCompatibility, transcodeVideo } from '@/lib/videoCompat'
import toast from 'react-hot-toast'

// ── Theme constants ────────────────────────────────────────────────────────
const ACCENT     = 'var(--tool-motion)'
const ACCENT_SUB = 'var(--tool-motion-subtle)'
const ACCENT_BDR = 'var(--tool-motion-border)'

// ── Session storage keys ───────────────────────────────────────────────────
const SS_SUBJECT_IMG = 'meckury_copymotion_subject'
const SS_VIDEO_META  = 'meckury_copymotion_video_meta'

// ── Helpers ────────────────────────────────────────────────────────────────
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
      sessionStorage.setItem(key, JSON.stringify({
        base64: ev.target.result,
        name: file.name,
        type: file.type,
      }))
    }
    reader.readAsDataURL(file)
  } catch { /* noop */ }
}

const restoreImage = (key) => new Promise((resolve) => {
  try {
    const saved = sessionStorage.getItem(key)
    if (!saved) return resolve(null)
    const { base64, name, type } = JSON.parse(saved)
    const bytes = atob(base64.split(',')[1])
    const ab    = new ArrayBuffer(bytes.length)
    const ia    = new Uint8Array(ab)
    for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i)
    const blob  = new Blob([ab], { type })
    resolve({ file: new File([blob], name, { type }), url: URL.createObjectURL(blob) })
  } catch { resolve(null) }
})

const persistVideoMeta = (name, duration, aspectRatio, compatible) => {
  try {
    sessionStorage.setItem(SS_VIDEO_META, JSON.stringify({ name, duration, aspectRatio, compatible }))
  } catch { /* noop */ }
}

const restoreVideoMeta = () => {
  try {
    const saved = sessionStorage.getItem(SS_VIDEO_META)
    return saved ? JSON.parse(saved) : null
  } catch { return null }
}

const getVideoDuration = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file)
  const vid = document.createElement('video')
  vid.preload = 'metadata'
  vid.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Math.round(vid.duration)) }
  vid.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
  vid.src = url
})

// ── Sub-components ─────────────────────────────────────────────────────────

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

// ── Compat badge shown on the video tile ──────────────────────────────────
const CompatBadge = ({ status }) => {
  // status: 'checking' | 'compatible' | 'incompatible' | null
  if (!status || status === null) return null

  if (status === 'checking') {
    return (
      <div
        className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
        style={{ background: 'rgba(0,0,0,0.72)', color: '#fff' }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="w-3 h-3 rounded-full border border-white"
          style={{ borderTopColor: 'transparent' }}
        />
        Checking…
      </div>
    )
  }

  if (status === 'compatible') {
    return (
      <div
        className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
        style={{ background: 'rgba(16,185,129,0.85)', color: '#fff' }}
      >
        <CheckCircle2 size={11} />
        Ready
      </div>
    )
  }

  if (status === 'incompatible') {
    return (
      <div
        className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
        style={{ background: 'rgba(239,160,20,0.9)', color: '#fff' }}
      >
        <RefreshCw size={11} />
        Will convert
      </div>
    )
  }

  return null
}

// ── Video upload zone ──────────────────────────────────────────────────────
const VideoUploadZone = ({
  value, ghostMeta, onUpload, onRemove,
  durationMismatch, compatStatus,
}) => {
  if (value) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
      >
        <video
          src={value.url}
          className="w-full h-full object-cover"
          muted loop autoPlay playsInline
          style={{ filter: durationMismatch ? 'blur(4px)' : 'none' }}
        />

        {/* Duration badge — only when valid and no compat issue */}
        {value.duration != null && !durationMismatch && (
          <div
            className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}
          >
            {formatDuration(value.duration)}
          </div>
        )}

        <CompatBadge status={compatStatus} />

        {/* Duration mismatch overlay */}
        {durationMismatch && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          >
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
            <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.95)', lineHeight: 1.5 }}>
              Duration doesn't match<br />any available option
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
    )
  }

  if (ghostMeta) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
      >
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
      <span className="text-xs mt-1 text-center px-4" style={{ color: 'var(--text-muted)' }}>
        MP4 · MOV · WEBM
      </span>
    </label>
  )
}

const ImageUploadZone = ({ value, onUpload, onRemove }) => {
  if (value) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
      >
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
      <span className="text-xs mt-1 text-center px-4" style={{ color: 'var(--text-muted)' }}>
        The image that moves
      </span>
    </label>
  )
}

const NoModelsState = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 gap-4 text-center"
  >
    <div
      className="w-14 h-14 rounded-2xl flex items-center justify-center"
      style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
    >
      <AlertCircle size={26} style={{ color: ACCENT }} />
    </div>
    <div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No models available yet</p>
      <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
        Copy Motion models are being set up. Check back soon!
      </p>
    </div>
  </motion.div>
)

// ── Full-screen overlay — used for both converting and generating ──────────
const FullscreenOverlay = ({ phase, convertProgress }) => {
  const isConverting = phase === 'converting'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-8"
      style={{
        backdropFilter:       'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        background:           'rgba(0,0,0,0.45)',
      }}
    >
      {isConverting ? (
        <>
          {/* Animated ring */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
              <motion.circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke={ACCENT}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - convertProgress / 100)}`}
                style={{ transformOrigin: '32px 32px', rotate: '-90deg' }}
                transition={{ duration: 0.3 }}
              />
            </svg>
            <span className="text-xs font-bold" style={{ color: '#fff' }}>
              {convertProgress}%
            </span>
          </div>

          <div className="text-center">
            <p className="text-sm font-bold tracking-wide" style={{ color: '#fff' }}>
              Converting your video
            </p>
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 240, lineHeight: 1.6 }}>
              Making it compatible with the AI model. This only takes a moment.
            </p>
          </div>
        </>
      ) : (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            className="w-10 h-10 rounded-full border-2"
            style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
          />
          <p className="text-sm font-semibold tracking-wide" style={{ color: '#fff' }}>
            Generating…
          </p>
        </>
      )}
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
// ── Video trim slider ──────────────────────────────────────────────────────
const VideoTrimSlider = ({ duration, maxDuration, trimStart, trimEnd, onTrimChange, videoUrl }) => {
  const trackRef    = useRef(null)
  const videoRef    = useRef(null)
  const [playing, setPlaying]         = useState(false)
  const [playhead, setPlayhead]       = useState(trimStart)
  const dragRef     = useRef(null) // 'start' | 'end' | null

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

  const pxToSec = (clientX) => {
    const rect = trackRef.current.getBoundingClientRect()
    const pct  = clamp((clientX - rect.left) / rect.width, 0, 1)
    return Math.round(pct * duration)
  }

  const onPointerMove = (clientX) => {
    if (!dragRef.current) return
    const sec = pxToSec(clientX)
    if (dragRef.current === 'start') {
      let s = clamp(sec, 0, duration - 1)
      let e = trimEnd
      if (s >= e) s = e - 1
      if (e - s > maxDuration) e = s + maxDuration
      onTrimChange(s, e)
    } else {
      let e = clamp(sec, 1, duration)
      let s = trimStart
      if (e <= s) e = s + 1
      if (e - s > maxDuration) s = e - maxDuration
      onTrimChange(s, e)
    }
  }

  useEffect(() => {
    const move = (ev) => onPointerMove(ev.clientX ?? ev.touches?.[0]?.clientX)
    const up   = () => { dragRef.current = null }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup',   up)
    window.addEventListener('touchmove', move, { passive: false })
    window.addEventListener('touchend',  up)
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup',   up)
      window.removeEventListener('touchmove', move)
      window.removeEventListener('touchend',  up)
    }
  }) // eslint-disable-line

  // Preview playback: only the selected segment
  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onTime = () => {
      setPlayhead(v.currentTime)
      if (v.currentTime >= trimEnd) {
        v.pause()
        v.currentTime = trimStart
        setPlaying(false)
        setPlayhead(trimStart)
      }
    }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [trimStart, trimEnd])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (playing) {
      v.pause()
      setPlaying(false)
    } else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart
      v.play()
      setPlaying(true)
    }
  }

  const startPct    = (trimStart / duration) * 100
  const endPct      = (trimEnd   / duration) * 100
  const playheadPct = (clamp(playhead, 0, duration) / duration) * 100

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{    opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <div
        className="rounded-2xl p-4 mt-2"
        style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className="relative rounded-xl overflow-hidden flex-shrink-0"
            style={{ width: 56, height: 56, background: 'rgba(0,0,0,0.4)' }}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <button
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.35)', color: '#fff' }}
              aria-label={playing ? 'Pause preview' : 'Play preview'}
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: ACCENT }}>
              <Scissors size={12} />
              Trim to fit · max {maxDuration}s
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {trimStart}s → {trimEnd}s ({trimEnd - trimStart}s selected)
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div
          ref={trackRef}
          className="relative w-full select-none"
          style={{ height: 36 }}
        >
          {/* Base track */}
          <div
            className="absolute left-0 right-0 rounded-full"
            style={{ top: 14, height: 8, background: 'rgba(0,0,0,0.18)' }}
          />
          {/* Selected region */}
          <div
            className="absolute rounded-full"
            style={{
              top: 14, height: 8,
              left:  `${startPct}%`,
              width: `${endPct - startPct}%`,
              background: ACCENT,
            }}
          />
          {/* Dim outside */}
          <div
            className="absolute rounded-l-full"
            style={{ top: 14, height: 8, left: 0, width: `${startPct}%`, background: 'rgba(0,0,0,0.32)' }}
          />
          <div
            className="absolute rounded-r-full"
            style={{ top: 14, height: 8, left: `${endPct}%`, right: 0, background: 'rgba(0,0,0,0.32)' }}
          />
          {/* Playhead */}
          {playing && (
            <div
              className="absolute"
              style={{
                top: 8, height: 20, width: 2,
                left: `${playheadPct}%`,
                background: '#fff',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
              }}
            />
          )}
          {/* Start handle */}
          <div
            onMouseDown={() => { dragRef.current = 'start' }}
            onTouchStart={() => { dragRef.current = 'start' }}
            className="absolute rounded-full cursor-ew-resize flex items-center justify-center"
            style={{
              top: 6, width: 24, height: 24,
              left: `calc(${startPct}% - 12px)`,
              background: '#fff',
              border: `2px solid ${ACCENT}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              touchAction: 'none',
            }}
          >
            <div style={{ width: 2, height: 10, background: ACCENT, borderRadius: 1 }} />
          </div>
          {/* End handle */}
          <div
            onMouseDown={() => { dragRef.current = 'end' }}
            onTouchStart={() => { dragRef.current = 'end' }}
            className="absolute rounded-full cursor-ew-resize flex items-center justify-center"
            style={{
              top: 6, width: 24, height: 24,
              left: `calc(${endPct}% - 12px)`,
              background: '#fff',
              border: `2px solid ${ACCENT}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              touchAction: 'none',
            }}
          >
            <div style={{ width: 2, height: 10, background: ACCENT, borderRadius: 1 }} />
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>0s</span>
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>
            {trimStart}s → {trimEnd}s
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{duration}s</span>
        </div>
      </div>
    </motion.div>
  )
}

export default function CreateCopyMotionPage() {
  const navigate                                    = useNavigate()
  const { user, credits, refreshProfile }           = useAuth()

  // Media state
  const [motionVideo,    setMotionVideo]    = useState(null)
  const [videoGhostMeta, setVideoGhostMeta] = useState(null)
  const [subjectImage,   setSubjectImage]   = useState(null)

  // Compat state
  // compatStatus: null | 'checking' | 'compatible' | 'incompatible'
  const [compatStatus,   setCompatStatus]   = useState(null)
  const [compatReason,   setCompatReason]   = useState(null)

  // Settings
  const [aspectRatio,    setAspectRatio]    = useState('9:16')
  const [withSound,      setWithSound]      = useState(false)
  const [model,          setModel]          = useState('')
  const [models,         setModels]         = useState([])
  const [modelsLoading,  setModelsLoading]  = useState(true)

  // Pipeline phase: null | 'converting' | 'submitting'
  const [phase,           setPhase]           = useState(null)
  const [convertProgress, setConvertProgress] = useState(0)
  const [trimming,        setTrimming]        = useState(false)

  // Trim window (seconds, integers)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd,   setTrimEnd]   = useState(0)

  // Persistent FFmpeg instance (loaded once)
  const ffmpegRef = useRef(null)

  // ── Restore session on mount ─────────────────────────────
  useEffect(() => {
    restoreImage(SS_SUBJECT_IMG).then((f) => { if (f) setSubjectImage(f) })
    const meta = restoreVideoMeta()
    if (meta) {
      setVideoGhostMeta(meta)
      if (meta.aspectRatio) setAspectRatio(meta.aspectRatio)
    }
  }, [])

  // ── Load models ──────────────────────────────────────────
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

  // ── Derived model config ─────────────────────────────────
  const selectedModel         = models.find((m) => m.value === model)
  const supportedAspectRatios = selectedModel?.supported_aspect_ratios ?? ['9:16', '16:9', '1:1']
  const supportsSound         = selectedModel?.supports_sound ?? false
  const modelDurations        = selectedModel?.supported_durations
    ? selectedModel.supported_durations.map(Number).sort((a, b) => a - b)
    : []

  useEffect(() => {
    if (selectedModel && !supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(supportedAspectRatios[0] ?? '9:16')
    }
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!supportsSound) setWithSound(false) }, [supportsSound])

  // ── Derived video status ─────────────────────────────────
  const videoDuration    = motionVideo?.duration ?? null
  const matchedDuration  = videoDuration != null && modelDurations.length > 0
    ? modelDurations.find((d) => d === videoDuration) ?? null
    : null
  const modelMaxDuration = modelDurations.length > 0 ? Math.max(...modelDurations) : 30
  const needsTrim        = videoDuration != null && videoDuration > modelMaxDuration
  const durationMismatch =
    videoDuration != null && modelDurations.length > 0 && matchedDuration === null && !needsTrim

  // Snap effective duration up to the nearest supported enum value
  const effectiveDuration = needsTrim ? Math.max(1, trimEnd - trimStart) : videoDuration
  const snappedDuration   = effectiveDuration != null && modelDurations.length > 0
    ? modelDurations.find((d) => d >= effectiveDuration) ?? null
    : null

  // Reset trim window when video or model max changes
  useEffect(() => {
    if (videoDuration != null && needsTrim) {
      setTrimStart(0)
      setTrimEnd(Math.min(videoDuration, modelMaxDuration))
    } else {
      setTrimStart(0)
      setTrimEnd(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoDuration, modelMaxDuration])

  // ── Credit calculation ───────────────────────────────────
  const durationMultiplier = (() => {
    if (!matchedDuration) return 1
    if (matchedDuration <= 5)  return 1
    if (matchedDuration <= 8)  return 1.6
    if (matchedDuration <= 10) return 2
    if (matchedDuration <= 12) return 2.4
    if (matchedDuration <= 15) return 3
    if (matchedDuration <= 20) return 4
    if (matchedDuration <= 30) return 6
    return Math.ceil(matchedDuration / 5)
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
  const isProcessing    = phase !== null

  const canGenerate =
    hasVideo &&
    !durationMismatch &&
    (needsTrim
      ? (snappedDuration !== null && trimEnd > trimStart)
      : matchedDuration !== null) &&
    hasSubject &&
    canAfford &&
    !!selectedModel &&
    !isProcessing &&
    !trimming &&
    compatStatus !== 'checking'

  // ── Video upload handler ─────────────────────────────────
  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const url      = URL.createObjectURL(file)
    const duration = await getVideoDuration(file)

    // Detect aspect ratio
    let detectedRatio = aspectRatio
    await new Promise((resolve) => {
      const vid    = document.createElement('video')
      vid.preload  = 'metadata'
      vid.onloadedmetadata = () => {
        if (vid.videoWidth && vid.videoHeight) {
          detectedRatio = detectAspectRatio(vid.videoWidth, vid.videoHeight)
          setAspectRatio(detectedRatio)
        }
        URL.revokeObjectURL(vid.src)
        resolve()
      }
      vid.onerror = resolve
      vid.src     = URL.createObjectURL(file)
    })

    setMotionVideo({ file, url, duration })
    setVideoGhostMeta(null)

    // ── Run compat check in background ────────────────────
    setCompatStatus('checking')
    setCompatReason(null)

    try {
      const { compatible, reason } = await checkVideoCompatibility(file)
      setCompatStatus(compatible ? 'compatible' : 'incompatible')
      setCompatReason(reason)
      persistVideoMeta(file.name, duration, detectedRatio, compatible)
    } catch {
      // If check itself errors, assume incompatible — safer
      setCompatStatus('incompatible')
      setCompatReason('Could not verify format — will convert to be safe')
      persistVideoMeta(file.name, duration, detectedRatio, false)
    }
  }

  // ── Subject upload handler ───────────────────────────────
  const handleSubjectUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSubjectImage({ file, url: URL.createObjectURL(file) })
    persistImage(SS_SUBJECT_IMG, file)
  }

  // ── Remove handlers ──────────────────────────────────────
  const handleRemoveVideo = () => {
    if (motionVideo?.url) URL.revokeObjectURL(motionVideo.url)
    setMotionVideo(null)
    setVideoGhostMeta(null)
    setCompatStatus(null)
    setCompatReason(null)
    try { sessionStorage.removeItem(SS_VIDEO_META) } catch { /* noop */ }
  }

  const handleRemoveSubject = () => {
    if (subjectImage?.url) URL.revokeObjectURL(subjectImage.url)
    setSubjectImage(null)
    try { sessionStorage.removeItem(SS_SUBJECT_IMG) } catch { /* noop */ }
  }

  // ── Trim video in-browser via ffmpeg.wasm ────────────────
  const trimVideoInBrowser = async (sourceFile, startSec, endSec) => {
    // Lazy-load + cache the FFmpeg instance across calls
    if (!ffmpegRef.current) {
      const { FFmpeg }            = await import('@ffmpeg/ffmpeg')
      const { toBlobURL }         = await import('@ffmpeg/util')
      const ff                    = new FFmpeg()
      const baseURL               = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ff.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`,   'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      ffmpegRef.current = ff
    }
    const ffmpeg       = ffmpegRef.current
    const { fetchFile } = await import('@ffmpeg/util')

    const ext        = sourceFile.name.split('.').pop() || 'mp4'
    const inputName  = `input.${ext}`
    const outputName = 'output.mp4'

    await ffmpeg.writeFile(inputName, await fetchFile(sourceFile))

    await ffmpeg.exec([
      '-ss',                String(startSec),
      '-to',                String(endSec),
      '-i',                 inputName,
      '-c:v',               'libx264',
      '-preset',            'ultrafast',
      '-crf',               '18',
      '-c:a',               'aac',
      '-avoid_negative_ts', 'make_zero',
      '-movflags',          '+faststart',
      outputName,
    ])

    const data        = await ffmpeg.readFile(outputName)
    const blob        = new Blob([data.buffer], { type: 'video/mp4' })
    const trimmedName = sourceFile.name.replace(/\.[^.]+$/, '') + '_trim.mp4'
    await ffmpeg.deleteFile(inputName).catch(() => {})
    await ffmpeg.deleteFile(outputName).catch(() => {})
    return new File([blob], trimmedName, { type: 'video/mp4' })
  }

  // ── Generate ─────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!hasVideo)        return toast.error('Upload a motion reference video')
    if (durationMismatch) return toast.error(`Video duration must exactly match one of: ${modelDurations.join('s, ')}s`)
    if (needsTrim && (snappedDuration === null || trimEnd <= trimStart)) {
      return toast.error('Pick a valid trim window')
    }
    if (!hasSubject)      return toast.error('Upload a subject image')
    if (!selectedModel)   return toast.error('Pick a model')
    if (!canAfford)       return toast.error('Not enough credits')
    if (!user)            return toast.error('Please sign in')

    let uploadFile = motionVideo.file
    let finalDuration = matchedDuration

    // ── Step 0: Trim if needed ─────────────────────────────
    if (needsTrim) {
      setTrimming(true)
      toast.loading('Trimming video…', { id: 'trim' })
      try {
        uploadFile    = await trimVideoInBrowser(motionVideo.file, trimStart, trimEnd)
        finalDuration = trimEnd - trimStart
      } catch (err) {
        toast.dismiss('trim')
        setTrimming(false)
        toast.error('Could not trim video. Please try a shorter clip.')
        return
      }
      toast.dismiss('trim')
      setTrimming(false)
    }

    // ── Step 1: Transcode if needed ────────────────────────
    if (!needsTrim && compatStatus === 'incompatible') {
      setPhase('converting')
      setConvertProgress(0)

      try {
        uploadFile = await transcodeVideo(motionVideo.file, (pct) => {
          setConvertProgress(pct)
        })
        setConvertProgress(100)
        // Brief pause so user sees 100% before it transitions
        await new Promise((r) => setTimeout(r, 400))
      } catch (err) {
        setPhase(null)
        setConvertProgress(0)
        toast.error('Video conversion failed. Try a different video.')
        return
      }
    }

    // ── Step 2: Upload + generate ──────────────────────────
    setPhase('submitting')

    try {
      // Upload video
      const vidExt  = uploadFile.name.split('.').pop()?.toLowerCase() || 'mp4'
      const vidPath = `${user.id}/${crypto.randomUUID()}.${vidExt}`
      const { error: vidErr } = await supabase.storage
        .from('generation-uploads')
        .upload(vidPath, uploadFile, {
          upsert: false,
          cacheControl: '3600',
          contentType: uploadFile.type || 'video/mp4',
        })
      if (vidErr) throw new Error('Video upload failed')
      const { data: { publicUrl: motionVideoUrl } } = supabase.storage
        .from('generation-uploads')
        .getPublicUrl(vidPath)

      // Upload image
      const imgExt  = subjectImage.file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const imgPath = `${user.id}/${crypto.randomUUID()}.${imgExt}`
      const { error: imgErr } = await supabase.storage
        .from('generation-uploads')
        .upload(imgPath, subjectImage.file, {
          upsert: false,
          cacheControl: '3600',
          contentType: subjectImage.file.type,
        })
      if (imgErr) throw new Error('Image upload failed')
      const { data: { publicUrl: subjectImageUrl } } = supabase.storage
        .from('generation-uploads')
        .getPublicUrl(imgPath)

      // Create generation record
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        'motion_transfer',
        status:                 'pending',
        prompt:                 null,
        model,
        aspect_ratio:           aspectRatio,
        duration:               String(snappedDuration ?? finalDuration ?? 5),
        credits_charged:        creditCost,
        output_type:            'video',
        start_frame_url:        subjectImageUrl,
        input_image_urls:       [motionVideoUrl],
        with_sound:             withSound,
        skip_prompt_refinement: true,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(
        user.id, creditCost, genRow.id
      )
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, {
          status: 'failed',
          error_message: deduct?.error || 'Insufficient credits',
        })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // Fire edge function — intentionally fire-and-forget
      supabase.functions
        .invoke('video-generate', { body: { generationId: genRow.id } })
        .catch((e) => console.error('video-generate invoke error', e))

      refreshProfile()
      toast.success('Copy Motion is being generated. Check your Media page.', { duration: 4000 })

      // Reset form
      handleRemoveVideo()
      handleRemoveSubject()
      setWithSound(false)

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setPhase(null)
      setConvertProgress(0)
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Converting / Generating overlay */}
      <AnimatePresence>
        {(isProcessing || trimming) && (
          <FullscreenOverlay
            phase={trimming ? 'trimming' : phase}
            convertProgress={convertProgress}
          />
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
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {modelsLoading ? (
            <div className="flex flex-col gap-4">
              {[...Array(2)].map((_, i) => (
                <div
                  key={i}
                  className="w-full rounded-2xl animate-pulse"
                  style={{ height: 200, background: 'var(--bg-elevated)' }}
                />
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
                  Upload a{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>motion reference video</strong> and a{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>subject image</strong>. The AI copies the
                  motion from the video onto your image — dances, gestures, camera moves.
                </p>
              </div>

              {/* Upload grid */}
              <div>
                <p
                  className="text-xs font-semibold mb-3 uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
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
                      durationMismatch={durationMismatch}
                      compatStatus={compatStatus}
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

                {/* Compat info line */}
                <AnimatePresence>
                  {compatStatus === 'incompatible' && compatReason && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
                      style={{
                        background: 'rgba(239,160,20,0.08)',
                        border: '1px solid rgba(239,160,20,0.25)',
                      }}
                    >
                      <RefreshCw size={12} style={{ color: '#efa014', flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: '#efa014' }}>
                        {compatReason} — conversion happens automatically when you generate.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Duration mismatch warning */}
                <AnimatePresence>
                  {durationMismatch && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                      }}
                    >
                      <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: '#ef4444' }}>
                        Video is <strong>{videoDuration}s</strong> — must be exactly{' '}
                        <strong>{modelDurations.join('s, ')}s</strong> for this model.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Duration OK confirmation */}
                {matchedDuration !== null && motionVideo && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Video is <strong style={{ color: ACCENT }}>{videoDuration}s</strong> — matches the{' '}
                    <strong style={{ color: ACCENT }}>{matchedDuration}s</strong> option. Ready to generate.
                  </p>
                )}
              </div>

              {/* Trim UI (only when video exceeds model max duration) */}
              <AnimatePresence>
                {needsTrim && motionVideo && (
                  <VideoTrimSlider
                    duration={videoDuration}
                    maxDuration={modelMaxDuration}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    onTrimChange={(s, e) => { setTrimStart(s); setTrimEnd(e) }}
                    videoUrl={motionVideo.url}
                  />
                )}
              </AnimatePresence>

              {needsTrim && (
                <p className="text-xs -mt-2" style={{ color: ACCENT }}>
                  Selected segment: {trimStart}s → {trimEnd}s ({trimEnd - trimStart}s) · will be trimmed before upload
                </p>
              )}

              {/* Duration display — read-only */}
              {matchedDuration !== null && (
                <div className="mb-1">
                  <p
                    className="text-xs font-semibold mb-2.5 uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Duration
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {modelDurations.map((d) => (
                      <div
                        key={d}
                        className="px-4 py-2 rounded-xl text-sm font-medium"
                        style={{
                          background: d === matchedDuration ? ACCENT    : 'var(--bg-elevated)',
                          color:      d === matchedDuration ? '#ffffff' : 'var(--text-secondary)',
                          opacity:    d === matchedDuration ? 1 : 0.35,
                        }}
                      >
                        {d}s
                      </div>
                    ))}
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Duration is set automatically from your video.
                  </p>
                </div>
              )}

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
        <div
          className="flex-shrink-0 px-4 lg:px-8 py-4"
          style={{ borderTop: `1px solid ${ACCENT_BDR}` }}
        >
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || trimming}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{
                background: canGenerate ? ACCENT    : 'var(--bg-elevated)',
                color:      canGenerate ? '#ffffff' : 'var(--text-muted)',
                cursor:     canGenerate ? 'pointer' : 'not-allowed',
              }}
            >
              {needsTrim ? <Scissors size={15} /> : <Zap size={15} fill="currentColor" />}
              {trimming
                ? 'Trimming video…'
                : isProcessing
                  ? phase === 'converting' ? 'Converting…' : 'Generating…'
                  : needsTrim
                    ? `Trim & Generate · ${creditCost} cr · ${trimEnd - trimStart}s`
                    : matchedDuration
                      ? `Generate · ${creditCost} cr · ${matchedDuration}s`
                      : 'Generate'}
            </button>

            {/* Helper messages */}
            {durationMismatch && (
              <p className="text-xs text-center mt-2" style={{ color: '#ef4444' }}>
                Upload a video that is exactly {modelDurations.join('s, ')}s
              </p>
            )}
            {!durationMismatch && !hasVideoOrGhost && !hasSubject && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Upload both a motion video and a subject image to continue
              </p>
            )}
            {!durationMismatch && (hasVideoOrGhost || hasSubject) && (!hasVideoOrGhost || !hasSubject) && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                {!hasVideoOrGhost ? 'Still need a motion reference video' : 'Still need a subject image'}
              </p>
            )}
            {!durationMismatch && videoGhostMeta && !motionVideo && hasSubject && (
              <p className="text-xs text-center mt-2" style={{ color: ACCENT }}>
                Re-upload your motion video to generate
              </p>
            )}
            {!durationMismatch && hasVideo && hasSubject && matchedDuration !== null && !canAfford && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Not enough credits.{' '}
                <button
                  onClick={() => navigate('/profile')}
                  className="font-semibold"
                  style={{ color: ACCENT }}
                >
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
