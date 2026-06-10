
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, X, ImagePlus, Plus, Maximize2,
  Film, AlertCircle, RefreshCw, CheckCircle2, Scissors, Lock,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { applyModelPreferences } from '@/hooks/useModelPreferences'

// ─── theme ────────────────────────────────────────────────────────────────────
const ACCENT     = 'var(--tool-video)'
const ACCENT_SUB = 'var(--tool-video-subtle)'
const ACCENT_BDR = 'var(--tool-video-border)'

// ─── session storage keys ─────────────────────────────────────────────────────
const SS_PROMPT      = 'meckury_video_prompt'
const SS_START_FRAME = 'meckury_video_start_frame'
const SS_END_FRAME   = 'meckury_video_end_frame'
const SS_REF_IMAGES  = 'meckury_video_ref_images'
const SS_OMNI_REF    = 'meckury_video_omni_ref'

// ─── constants ────────────────────────────────────────────────────────────────
const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]
const VIDEO_EDIT_MAX_BILLABLE = 8
const VIDEO_EDIT_CPS          = 49
const VIDEO_EDIT_CONVERT_COST = 2
const MAX_VIDEO_BYTES         = 40 * 1024 * 1024

// ─── helpers ──────────────────────────────────────────────────────────────────
function getModelCaps(model) {
  if (!model) return {
    supportsStartFrame:    true,
    supportsEndFrame:      false,
    supportsFrameToFrame:  false,
    supportsMultiImage:    false,
    supportsVideoInput:    false,
    isVideoEdit:           false,
    maxRefImages:          1,
    supportedDurations:    ['5', '8', '10'],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    supportsSound:         false,
  }
  return {
    supportsStartFrame:    model.supports_start_frame    ?? true,
    supportsEndFrame:      model.supports_end_frame      ?? false,
    supportsFrameToFrame:  model.supports_frame_to_frame ?? false,
    supportsMultiImage:    model.supports_multi_image    ?? false,
    supportsVideoInput:    model.supports_video_input    ?? false,
    isVideoEdit:           model.feature === 'video_to_video',
    maxRefImages:          model.max_ref_images          ?? 1,
    supportedDurations:    model.supported_durations     ?? [],
    supportedAspectRatios: model.supported_aspect_ratios ?? ['9:16', '16:9', '1:1'],
    supportsSound:         model.supports_sound          ?? false,
  }
}

function detectAspectRatio(width, height) {
  const r = width / height
  if (r > 1.6)  return '16:9'
  if (r < 0.75) return '9:16'
  return '1:1'
}

function deriveVideoType(startFrame, endFrame) {
  if (startFrame && endFrame) return 'start_end_frame'
  if (startFrame)             return 'image_to_video'
  if (endFrame)               return 'end_frame_text'
  return 'text_to_video'
}

function tagForSlot(idx) { return `[img${idx + 1}]` }

function formatDuration(secs) {
  if (!secs && secs !== 0) return '—'
  const s = Math.round(Number(secs))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60 ? `${s % 60}s` : ''}`.trim()
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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

const readVideoMetadata = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file)
  const vid = document.createElement('video')
  vid.preload = 'metadata'
  vid.onloadedmetadata = () => {
    const meta = {
      duration:    vid.duration ? Math.round(vid.duration) : null,
      width:       vid.videoWidth  || null,
      height:      vid.videoHeight || null,
      aspectRatio: vid.videoWidth && vid.videoHeight
        ? detectAspectRatio(vid.videoWidth, vid.videoHeight) : null,
    }
    URL.revokeObjectURL(url)
    resolve(meta)
  }
  vid.onerror = () => { URL.revokeObjectURL(url); resolve({ duration: null, width: null, height: null, aspectRatio: null }) }
  vid.src = url
})

const persistFrame = (key, file) => {
  if (!file) { try { sessionStorage.removeItem(key) } catch {} ; return }
  try {
    const reader = new FileReader()
    reader.onload = (ev) => sessionStorage.setItem(key, JSON.stringify({ base64: ev.target.result, name: file.name, type: file.type }))
    reader.readAsDataURL(file)
  } catch {}
}

const restoreFrame = (key) => new Promise((resolve) => {
  try {
    const saved = sessionStorage.getItem(key)
    if (!saved) return resolve(null)
    const item = JSON.parse(saved)
    if (item.url && !item.base64) return resolve({ file: null, url: item.url, name: item.name })
    const { base64, name, type } = item
    const byteString = atob(base64.split(',')[1])
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type })
    resolve({ file: new File([blob], name, { type }), url: URL.createObjectURL(blob) })
  } catch { resolve(null) }
})

// ─── video compatibility check ────────────────────────────────────────────────
function checkVideoEditCompat({ videoMeta, maxBillable }) {
  if (!videoMeta?.duration) return { ok: false, tooShort: false, needsTrim: false, reason: null }
  if (videoMeta.duration < 1) return { ok: false, tooShort: true, needsTrim: false, reason: 'Video is too short (min 1s).' }
  if (videoMeta.duration > maxBillable) return { ok: false, tooShort: false, needsTrim: true, reason: `Video is ${videoMeta.duration}s — longer than the ${maxBillable}s billing cap. Trim it down.` }
  return { ok: true, tooShort: false, needsTrim: false, reason: null }
}

// ─── trim edge function caller ────────────────────────────────────────────────
async function callTrimEdgeFunction({ file, url, userId, targetDuration, startTime, onProgress }) {
  onProgress?.(5)

  let sourceUrl = url
  if (file) {
    const ext     = (file.name.split('.').pop() || 'mp4').toLowerCase()
    const srcPath = `${userId}/video-edit-src/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('generation-uploads')
      .upload(srcPath, file, { upsert: false, cacheControl: '3600', contentType: file.type || 'video/mp4' })
    if (upErr) throw new Error(upErr.message || 'Could not upload source video')
    onProgress?.(20)
    const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(srcPath)
    sourceUrl = publicUrl
    setTimeout(() => supabase.storage.from('generation-uploads').remove([srcPath]).catch(() => {}), 60_000)
  }

  onProgress?.(25)
  let virtualPct = 25
  const tick = setInterval(() => { virtualPct = Math.min(virtualPct + 2, 90); onProgress?.(virtualPct) }, 800)

  let result
  try {
    const { data, error } = await supabase.functions.invoke('process-video-for-motion', {
      body: {
        sourceUrl,
        targetAspectRatio: '16:9',
        targetDuration,
        startTime,
        trimOnly: true,
      },
    })
    if (error)          throw new Error(error.message || 'Trim edge function failed')
    if (!data?.success) throw new Error(data?.error   || 'Trim failed')
    result = data
  } finally {
    clearInterval(tick)
  }

  onProgress?.(100)
  return result
}

