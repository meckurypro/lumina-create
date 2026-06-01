import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, X, ImagePlus, VideoIcon, Mic, FileText,
  Users, User, Library, Play, Pause, Loader2, ChevronDown, Plus,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import { ugcAudioChunks } from '@/lib/ugcVoices'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-talking-head)'
const ACCENT_SUB = 'var(--tool-talking-head-subtle)'
const ACCENT_BDR = 'var(--tool-talking-head-border)'

const SS_PROMPT      = 'meckury_th_prompt'
const SS_SUBJECT_IMG = 'meckury_th_subject_img'
const SS_SUBJECT_VID = 'meckury_th_subject_vid'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

// ─── Duration helpers ─────────────────────────────────────────────────────────

/** Sum of all filled slot durations (seconds). Falls back to 0 for unknown durations. */
function totalSlotDuration(slots) {
  return slots.filter(Boolean).reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0)
}

/**
 * Trim a slots array so the cumulative duration never exceeds limitS.
 * Returns { kept, dropped } — kept is the trimmed array, dropped is count removed.
 */
function trimSlotsToLimit(slots, limitS) {
  let cumulative = 0
  let cutIndex   = null
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i]) continue
    const dur = slots[i].duration_seconds ?? 0
    if (cumulative + dur > limitS + 0.25) {   // 0.25s tolerance for float imprecision
      cutIndex = i
      break
    }
    cumulative += dur
  }
  if (cutIndex === null) return { kept: slots, dropped: 0 }
  const kept    = slots.slice(0, cutIndex).filter(Boolean)
  const dropped = slots.slice(cutIndex).filter(Boolean).length
  return { kept, dropped }
}

// ─── Audio utilities ──────────────────────────────────────────────────────────

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

// ─── caps helper ──────────────────────────────────────────────────────────────
function getModelCaps(model) {
  if (!model) return {
    faceInput: true, videoInput: false, textScript: false, multiChar: false,
    maxRefImages: 1, supportedDurations: ['5', '10'],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    supportsSound: false, isFlatRate: false,
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
  if (r > 1.6) return '16:9'; if (r < 0.75) return '9:16'; return '1:1'
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
          url: URL.createObjectURL(blob),
          ar: detectAspectRatio(canvas.width, canvas.height),
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
    resolve({ file: new File([new Blob([ab], { type }), name, { type }]), url: URL.createObjectURL(new Blob([ab], { type })) })
  } catch { resolve(null) }
})

// ─── SettingChips ─────────────────────────────────────────────────────────────
const SettingChips = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{label}</p>
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button key={opt.value} onClick={() => !opt.disabled && onChange(opt.value)} disabled={opt.disabled}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: value === opt.value ? ACCENT    : 'var(--bg-elevated)',
            color:      value === opt.value ? '#ffffff'  : 'var(--text-secondary)',
            opacity: opt.disabled ? 0.3 : 1, cursor: opt.disabled ? 'not-allowed' : 'pointer',
          }}>
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)

