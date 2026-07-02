import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, X, ImagePlus, VideoIcon, Mic, FileText,
  Users, User, Library, Play, Pause, Loader2, ChevronDown,
  AlertTriangle, CheckCircle2, RefreshCw, Scissors,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import { ugcAudioChunks } from '@/lib/ugcVoices'
import toast from 'react-hot-toast'
import { applyModelPreferences } from '@/hooks/useModelPreferences'

const ACCENT     = 'var(--tool-talking-head)'
const ACCENT_SUB = 'var(--tool-talking-head-subtle)'
const ACCENT_BDR = 'var(--tool-talking-head-border)'

const SS_PROMPT         = 'meckury_th_prompt'
const SS_SUBJECT_IMG    = 'meckury_th_subject_img'
const SS_SUBJECT_VID    = 'meckury_th_subject_vid'
const SS_LIPSYNC_PREFILL = 'meckury_th_lipsync_prefill'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

const VIDEO_TRIM_COST = 2

// ─────────────────────────────────────────────────────────────────────────────
// CAPABILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
    requiresImage:         false,
    requiresAudio:         false,
    requiresVideo:         false,
    requiresVoiceId:       false,
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
    requiresImage:         model.requires_image          ?? false,
    requiresAudio:         model.requires_audio          ?? false,
    requiresVideo:         model.requires_video          ?? false,
    requiresVoiceId:       model.requires_voice_id       ?? false,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DURATION / AUDIO BUDGET HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function totalSlotDuration(slots) {
  return slots.filter(Boolean).reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0)
}

function trimSlotsToLimit(slots, limitS) {
  let cumulative = 0
  let cutIndex   = null
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) continue
    const dur = slots[i].duration_seconds ?? 0
    if (cumulative + dur > limitS + 0.25) { cutIndex = i; break }
    cumulative += dur
  }
  if (cutIndex === null) return { kept: slots, dropped: 0 }
  const kept    = slots.slice(0, cutIndex).filter(Boolean)
  const dropped = slots.slice(cutIndex).filter(Boolean).length
  return { kept, dropped }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function audioBufferToWav(buffer) {
  const numChannels    = buffer.numberOfChannels
  const sampleRate     = buffer.sampleRate
  const numSamples     = buffer.length
  const bytesPerSample = 2
  const dataSize       = numSamples * numChannels * bytesPerSample
  const ab             = new ArrayBuffer(44 + dataSize)
  const view           = new DataView(ab)
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
  ws(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE')
  ws(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true); view.setUint16(34, 16, true)
  ws(36, 'data'); view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }
  return new Blob([ab], { type: 'audio/wav' })
}

async function decodeBlob(blob) {
  const ctx = new AudioContext()
  const ab  = await blob.arrayBuffer()
  return ctx.decodeAudioData(ab)
}

function getAudioDuration(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url   = URL.createObjectURL(fileOrBlob)
    const audio = new Audio()
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(audio.duration) }
    audio.onerror          = () => { URL.revokeObjectURL(url); reject(new Error('Could not read audio duration')) }
    audio.src = url
  })
}

async function trimAudioToLimit(blob, maxSeconds, startTime = 0) {
  const buffer      = await decodeBlob(blob)
  const startSample = Math.floor(startTime * buffer.sampleRate)
  const maxSamples  = Math.floor(maxSeconds * buffer.sampleRate)
  const endSample   = Math.min(startSample + maxSamples, buffer.length)
  const trimSamples = endSample - startSample

  if (startSample === 0 && buffer.length <= maxSamples) return blob

  const ctx = new OfflineAudioContext(buffer.numberOfChannels, trimSamples, buffer.sampleRate)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.connect(ctx.destination)
  src.start(0, startTime, maxSeconds)
  const trimmed = await ctx.startRendering()
  return audioBufferToWav(trimmed)
}

async function concatenateAudioBlobs(blobs) {
  if (blobs.length === 1) {
    const buf = await decodeBlob(blobs[0])
    return audioBufferToWav(buf)
  }
  const buffers    = await Promise.all(blobs.map(decodeBlob))
  const sampleRate = buffers[0].sampleRate
  const numCh      = buffers[0].numberOfChannels
  const totalLen   = buffers.reduce((acc, b) => acc + b.length, 0)
  const ctx        = new OfflineAudioContext(numCh, totalLen, sampleRate)
  let   offset     = 0
  for (const buf of buffers) {
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(offset / sampleRate)
    offset += buf.length
  }
  const rendered = await ctx.startRendering()
  return audioBufferToWav(rendered)
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function detectAspectRatio(w, h) {
  const r = w / h
  if (r > 1.6) return '16:9'
  if (r < 0.75) return '9:16'
  return '1:1'
}

function formatDuration(secs) {
  if (!secs && secs !== 0) return '—'
  const s = Math.round(Number(secs))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60 ? `${s % 60}s` : ''}`.trim()
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  vid.onerror = () => {
    URL.revokeObjectURL(url)
    resolve({ duration: null, width: null, height: null, aspectRatio: null })
  }
  vid.src = url
})

async function callTrimEdgeFunction({ file, url, userId, targetDuration, startTime, onProgress }) {
  onProgress?.(5)
  let sourceUrl       = url
  let tempStoragePath = null

  if (file) {
    const ext     = (file.name.split('.').pop() || 'mp4').toLowerCase()
    const srcPath = `${userId}/th-video-src/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('generation-uploads')
      .upload(srcPath, file, { upsert: false, cacheControl: '3600', contentType: file.type || 'video/mp4' })
    if (upErr) throw new Error(upErr.message || 'Could not upload source video')
    onProgress?.(20)
    const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(srcPath)
    sourceUrl       = publicUrl
    tempStoragePath = srcPath
  }

  onProgress?.(25)
  let virtualPct = 25
  const tick = setInterval(() => { virtualPct = Math.min(virtualPct + 2, 90); onProgress?.(virtualPct) }, 800)
  let result
  try {
    const { data, error } = await supabase.functions.invoke('process-video-for-motion', {
      body: { sourceUrl, targetDuration, startTime, trimOnly: true },
    })
    if (error)          throw new Error(error.message || 'Trim edge function failed')
    if (!data?.success) throw new Error(data?.error   || 'Trim failed')
    result = data
  } finally {
    clearInterval(tick)
    if (tempStoragePath) {
      supabase.storage.from('generation-uploads').remove([tempStoragePath]).catch(() => {})
    }
  }

  onProgress?.(100)
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
        })
      }, 'image/jpeg', 0.92)
    }
    img.src = url
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSION PERSISTENCE
// ─────────────────────────────────────────────────────────────────────────────

const persistFile = (key, url, name) => {
  if (!url) { try { sessionStorage.removeItem(key) } catch {} ; return }
  try {
    sessionStorage.setItem(key, JSON.stringify({ url, name }))
  } catch {}
}