// ─── compat badge ─────────────────────────────────────────────────────────────
const CompatBadge = ({ status }) => {
  if (!status) return null
  const map = {
    compatible:   { bg: 'rgba(16,185,129,0.85)',  color: '#fff', icon: <CheckCircle2 size={11} />, text: 'Ready'           },
    converted:    { bg: 'rgba(16,185,129,0.85)',  color: '#fff', icon: <CheckCircle2 size={11} />, text: 'Trimmed · Ready' },
    incompatible: { bg: 'rgba(239,160,20,0.9)',   color: '#fff', icon: <RefreshCw   size={11} />, text: 'Needs trim'      },
    rejected:     { bg: 'rgba(239,68,68,0.92)',   color: '#fff', icon: <AlertCircle size={11} />, text: 'Too short'       },
  }
  const cfg = map[status]
  if (!cfg) return null
  return (
    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.icon}
      {cfg.text}
    </div>
  )
}

// ─── video upload zone ────────────────────────────────────────────────────────
const VideoUploadZone = ({ value, onUpload, onRemove, compatStatus, tooShort }) => {
  if (value) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: (value.aspectRatio?.replace(':', '/') || '16/9'), background: 'var(--bg-elevated)' }}>
        <video
          src={value.url}
          className="w-full h-full object-cover"
          muted loop autoPlay playsInline
          style={{ filter: tooShort ? 'blur(4px)' : 'none' }}
        />
        {value.duration != null && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
            {formatDuration(value.duration)}
            {value.size && <span className="ml-1.5 opacity-70">· {formatBytes(value.size)}</span>}
          </div>
        )}
        <CompatBadge status={compatStatus} />
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
      style={{ aspectRatio: '9/16', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
    >
      <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
      <Film size={24} style={{ color: ACCENT, marginBottom: 8 }} />
      <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload video</span>
      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>MP4 · MOV · WEBM · max 40 MB</span>
    </label>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────
const SettingChips = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
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
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.aka}</p>
                      {m.description && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.description}</p>}
                      {m.supports_multi_image && <p className="text-xs mt-0.5" style={{ color: ACCENT, opacity: 0.8 }}>Multi-ref</p>}
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
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{m.aka}</p>
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