// ─── ModelDropdown ────────────────────────────────────────────────────────────
const ModelDropdown = ({ models, value, onChange }) => {
  const [open, setOpen] = useState(false)
  const unlocked = models.filter((m) => !m.is_locked)
  const locked   = models.filter((m) =>  m.is_locked)
  const selected = models.find((m) => m.value === value) || unlocked[0]
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
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
              initial={{ opacity: 0, y: -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }} transition={{ duration: 0.13 }}
              className="absolute right-0 top-9 z-50 w-60 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 32px rgba(0,0,0,0.28)' }}>
              <div className="py-1">
                {unlocked.map((m) => {
                  const caps = getModelCaps(m)
                  const tags = [caps.faceInput && 'Face', caps.videoInput && 'Video', caps.multiChar && '2-char', caps.textScript && 'Text→Speech'].filter(Boolean)
                  return (
                    <button key={m.value} onClick={() => { onChange(m.value); setOpen(false) }}
                      className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                      style={{ background: m.value === value ? ACCENT_SUB : 'transparent' }}>
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

// ─── SubjectSlot ──────────────────────────────────────────────────────────────
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

// ─── Shared audio singleton ───────────────────────────────────────────────────
const sharedPickerAudio = { ref: null }

// ─── AudioSourcePicker ────────────────────────────────────────────────────────
// maxDurationS: how many seconds remain in the budget for this slot
function AudioSourcePicker({ onAudioUpload, onImport, userId, maxDurationS, slotIndex }) {
  const [mode,          setMode]          = useState(null)
  const [generations,   setGens]          = useState([])
  const [loadingList,   setLoadingList]   = useState(false)
  const [playing,       setPlaying]       = useState(null)
  const [expandedId,    setExpandedId]    = useState(null)
  const [chunksMap,     setChunksMap]     = useState({})
  const [loadingChunks, setLoadingChunks] = useState(null)

  // Format seconds nicely: "4.2s" or "4s"
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
    if (chunkDur !== null && chunkDur > maxDurationS + 0.25) {
      toast.error(`This chunk is ${chunkDur.toFixed(1)}s but only ${fmtS(maxDurationS)} remains. Pick a shorter clip.`, { duration: 5000 })
      return
    }
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

  const handleImportFull = (gen) => {
    const dur = gen.duration_seconds ?? null
    if (dur !== null && dur > maxDurationS + 0.25) {
      toast.error(`This audio is ${dur.toFixed(1)}s but only ${fmtS(maxDurationS)} remains. Pick a shorter clip or use a chunk.`, { duration: 5000 })
      return
    }
    stopAudio(); onImport(gen)
  }

  if (mode === null) {
    return (
      <div className="flex gap-2">
        <label
          className="flex-1 flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all gap-1.5 py-5"
          style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
          <input type="file" accept="audio/*" className="hidden" onChange={onAudioUpload} />
          <Mic size={20} style={{ color: ACCENT }} />
          <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload file</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Max {fmtS(maxDurationS)}</span>
        </label>
        <button onClick={openPicker}
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
          <div className="flex justify-center py-8"><Loader2 size={18} style={{ color: ACCENT }} className="animate-spin" /></div>
        ) : generations.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>No generated audio yet</p>
        ) : generations.map((gen) => {
          const dur        = gen.duration_seconds ? `${Math.round(gen.duration_seconds)}s` : '—'
          const date       = new Date(gen.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          const snippet    = gen.script?.length > 55 ? gen.script.slice(0, 55) + '…' : gen.script
          const isExpanded = expandedId === gen.id
          const chunks     = chunksMap[gen.id] || []
          const hasChunks  = gen.chunk_count > 0
          const tooLong    = gen.duration_seconds != null && gen.duration_seconds > maxDurationS + 0.25

          return (
            <div key={gen.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="flex items-center gap-2.5 px-3 py-2.5">
                <button onClick={() => togglePlay(gen.id, gen.output_url)} disabled={!gen.output_url}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                  style={{ background: playing === gen.id ? ACCENT : ACCENT_SUB, opacity: gen.output_url ? 1 : 0.3 }}>
                  {playing === gen.id
                    ? <Pause size={13} style={{ color: '#fff'  }} fill="currentColor" />
                    : <Play  size={13} style={{ color: ACCENT }} fill="currentColor" />
                  }
                </button>
                <button className="flex-1 min-w-0 text-left" onClick={() => hasChunks && handleExpand(gen)}>
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{snippet}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {gen.voice?.name ?? 'Voice'} · {dur}{hasChunks ? ` · ${gen.chunk_count} parts` : ''} · {date}
                  </p>
                  {tooLong && !hasChunks && (
                    <p className="text-xs mt-0.5 font-semibold" style={{ color: '#f59e0b' }}>
                      Too long · only {fmtS(maxDurationS)} remaining
                    </p>
                  )}
                </button>
                {hasChunks ? (
                  <button onClick={() => handleExpand(gen)}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{ background: isExpanded ? ACCENT : ACCENT_SUB, color: isExpanded ? '#fff' : ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                    <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                    Parts
                  </button>
                ) : (
                  <button onClick={() => handleImportFull(gen)} disabled={tooLong}
                    className="flex-shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                    style={{ background: tooLong ? 'var(--bg-card)' : ACCENT, color: tooLong ? 'var(--text-muted)' : '#fff', opacity: tooLong ? 0.5 : 1 }}>
                    Use
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
                        <div className="flex justify-center py-3"><Loader2 size={15} style={{ color: ACCENT }} className="animate-spin" /></div>
                      ) : chunks.length === 0 ? (
                        <div className="flex items-center justify-between py-2">
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Parts not ready — use full audio</p>
                          <button onClick={() => handleImportFull(gen)} disabled={tooLong}
                            className="flex-shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                            style={{ background: tooLong ? 'var(--bg-elevated)' : ACCENT, color: tooLong ? 'var(--text-muted)' : '#fff' }}>
                            Use full
                          </button>
                        </div>
                      ) : chunks.map((chunk) => {
                        const chunkDur       = chunk.duration_ms ? chunk.duration_ms / 1000 : null
                        const chunkDurStr    = chunkDur != null ? `${chunkDur.toFixed(1)}s` : '—'
                        const chunkTooLong   = chunkDur != null && chunkDur > maxDurationS + 0.25
                        const isPlayingChunk = playing === chunk.id
                        return (
                          <div key={chunk.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl"
                            style={{ background: 'var(--bg-elevated)' }}>
                            <button onClick={() => togglePlay(chunk.id, chunk.public_url)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
                              style={{ background: isPlayingChunk ? ACCENT : ACCENT_SUB }}>
                              {isPlayingChunk
                                ? <Pause size={11} style={{ color: '#fff'  }} fill="currentColor" />
                                : <Play  size={11} style={{ color: ACCENT }} fill="currentColor" />
                              }
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{chunk.label}</p>
                              <p className="text-xs" style={{ color: chunkTooLong ? '#f59e0b' : 'var(--text-muted)' }}>
                                {chunkDurStr}{chunkTooLong ? ` · only ${fmtS(maxDurationS)} left` : ''}
                              </p>
                            </div>
                            <button onClick={() => handleImportChunk(gen, chunk)} disabled={chunkTooLong}
                              className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95"
                              style={{ background: chunkTooLong ? 'var(--bg-card)' : ACCENT, color: chunkTooLong ? 'var(--text-muted)' : '#fff', opacity: chunkTooLong ? 0.5 : 1 }}>
                              Use
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

// ─── Single audio slot pill ───────────────────────────────────────────────────
const AudioSlotPill = ({ slotIndex, audioFile, onRemove }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.15 }}
    className="flex items-center gap-3 p-3 rounded-2xl"
    style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}` }}>
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ACCENT_SUB }}>
      <Mic size={15} style={{ color: ACCENT }} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
        {audioFile.fromChunk ? audioFile.chunkLabel : audioFile.name}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {audioFile.fromChunk
          ? `Part ${slotIndex + 1} · chunk`
          : audioFile.fromGeneration
            ? `Part ${slotIndex + 1} · imported`
            : `Part ${slotIndex + 1} · uploaded`}
        {audioFile.duration_seconds != null ? ` · ${audioFile.duration_seconds.toFixed(1)}s` : ''}
      </p>
    </div>
    <button onClick={onRemove} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
      <X size={13} />
    </button>
  </motion.div>
)

// ─── Multi-slot audio section ─────────────────────────────────────────────────
// Budget logic:
//   - totalUsed   = sum of all filled slot durations
//   - remaining   = durationS - totalUsed
//   - showPicker  = remaining > 0 (not >= full slot — any remaining space gets a picker)
//   - maxDurationS passed to picker = remaining (so upload/import validation uses real budget)
function MultiSlotAudio({
  label, audioSlots, durationS,
  onSlotFill, onSlotClear, audioMode, onAudioModeChange,
  script, onScriptChange, supportsTextScript, charIndex, userId,
}) {
  const charLabel    = charIndex !== undefined ? ` · Character ${charIndex + 1}` : ''
  const filledSlots  = audioSlots.filter(Boolean)
  const filledCount  = filledSlots.length
  const totalUsed    = totalSlotDuration(audioSlots)
  const remaining    = Math.max(0, durationS - totalUsed)
  const isFull       = remaining <= 0.1   // treat <0.1s as full
  const fmtS         = (s) => Number.isFinite(s) ? (s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`) : '—'

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

      {/* Hint shown when multiple parts are possible */}
      {durationS > 0 && filledCount === 0 && (
        <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Upload audio up to {durationS}s total. Add multiple clips — they will be joined in order.
        </p>
      )}

      {supportsTextScript && (
        <div className="flex gap-1 p-1 rounded-xl self-start" style={{ background: 'var(--bg-elevated)' }}>
          {[
            { value: 'upload', label: 'Audio', icon: Mic      },
            { value: 'text',   label: 'Script', icon: FileText },
          ].map(({ value, label: lbl, icon: Icon }) => (
            <button key={value} onClick={() => onAudioModeChange(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{ background: audioMode === value ? ACCENT : 'transparent', color: audioMode === value ? '#ffffff' : 'var(--text-muted)' }}>
              <Icon size={11} />{lbl}
            </button>
          ))}
        </div>
      )}

      {audioMode === 'upload' && (
        <div className="flex flex-col gap-2">
          <AnimatePresence>
            {audioSlots.map((slot, i) => slot && (
              <AudioSlotPill key={i} slotIndex={i} audioFile={slot} onRemove={() => onSlotClear(i)} />
            ))}
          </AnimatePresence>

          {/* Show picker only while there is remaining budget */}
          {!isFull && (
            <motion.div
              key={`picker-${filledCount}`}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}>
              {filledCount > 0 && (
                <p className="text-xs mb-1.5 font-medium" style={{ color: 'var(--text-muted)' }}>
                  Part {filledCount + 1} · {fmtS(remaining)} remaining
                </p>
              )}
              <AudioSourcePicker
                onAudioUpload={(e) => onSlotFill(filledCount, e)}
                onImport={(gen) => onSlotFill(filledCount, null, gen)}
                userId={userId}
                maxDurationS={remaining}
                slotIndex={filledCount}
              />
            </motion.div>
          )}

          {isFull && filledCount > 0 && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs text-center py-1 font-semibold"
              style={{ color: ACCENT }}>
              Budget full · {durationS}s used ✓
            </motion.p>
          )}
        </div>
      )}

      {audioMode === 'text' && (
        <textarea value={script} onChange={(e) => onScriptChange(e.target.value)}
          placeholder="Type the script this character will speak…" rows={3}
          className="w-full px-4 py-3 rounded-2xl text-sm resize-none outline-none transition-all"
          style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}`, color: 'var(--text-primary)', fontFamily: 'inherit', lineHeight: 1.6 }} />
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
  const [subjectMode, setSubjectMode] = useState('face')
  const [faceImage,   setFaceImage]   = useState(null)
  const [videoFile,   setVideoFile]   = useState(null)

  // audio — arrays of slots per character
  const [audioSlots1,  setAudioSlots1]  = useState([])
  const [audioSlots2,  setAudioSlots2]  = useState([])
  const [audioMode1,   setAudioMode1]   = useState('upload')
  const [audioMode2,   setAudioMode2]   = useState('upload')
  const [script1,      setScript1]      = useState('')
  const [script2,      setScript2]      = useState('')

  // settings
  const [prompt,      setPrompt]      = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [autoRatio,   setAutoRatio]   = useState(false)
  const [duration,    setDuration]    = useState('5')

  const [submitting,  setSubmitting]  = useState(false)
  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)

  const durationNum = parseInt(duration || '5', 10)

  // ── session restore ──────────────────────────────────────────
  useEffect(() => {
    try { const p = sessionStorage.getItem(SS_PROMPT); if (p) setPrompt(p) } catch {}
    restoreFile(SS_SUBJECT_IMG).then((f) => {
      if (!f) return
      setFaceImage(f)
      const img = new Image()
      img.onload = () => { setAspectRatio(detectAspectRatio(img.width, img.height)); setAutoRatio(true) }
      img.src = f.url
    })
    restoreFile(SS_SUBJECT_VID).then((f) => { if (f) setVideoFile(f) })
  }, [])

  useEffect(() => {
    try {
      if (prompt) sessionStorage.setItem(SS_PROMPT, prompt)
      else        sessionStorage.removeItem(SS_PROMPT)
    } catch {}
  }, [prompt])

  // ── When duration changes, trim slots that exceed the new limit ──────────
  useEffect(() => {
    const trimAndNotify = (slots, setSlots, charLabel) => {
      const { kept, dropped } = trimSlotsToLimit(slots, durationNum)
      if (dropped > 0) {
        setSlots(kept)
        toast(`${dropped} audio part${dropped > 1 ? 's' : ''} removed from ${charLabel} — exceeded new ${durationNum}s limit.`, {
          icon: '✂️', duration: 4000,
        })
      } else {
        // No drop needed, but still enforce hard trim by index in case durations were unknown
        setSlots((prev) => prev.slice(0, prev.filter(Boolean).length))
      }
    }
    trimAndNotify(audioSlots1, setAudioSlots1, 'Character 1')
    trimAndNotify(audioSlots2, setAudioSlots2, 'Character 2')
  }, [durationNum]) // eslint-disable-line

  // ── load models ──────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models').select('*').eq('feature', 'lipsync')
      .eq('is_active', true).eq('is_user_facing', true).order('sort_order')
    const list = data || []
    setModels(list)
    setModel(list.find((m) => !m.is_locked)?.value || '')
    setModelsLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  const selectedModel = models.find((m) => m.value === model)
  const caps          = getModelCaps(selectedModel)

  // ── reset on model change ────────────────────────────────────
  useEffect(() => {
    if (!selectedModel) return
    if (!caps.faceInput && caps.videoInput)  setSubjectMode('video')
    if (caps.faceInput  && !caps.videoInput) setSubjectMode('face')
    if (!caps.textScript) { setAudioMode1('upload'); setAudioMode2('upload') }
    if (!caps.multiChar) { setAudioSlots2([]); setScript2('') }
    if (!caps.supportedDurations.includes(duration)) setDuration(caps.supportedDurations[0] || '5')
    if (!autoRatio && !caps.supportedAspectRatios.includes(aspectRatio)) setAspectRatio(caps.supportedAspectRatios[0] || '9:16')
  }, [model]) // eslint-disable-line

  // ── credit cost ──────────────────────────────────────────────
  const creditCost = (() => {
    if (!selectedModel) return 0
    const base = selectedModel.credit_cost_i2i || selectedModel.credit_cost_t2i || 0
    if (caps.isFlatRate) return base
    return Math.ceil(base * parseInt(duration || '5'))
  })()

  const canAfford = credits >= creditCost

  // ── readiness ────────────────────────────────────────────────
  const hasSubject = subjectMode === 'face' ? !!faceImage : !!videoFile
  const hasAudio1  = audioMode1 === 'upload'
    ? audioSlots1.filter(Boolean).length > 0
    : script1.trim().length > 0
  const hasAudio2  = !caps.multiChar || (
    audioMode2 === 'upload'
      ? audioSlots2.filter(Boolean).length > 0
      : script2.trim().length > 0
  )
  const subjectRequired = caps.faceInput || caps.videoInput
  const subjectOk       = !subjectRequired || hasSubject
  const buttonDisabled  = submitting || !canAfford || !hasAudio1 || !hasAudio2 || !subjectOk || !selectedModel

  const modeLabel = (() => {
    if (caps.multiChar)                             return 'Multi-Character Sync'
    if (caps.videoInput && subjectMode === 'video') return 'Video Lip Sync'
    if (caps.faceInput  && subjectMode === 'face')  return 'Talking Avatar'
    return 'Talking Head'
  })()

  // ── upload handlers ──────────────────────────────────────────
  const handleFaceUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const compressed = await compressImage(file)
    setFaceImage(compressed); persistFile(SS_SUBJECT_IMG, compressed.file)
    setAspectRatio(compressed.ar); setAutoRatio(true)
  }

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setVideoFile({ file, name: file.name, url: URL.createObjectURL(file) })
    persistFile(SS_SUBJECT_VID, file)
  }

  // ── Slot fill: handles both file upload and chunk/generation import ──────
  const handleSlotFill = (charSlot) => async (slotIndex, e, imported) => {
    const setSlots  = charSlot === 1 ? setAudioSlots1 : setAudioSlots2
    const curSlots  = charSlot === 1 ? audioSlots1    : audioSlots2
    const usedSoFar = totalSlotDuration(curSlots)
    const remaining = Math.max(0, durationNum - usedSoFar)

    // ── Import path ──
    if (imported) {
      const durS = imported.duration_seconds ?? null

      if (durS !== null && durS > remaining + 0.25) {
        toast.error(
          `This audio is ${durS.toFixed(1)}s but only ${remaining <= 0 ? '0s' : remaining.toFixed(1) + 's'} remains in your ${durationNum}s budget.`,
          { duration: 5000 }
        )
        return
      }

      const filled = {
        file:            null,
        url:             imported.output_url,
        name:            imported.name ?? imported.chunkLabel ?? 'Audio',
        fromChunk:       !!imported.fromChunk,
        fromGeneration:  !imported.fromChunk,
        chunkLabel:      imported.chunkLabel ?? null,
        duration_seconds: durS,
      }
      setSlots((prev) => { const next = [...prev]; next[slotIndex] = filled; return next })
      return
    }

    // ── File upload path ──
    const file = e?.target?.files?.[0]; if (!file) return

    let durS = null
    try { durS = await getAudioDuration(file) } catch {}

    if (durS !== null && durS > remaining + 0.25) {
      toast.error(
        `This audio is ${durS.toFixed(1)}s but only ${remaining.toFixed(1)}s remains in your ${durationNum}s budget. ` +
        `Upload a shorter clip or use a chunk from My Generations.`,
        { duration: 6000 }
      )
      return
    }

    const filled = {
      file,
      url:             URL.createObjectURL(file),
      name:            file.name,
      fromChunk:       false,
      fromGeneration:  false,
      duration_seconds: durS,
    }
    setSlots((prev) => { const next = [...prev]; next[slotIndex] = filled; return next })
  }

  const handleSlotClear = (charSlot) => (slotIndex) => {
    const setSlots = charSlot === 1 ? setAudioSlots1 : setAudioSlots2
    setSlots((prev) => {
      const next = [...prev]
      next[slotIndex] = null
      while (next.length > 0 && !next[next.length - 1]) next.pop()
      return next
    })
  }

  const clearAll = () => {
    setFaceImage(null); setVideoFile(null)
    setAudioSlots1([]); setAudioSlots2([])
    setScript1(''); setScript2('')
    setAutoRatio(false); setAspectRatio('9:16'); setPrompt('')
    try {
      [SS_PROMPT, SS_SUBJECT_IMG, SS_SUBJECT_VID].forEach((k) => sessionStorage.removeItem(k))
    } catch {}
  }

  // ── Upload file to storage ───────────────────────────────────
  const uploadToStorage = async (fileOrBlob, name = 'audio.wav', bucket = 'generation-uploads') => {
    const ext  = name.split('.').pop()?.toLowerCase() || 'wav'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { data, error } = await supabase.storage.from(bucket)
      .upload(path, fileOrBlob, { upsert: false, cacheControl: '3600', contentType: fileOrBlob.type || 'audio/wav' })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
    return publicUrl
  }

  // ── Build final audio URL for a character's slots ────────────
  const buildAudioUrl = async (slots) => {
    const filled = slots.filter(Boolean)
    if (filled.length === 0) return null
    if (filled.length === 1 && !filled[0].file) return filled[0].url

    const blobs = await Promise.all(
      filled.map(async (slot) => {
        if (slot.file) return slot.file
        const res = await fetch(slot.url)
        if (!res.ok) throw new Error(`Could not fetch audio: ${slot.url}`)
        return res.blob()
      })
    )

    if (blobs.length === 1 && filled[0].file) {
      return uploadToStorage(filled[0].file, filled[0].name)
    }

    const combined = await concatenateAudioBlobs(blobs)
    return uploadToStorage(combined, 'combined.wav')
  }

  // ── Generate ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedModel) return toast.error('Pick a model')
    if (!hasAudio1)     return toast.error('Add audio for character 1')
    if (!hasAudio2)     return toast.error('Add audio for character 2')
    if (!subjectOk)     return toast.error(subjectMode === 'face' ? 'Upload a face photo' : 'Upload a subject video')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    // Final safety trim before generate (covers edge cases with unknown durations)
    const { kept: safe1 } = trimSlotsToLimit(audioSlots1, durationNum)
    const { kept: safe2 } = trimSlotsToLimit(audioSlots2, durationNum)

    setSubmitting(true)
    try {
      let startFrameUrl   = null
      let subjectVideoUrl = null

      if (subjectMode === 'face'  && faceImage?.file)  startFrameUrl   = await uploadToStorage(faceImage.file, faceImage.file.name, 'generation-uploads')
      if (subjectMode === 'video' && videoFile?.file)   subjectVideoUrl = await uploadToStorage(videoFile.file, videoFile.file.name, 'generation-uploads')

      let audio1Url = null
      let audio2Url = null

      if (audioMode1 === 'upload') audio1Url = await buildAudioUrl(safe1)
      if (caps.multiChar && audioMode2 === 'upload') audio2Url = await buildAudioUrl(safe2)

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

  // ─── render ───────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Generating overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }} />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>
              {audioSlots1.filter(Boolean).length > 1 || audioSlots2.filter(Boolean).length > 1
                ? 'Joining audio parts…'
                : 'Generating…'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Talking Head</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>{modeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && models.length > 0 && <ModelDropdown models={models} value={model} onChange={setModel} />}
          {!modelsLoading && models.length === 0 && (
            <span className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>No models</span>
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

          {/* ── Subject ── */}
          {(caps.faceInput || caps.videoInput) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Subject <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— required</span>
                </p>
                {caps.faceInput && caps.videoInput && (
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
                onFaceRemove={() => { setFaceImage(null); setAutoRatio(false); setAspectRatio('9:16'); try { sessionStorage.removeItem(SS_SUBJECT_IMG) } catch {} }}
                onVideoRemove={() => { setVideoFile(null); try { sessionStorage.removeItem(SS_SUBJECT_VID) } catch {} }}
              />
            </div>
          )}

          {/* ── Settings ── */}
          <div>
            <SettingChips
              label="Aspect Ratio"
              options={ALL_ASPECT_RATIOS.map((o) => ({ ...o, disabled: !caps.supportedAspectRatios.includes(o.value) }))}
              value={aspectRatio} onChange={(v) => { setAspectRatio(v); setAutoRatio(false) }}
            />
            {caps.supportedDurations?.length > 1 && (
              <SettingChips
                label="Duration"
                options={caps.supportedDurations.map((d) => ({ label: `${d}s`, value: d }))}
                value={duration} onChange={setDuration}
              />
            )}
          </div>

          {/* ── Audio ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {caps.multiChar ? 'Audio Tracks' : 'Audio'}
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — required</span>
              </p>
              {caps.multiChar && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold"
                  style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                  <Users size={11} />2 characters
                </div>
              )}
            </div>

            <MultiSlotAudio
              label="Audio"
              audioSlots={audioSlots1}
              durationS={durationNum}
              onSlotFill={handleSlotFill(1)}
              onSlotClear={handleSlotClear(1)}
              audioMode={audioMode1}
              onAudioModeChange={setAudioMode1}
              script={audioMode1 === 'text' ? script1 : ''}
              onScriptChange={setScript1}
              supportsTextScript={caps.textScript}
              charIndex={caps.multiChar ? 0 : undefined}
              userId={user?.id}
            />

            {caps.multiChar && (
              <MultiSlotAudio
                label="Audio"
                audioSlots={audioSlots2}
                durationS={durationNum}
                onSlotFill={handleSlotFill(2)}
                onSlotClear={handleSlotClear(2)}
                audioMode={audioMode2}
                onAudioModeChange={setAudioMode2}
                script={audioMode2 === 'text' ? script2 : ''}
                onScriptChange={setScript2}
                supportsTextScript={caps.textScript}
                charIndex={1}
                userId={user?.id}
              />
            )}
          </div>

          {/* ── Prompt ── */}
          <Textarea label="Prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
            placeholder="Optional: describe pose, expression, background scene…" rows={3} />

        </div>
      </div>

      {/* Generate button */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button onClick={handleGenerate} disabled={buttonDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{ background: buttonDisabled ? 'var(--bg-elevated)' : ACCENT, color: buttonDisabled ? 'var(--text-muted)' : '#ffffff' }}>
            <Zap size={15} fill="currentColor" />
            {submitting ? 'Generating…' : !canAfford ? 'Not enough credits' : `Generate · ${creditCost} cr`}
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