const restoreFile = (key) => new Promise((resolve) => {
  try {
    const saved = sessionStorage.getItem(key)
    if (!saved) return resolve(null)
    sessionStorage.removeItem(key)
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

// ─────────────────────────────────────────────────────────────────────────────
// SETTING CHIPS
// ─────────────────────────────────────────────────────────────────────────────

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
            background: value === opt.value ? ACCENT : 'var(--bg-elevated)',
            color:      value === opt.value ? '#ffffff' : 'var(--text-secondary)',
            opacity:    opt.disabled ? 0.3 : 1,
            cursor:     opt.disabled ? 'not-allowed' : 'pointer',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// MODEL DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────

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
        style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
       <span>{selected?.label || 'Model'}</span>
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
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute right-0 top-9 z-50 w-64 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}>
              <div className="py-1">
                {unlocked.map((m) => {
                  const caps = getModelCaps(m)
                  const tags = [
                    caps.requiresImage   && 'Photo',
                    caps.requiresVideo   && 'Video',
                    caps.requiresAudio   && 'Audio',
                    caps.requiresVoiceId && 'Script→Voice',
                    caps.multiChar       && '2-char',
                  ].filter(Boolean)
                  return (
                    <button
                      key={m.value}
                      onClick={() => { onChange(m.value); setOpen(false) }}
                      className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                      style={{ background: m.value === value ? ACCENT_SUB : 'transparent' }}>
                      <div className="min-w-0">
                       <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                        {m.description && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.description}</p>
                        )}
                        {tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {tags.map((t) => (
                              <span key={t} className="px-1.5 py-0.5 rounded-md font-semibold"
                                style={{ background: ACCENT_SUB, color: ACCENT, fontSize: 10 }}>
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {m.value === value && (
                        <span style={{ color: ACCENT, fontSize: 14, flexShrink: 0, marginLeft: 8 }}>✓</span>
                      )}
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

// ─────────────────────────────────────────────────────────────────────────────
// SUBJECT SLOT
// ─────────────────────────────────────────────────────────────────────────────

const SubjectSlot = ({ mode, faceImage, videoFile, onFaceUpload, onVideoUpload, onFaceRemove, onVideoRemove, videoCompatStatus }) => {
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
        <label
          className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all w-full max-w-[200px]"
          style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
          <input type="file" accept="image/*" className="hidden" onChange={onFaceUpload} />
          <ImagePlus size={24} style={{ color: ACCENT, marginBottom: 8 }} />
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload face photo</span>
          <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Clear, front-facing</span>
        </label>
      </div>
    )
  }

  if (videoFile) {
    const compatMap = {
      compatible:   { bg: 'rgba(16,185,129,0.85)',  icon: <CheckCircle2 size={11} />, text: 'Ready'           },
      incompatible: { bg: 'rgba(239,160,20,0.9)',   icon: <RefreshCw   size={11} />, text: 'Needs trim'      },
      converted:    { bg: 'rgba(16,185,129,0.85)',  icon: <CheckCircle2 size={11} />, text: 'Trimmed · Ready' },
      rejected:     { bg: 'rgba(239,68,68,0.92)',   icon: <AlertTriangle size={11} />, text: 'Too short'      },
    }
    const badge = videoCompatStatus ? compatMap[videoCompatStatus] : null

    return (
      <div className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: videoFile.aspectRatio?.replace(':', '/') || '9/16', background: 'var(--bg-elevated)', maxHeight: 320 }}>
        <video src={videoFile.url} className="w-full h-full object-cover" muted loop autoPlay playsInline />
        {videoFile.duration != null && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
            {formatDuration(videoFile.duration)}
            {videoFile.size && <span className="ml-1.5 opacity-70">· {formatBytes(videoFile.size)}</span>}
          </div>
        )}
        {badge && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
            style={{ background: badge.bg, color: '#fff' }}>
            {badge.icon}{badge.text}
          </div>
        )}
        <button onClick={onVideoRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', zIndex: 10 }}>
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <label
      className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all"
      style={{ minHeight: 160, border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
      <input type="file" accept="video/*" className="hidden" onChange={onVideoUpload} />
      <VideoIcon size={24} style={{ color: ACCENT, marginBottom: 8 }} />
      <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload subject video</span>
      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>MP4 · MOV · max 40 MB</span>
    </label>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSING OVERLAY
// ─────────────────────────────────────────────────────────────────────────────

const ProcessingOverlay = ({ phase, convertProgress, audioSlots1, audioSlots2 }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
    style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}>
    {phase === 'trimming_video' ? (
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
          <p className="text-sm font-bold tracking-wide" style={{ color: '#fff' }}>Trimming video</p>
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
        <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>
          {audioSlots1?.filter(Boolean).length > 1 || audioSlots2?.filter(Boolean).length > 1
            ? 'Joining audio parts…'
            : 'Generating…'}
        </p>
      </>
    )}
  </motion.div>
)

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO SOURCE PICKER
// ─────────────────────────────────────────────────────────────────────────────

const sharedPickerAudio = { ref: null }

function AudioSourcePicker({ onAudioUpload, onImport, userId, maxDurationS, slotIndex }) {
  const [mode,          setMode]          = useState(null)
  const [generations,   setGens]          = useState([])
  const [loadingList,   setLoadingList]   = useState(false)
  const [playing,       setPlaying]       = useState(null)
  const [expandedId,    setExpandedId]    = useState(null)
  const [chunksMap,     setChunksMap]     = useState({})
  const [loadingChunks, setLoadingChunks] = useState(null)

  const fmtS = (s) => Number.isFinite(s) ? (s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`) : '—'

  const openPicker = async () => {
    setMode('pick')
    setLoadingList(true)
    const { data, error } = await supabase
      .from('ugc_audio_generations')
      .select('id, script, duration_seconds, output_url, created_at, chunk_count, voice:ugc_voices(name)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error) setGens(data || [])
    setLoadingList(false)
  }

  const stopAudio = () => {
    if (sharedPickerAudio.ref) { sharedPickerAudio.ref.pause(); sharedPickerAudio.ref = null }
    setPlaying(null)
  }

  const togglePlay = (id, url) => {
    if (playing === id) { stopAudio(); return }
    stopAudio()
    if (!url) return
    const audio = new Audio(url)
    audio.onended = () => setPlaying(null)
    audio.play()
    sharedPickerAudio.ref = audio
    setPlaying(id)
  }

  const handleExpand = async (gen) => {
    if (expandedId === gen.id) { stopAudio(); setExpandedId(null); return }
    stopAudio(); setExpandedId(gen.id)
    if (chunksMap[gen.id]) return
    if (!gen.chunk_count || gen.chunk_count === 0) { setChunksMap((p) => ({ ...p, [gen.id]: [] })); return }
    setLoadingChunks(gen.id)
    const { data, error } = await ugcAudioChunks.getByGeneration(gen.id)
    setChunksMap((p) => ({ ...p, [gen.id]: error ? [] : (data || []) }))
    setLoadingChunks(null)
  }

  const handleImportChunk = (gen, chunk) => {
    const chunkDur = chunk.duration_ms ? chunk.duration_ms / 1000 : null
    stopAudio()
    onImport({
      output_url:       chunk.public_url,
      name:             chunk.label,
      voice:            gen.voice,
      duration_seconds: chunkDur ?? maxDurationS,
      fromChunk:        true,
      chunkLabel:       chunk.label,
    })
  }

  const handleImportFull = (gen) => { stopAudio(); onImport(gen) }

  if (mode === null) {
    return (
      <div className="flex gap-2">
        <label
          className="flex-1 flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all gap-1.5 py-5"
          style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
          <input type="file" accept="audio/*" className="hidden" onChange={onAudioUpload} />
          <Mic size={20} style={{ color: ACCENT }} />
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload file</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto-trimmed to fit</span>
        </label>
        <button
          onClick={openPicker}
          className="flex-1 flex flex-col items-center justify-center rounded-2xl transition-all gap-1.5 py-5"
          style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
          <Library size={20} style={{ color: ACCENT }} />
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>My generations</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Browse &amp; import</span>
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-elevated)' }}>
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>My Generated Audio</span>
        <button onClick={() => { stopAudio(); setMode(null) }} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
          <X size={13} />
        </button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 380 }}>
        {loadingList ? (
          <div className="flex justify-center py-8">
            <Loader2 size={18} style={{ color: ACCENT }} className="animate-spin" />
          </div>
        ) : generations.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No generated audio yet</p>
        ) : generations.map((gen) => {
          const dur        = gen.duration_seconds ? `${Math.round(gen.duration_seconds)}s` : '—'
          const date       = new Date(gen.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          const snippet    = gen.script?.length > 55 ? gen.script.slice(0, 55) + '…' : gen.script
          const isExpanded = expandedId === gen.id
          const chunks     = chunksMap[gen.id] || []
          const hasChunks  = gen.chunk_count > 0
          const willTrim   = gen.duration_seconds != null && gen.duration_seconds > maxDurationS + 0.25

          return (
            <div key={gen.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <button
                  onClick={() => togglePlay(gen.id, gen.output_url)}
                  disabled={!gen.output_url}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                  style={{ background: playing === gen.id ? ACCENT : ACCENT_SUB, opacity: gen.output_url ? 1 : 0.3 }}>
                  {playing === gen.id
                    ? <Pause size={13} style={{ color: '#fff'  }} fill="currentColor" />
                    : <Play  size={13} style={{ color: ACCENT }} fill="currentColor" />}
                </button>
                <button className="flex-1 min-w-0 text-left" onClick={() => hasChunks && handleExpand(gen)}>
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{snippet}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {gen.voice?.name ?? 'Voice'} · {dur}{hasChunks ? ` · ${gen.chunk_count} parts` : ''} · {date}
                  </p>
                  {willTrim && !hasChunks && (
                    <p className="text-xs mt-0.5 font-semibold" style={{ color: '#f59e0b' }}>
                      Will trim to {fmtS(maxDurationS)}
                    </p>
                  )}
                </button>
                {hasChunks ? (
                  <button
                    onClick={() => handleExpand(gen)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{ background: isExpanded ? ACCENT : ACCENT_SUB, color: isExpanded ? '#fff' : ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                    <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    Parts
                  </button>
                ) : (
                  <button
                    onClick={() => handleImportFull(gen)}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{ background: ACCENT, color: '#fff' }}>
                    {willTrim ? 'Import & trim' : 'Use'}
                  </button>
                )}
              </div>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}>
                    <div className="px-3 pb-2 pt-1 flex flex-col gap-1.5"
                      style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                      {loadingChunks === gen.id ? (
                        <div className="flex justify-center py-3">
                          <Loader2 size={15} style={{ color: ACCENT }} className="animate-spin" />
                        </div>
                      ) : chunks.length === 0 ? (
                        <div className="flex items-center justify-between py-2">
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Parts not ready — use full audio</p>
                          <button onClick={() => handleImportFull(gen)}
                            className="flex-shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                            style={{ background: ACCENT, color: '#fff' }}>
                            Use full
                          </button>
                        </div>
                      ) : chunks.map((chunk) => {
                        const chunkDur    = chunk.duration_ms ? chunk.duration_ms / 1000 : null
                        const chunkDurStr = chunkDur != null ? `${chunkDur.toFixed(1)}s` : '—'
                        const willTrimCk  = chunkDur != null && chunkDur > maxDurationS + 0.25
                        const isPlayingCk = playing === chunk.id
                        return (
                          <div key={chunk.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl"
                            style={{ background: 'var(--bg-elevated)' }}>
                            <button onClick={() => togglePlay(chunk.id, chunk.public_url)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                              style={{ background: isPlayingCk ? ACCENT : ACCENT_SUB }}>
                              {isPlayingCk
                                ? <Pause size={11} style={{ color: '#fff'  }} fill="currentColor" />
                                : <Play  size={11} style={{ color: ACCENT }} fill="currentColor" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{chunk.label}</p>
                              <p className="text-xs" style={{ color: willTrimCk ? '#f59e0b' : 'var(--text-muted)' }}>
                                {chunkDurStr}{willTrimCk ? ` · will trim to ${fmtS(maxDurationS)}` : ''}
                              </p>
                            </div>
                            <button onClick={() => handleImportChunk(gen, chunk)}
                              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95"
                              style={{ background: ACCENT, color: '#fff' }}>
                              {willTrimCk ? 'Import & trim' : 'Use'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAINED AUDIO PLAYER
// ─────────────────────────────────────────────────────────────────────────────

function ChainedAudioPlayer({ audioSlots, onSlotClear, onSlotStartChange }) {
  const [playing,  setPlaying]  = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef   = useRef(null)
  const blobUrlRef = useRef(null)
  const rafRef     = useRef(null)

  const filledSlots = audioSlots.filter(Boolean)
  const totalDur    = filledSlots.reduce((a, s) => a + (s.duration_seconds ?? 0), 0)
  const fmtTime     = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const fmtS        = (s) => Number.isFinite(s) ? (s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`) : '—'

  const buildChain = useCallback(async () => {
    const blobs = await Promise.all(
      filledSlots.map(async (slot) => {
        let blob = slot.file
          ? slot.file
          : await fetch(slot.url).then((r) => { if (!r.ok) throw new Error('fetch failed'); return r.blob() })
        if (slot._needsTrim && slot._trimToSeconds > 0) {
          blob = await trimAudioToLimit(blob, slot._trimToSeconds, slot._trimStartTime ?? 0)
        }
        return blob
      })
    )
    if (blobs.length === 1) return URL.createObjectURL(blobs[0])
    const combined = await concatenateAudioBlobs(blobs)
    return URL.createObjectURL(combined)
  }, [filledSlots.map((s) => `${s.url}|${s._trimStartTime ?? 0}|${s._trimToSeconds ?? 0}`).join('|')]) // eslint-disable-line

  useEffect(() => {
    return () => {
      if (rafRef.current)     cancelAnimationFrame(rafRef.current)
      if (audioRef.current)   { audioRef.current.pause(); audioRef.current = null }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (audioRef.current)   { audioRef.current.pause(); audioRef.current = null }
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
    if (rafRef.current)     cancelAnimationFrame(rafRef.current)
    setPlaying(false); setProgress(0)
  }, [filledSlots.length])

  const tickProgress = () => {
    const a = audioRef.current
    if (!a || a.paused) return
    setProgress(a.duration ? a.currentTime / a.duration : 0)
    rafRef.current = requestAnimationFrame(tickProgress)
  }

  const handlePlayPause = async () => {
    if (playing) { audioRef.current?.pause(); setPlaying(false); return }
    try {
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null }
      blobUrlRef.current = await buildChain()
      if (!audioRef.current) {
        const a = new Audio(blobUrlRef.current)
        a.onended = () => { setPlaying(false); setProgress(0) }
        audioRef.current = a
      } else {
        audioRef.current.src = blobUrlRef.current
      }
      await audioRef.current.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tickProgress)
    } catch (err) {
      toast.error('Could not play audio'); console.error(err)
    }
  }

  const handleSeek = (e) => {
    const a = audioRef.current
    if (!a || !a.duration) return
    const rect  = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    a.currentTime = ratio * a.duration
    setProgress(ratio)
  }

  if (filledSlots.length === 0) return null

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      className="flex flex-col gap-2 p-3 rounded-2xl"
      style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}` }}>
      <div className="flex items-center gap-3">
        <button onClick={handlePlayPause}
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
          style={{ background: ACCENT }}>
          {playing
            ? <Pause size={14} style={{ color: '#fff' }} fill="currentColor" />
            : <Play  size={14} style={{ color: '#fff' }} fill="currentColor" />}
        </button>
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <div className="relative h-1.5 rounded-full cursor-pointer" style={{ background: 'var(--bg-card)' }}
            onClick={handleSeek}>
            <div className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{ width: `${progress * 100}%`, background: ACCENT }} />
          </div>
          <div className="flex justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {filledSlots.length} part{filledSlots.length > 1 ? 's' : ''} chained
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtTime(totalDur)}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {audioSlots.map((slot, i) => slot && (
          <div key={i} className="flex flex-col gap-1 px-2 py-1.5 rounded-xl" style={{ background: 'var(--bg-card)' }}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold flex-shrink-0 w-5 text-center" style={{ color: ACCENT }}>{i + 1}</span>
              <p className="text-xs flex-1 min-w-0 truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                {slot.fromChunk ? slot.chunkLabel : slot.name}
              </p>
              <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                {slot.duration_seconds != null ? `${slot.duration_seconds.toFixed(1)}s` : '—'}
              </span>
              <button onClick={() => onSlotClear(i)}
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                <X size={10} />
              </button>
            </div>
            {slot._needsTrim && slot._rawDuration != null && slot._trimToSeconds != null && (
              <div className="flex flex-col gap-1 pt-1" style={{ borderTop: '1px solid var(--border-color)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                    <Scissors size={9} style={{ display: 'inline', marginRight: 3 }} />
                    Start from
                  </span>
                  <span className="text-xs font-bold" style={{ color: ACCENT }}>
                    {fmtS(slot._trimStartTime ?? 0)} → {fmtS((slot._trimStartTime ?? 0) + slot._trimToSeconds)}
                  </span>
                </div>
                <input type="range" min={0} max={Math.max(0, slot._rawDuration - slot._trimToSeconds)}
                  step={0.1} value={slot._trimStartTime ?? 0}
                  onChange={(e) => onSlotStartChange(i, Number(e.target.value))}
                  className="w-full" style={{ accentColor: ACCENT }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Source is {fmtS(slot._rawDuration)} — drag to pick which {fmtS(slot._trimToSeconds)} to keep
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-SLOT AUDIO SECTION
// ─────────────────────────────────────────────────────────────────────────────

function MultiSlotAudio({
  label, audioSlots, durationS,
  onSlotFill, onSlotClear, onSlotStartChange,
  audioMode, onAudioModeChange,
  script, onScriptChange, supportsTextScript, charIndex, userId,
  audioUploadDisabled = false,
}) {
  const charLabel   = charIndex !== undefined ? ` · Character ${charIndex + 1}` : ''
  const filledSlots = audioSlots.filter(Boolean)
  const filledCount = filledSlots.length
  const totalUsed   = totalSlotDuration(audioSlots)
  const remaining   = Math.max(0, durationS - totalUsed)
  const isFull      = remaining <= 0.1
  const fmtS        = (s) => Number.isFinite(s) ? (s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`) : '—'

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {label}{charLabel}
        </p>
        {filledCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
            style={{ background: isFull ? ACCENT : ACCENT_SUB, color: isFull ? '#fff' : ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
            {fmtS(totalUsed)} / {durationS}s {isFull ? '· full' : `· ${fmtS(remaining)} left`}
          </span>
        )}
      </div>

    {durationS > 0 && filledCount === 0 && !audioUploadDisabled && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Upload audio up to {durationS}s total. Longer files are trimmed automatically.
        </p>
      )}
{supportsTextScript && (() => {
        const modeOptions = audioUploadDisabled
          ? [{ value: 'text', label: 'Script', icon: FileText }]
          : [
              { value: 'upload', label: 'Audio',  icon: Mic      },
              { value: 'text',   label: 'Script',  icon: FileText },
            ]
        return (
          <div className="flex gap-1 p-1 rounded-xl self-start" style={{ background: 'var(--bg-elevated)' }}>
            {modeOptions.map(({ value, label: lbl, icon: Icon }) => (
              <button key={value} onClick={() => onAudioModeChange(value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: audioMode === value ? ACCENT : 'transparent', color: audioMode === value ? '#ffffff' : 'var(--text-muted)' }}>
                <Icon size={11} />{lbl}
              </button>
            ))}
          </div>
        )
      })()}

      {audioMode === 'upload' && (
        <div className="flex flex-col gap-2">
          {filledCount > 0 && (
            <ChainedAudioPlayer audioSlots={audioSlots} onSlotClear={onSlotClear} onSlotStartChange={onSlotStartChange} />
          )}
          {!isFull && (
            <motion.div key={`picker-${filledCount}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
              {filledCount > 0 && (
                <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                  Part {filledCount + 1} · {fmtS(remaining)} remaining
                </p>
              )}
              <AudioSourcePicker
                onAudioUpload={(e) => onSlotFill(filledCount, e)}
                onImport={(gen) => onSlotFill(filledCount, null, gen)}
                userId={userId} maxDurationS={remaining} slotIndex={filledCount}
              />
            </motion.div>
          )}
          {isFull && filledCount > 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs text-center py-1 font-semibold" style={{ color: ACCENT }}>
              Budget full · {durationS}s used ✓
            </motion.p>
          )}
        </div>
      )}

      {audioMode === 'text' && (
        <textarea value={script} onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Type the script this character will speak…"
          rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm resize-none outline-none transition-all"
          style={{
            background: 'var(--bg-elevated)',
            border:     `1px solid ${ACCENT_BDR}`,
            color:      'var(--text-primary)',
            fontFamily: 'inherit',
            lineHeight: 1.6,
          }} />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION BANNER
// ─────────────────────────────────────────────────────────────────────────────

function ValidationBanner({ errors }) {
  if (!errors.length) return null
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1.5">
      {errors.map((err, i) => (
        <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs font-medium"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.18)' }}>
          <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      ))}
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function CreateTalkingHeadPage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [model,         setModel]         = useState('')

  // Subject
  const [subjectMode, setSubjectMode] = useState('face')
  const [faceImage,   setFaceImage]   = useState(null)
  const [videoFile,   setVideoFile]   = useState(null)

  // Video trim
  const [videoTrimStart,  setVideoTrimStart]  = useState(0)
  const [phase,           setPhase]           = useState(null)
  const [convertProgress, setConvertProgress] = useState(0)

  // Audio — per-character slot arrays
  const [audioSlots1, setAudioSlots1] = useState([])
  const [audioSlots2, setAudioSlots2] = useState([])
  const [audioMode1,  setAudioMode1]  = useState('upload')
  const [audioMode2,  setAudioMode2]  = useState('upload')
  const [script1,     setScript1]     = useState('')
  const [script2,     setScript2]     = useState('')

  // Settings
  const [prompt,      setPrompt]      = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [autoRatio,   setAutoRatio]   = useState(false)
  const [duration,    setDuration]    = useState('5')

  const [pendingVideoSubject, setPendingVideoSubject] = useState(false)

  const pendingModelRef = useRef(null)

  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)
  const durationNum    = parseInt(duration || '5', 10)
  const isProcessing   = phase !== null

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try {
        [SS_SUBJECT_IMG, SS_SUBJECT_VID].forEach(k => sessionStorage.removeItem(k))
      } catch {}
    }
  }, [])

  // ── Session restore ──────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SS_LIPSYNC_PREFILL)
      if (raw) {
        sessionStorage.removeItem(SS_LIPSYNC_PREFILL)
        const prefill = JSON.parse(raw)
        if (prefill.script)    setScript1(prefill.script)
        if (prefill.audioMode) setAudioMode1(prefill.audioMode)
        if (prefill.model)     pendingModelRef.current = prefill.model
        toast.success(
          prefill.script
            ? `Talking Head ready — script pre-filled. Choose a voice model and generate.`
            : `Talking Head ready — image pre-loaded. Add a script and generate.`,
          { duration: 5000 }
        )
      }
    } catch {}

    try { const p = sessionStorage.getItem(SS_PROMPT); if (p) setPrompt(p) } catch {}

    restoreFile(SS_SUBJECT_IMG).then((f) => {
      if (!f) return
      setFaceImage(f)
      const img = new Image()
      img.onload = () => { setAspectRatio(detectAspectRatio(img.width, img.height)); setAutoRatio(true) }
      img.src = f.url
    })
    restoreFile(SS_SUBJECT_VID).then((f) => {
      if (!f) return
      setVideoFile(f)
      setPendingVideoSubject(true)
    })
  }, [])

  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(SS_PROMPT, prompt)
      else        sessionStorage.removeItem(SS_PROMPT)
    } catch {}
  }, [prompt])

  // ── Trim audio slots when duration chip changes ──────────────────────────
  useEffect(() => {
    const trimAndNotify = (slots, setSlots, charLabel) => {
      const { kept, dropped } = trimSlotsToLimit(slots, durationNum)
      if (dropped > 0) {
        setSlots(kept)
        toast(`${dropped} audio part${dropped > 1 ? 's' : ''} removed from ${charLabel} — exceeded new ${durationNum}s limit.`, {
          icon: '✂️', duration: 4000,
        })
      }
    }
    trimAndNotify(audioSlots1, setAudioSlots1, 'Character 1')
    trimAndNotify(audioSlots2, setAudioSlots2, 'Character 2')
  }, [durationNum]) // eslint-disable-line

  // ── Clamp videoTrimStart when duration or video changes ──────────────────
  useEffect(() => {
    if (!videoFile?.duration) return
    const maxStart = Math.max(0, videoFile.duration - durationNum)
    if (videoTrimStart > maxStart) setVideoTrimStart(maxStart)
  }, [videoFile?.duration, durationNum, videoTrimStart])

  // ── Load models ──────────────────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('feature', 'lipsync')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const isMaster     = profile?.user_tier === 'master'
    const tierFiltered = (data || []).filter((m) => isMaster || m.tier_required !== 'master')
    const list         = await applyModelPreferences(tierFiltered, user?.id)
    setModels(list)
    setModelsLoading(false)

    setPendingVideoSubject((isPending) => {
      if (pendingModelRef.current) {
        const preferredModel = list.find((m) => m.value === pendingModelRef.current && !m.is_locked)
        pendingModelRef.current = null
        if (preferredModel) {
          setModel(preferredModel.value)
          return isPending ? true : false
        }
      }

      if (isPending) {
        const videoModel = list.find((m) => !m.is_locked && (m.supports_video_input ?? false))
                        || list.find((m) => !m.is_locked)
        setModel(videoModel?.value || '')
        setSubjectMode('video')
      } else {
        setModel(list.find((m) => !m.is_locked)?.value || '')
      }
      return false
    })
  }, []) // eslint-disable-line

  useEffect(() => { loadModels() }, [loadModels])

  const selectedModel = models.find((m) => m.value === model)
  const caps          = getModelCaps(selectedModel)

  // ── Reset when model changes ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedModel) return
    if (caps.requiresVideo)                       setSubjectMode('video')
    else if (!caps.faceInput && caps.videoInput)  setSubjectMode('video')
    else if (caps.faceInput  && !caps.videoInput) setSubjectMode('face')
    if (!caps.textScript) { setAudioMode1('upload'); setAudioMode2('upload') }
    if (!caps.multiChar) { setAudioSlots2([]); setScript2('') }
    if (!caps.supportedDurations.includes(duration)) setDuration(caps.supportedDurations[0] || '5')
    if (!autoRatio && !caps.supportedAspectRatios.includes(aspectRatio)) setAspectRatio(caps.supportedAspectRatios[0] || '9:16')
    if (caps.requiresVoiceId && !caps.requiresAudio) setAudioMode1('text')
  }, [model]) // eslint-disable-line

  // ── Video compatibility ──────────────────────────────────────────────────
  const videoCompat = useMemo(() => {
    if (!caps.videoInput || !videoFile?.duration) return null
    if (videoFile.duration < 1) return 'rejected'
    if (videoFile._trimmed)     return 'converted'
    if (videoFile.duration > durationNum) return 'incompatible'
    return 'compatible'
  }, [caps.videoInput, videoFile, durationNum])

  const videoNeedsTrim       = videoCompat === 'incompatible'
  const videoTrimmedButStale = videoFile?._trimmed && videoNeedsTrim
  const videoTooShort        = videoCompat === 'rejected'

  // ── Credit cost ──────────────────────────────────────────────────────────
  const creditCost = (() => {
    if (!selectedModel) return 0
    const base = selectedModel.credit_cost_i2i || selectedModel.credit_cost_t2i || 0
    if (caps.isFlatRate) return base
    return Math.ceil(base * parseInt(duration || '5'))
  })()

  const canAfford = credits >= creditCost

  // ── Validation ───────────────────────────────────────────────────────────
  const validationErrors = useMemo(() => {
    if (!selectedModel) return ['Select a model to continue']
    const errors = []

    if (caps.requiresImage && !faceImage)
      errors.push('Upload a face photo — this model requires one')
    if (caps.requiresVideo && !videoFile)
      errors.push('Upload a subject video — this model requires one')
    if (caps.requiresVideo && videoTooShort)
      errors.push('Subject video is too short — minimum 1 second')
    if (caps.requiresVideo && videoNeedsTrim)
      errors.push('Subject video is longer than the selected duration — trim it first')

    if (caps.requiresAudio) {
      if (audioMode1 === 'upload' && audioSlots1.filter(Boolean).length === 0)
        errors.push(caps.multiChar ? 'Add audio for Character 1' : 'Add an audio track')
      if (caps.multiChar && audioMode2 === 'upload' && audioSlots2.filter(Boolean).length === 0)
        errors.push('Add audio for Character 2')
    }

    if (caps.requiresVoiceId && !script1.trim())
      errors.push('Type a script — this model converts your text to speech')
    if (!canAfford) errors.push('Not enough credits')
    if (creditCost === 0 && selectedModel && !selectedModel?.is_render_window)
      errors.push('Model pricing is misconfigured — contact support')

    return errors
  }, [selectedModel, caps, faceImage, videoFile, videoTooShort, videoNeedsTrim,
      audioMode1, audioSlots1, audioMode2, audioSlots2, script1, canAfford])

  const buttonDisabled = isProcessing || validationErrors.length > 0

  // ── Mode label ───────────────────────────────────────────────────────────
  const modeLabel = (() => {
    if (caps.multiChar)                             return 'Multi-Character Sync'
    if (caps.requiresVoiceId)                       return 'Text → Lip Sync'
    if (caps.videoInput && subjectMode === 'video') return 'Video Lip Sync'
    if (caps.faceInput  && subjectMode === 'face')  return 'Talking Avatar'
    return 'Talking Head'
  })()

  // ── Upload handlers ──────────────────────────────────────────────────────
  const handleFaceUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const compressed = await compressImage(file)
    setFaceImage(compressed)
    setAspectRatio(compressed.ar)
    setAutoRatio(true)
  }

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > 40 * 1024 * 1024) {
      toast.error(`Video must be under 40 MB. Yours is ${formatBytes(file.size)}.`)
      e.target.value = ''; return
    }
    const meta = await readVideoMetadata(file)
    if (meta.duration != null && meta.duration < 1) {
      toast.error('Video is too short — minimum 1 second.')
      e.target.value = ''; return
    }
    const url = URL.createObjectURL(file)
    setVideoFile({ file, url, name: file.name, duration: meta.duration, size: file.size, aspectRatio: meta.aspectRatio })
    setVideoTrimStart(0)
    e.target.value = ''
  }

  const handleRemoveVideo = () => {
    if (videoFile?.url && videoFile?.file) URL.revokeObjectURL(videoFile.url)
    setVideoFile(null); setVideoTrimStart(0)
    try { sessionStorage.removeItem(SS_SUBJECT_VID) } catch {}
  }

  // ── Video trim ───────────────────────────────────────────────────────────
  const handleTrimVideo = async () => {
    if (!user)      return toast.error('Please sign in')
    if (!videoFile) return toast.error('Upload a video first')
    if (credits < VIDEO_TRIM_COST) return toast.error(`Video trim costs ${VIDEO_TRIM_COST} credits.`)

    setPhase('trimming_video'); setConvertProgress(0)
    let processed
    try {
      processed = await callTrimEdgeFunction({
        file: videoFile.file, url: videoFile.url, userId: user.id,
        targetDuration: durationNum, startTime: videoTrimStart,
        onProgress: (p) => setConvertProgress(p),
      })
    } catch (err) {
      setPhase(null); setConvertProgress(0); toast.error(err?.message || 'Video trim failed.'); return
    }

    if (!processed?.url || typeof processed.url !== 'string' || !processed.url.startsWith('http')) {
      setPhase(null); setConvertProgress(0)
      toast.error('Trim returned an invalid result. No credits were charged.'); return
    }

    try {
      await supabase.rpc('deduct_credits', {
        p_user_id: user.id, p_amount: VIDEO_TRIM_COST,
        p_generation_id: null, p_description: 'Talking Head subject video trim',
      })
    } catch {}

    refreshProfile(); setPhase(null); setConvertProgress(0)
    setVideoFile({
      file: null, url: processed.url, name: videoFile.name,
      duration: processed.duration ?? durationNum, aspectRatio: videoFile.aspectRatio, _trimmed: true,
    })
    toast.success('Video trimmed — ready to generate!', { duration: 3000 })
  }

  // ── Audio slot fill ──────────────────────────────────────────────────────
  const handleSlotFill = (charSlot) => async (slotIndex, e, imported) => {
    const setSlots  = charSlot === 1 ? setAudioSlots1 : setAudioSlots2
    const curSlots  = charSlot === 1 ? audioSlots1    : audioSlots2
    const usedSoFar = totalSlotDuration(curSlots)
    const remaining = Math.max(0, durationNum - usedSoFar)

    if (imported) {
      const durS      = imported.duration_seconds ?? null
      const needsTrim = durS !== null && durS > remaining + 0.25
      if (needsTrim) {
        toast(`Trimming audio to ${remaining.toFixed(1)}s — drag the slider to pick which part to keep.`, { icon: '✂️', duration: 4000 })
      }
      const filled = {
        file: null, url: imported.output_url,
        name: imported.name ?? imported.chunkLabel ?? 'Audio',
        fromChunk: !!imported.fromChunk, fromGeneration: !imported.fromChunk,
        chunkLabel: imported.chunkLabel ?? null,
        duration_seconds: durS !== null ? Math.min(durS, remaining) : remaining,
        _needsTrim: needsTrim, _trimToSeconds: remaining, _trimStartTime: 0, _rawDuration: durS,
      }
      setSlots((prev) => { const next = [...prev]; next[slotIndex] = filled; return next })
      return
    }

    const file = e?.target?.files?.[0]; if (!file) return
    let durS = null
    try { durS = await getAudioDuration(file) } catch {}

    const needsTrim = durS !== null && durS > remaining + 0.25
    if (needsTrim) {
      toast(`Audio is ${durS.toFixed(1)}s — trimming to ${remaining.toFixed(1)}s. Drag the slider to pick which part to keep.`, { icon: '✂️', duration: 4500 })
    }

    const filled = {
      file, url: URL.createObjectURL(file), name: file.name,
      fromChunk: false, fromGeneration: false,
      duration_seconds: durS !== null ? Math.min(durS, remaining) : remaining,
      _needsTrim: needsTrim, _trimToSeconds: remaining, _trimStartTime: 0, _rawDuration: durS,
    }
    setSlots((prev) => { const next = [...prev]; next[slotIndex] = filled; return next })
  }

  const handleSlotClear = (charSlot) => (slotIndex) => {
    const setSlots = charSlot === 1 ? setAudioSlots1 : setAudioSlots2
    setSlots((prev) => {
      const next = [...prev]; next[slotIndex] = null
      while (next.length > 0 && !next[next.length - 1]) next.pop()
      return next
    })
  }

  const handleSlotStartChange = (charSlot) => (slotIndex, startTime) => {
    const setSlots = charSlot === 1 ? setAudioSlots1 : setAudioSlots2
    setSlots((prev) => {
      const next = [...prev]; if (!next[slotIndex]) return prev
      next[slotIndex] = { ...next[slotIndex], _trimStartTime: startTime }
      return next
    })
  }

  const clearAll = () => {
    setFaceImage(null); setVideoFile(null)
    setAudioSlots1([]); setAudioSlots2([])
    setScript1(''); setScript2('')
    setAutoRatio(false); setAspectRatio('9:16'); setPrompt('')
    setVideoTrimStart(0)
    try {
      [SS_PROMPT, SS_SUBJECT_IMG, SS_SUBJECT_VID].forEach((k) => sessionStorage.removeItem(k))
    } catch {}
  }

  // ── Storage upload ───────────────────────────────────────────────────────
  const uploadToStorage = async (fileOrBlob, name = 'audio.wav', bucket = 'generation-uploads') => {
    const ext  = name.split('.').pop()?.toLowerCase() || 'wav'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, fileOrBlob, { upsert: false, cacheControl: '3600', contentType: fileOrBlob.type || 'audio/wav' })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return publicUrl
  }

  const buildAudioUrl = async (slots) => {
    const filled = slots.filter(Boolean)
    if (filled.length === 0) return null

    const blobs = await Promise.all(
      filled.map(async (slot) => {
        let blob = slot.file
          ? slot.file
          : await fetch(slot.url).then((r) => { if (!r.ok) throw new Error('fetch failed'); return r.blob() })
        if (slot._needsTrim && slot._trimToSeconds > 0) {
          blob = await trimAudioToLimit(blob, slot._trimToSeconds, slot._trimStartTime ?? 0)
        }
        return blob
      })
    )

    if (blobs.length === 1 && filled[0].file && !filled[0]._needsTrim) {
      return uploadToStorage(filled[0].file, filled[0].name)
    }

    const combined = blobs.length === 1 ? blobs[0] : await concatenateAudioBlobs(blobs)
    return uploadToStorage(combined, 'combined.wav')
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (validationErrors.length) return toast.error(validationErrors[0])
    if (!user) return toast.error('Please sign in')

    const { kept: safe1 } = trimSlotsToLimit(audioSlots1, durationNum)
    const { kept: safe2 } = trimSlotsToLimit(audioSlots2, durationNum)

    setPhase('submitting')
    try {
      let startFrameUrl   = null
      let subjectVideoUrl = null

      if (subjectMode === 'face' && faceImage) {
        startFrameUrl = faceImage.file
          ? await uploadToStorage(faceImage.file, faceImage.file.name, 'generation-uploads')
          : faceImage.url
      }
      if (subjectMode === 'video' && videoFile) {
        subjectVideoUrl = videoFile.file
          ? await uploadToStorage(videoFile.file, videoFile.file.name, 'generation-uploads')
          : videoFile.url
      }

      let audio1Url = null
      let audio2Url = null

      if (caps.requiresAudio) {
        if (audioMode1 === 'upload') audio1Url = await buildAudioUrl(safe1)
        if (caps.multiChar && audioMode2 === 'upload') audio2Url = await buildAudioUrl(safe2)
      }

      if (caps.requiresAudio && !audio1Url && audioMode1 === 'upload') {
        throw new Error('Audio upload failed — please try again')
      }

      const inputImageUrls = [startFrameUrl].filter(Boolean)

      // ── Create generation row ────────────────────────────────────────────
      // Write ALL fields that runLipsync reads from the DB row so the edge
      // function never has to rely on meta passed in the invoke body.
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:          user.id,
        generation_type:  'lipsync',
        status:           'pending',
        prompt:           prompt || null,
        model,
        aspect_ratio:     aspectRatio,
        duration,
        credits_charged:  creditCost,
        output_type:      'video',
        // Subject
        start_frame_url:  startFrameUrl   || null,
        video_input_url:  subjectVideoUrl || null,
        // Audio
        audio_url:        audio1Url       || null,
        audio_2_url:      audio2Url       || null,
        // Text scripts
        text_script:      audioMode1 === 'text' ? script1.trim() || null : null,
        text_script_2:    caps.multiChar && audioMode2 === 'text' ? script2.trim() || null : null,
        // Image array (for multi-image models)
        input_image_urls: inputImageUrls.length ? inputImageUrls : null,
        with_sound:       true,
        skip_prompt_refinement: skipRefinement,
        is_system_prompt: false,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // ── Deduct credits ───────────────────────────────────────────────────
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // ── Dispatch — edge function reads everything from the row ───────────
const edgeFn = selectedModel?.feature === 'lipsync'
        ? 'lipsync-generate'
        : 'talking-head-generate'

      const { data: invokeData, error: invokeErr } = await supabase.functions
        .invoke(edgeFn, { body: { generationId: genRow.id } })

      if (invokeErr || invokeData?.error) {
        const msg = invokeData?.error || invokeErr?.message || 'Generation blocked'
        toast.error(msg)
        await refreshProfile()
        return
      }

      refreshProfile()
      toast.success('Your talking head video is being generated. Check your Media page.', { duration: 4000 })
      clearAll()

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      console.error('TalkingHead generate error:', err)
    } finally {
      setPhase(null)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      <AnimatePresence>
        {isProcessing && (
          <ProcessingOverlay
            phase={phase} convertProgress={convertProgress}
            audioSlots1={audioSlots1} audioSlots2={audioSlots2}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
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
            <span className="text-xs px-3 py-1.5 rounded-xl"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
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

          {/* ── Subject ──────────────────────────────────────────────────── */}
          {(caps.faceInput || caps.videoInput) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Subject
                  {(caps.requiresImage || caps.requiresVideo) && (
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — required</span>
                  )}
                </p>
                {caps.faceInput && caps.videoInput && !caps.requiresVideo && (
                  <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    {[{ value: 'face', label: 'Photo', icon: User }, { value: 'video', label: 'Video', icon: VideoIcon }].map(({ value, label, icon: Icon }) => (
                      <button key={value} onClick={() => setSubjectMode(value)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: subjectMode === value ? ACCENT : 'transparent', color: subjectMode === value ? '#ffffff' : 'var(--text-muted)' }}>
                        <Icon size={11} />{label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <SubjectSlot
                mode={subjectMode} faceImage={faceImage} videoFile={videoFile}
                onFaceUpload={handleFaceUpload} onVideoUpload={handleVideoUpload}
                onFaceRemove={() => {
                  setFaceImage(null); setAutoRatio(false); setAspectRatio('9:16')
                  try { sessionStorage.removeItem(SS_SUBJECT_IMG) } catch {}
                }}
                onVideoRemove={handleRemoveVideo}
                videoCompatStatus={videoCompat}
              />

              <AnimatePresence>
                {videoTooShort && (
                  <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18 }} className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <p className="text-xs" style={{ color: '#ef4444' }}>Video is too short — minimum 1 second.</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {(videoCompat === 'compatible' || videoCompat === 'converted') && videoFile && (
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Video is{' '}
                  <strong style={{ color: ACCENT }}>
                    {videoFile.duration}s{videoFile._trimmed ? ' · trimmed' : ''}
                  </strong>{' '}
                  — ready to generate.
                </p>
              )}

              <AnimatePresence>
                {videoTrimmedButStale && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }} className="mt-3 rounded-2xl p-4 flex flex-col gap-3"
                    style={{ background: 'rgba(91,110,247,0.08)', border: '1px solid rgba(91,110,247,0.25)' }}>
                    <div className="flex items-start gap-2">
                      <Scissors size={14} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: ACCENT }}>Duration changed after trim</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                          Your trimmed video is {formatDuration(videoFile.duration)} but you switched to {durationNum}s.
                          Re-trim to match the new duration, or revert your duration selection.
                        </p>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          Re-trim cost: <strong style={{ color: 'var(--text-primary)' }}>{VIDEO_TRIM_COST} credits</strong>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleTrimVideo} disabled={credits < VIDEO_TRIM_COST || isProcessing}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: credits >= VIDEO_TRIM_COST && !isProcessing ? ACCENT : 'var(--bg-elevated)',
                          color:      credits >= VIDEO_TRIM_COST && !isProcessing ? '#fff'  : 'var(--text-muted)',
                          cursor:     credits >= VIDEO_TRIM_COST && !isProcessing ? 'pointer' : 'not-allowed',
                        }}>
                        Re-trim to {durationNum}s · {VIDEO_TRIM_COST} cr
                      </button>
                      <button onClick={handleRemoveVideo} className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                        Remove video
                      </button>
                    </div>
                    {credits < VIDEO_TRIM_COST && (
                      <p className="text-xs" style={{ color: '#ef4444' }}>
                        Not enough credits.{' '}
                        <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Top up</button>
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {caps.videoInput && videoFile && !videoTooShort && videoNeedsTrim && !videoFile._trimmed && (
                <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Scissors size={14} style={{ color: ACCENT }} />
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      Trim to {durationNum}s
                    </p>
                    <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
                      Source: {formatDuration(videoFile.duration)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Start time</p>
                    <p className="text-xs font-bold" style={{ color: ACCENT }}>
                      {videoTrimStart}s → {videoTrimStart + durationNum}s
                    </p>
                  </div>
                  <input type="range" min={0} max={Math.max(0, (videoFile.duration ?? durationNum) - durationNum)}
                    step={1} value={videoTrimStart} onChange={(e) => setVideoTrimStart(Number(e.target.value))}
                    className="w-full" style={{ accentColor: ACCENT }} />
                </div>
              )}

              <AnimatePresence>
                {caps.videoInput && videoNeedsTrim && !videoFile?._trimmed && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }} className="mt-3 rounded-2xl p-4 flex flex-col gap-3"
                    style={{ background: 'rgba(239,160,20,0.08)', border: '1px solid rgba(239,160,20,0.25)' }}>
                    <div className="flex items-start gap-2">
                      <RefreshCw size={14} style={{ color: '#efa014', marginTop: 2, flexShrink: 0 }} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#efa014' }}>Video needs trimming</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                          Source is {formatDuration(videoFile.duration)} but selected duration is {durationNum}s.
                          Clip: <strong>{videoTrimStart}s → {videoTrimStart + durationNum}s</strong>
                        </p>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          Trim cost: <strong style={{ color: 'var(--text-primary)' }}>{VIDEO_TRIM_COST} credits</strong>.
                          Trimmed video loads here — no redirect needed.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleTrimVideo} disabled={credits < VIDEO_TRIM_COST || isProcessing}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: credits >= VIDEO_TRIM_COST && !isProcessing ? ACCENT : 'var(--bg-elevated)',
                          color:      credits >= VIDEO_TRIM_COST && !isProcessing ? '#fff'  : 'var(--text-muted)',
                          cursor:     credits >= VIDEO_TRIM_COST && !isProcessing ? 'pointer' : 'not-allowed',
                        }}>
                        Trim &amp; Continue · {VIDEO_TRIM_COST} cr
                      </button>
                      <button onClick={handleRemoveVideo} className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                        Cancel
                      </button>
                    </div>
                    {credits < VIDEO_TRIM_COST && (
                      <p className="text-xs" style={{ color: '#ef4444' }}>
                        Not enough credits to trim.{' '}
                        <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Top up</button>
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ── Settings ─────────────────────────────────────────────────── */}
          <div>
            <SettingChips
              label="Aspect Ratio"
              options={ALL_ASPECT_RATIOS.map((o) => ({ ...o, disabled: !caps.supportedAspectRatios.includes(o.value) }))}
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

          {/* ── Audio ────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
           <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {caps.requiresVoiceId && !caps.requiresAudio
                  ? (caps.multiChar ? 'Scripts' : 'Script')
                  : (caps.multiChar ? 'Audio Tracks' : 'Audio')}
                {(caps.requiresAudio || caps.requiresVoiceId) && (
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — required</span>
                )}
              </p>
              {caps.multiChar && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold"
                  style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                  <Users size={11} />2 characters
                </div>
              )}
            </div>

<MultiSlotAudio
              label={caps.requiresVoiceId && !caps.requiresAudio ? 'Script' : 'Audio'} audioSlots={audioSlots1} durationS={durationNum}
              onSlotFill={handleSlotFill(1)} onSlotClear={handleSlotClear(1)}
              onSlotStartChange={handleSlotStartChange(1)}
              audioMode={audioMode1} onAudioModeChange={setAudioMode1}
              script={audioMode1 === 'text' ? script1 : ''} onScriptChange={setScript1}
              supportsTextScript={caps.textScript}
              charIndex={caps.multiChar ? 0 : undefined} userId={user?.id}
              audioUploadDisabled={caps.requiresVoiceId && !caps.requiresAudio}
            />

        {caps.multiChar && (
              <MultiSlotAudio
                label={caps.requiresVoiceId && !caps.requiresAudio ? 'Script' : 'Audio'} audioSlots={audioSlots2} durationS={durationNum}
                onSlotFill={handleSlotFill(2)} onSlotClear={handleSlotClear(2)}
                onSlotStartChange={handleSlotStartChange(2)}
                audioMode={audioMode2} onAudioModeChange={setAudioMode2}
                script={audioMode2 === 'text' ? script2 : ''} onScriptChange={setScript2}
                supportsTextScript={caps.textScript} charIndex={1} userId={user?.id}
                audioUploadDisabled={caps.requiresVoiceId && !caps.requiresAudio}
              />
            )}
          </div>

          {/* ── Prompt ───────────────────────────────────────────────────── */}
          <Textarea
            label="Prompt" value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional: describe pose, expression, background scene…"
            rows={3}
          />

        </div>
      </div>

      {/* Generate button + validation */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">

          <button
            onClick={handleGenerate}
            disabled={buttonDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: buttonDisabled ? 'var(--bg-elevated)' : ACCENT,
              color:      buttonDisabled ? 'var(--text-muted)'  : '#ffffff',
            }}>
            {isProcessing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Zap size={15} fill="currentColor" />
            )}
            {isProcessing
              ? phase === 'trimming_video' ? 'Trimming video…' : 'Generating…'
              : `Generate · ${creditCost} cr`}
          </button>

          {!canAfford ? (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                Top up
              </button>
            </p>
          ) : validationErrors.length > 0 && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              {validationErrors[0]}
            </p>
          )}

        </div>
      </div>

    </div>
  )
}