const FrameUpload = ({ label, value, onChange, onRemove, disabled = false, inactive = false }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
    {value ? (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1', opacity: inactive ? 0.6 : 1 }}>
        <img src={value.url} alt={label} className="w-full h-full object-cover"
          style={{ filter: inactive ? 'blur(4px)' : 'none', pointerEvents: inactive ? 'none' : 'auto' }} />
        {inactive && (
          <div className="absolute inset-0 flex items-center justify-center px-3" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <p className="text-xs font-semibold text-center" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
              Not supported<br />by this model
            </p>
          </div>
        )}
        <button onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', zIndex: 10 }}>
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

const MultiRefGrid = ({ images, maxImages, onAdd, onRemove, onTagInsert, onFullscreen }) => {
  const slots       = Array.from({ length: maxImages }, (_, i) => images[i] || null)
  const filledCount = images.filter(Boolean).length

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Reference up to {maxImages} images. Insert{' '}
        {Array.from({ length: Math.min(maxImages, 4) }, (_, i) => (
          <span key={i}>
            <button
              onClick={() => onTagInsert(tagForSlot(i))}
              className="px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              {tagForSlot(i)}
            </button>
            {i < Math.min(maxImages, 4) - 1 ? ' ' : ''}
          </span>
        ))}{' '}
        tags into your prompt to describe how each image is used.
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(maxImages, 4)}, 1fr)` }}>
        {slots.map((img, idx) => (
          <div key={idx} className="flex flex-col gap-1.5">
            {img ? (
              <div className="relative group">
                <div
                  className="relative overflow-hidden rounded-xl cursor-pointer"
                  style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
                  onClick={() => onFullscreen(idx)}
                >
                  {img.isVideo ? (
                    <video src={img.url} className="w-full h-full object-cover" muted playsInline style={{ pointerEvents: 'none' }} />
                  ) : (
                    <img src={img.url} alt={`ref ${idx + 1}`} className="w-full h-full" style={{ objectFit: 'cover' }} />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <Maximize2 size={16} color="white" />
                  </div>
                  {img.isVideo && (
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>Video</div>
                  )}
                </div>
                <button
                  onClick={() => onTagInsert(tagForSlot(idx))}
                  className="w-full py-1 rounded-lg text-xs font-mono font-semibold transition-all"
                  style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
                >
                  {tagForSlot(idx)}
                </button>
                <button
                  onClick={() => onRemove(idx)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center z-10"
                  style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                >
                  <X size={11} />
                </button>
              </div>
            ) : idx === filledCount ? (
              <label className="cursor-pointer">
                <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onAdd(e, idx)} />
                <div className="flex flex-col items-center justify-center rounded-xl transition-all"
                  style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                  <Plus size={18} style={{ color: ACCENT, marginBottom: 4 }} />
                  <span className="text-xs font-medium" style={{ color: ACCENT }}>img{idx + 1}</span>
                </div>
                <div className="w-full mt-1.5 py-1 rounded-lg text-xs font-mono font-semibold text-center"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', opacity: 0.4 }}>
                  {tagForSlot(idx)}
                </div>
              </label>
            ) : (
              <div>
                <div className="flex flex-col items-center justify-center rounded-xl"
                  style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)', opacity: 0.25 }}>
                  <Plus size={14} style={{ color: 'var(--text-muted)' }} />
                </div>
                <div className="w-full mt-1.5 py-1 rounded-lg text-xs font-mono font-semibold text-center"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', opacity: 0.2 }}>
                  {tagForSlot(idx)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── processing overlay ───────────────────────────────────────────────────────
const ProcessingOverlay = ({ phase, convertProgress }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-8"
    style={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', background: 'rgba(0,0,0,0.45)' }}
  >
    {phase === 'converting' ? (
      <>
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <motion.circle
              cx="32" cy="32" r="28" fill="none" stroke={ACCENT} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - convertProgress / 100)}`}
              style={{ transformOrigin: '32px 32px', rotate: '-90deg' }}
              transition={{ duration: 0.3 }}
            />
          </svg>
          <span className="text-xs font-bold" style={{ color: '#fff' }}>{convertProgress}%</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold tracking-wide" style={{ color: '#fff' }}>Trimming your video</p>
          <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 240, lineHeight: 1.6 }}>
            Re-encoding for the model. Hang tight.
          </p>
        </div>
      </>
    ) : (
      <>
        <motion.div
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2"
          style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
        />
        <p className="text-sm font-semibold tracking-wide" style={{ color: '#fff' }}>Generating…</p>
      </>
    )}
  </motion.div>
)

// ─── main page ────────────────────────────────────────────────────────────────
export default function CreateVideoPage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()
  const textareaRef = useRef(null)

  // ── standard video state ──────────────────────────────────────────────────
  const [prompt,        setPrompt]        = useState('')
  const [startFrame,    setStartFrame]    = useState(null)
  const [endFrame,      setEndFrame]      = useState(null)
  const [refImages,     setRefImages]     = useState([])
  const [multiMode,     setMultiMode]     = useState(false)
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [autoRatio,     setAutoRatio]     = useState(false)
  const [duration,      setDuration]      = useState('5')
  const [withSound,     setWithSound]     = useState(true)
  const [model,         setModel]         = useState('')
  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [fullscreenIdx, setFullscreenIdx] = useState(null)

  // ── video_to_video state ──────────────────────────────────────────────────
  const [editVideo,       setEditVideo]       = useState(null)
  const [trimTarget,      setTrimTarget]      = useState(null)
  const [trimStart,       setTrimStart]       = useState(0)
  const [phase,           setPhase]           = useState(null)
  const [convertProgress, setConvertProgress] = useState(0)

  // ── convertedSettings: snapshot of what the trim actually produced ────────
  // Shape: { duration: number } | null
  // Set after a successful trim, cleared on video removal or fresh upload.
  // Prevents the user from silently changing trimTarget post-trim and inflating
  // the credit cost against a video the model will never see at that duration.
  const [convertedSettings, setConvertedSettings] = useState(null)

  // ── omni ref ──────────────────────────────────────────────────────────────
  const [omniRefLoaded, setOmniRefLoaded] = useState(false)

  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)

  // ── session restore ───────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const savedPrompt = sessionStorage.getItem(SS_PROMPT)
      if (savedPrompt) setPrompt(savedPrompt)
    } catch {}

    try {
      const omniRaw = sessionStorage.getItem(SS_OMNI_REF)
      if (omniRaw) {
        const { url, name } = JSON.parse(omniRaw)
        sessionStorage.removeItem(SS_OMNI_REF)
        setOmniRefLoaded({ url, name })
        return
      }
    } catch {}

    restoreFrame(SS_START_FRAME).then((frame) => {
      if (!frame) return
      setStartFrame(frame)
      const img = new Image()
      img.onload = () => { setAspectRatio(detectAspectRatio(img.width, img.height)); setAutoRatio(true) }
      img.src = frame.url
    })
    restoreFrame(SS_END_FRAME).then((frame) => { if (frame) setEndFrame(frame) })

    try {
      const savedRefs = sessionStorage.getItem(SS_REF_IMAGES)
      if (savedRefs) {
        const arr = JSON.parse(savedRefs)
        Promise.all(arr.map(async ({ base64, name, type }) => {
          const byteString = atob(base64.split(',')[1])
          const ab = new ArrayBuffer(byteString.length)
          const ia = new Uint8Array(ab)
          for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
          const blob = new Blob([ab], { type })
          const file = new File([blob], name, { type })
          const url  = URL.createObjectURL(blob)
          const ar   = await new Promise((res) => {
            const img = new Image()
            img.onload = () => res(detectAspectRatio(img.width, img.height))
            img.src = url
          })
          return { file, url, ar }
        })).then(setRefImages)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(SS_PROMPT, prompt)
      else        sessionStorage.removeItem(SS_PROMPT)
    } catch {}
  }, [prompt])

  const persistRefImages = (imgs) => {
    try {
      if (!imgs.length) { sessionStorage.removeItem(SS_REF_IMAGES); return }
      Promise.all(imgs.map(({ file }) => new Promise((res) => {
        if (!file) return res(null)
        const reader = new FileReader()
        reader.onload = (ev) => res({ base64: ev.target.result, name: file.name, type: file.type })
        reader.readAsDataURL(file)
      }))).then((arr) => {
        const filtered = arr.filter(Boolean)
        if (filtered.length) sessionStorage.setItem(SS_REF_IMAGES, JSON.stringify(filtered))
      })
    } catch {}
  }

  // ── load models ───────────────────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'video')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const isMaster     = profile?.user_tier === 'master'
    const tierFiltered = (data || []).filter((m) => isMaster || m.tier_required !== 'master')
    const list         = await applyModelPreferences(tierFiltered, user?.id)
    setModels(list)
    setModelsLoading(false)
    return list
  }, [])

  useEffect(() => {
    loadModels().then((list) => {
      const unlocked = list.filter((m) => !m.is_locked)

      setOmniRefLoaded((pending) => {
        if (pending && pending.url) {
          const omniModel = unlocked.find((m) => m.supports_multi_image && m.supports_video_input) || unlocked[0]
          if (omniModel) {
            setModel(omniModel.value)
            setMultiMode(true)
            setRefImages([{ file: null, url: pending.url, ar: '9:16', isVideo: true, name: pending.name }])
          }
          return false
        }
        const preferred = profile?.preferred_model
        const match     = preferred && unlocked.find((m) => m.value === preferred)
        setModel((match || unlocked[0])?.value || '')
        return false
      })
    })
  }, [loadModels])

  const selectedModel = models.find((m) => m.value === model)
  const caps          = getModelCaps(selectedModel)

  // ── reset when model changes ──────────────────────────────────────────────
  useEffect(() => {
    if (!caps.supportsMultiImage) {
      setMultiMode(false)
      setRefImages([])
      try { sessionStorage.removeItem(SS_REF_IMAGES) } catch {}
    }
    if (!caps.isVideoEdit) {
      setEditVideo(null)
      setTrimTarget(null)
      setTrimStart(0)
      setConvertedSettings(null)
    }
  }, [model]) // eslint-disable-line

  useEffect(() => {
    if (!selectedModel) return
    if (caps.supportedDurations.length > 0 && !caps.supportedDurations.includes(duration)) {
      setDuration(caps.supportedDurations[0] || '5')
    }
    if (!autoRatio && !caps.supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(caps.supportedAspectRatios[0] || '9:16')
    }
  }, [model]) // eslint-disable-line

  useEffect(() => {
    if (!modelsLoading && !caps.supportsSound) setWithSound(false)
  }, [caps.supportsSound, modelsLoading])

  // ── trim target default ───────────────────────────────────────────────────
  useEffect(() => {
    if (!caps.isVideoEdit || !editVideo?.duration) return
    setTrimTarget(Math.min(editVideo.duration, VIDEO_EDIT_MAX_BILLABLE))
    setTrimStart(0)
  }, [editVideo?.duration, caps.isVideoEdit])

  // clamp trimStart
  useEffect(() => {
    if (!editVideo?.duration || !trimTarget) return
    const maxStart = Math.max(0, editVideo.duration - trimTarget)
    if (trimStart > maxStart) setTrimStart(maxStart)
  }, [editVideo?.duration, trimTarget, trimStart])

  // ── video_to_video compatibility ──────────────────────────────────────────
  const editCompat = useMemo(() => {
    if (!caps.isVideoEdit || !editVideo) return null
    return checkVideoEditCompat({ videoMeta: editVideo, maxBillable: VIDEO_EDIT_MAX_BILLABLE })
  }, [caps.isVideoEdit, editVideo])

  const editCompatStatus = useMemo(() => {
    if (!editVideo || !editCompat) return null
    if (editCompat.tooShort)   return 'rejected'
    if (editVideo._converted)  return 'converted'
    if (editCompat.ok)         return 'compatible'
    if (editCompat.needsTrim)  return 'incompatible'
    return null
  }, [editVideo, editCompat])

  const needsTrim = !!editCompat?.needsTrim && !editVideo?._converted

  // ── billable duration — authoritative for cost and generation payload ─────
  // After conversion, always trust convertedSettings.duration, not the live
  // trimTarget chip (which the user might have changed post-trim).
  const billableDuration = useMemo(() => {
    if (!caps.isVideoEdit) return null
    if (convertedSettings) return convertedSettings.duration          // locked to actual trim output
    if (editVideo?._converted) return editVideo.duration              // fallback: video's own duration
    return Math.min(trimTarget ?? editVideo?.duration ?? VIDEO_EDIT_MAX_BILLABLE, VIDEO_EDIT_MAX_BILLABLE)
  }, [caps.isVideoEdit, convertedSettings, editVideo, trimTarget])

  // ── active frames ─────────────────────────────────────────────────────────
  const activeStartFrame = startFrame && caps.supportsStartFrame                              ? startFrame : null
  const activeEndFrame   = endFrame   && (caps.supportsEndFrame || caps.supportsFrameToFrame) ? endFrame   : null

  const type = multiMode && refImages.length > 0
    ? 'image_to_video'
    : deriveVideoType(activeStartFrame, activeEndFrame)

  const isI2V = multiMode ? refImages.length > 0 : !!(activeStartFrame || activeEndFrame)

  // ── credit cost ───────────────────────────────────────────────────────────
  const creditCost = useMemo(() => {
    if (!selectedModel) return 0
    if (caps.isVideoEdit) {
      const billable = billableDuration ?? VIDEO_EDIT_MAX_BILLABLE
      return billable * VIDEO_EDIT_CPS
    }
    const creditsPerSecond = (isI2V ? selectedModel.credit_cost_i2i : selectedModel.credit_cost_t2i) || 0
    const isFlatRate       = selectedModel?.is_flat_rate ?? false
    if (isFlatRate) return creditsPerSecond
    const base = creditsPerSecond * parseInt(duration || '5')
    return withSound && caps.supportsSound
      ? Math.ceil(base * (selectedModel?.sound_cost_multiplier ?? 1.5))
      : Math.ceil(base)
  }, [selectedModel, caps, isI2V, duration, withSound, billableDuration])

  const canAfford   = credits >= creditCost
  const promptEmpty = !prompt.trim()

  // ── mode label ────────────────────────────────────────────────────────────
  const modeLabel = caps.isVideoEdit
    ? 'Video Edit'
    : multiMode && refImages.length > 0
      ? `Multi-Ref · ${refImages.length} ref${refImages.length > 1 ? 's' : ''}`
      : {
          text_to_video:   'Text to Video',
          image_to_video:  'Image to Video',
          end_frame_text:  'End Frame + Text',
          start_end_frame: 'Start + End Frame',
        }[type]

  // ── frame upload handlers ─────────────────────────────────────────────────
  const handleFrameUpload = (setter, ssKey) => (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    if (!startFrame && !endFrame) {
      const img = new Image()
      img.onload = () => { setAspectRatio(detectAspectRatio(img.width, img.height)); setAutoRatio(true) }
      img.src = url
    }
    setter({ file, url })
    persistFrame(ssKey, file)
  }

  const handleRemoveFrame = (setter, ssKey, isStart) => {
    setter(null)
    try { sessionStorage.removeItem(ssKey) } catch {}
    const otherFrame = isStart ? endFrame : startFrame
    if (!otherFrame) { setAutoRatio(false); setAspectRatio('9:16') }
  }

  // ── multi-ref handlers ────────────────────────────────────────────────────
  const handleAddRefImage = async (e, slotIdx) => {
    const file = e.target.files?.[0]
    if (!file) return
    const isVideoFile = file.type.startsWith('video/')
    if (isVideoFile) {
      const url = URL.createObjectURL(file)
      setRefImages((prev) => {
        const next = [...prev]
        next[slotIdx] = { file, url, ar: '9:16', isVideo: true, name: file.name }
        const trimmed = next.filter((_, i) => i <= slotIdx || next[i] != null)
        persistRefImages(trimmed)
        return trimmed
      })
    } else {
      const compressed = await compressImage(file)
      setRefImages((prev) => {
        const next = [...prev]
        next[slotIdx] = { ...compressed, isVideo: false }
        const trimmed = next.filter((_, i) => i <= slotIdx || next[i] != null)
        persistRefImages(trimmed)
        if (slotIdx === 0) { setAspectRatio(compressed.ar); setAutoRatio(true) }
        return trimmed
      })
    }
  }

  const handleRemoveRefImage = (idx) => {
    setRefImages((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      persistRefImages(next)
      if (idx === 0 && next.length === 0) { setAutoRatio(false); setAspectRatio('9:16') }
      return next
    })
  }

  // ── video_to_video upload ─────────────────────────────────────────────────
  const handleEditVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(`Video must be under ${formatBytes(MAX_VIDEO_BYTES)}. Yours is ${formatBytes(file.size)}.`)
      e.target.value = ''
      return
    }

    const meta = await readVideoMetadata(file)

    if (meta.duration != null && meta.duration < 1) {
      toast.error('Video is too short — minimum 1 second.')
      e.target.value = ''
      return
    }

    const url = URL.createObjectURL(file)
    setEditVideo({ file, url, duration: meta.duration, size: file.size, aspectRatio: meta.aspectRatio })
    setTrimStart(0)
    setConvertedSettings(null) // fresh upload — clear any prior conversion snapshot
    if (meta.aspectRatio && caps.supportedAspectRatios.includes(meta.aspectRatio)) {
      setAspectRatio(meta.aspectRatio)
      setAutoRatio(true)
    }
    e.target.value = ''
  }

  const handleRemoveEditVideo = () => {
    if (editVideo?.url && editVideo?.file) URL.revokeObjectURL(editVideo.url)
    setEditVideo(null)
    setTrimTarget(null)
    setTrimStart(0)
    setConvertedSettings(null)
  }

  // ── trim / convert ────────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!user)       return toast.error('Please sign in')
    if (!editVideo)  return toast.error('Upload a video first')
    if (!trimTarget) return toast.error('Select a trim duration')
    if (credits < VIDEO_EDIT_CONVERT_COST) return toast.error(`Trim costs ${VIDEO_EDIT_CONVERT_COST} credits.`)

    setPhase('converting')
    setConvertProgress(0)

    let processed
    try {
      processed = await callTrimEdgeFunction({
        file:           editVideo.file,
        url:            editVideo.url,
        userId:         user.id,
        targetDuration: trimTarget,
        startTime:      trimStart,
        onProgress:     (p) => setConvertProgress(p),
      })
    } catch (err) {
      setPhase(null)
      setConvertProgress(0)
      toast.error(err?.message || 'Trim failed.')
      return
    }

    try {
      await supabase.rpc('deduct_credits', {
        p_user_id:       user.id,
        p_amount:        VIDEO_EDIT_CONVERT_COST,
        p_generation_id: null,
        p_description:   'Video Edit trim conversion',
      })
    } catch {}

    refreshProfile()
    setPhase(null)
    setConvertProgress(0)

    const actualDuration = processed.duration ?? trimTarget

    // Hydrate the video card and lock in what was actually produced
    setEditVideo({
      file:        null,
      url:         processed.url,
      duration:    actualDuration,
      _converted:  true,
    })
    setConvertedSettings({ duration: actualDuration })

    // Snap the chip to match the actual output so the UI is consistent
    setTrimTarget(actualDuration)
    setTrimStart(0)

    toast.success('Video trimmed — ready to generate!', { duration: 3000 })
  }

  // ── tag insertion ─────────────────────────────────────────────────────────
  const handleTagInsert = (tag) => {
    const el = textareaRef.current
    if (!el) { setPrompt((p) => p ? `${p} ${tag}` : tag); return }
    const start    = el.selectionStart
    const end      = el.selectionEnd
    const before   = prompt.slice(0, start)
    const after    = prompt.slice(end)
    const needsSpc = before.length > 0 && !before.endsWith(' ')
    const inserted = `${needsSpc ? ' ' : ''}${tag} `
    setPrompt(before + inserted + after)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + inserted.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  // ── generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (promptEmpty)    return toast.error('Enter a prompt')
    if (!selectedModel) return toast.error('Pick a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    if (caps.isVideoEdit) {
      if (!editVideo)           return toast.error('Upload a video to edit')
      if (editCompat?.tooShort) return toast.error('Video is too short for this model')
      if (needsTrim)            return toast.error('Trim your video first, then generate')
    }

    setPhase('submitting')
    try {
      // ── video_to_video path ───────────────────────────────────────────────
      if (caps.isVideoEdit) {
        let videoUrl
        if (!editVideo.file) {
          videoUrl = editVideo.url
        } else {
          const ext  = (editVideo.file.name.split('.').pop() || 'mp4').toLowerCase()
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('generation-uploads')
            .upload(path, editVideo.file, { upsert: false, cacheControl: '3600', contentType: editVideo.file.type || 'video/mp4' })
          if (upErr) throw new Error('Video upload failed')
          const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)
          videoUrl = publicUrl
        }

        // Use billableDuration — locked to convertedSettings when available
        const finalDuration = billableDuration ?? VIDEO_EDIT_MAX_BILLABLE
        const finalCost     = finalDuration * VIDEO_EDIT_CPS

        const { data: genRow, error: genErr } = await generationsDb.create({
          user_id:                user.id,
          generation_type:        'video_to_video',
          status:                 'pending',
          prompt,
          model,
          aspect_ratio:           aspectRatio,
          duration:               String(finalDuration),
          credits_charged:        finalCost,
          output_type:            'video',
          input_image_urls:       [videoUrl],
          with_sound:             false,
          skip_prompt_refinement: true,
        })
        if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

        const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, finalCost, genRow.id)
        if (dErr || !deduct?.success) {
          await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
          throw new Error(deduct?.error || 'Not enough credits')
        }

        supabase.functions.invoke('video-generate', { body: { generationId: genRow.id } })
          .catch((e) => console.error('video-generate invoke error', e))

        refreshProfile()
        toast.success('Your edited video is being generated. Check your Media page.', { duration: 4000 })
        setPrompt('')
        handleRemoveEditVideo()
        return
      }

      // ── standard path ─────────────────────────────────────────────────────
      let startFrameUrl = null
      if (!multiMode && activeStartFrame) {
        if (activeStartFrame.file) {
          const ext  = (activeStartFrame.file.name.split('.').pop() || 'jpg').toLowerCase()
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('generation-uploads')
            .upload(path, activeStartFrame.file, { upsert: false, cacheControl: '3600', contentType: activeStartFrame.file.type })
          if (upErr) throw new Error('Start frame upload failed')
          const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)
          startFrameUrl = publicUrl
        } else {
          startFrameUrl = activeStartFrame.url
        }
      }

      let endFrameUrl = null
      if (!multiMode && activeEndFrame?.file) {
        const ext  = (activeEndFrame.file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, activeEndFrame.file, { upsert: false, cacheControl: '3600', contentType: activeEndFrame.file.type })
        if (upErr) throw new Error('End frame upload failed')
        const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)
        endFrameUrl = publicUrl
      }

      const uploadedRefUrls = []
      if (multiMode && refImages.length > 0) {
        for (const img of refImages) {
          if (!img) continue
          if (!img.file) { uploadedRefUrls.push(img.url); continue }
          const contentType = img.file.type || 'image/jpeg'
          const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`
          const { data: uploadData, error: upErr } = await supabase.storage
            .from('generation-uploads')
            .upload(path, img.file, { upsert: false, cacheControl: '3600', contentType })
          if (upErr) throw new Error(`Reference upload failed: ${upErr.message}`)
          const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(uploadData.path)
          uploadedRefUrls.push(publicUrl)
        }
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
        input_image_urls:       uploadedRefUrls.length ? uploadedRefUrls : null,
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
      setRefImages([])
      setAutoRatio(false)
      setAspectRatio('9:16')
      setWithSound(true)
      try {
        sessionStorage.removeItem(SS_PROMPT)
        sessionStorage.removeItem(SS_START_FRAME)
        sessionStorage.removeItem(SS_END_FRAME)
        sessionStorage.removeItem(SS_REF_IMAGES)
      } catch {}

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setPhase(null)
    }
  }

  const fullscreenImage = fullscreenIdx !== null ? refImages[fullscreenIdx] : null
  const isProcessing    = phase !== null

  const generateDisabled = isProcessing || !canAfford || promptEmpty || !selectedModel
    || (caps.isVideoEdit && (!editVideo || editCompat?.tooShort || needsTrim))

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      <AnimatePresence>
        {isProcessing && <ProcessingOverlay phase={phase} convertProgress={convertProgress} />}
      </AnimatePresence>

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)' }}
            onClick={() => setFullscreenIdx(null)}
          >
            <button onClick={() => setFullscreenIdx(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
              <X size={18} />
            </button>
            {fullscreenImage.isVideo ? (
              <motion.video
                initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                src={fullscreenImage.url} controls autoPlay className="rounded-2xl"
                style={{ maxWidth: '100%', maxHeight: '90dvh' }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <motion.img
                initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
                src={fullscreenImage.url} alt="Reference full" className="rounded-2xl"
                style={{ maxWidth: '100%', maxHeight: '90dvh', objectFit: 'contain' }}
                onClick={(e) => e.stopPropagation()}
              />
            )}
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
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Video</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>{modeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && <ModelDropdown models={models} value={model} onChange={setModel} />}
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

          {/* ── VIDEO_TO_VIDEO SECTION ────────────────────────────────────── */}
          {caps.isVideoEdit ? (
            <>
              {/* Info banner */}
              <div className="rounded-2xl px-4 py-3 flex gap-3 items-start"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                <Film size={16} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Upload a video and describe the style transformation. The model edits across all frames.
                </p>
              </div>

              {/* Video upload */}
              <div>
                <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Source Video
                </p>
                <VideoUploadZone
                  value={editVideo}
                  onUpload={handleEditVideoUpload}
                  onRemove={handleRemoveEditVideo}
                  compatStatus={editCompatStatus}
                  tooShort={!!editCompat?.tooShort}
                />

                {/* Too short rejection */}
                <AnimatePresence>
                  {editCompat?.tooShort && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: '#ef4444' }}>{editCompat.reason}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Ready confirmation */}
                {(editCompat?.ok || editVideo?._converted) && editVideo && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Video is{' '}
                    <strong style={{ color: ACCENT }}>
                      {editVideo.duration}s{editVideo._converted ? ' · trimmed' : ''}
                    </strong>{' '}
                    — ready to generate.
                    {convertedSettings && (
                      <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                        · Billing locked to <strong style={{ color: ACCENT }}>{convertedSettings.duration}s</strong>.
                      </span>
                    )}
                  </p>
                )}
              </div>

              {/* Trim UI — shown when video > 8s and not yet converted */}
              {editVideo && !editCompat?.tooShort && editCompat?.needsTrim && !editVideo._converted && (
                <div className="rounded-2xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Scissors size={14} style={{ color: ACCENT }} />
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      Trim to duration
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap mb-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((d) => {
                      const tooLong = editVideo.duration != null && d > editVideo.duration
                      return (
                        <button
                          key={d}
                          disabled={tooLong}
                          onClick={() => { setTrimTarget(d); setTrimStart(0) }}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                          style={{
                            background: d === trimTarget ? ACCENT    : 'var(--bg-card)',
                            color:      d === trimTarget ? '#ffffff' : 'var(--text-secondary)',
                            opacity:    tooLong ? 0.3 : 1,
                            cursor:     tooLong ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {d}s
                        </button>
                      )
                    })}
                  </div>

                  {trimTarget != null && editVideo.duration > trimTarget && (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Start time</p>
                        <p className="text-xs font-bold" style={{ color: ACCENT }}>
                          {trimStart}s → {trimStart + trimTarget}s
                        </p>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, editVideo.duration - trimTarget)}
                        step={1}
                        value={trimStart}
                        onChange={(e) => setTrimStart(Number(e.target.value))}
                        className="w-full"
                        style={{ accentColor: ACCENT }}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Post-trim locked duration display — replaces trim UI after conversion */}
              {editVideo?._converted && convertedSettings && (
                <div className="rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <Lock size={14} style={{ color: ACCENT, flexShrink: 0 }} />
                  <div className="flex-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Trimmed to {convertedSettings.duration}s
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      Duration is locked. Remove the video and re-upload to trim differently.
                    </p>
                  </div>
                  <div className="px-2.5 py-1 rounded-lg text-xs font-bold"
                    style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                    {convertedSettings.duration * VIDEO_EDIT_CPS} cr
                  </div>
                </div>
              )}

              {/* Conversion panel */}
              <AnimatePresence>
                {needsTrim && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{ background: 'rgba(239,160,20,0.08)', border: '1px solid rgba(239,160,20,0.25)' }}
                  >
                    <div className="flex items-start gap-2">
                      <RefreshCw size={14} style={{ color: '#efa014', marginTop: 2, flexShrink: 0 }} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#efa014' }}>Video needs trimming</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                          {editCompat?.reason}
                          {trimTarget && (
                            <> · Clip: <strong>{trimStart}s → {trimStart + trimTarget}s</strong></>
                          )}
                        </p>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          Trim cost: <strong style={{ color: 'var(--text-primary)' }}>{VIDEO_EDIT_CONVERT_COST} credits</strong>.
                          Trimmed video loads here — no redirect needed.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleConvert}
                        disabled={credits < VIDEO_EDIT_CONVERT_COST || isProcessing || !trimTarget}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: credits >= VIDEO_EDIT_CONVERT_COST && !isProcessing && trimTarget ? ACCENT : 'var(--bg-elevated)',
                          color:      credits >= VIDEO_EDIT_CONVERT_COST && !isProcessing && trimTarget ? '#fff'  : 'var(--text-muted)',
                          cursor:     credits >= VIDEO_EDIT_CONVERT_COST && !isProcessing && trimTarget ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Trim &amp; Continue · {VIDEO_EDIT_CONVERT_COST} cr
                      </button>
                      <button
                        onClick={handleRemoveEditVideo}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                      >
                        Cancel
                      </button>
                    </div>
                    {credits < VIDEO_EDIT_CONVERT_COST && (
                      <p className="text-xs" style={{ color: '#ef4444' }}>
                        Not enough credits to trim.{' '}
                        <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Top up</button>
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          ) : (
            /* ── STANDARD FRAMES / MULTI-REF SECTION ────────────────────── */
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {caps.supportsMultiImage && multiMode ? 'Reference' : 'Frames'}
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — optional</span>
                </p>
                {caps.supportsMultiImage && (
                  <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    {[{ value: false, label: 'Frames' }, { value: true, label: 'Multi-ref' }].map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => {
                          setMultiMode(opt.value)
                          if (!opt.value) {
                            setRefImages([])
                            try { sessionStorage.removeItem(SS_REF_IMAGES) } catch {}
                          }
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{
                          background: multiMode === opt.value ? ACCENT    : 'transparent',
                          color:      multiMode === opt.value ? '#ffffff' : 'var(--text-muted)',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {caps.supportsMultiImage && multiMode ? (
                <MultiRefGrid
                  images={refImages}
                  maxImages={caps.maxRefImages}
                  onAdd={handleAddRefImage}
                  onRemove={handleRemoveRefImage}
                  onTagInsert={handleTagInsert}
                  onFullscreen={(idx) => setFullscreenIdx(idx)}
                />
              ) : (
                <>
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
                  {autoRatio && !multiMode && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Aspect ratio auto-set to <strong>{aspectRatio}</strong> from uploaded frame
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Prompt */}
          <Textarea
            ref={textareaRef}
            label="Prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              caps.isVideoEdit
                ? 'Describe the style transformation e.g. "animate style with vibrant colors"'
                : caps.supportsMultiImage && multiMode && refImages.length > 0
                  ? `e.g. ${tagForSlot(0)} walks through a neon-lit street, medium tracking shot`
                  : 'Describe the motion, scene, or action…'
            }
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
            {caps.supportedDurations.length > 0 && (
              <SettingChips
                label="Duration"
                options={caps.supportedDurations.map((d) => ({ label: `${d}s`, value: d, disabled: false }))}
                value={duration}
                onChange={setDuration}
              />
            )}
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
            disabled={generateDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: generateDisabled ? 'var(--bg-elevated)' : ACCENT,
              color:      generateDisabled ? 'var(--text-muted)'  : '#ffffff',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {isProcessing
              ? phase === 'converting' ? 'Trimming…' : 'Generating…'
              : `Generate · ${creditCost} cr`
            }
          </button>

          {caps.isVideoEdit && needsTrim && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Trim your video above to continue.
            </p>
          )}
          {caps.isVideoEdit && editCompat?.tooShort && (
            <p className="text-xs text-center mt-2" style={{ color: '#ef4444' }}>
              Video is too short — upload a different one.
            </p>
          )}
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
