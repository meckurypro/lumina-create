import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, X, ImagePlus, Plus, Maximize2,
  Film, AlertCircle, RefreshCw, CheckCircle2, Scissors, Lock,
  Mic, Library, Play, Pause, Loader2, ChevronDown,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRenderWindowSubscription } from '@/hooks/useRenderWindowSubscription'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import { ugcAudioChunks } from '@/lib/ugcVoices'
import toast from 'react-hot-toast'
import { applyModelPreferences } from '@/hooks/useModelPreferences'
import { detectAspectRatio, compressImage, readVideoMetadata, tagForSlot, formatDuration, formatBytes } from '@/lib/mediaUtils'
import { ModelDropdown } from '@/components/create/ModelDropdown'
import { SettingChips } from '@/components/create/SettingChips'
import { MentionPicker } from '@/components/create/MentionPicker'
import { usePromptTagging } from '@/hooks/usePromptTagging'
import { fetchMentionLibrary, fetchBrandProducts } from '@/lib/ugcMentions'
import { saveDraftJSON, loadDraftJSON, draftDelete, saveDraftFile, loadDraftFile, saveDraftImages, loadDraftImages } from '@/lib/draftCache'

// ─── theme ────────────────────────────────────────────────────────────────────
const ACCENT     = 'var(--tool-video)'
const ACCENT_SUB = 'var(--tool-video-subtle)'
const ACCENT_BDR = 'var(--tool-video-border)'

// ─── draft keys (this page's own drafts) ──────────────────────────────────────
const DRAFT_PROMPT     = 'create_video:prompt'
const DRAFT_START_FRAME = 'create_video:start_frame'
const DRAFT_END_FRAME   = 'create_video:end_frame'
const DRAFT_REF_IMAGES  = 'create_video:ref_images'

// ─── cross-page handoff keys — stay on sessionStorage, NOT draftCache ─────────
// These are written by other pages (Assets picker, this page's own lipsync
// redirect into Talking Head) as one-time payloads, not per-page drafts.
const SS_OMNI_REF = 'meckury_video_omni_ref'
const TH_SS_SUBJECT_IMG     = 'meckury_th_subject_img'
const TH_SS_LIPSYNC_PREFILL = 'meckury_th_lipsync_prefill'

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

// Features that belong on this page (i2v / t2v / start-end / video-edit).
// Lipsync and motion_transfer models are deliberately excluded — they have
// their own pages (CreateTalkingHeadPage, CreateCopyMotionPage).
const VIDEO_PAGE_FEATURES = [
  'image_to_video',
  'image_text_to_video',
  'text_to_video',
  'frame_to_frame',
  'video_to_video',
]

// Dual-purpose models: intentionally shown here even though their `feature`
// column points to another page's category (e.g. meckury_i2v_max is tagged
// feature="lipsync" but is also a legitimate i2v model). Add a model's
// `value` here only when you explicitly want it to cross categories.
const CROSSOVER_ALLOWLIST = ['meckury_i2v_max']

// ─── model capability helper (page-specific — not duplicated elsewhere) ───────
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
    requiresAudio:         false,
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
    requiresEndFrame:      model.requires_end_frame      ?? false,
    requiresImage:         model.requires_image          ?? false,
    requiresVideo:         model.requires_video           ?? false,
    requiresAudio:         model.requires_audio          ?? false,
  }
}

function deriveVideoType(startFrame, endFrame) {
  if (startFrame && endFrame) return 'start_end_frame'
  if (startFrame)             return 'image_to_video'
  if (endFrame)               return 'end_frame_text'
  return 'text_to_video'
}

function checkVideoEditCompat({ videoMeta, maxBillable }) {
  if (!videoMeta?.duration) return { ok: false, tooShort: false, needsTrim: false, reason: null }
  if (videoMeta.duration < 1) return { ok: false, tooShort: true, needsTrim: false, reason: 'Video is too short (min 1s).' }
  if (videoMeta.duration > maxBillable) return { ok: false, tooShort: false, needsTrim: true, reason: `Video is ${videoMeta.duration}s — longer than the ${maxBillable}s billing cap. Trim it down.` }
  return { ok: true, tooShort: false, needsTrim: false, reason: null }
}

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
      body: { sourceUrl, targetAspectRatio: '16:9', targetDuration, startTime, trimOnly: true },
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

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO UTILITIES  (duplicated verbatim in CreateTalkingHeadPage — candidate
// for a future src/lib/audioUtils.js extraction, out of scope for this pass)
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

function totalSlotDuration(slots) {
  return slots.filter(Boolean).reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0)
}

// ─── shared audio ref (stops playback when picker unmounts) ───────────────────
const sharedPickerAudio = { ref: null }

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO SOURCE PICKER
// ─────────────────────────────────────────────────────────────────────────────

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
      {cfg.icon}{cfg.text}
    </div>
  )
}

const VideoUploadZone = ({ value, onUpload, onRemove, compatStatus, tooShort }) => {
  if (value) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden"
        style={{ aspectRatio: (value.aspectRatio?.replace(':', '/') || '16/9'), background: 'var(--bg-elevated)' }}>
        <video src={value.url} className="w-full h-full object-cover" muted loop autoPlay playsInline
          style={{ filter: tooShort ? 'blur(4px)' : 'none' }} />
        {value.duration != null && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
            {formatDuration(value.duration)}
            {value.size && <span className="ml-1.5 opacity-70">· {formatBytes(value.size)}</span>}
          </div>
        )}
        <CompatBadge status={compatStatus} />
        <button onClick={onRemove} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', zIndex: 10 }}>
          <X size={13} />
        </button>
      </div>
    )
  }
  return (
    <label className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
      style={{ aspectRatio: '9/16', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
      <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
      <Film size={24} style={{ color: ACCENT, marginBottom: 8 }} />
      <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload video</span>
      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>MP4 · MOV · WEBM · max 40 MB</span>
    </label>
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
        <button onClick={onRemove} className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', zIndex: 10 }}>
          <X size={13} />
        </button>
      </div>
    ) : (
      <label className="flex flex-col items-center justify-center w-full rounded-2xl transition-all"
        style={{
          aspectRatio: '1/1',
          border:      `1.5px dashed ${ACCENT_BDR}`,
          background:  ACCENT_SUB,
          cursor:      disabled ? 'not-allowed' : 'pointer',
          opacity:     disabled ? 0.3 : 1,
        }}>
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
            <button onClick={() => onTagInsert(tagForSlot(i))}
              className="px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
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
                <div className="relative overflow-hidden rounded-xl cursor-pointer"
                  style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
                  onClick={() => onFullscreen(idx)}>
                  {img.isVideo
                    ? <video src={img.url} className="w-full h-full object-cover" muted playsInline style={{ pointerEvents: 'none' }} />
                    : <img src={img.url} alt={`ref ${idx + 1}`} className="w-full h-full" style={{ objectFit: 'cover' }} />}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <Maximize2 size={16} color="white" />
                  </div>
                  {img.isVideo && (
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-xs font-bold"
                      style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>Video</div>
                  )}
                </div>
                <button onClick={() => onTagInsert(tagForSlot(idx))}
                  className="w-full py-1 rounded-lg text-xs font-mono font-semibold transition-all"
                  style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                  {tagForSlot(idx)}
                </button>
                <button onClick={() => onRemove(idx)}
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center z-10"
                  style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}>
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

const ProcessingOverlay = ({ phase, convertProgress }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-8"
    style={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', background: 'rgba(0,0,0,0.45)' }}>
    {phase === 'converting' ? (
      <>
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <motion.circle cx="32" cy="32" r="28" fill="none" stroke={ACCENT} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              strokeDashoffset={`${2 * Math.PI * 28 * (1 - convertProgress / 100)}`}
              style={{ transformOrigin: '32px 32px', rotate: '-90deg' }} transition={{ duration: 0.3 }} />
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
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="w-10 h-10 rounded-full border-2"
          style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }} />
        <p className="text-sm font-semibold tracking-wide" style={{ color: '#fff' }}>Generating…</p>
      </>
    )}
  </motion.div>
)

// ─── main page ────────────────────────────────────────────────────────────────
export default function CreateVideoPage() {
  const navigate                                   = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()
  const { canUseRWModels }                         = useRenderWindowSubscription()
  const textareaRef = useRef(null)

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

  const [editVideo,         setEditVideo]         = useState(null)
  const [trimTarget,        setTrimTarget]        = useState(null)
  const [trimStart,         setTrimStart]         = useState(0)
  const [phase,             setPhase]             = useState(null)
  const [convertProgress,   setConvertProgress]   = useState(0)
  const [convertedSettings, setConvertedSettings] = useState(null)

  const [omniRefLoaded, setOmniRefLoaded] = useState(false)

 const [audioSlots, setAudioSlots] = useState([])

  const [mentionLibrary,       setMentionLibrary]       = useState({ characters: [], brands: [] })
  const [brandProducts,        setBrandProducts]        = useState([])
  const [brandProductsLoading, setBrandProductsLoading] = useState(false)

  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)

  const {
    trackSelection, insertAtCursor, handlePromptChange,
    mention, resolveMention, drillIntoBrand: drillMentionBrand, backToRoot, closeMention,
  } = usePromptTagging({ textareaRef, getPrompt: () => prompt, setPrompt })

  useEffect(() => {
    if (!user) return
    fetchMentionLibrary(user.id).then(setMentionLibrary)
  }, [user])

  const handleDrillIntoBrand = async (brand) => {
    drillMentionBrand(brand)
    setBrandProductsLoading(true)
    const products = await fetchBrandProducts(brand.id)
    setBrandProducts(products)
    setBrandProductsLoading(false)
  }

  // ── cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try {
        draftDelete(DRAFT_START_FRAME)
        draftDelete(DRAFT_END_FRAME)
        draftDelete(DRAFT_REF_IMAGES)
      } catch {}
    }
  }, [])

  // ── restore drafts ────────────────────────────────────────────────────────
  useEffect(() => {
    loadDraftJSON(DRAFT_PROMPT).then((p) => { if (p) setPrompt(p) })

    try {
      const omniRaw = sessionStorage.getItem(SS_OMNI_REF)
      if (omniRaw) {
        const { url, name } = JSON.parse(omniRaw)
        sessionStorage.removeItem(SS_OMNI_REF)
        setOmniRefLoaded({ url, name })
        return
      }
    } catch {}

    loadDraftFile(DRAFT_START_FRAME).then((frame) => {
      if (!frame) return
      setStartFrame(frame)
      const img = new Image()
      img.onload = () => { setAspectRatio(detectAspectRatio(img.width, img.height)); setAutoRatio(true) }
      img.src = frame.url
    })
    loadDraftFile(DRAFT_END_FRAME).then((frame) => { if (frame) setEndFrame(frame) })
    loadDraftImages(DRAFT_REF_IMAGES).then((restored) => { if (restored.length) setRefImages(restored) })
  }, [])

  useEffect(() => {
    saveDraftJSON(DRAFT_PROMPT, prompt)
  }, [prompt])

  const persistRefImages = (imgs) => { saveDraftImages(DRAFT_REF_IMAGES, imgs) }

  // ── load models ───────────────────────────────────────────────────────────
const loadModels = useCallback(async () => {
    setModelsLoading(true)

    const [{ data: byFeature }, { data: crossover }] = await Promise.all([
      supabase
        .from('models')
        .select('*')
        .eq('type', 'video')
        .eq('is_active', true)
        .eq('is_user_facing', true)
        .in('feature', VIDEO_PAGE_FEATURES)
        .order('sort_order'),
      supabase
        .from('models')
        .select('*')
        .eq('type', 'video')
        .eq('is_active', true)
        .eq('is_user_facing', true)
        .in('value', CROSSOVER_ALLOWLIST)
        .order('sort_order'),
    ])

const merged = [...(byFeature || [])]
    for (const m of crossover || []) {
      if (!merged.some((x) => x.value === m.value)) merged.push(m)
    }

    const isMaster     = profile?.user_tier === 'master'
    const tierFiltered = merged
      .filter((m) => isMaster || m.tier_required !== 'master')
      // Render-window (ComfyUI) models are only visible with an active
      // subscription AND a currently-open window — otherwise they'd be
      // shown but unusable.
      .filter((m) => m.model_access_type !== 'render_window' || canUseRWModels)
    const list         = await applyModelPreferences(tierFiltered, user?.id)
    setModels(list)
    setModelsLoading(false)
    return list
  }, [canUseRWModels])

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

  useEffect(() => {
    if (!caps.supportsMultiImage || caps.requiresEndFrame) {
      setMultiMode(false); setRefImages([])
      draftDelete(DRAFT_REF_IMAGES)
    }
    if (!caps.isVideoEdit) {
      setEditVideo(null); setTrimTarget(null); setTrimStart(0); setConvertedSettings(null)
    }
    if (!caps.requiresAudio) {
      setAudioSlots([])
    }
  }, [model]) // eslint-disable-line

  useEffect(() => {
    if (!selectedModel) return
    if (caps.supportedDurations.length > 0 && !caps.supportedDurations.includes(duration))
      setDuration(caps.supportedDurations[0] || '5')
    if (!autoRatio && !caps.supportedAspectRatios.includes(aspectRatio))
      setAspectRatio(caps.supportedAspectRatios[0] || '9:16')
  }, [model]) // eslint-disable-line

  useEffect(() => {
    if (!modelsLoading && !caps.supportsSound) setWithSound(false)
  }, [caps.supportsSound, modelsLoading])

  useEffect(() => {
    if (!caps.isVideoEdit || !editVideo?.duration) return
    setTrimTarget(Math.min(editVideo.duration, VIDEO_EDIT_MAX_BILLABLE))
    setTrimStart(0)
  }, [editVideo?.duration, caps.isVideoEdit])

  useEffect(() => {
    if (!editVideo?.duration || !trimTarget) return
    const maxStart = Math.max(0, editVideo.duration - trimTarget)
    if (trimStart > maxStart) setTrimStart(maxStart)
  }, [editVideo?.duration, trimTarget, trimStart])

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

  const billableDuration = useMemo(() => {
    if (!caps.isVideoEdit) return null
    if (convertedSettings) return convertedSettings.duration
    if (editVideo?._converted) return editVideo.duration
    return Math.min(trimTarget ?? editVideo?.duration ?? VIDEO_EDIT_MAX_BILLABLE, VIDEO_EDIT_MAX_BILLABLE)
  }, [caps.isVideoEdit, convertedSettings, editVideo, trimTarget])

  const activeStartFrame = startFrame && caps.supportsStartFrame                              ? startFrame : null
  const activeEndFrame   = endFrame   && (caps.supportsEndFrame || caps.supportsFrameToFrame) ? endFrame   : null

  const type   = multiMode && refImages.length > 0 ? 'image_to_video' : deriveVideoType(activeStartFrame, activeEndFrame)
  const isI2V  = multiMode ? refImages.length > 0 : !!(activeStartFrame || activeEndFrame)

  const creditCost = useMemo(() => {
    if (!selectedModel) return 0
    if (caps.isVideoEdit) {
      const billable = billableDuration ?? VIDEO_EDIT_MAX_BILLABLE
      return billable * VIDEO_EDIT_CPS
    }
    const isFlatRate = selectedModel?.is_flat_rate ?? false
    if (isFlatRate) {
      return isI2V
        ? (selectedModel.credit_cost_i2i || 0)
        : (selectedModel.credit_cost_t2i || 0)
    }
    const dur = parseInt(duration || '5', 10)
    if (selectedModel.credit_cost_per_second) {
      const billable = Math.max(dur, selectedModel.min_billable_seconds ?? 1)
      const base = Math.ceil(selectedModel.credit_cost_per_second * billable)
      return withSound && caps.supportsSound
        ? Math.ceil(base * (selectedModel?.sound_cost_multiplier ?? 1.5))
        : base
    }
    const cps = isI2V
      ? (selectedModel.credit_cost_i2i || 0)
      : (selectedModel.credit_cost_t2i || 0)
    const base = cps * dur
    return withSound && caps.supportsSound
      ? Math.ceil(base * (selectedModel?.sound_cost_multiplier ?? 1.5))
      : Math.ceil(base)
  }, [selectedModel, caps, isI2V, duration, withSound, billableDuration])

  const canAfford   = credits >= creditCost
  const promptEmpty = !prompt.trim()

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
  const handleFrameUpload = (setter, draftKey) => (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const url  = URL.createObjectURL(file)
    if (!startFrame && !endFrame) {
      const img = new Image()
      img.onload = () => { setAspectRatio(detectAspectRatio(img.width, img.height)); setAutoRatio(true) }
      img.src = url
    }
    setter({ file, url })
    saveDraftFile(draftKey, { file, name: file.name })
  }

  const handleRemoveFrame = (setter, draftKey, isStart) => {
    setter(null)
    draftDelete(draftKey)
    const otherFrame = isStart ? endFrame : startFrame
    if (!otherFrame) { setAutoRatio(false); setAspectRatio('9:16') }
  }

  // ── multi-ref handlers ────────────────────────────────────────────────────
  const handleAddRefImage = async (e, slotIdx) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file)
      setRefImages((prev) => {
        const next = [...prev]; next[slotIdx] = { file, url, ar: '9:16', isVideo: true, name: file.name }
        const trimmed = next.filter((_, i) => i <= slotIdx || next[i] != null)
        persistRefImages(trimmed); return trimmed
      })
    } else {
      const compressed = await compressImage(file)
      setRefImages((prev) => {
        const next = [...prev]; next[slotIdx] = { ...compressed, isVideo: false }
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
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error(`Video must be under ${formatBytes(MAX_VIDEO_BYTES)}. Yours is ${formatBytes(file.size)}.`)
      e.target.value = ''; return
    }
    const meta = await readVideoMetadata(file)
    if (meta.duration != null && meta.duration < 1) {
      toast.error('Video is too short — minimum 1 second.')
      e.target.value = ''; return
    }
    const url = URL.createObjectURL(file)
    setEditVideo({ file, url, duration: meta.duration, size: file.size, aspectRatio: meta.aspectRatio })
    setTrimStart(0); setConvertedSettings(null)
    if (meta.aspectRatio && caps.supportedAspectRatios.includes(meta.aspectRatio)) {
      setAspectRatio(meta.aspectRatio); setAutoRatio(true)
    }
    e.target.value = ''
  }

  const handleRemoveEditVideo = () => {
    if (editVideo?.url && editVideo?.file) URL.revokeObjectURL(editVideo.url)
    setEditVideo(null); setTrimTarget(null); setTrimStart(0); setConvertedSettings(null)
  }

  // ── trim / convert ────────────────────────────────────────────────────────
  const handleConvert = async () => {
    if (!user)       return toast.error('Please sign in')
    if (!editVideo)  return toast.error('Upload a video first')
    if (!trimTarget) return toast.error('Select a trim duration')
    if (credits < VIDEO_EDIT_CONVERT_COST) return toast.error(`Trim costs ${VIDEO_EDIT_CONVERT_COST} credits.`)

    setPhase('converting'); setConvertProgress(0)
    let processed
    try {
      processed = await callTrimEdgeFunction({
        file: editVideo.file, url: editVideo.url, userId: user.id,
        targetDuration: trimTarget, startTime: trimStart,
        onProgress: (p) => setConvertProgress(p),
      })
    } catch (err) {
      setPhase(null); setConvertProgress(0); toast.error(err?.message || 'Trim failed.'); return
    }

    try {
      await supabase.rpc('deduct_credits', {
        p_user_id: user.id, p_amount: VIDEO_EDIT_CONVERT_COST,
        p_generation_id: null, p_description: 'Video Edit trim conversion',
      })
    } catch {}

    refreshProfile(); setPhase(null); setConvertProgress(0)
    const actualDuration = processed.duration ?? trimTarget
    setEditVideo({ file: null, url: processed.url, duration: actualDuration, _converted: true })
    setConvertedSettings({ duration: actualDuration })
    setTrimTarget(actualDuration); setTrimStart(0)
    toast.success('Video trimmed — ready to generate!', { duration: 3000 })
  }

// ── tag insertion ─────────────────────────────────────────────────────────
  // insertAtCursor (manual [imgN] buttons) and resolveMention ("@"/"/"
  // pickers) come from usePromptTagging above.

  const addMentionRefImage = (url, role, label) => {
    if (!caps.supportsMultiImage) {
      toast.error('Switch to a multi-reference model to tag characters or brands')
      return null
    }
    const filled = refImages.filter(Boolean)
    if (filled.length >= caps.maxRefImages) {
      toast.error(`This model supports up to ${caps.maxRefImages} reference images`)
      return null
    }
    if (!multiMode) setMultiMode(true)
    const idx = filled.length
    const next = [...refImages]
    next[idx] = { file: null, url, ar: '1:1', isVideo: false, role, label }
    setRefImages(next)
    persistRefImages(next)
    return idx
  }

  const handleSelectMentionUpload = (idx) => resolveMention(tagForSlot(idx))

  const handleSelectMentionCharacter = (character) => {
    const idx = addMentionRefImage(character.photo_face_front, 'character_face', character.name)
    if (idx !== null) resolveMention(tagForSlot(idx))
  }

  const handleSelectMentionLogo = (brand) => {
    const idx = addMentionRefImage(brand.logo_url, 'brand_logo', brand.brand_name)
    if (idx !== null) resolveMention(tagForSlot(idx))
  }

  const handleSelectMentionProduct = (brand, product) => {
    const idx = addMentionRefImage(product.image_url, 'product', `${brand.brand_name} — ${product.name}`)
    if (idx !== null) resolveMention(tagForSlot(idx))
  }
  // ── audio slot handlers ───────────────────────────────────────────────────
  const handleAudioSlotFill = async (slotIndex, e, imported) => {
    const usedSoFar = totalSlotDuration(audioSlots)
    const dur       = parseInt(duration || '5', 10)
    const remaining = Math.max(0, dur - usedSoFar)

    if (imported) {
      const durS      = imported.duration_seconds ?? null
      const needsTrim = durS !== null && durS > remaining + 0.25
      if (needsTrim) toast(`Trimming audio to ${remaining.toFixed(1)}s.`, { icon: '✂️', duration: 3500 })
      const filled = {
        file: null, url: imported.output_url,
        name: imported.name ?? imported.chunkLabel ?? 'Audio',
        fromChunk: !!imported.fromChunk, chunkLabel: imported.chunkLabel ?? null,
        duration_seconds: durS !== null ? Math.min(durS, remaining) : remaining,
        _needsTrim: needsTrim, _trimToSeconds: remaining, _trimStartTime: 0, _rawDuration: durS,
      }
      setAudioSlots((prev) => { const next = [...prev]; next[slotIndex] = filled; return next })
      return
    }

    const file = e?.target?.files?.[0]; if (!file) return
    let durS = null
    try { durS = await getAudioDuration(file) } catch {}
    const needsTrim = durS !== null && durS > remaining + 0.25
    if (needsTrim) toast(`Audio trimmed to ${remaining.toFixed(1)}s.`, { icon: '✂️', duration: 3500 })
    const filled = {
      file, url: URL.createObjectURL(file), name: file.name,
      fromChunk: false, duration_seconds: durS !== null ? Math.min(durS, remaining) : remaining,
      _needsTrim: needsTrim, _trimToSeconds: remaining, _trimStartTime: 0, _rawDuration: durS,
    }
    setAudioSlots((prev) => { const next = [...prev]; next[slotIndex] = filled; return next })
  }

  const handleAudioSlotClear = (slotIndex) => {
    setAudioSlots((prev) => {
      const next = [...prev]; next[slotIndex] = null
      while (next.length > 0 && !next[next.length - 1]) next.pop()
      return next
    })
  }

  const handleAudioSlotStartChange = (slotIndex, startTime) => {
    setAudioSlots((prev) => {
      const next = [...prev]; if (!next[slotIndex]) return prev
      next[slotIndex] = { ...next[slotIndex], _trimStartTime: startTime }
      return next
    })
  }

  // ── lipsync redirect ──────────────────────────────────────────────────────
  const handleLipsyncRedirect = useCallback(({ extractedSpeech, startFrameFile, startFrameUrl }) => {
    if (startFrameFile) {
      try {
        const reader = new FileReader()
        reader.onload = (ev) => {
          sessionStorage.setItem(TH_SS_SUBJECT_IMG, JSON.stringify({
            base64: ev.target.result,
            name:   startFrameFile.name,
            type:   startFrameFile.type,
          }))
        }
        reader.readAsDataURL(startFrameFile)
      } catch {}
    } else if (startFrameUrl) {
      try {
        sessionStorage.setItem(TH_SS_SUBJECT_IMG, JSON.stringify({
          url:  startFrameUrl,
          name: 'subject.jpg',
        }))
      } catch {}
    }

    try {
      sessionStorage.setItem(TH_SS_LIPSYNC_PREFILL, JSON.stringify({
        script:    extractedSpeech ?? '',
        model:     'kling_v1_ai_avatar_standard',
        audioMode: 'text',
      }))
    } catch {}

    navigate('/create/talking-head')
  }, [navigate])

  // ── audio upload to storage ───────────────────────────────────────────────
  const uploadAudioToStorage = async (fileOrBlob, name = 'audio.wav') => {
    const ext  = name.split('.').pop()?.toLowerCase() || 'wav'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { data, error } = await supabase.storage
      .from('generation-uploads')
      .upload(path, fileOrBlob, { upsert: false, cacheControl: '3600', contentType: fileOrBlob.type || 'audio/wav' })
    if (error) throw new Error(`Audio upload failed: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(data.path)
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
        if (slot._needsTrim && slot._trimToSeconds > 0)
          blob = await trimAudioToLimit(blob, slot._trimToSeconds, slot._trimStartTime ?? 0)
        return blob
      })
    )
    if (blobs.length === 1 && filled[0].file && !filled[0]._needsTrim)
      return uploadAudioToStorage(filled[0].file, filled[0].name)
    const combined = blobs.length === 1 ? blobs[0] : await concatenateAudioBlobs(blobs)
    return uploadAudioToStorage(combined, 'combined.wav')
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

        const finalDuration = billableDuration ?? VIDEO_EDIT_MAX_BILLABLE
        const finalCost     = finalDuration * VIDEO_EDIT_CPS

        const { data: genRow, error: genErr } = await generationsDb.create({
          user_id: user.id, generation_type: 'video_to_video', status: 'pending',
          prompt, model, aspect_ratio: aspectRatio, duration: String(finalDuration),
          credits_charged: finalCost, output_type: 'video',
         input_image_urls: [videoUrl], with_sound: false, skip_prompt_refinement: true,
          is_system_prompt: false,
        })
        if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

        const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, finalCost, genRow.id)
        if (dErr || !deduct?.success) {
          await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
          throw new Error(deduct?.error || 'Not enough credits')
        }

        const { data: invokeData, error: invokeErr } = await supabase.functions
          .invoke('video-generate', { body: { generationId: genRow.id } })

        if (invokeErr || invokeData?.error) {
          const msg = invokeData?.error || invokeErr?.message || 'Generation blocked'
          toast.error(msg)
          await refreshProfile()
          return
        }

        refreshProfile()
        toast.success('Your edited video is being generated. Check your Media page.', { duration: 4000 })
        setPrompt(''); handleRemoveEditVideo()
        return
      }

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
      const imageRefsMeta   = []
      if (multiMode && refImages.length > 0) {
        for (const img of refImages) {
          if (!img) continue
          let url = img.url
          if (img.file) {
            const contentType = img.file.type || 'image/jpeg'
            const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
            const path = `${user.id}/${crypto.randomUUID()}.${ext}`
            const { data: uploadData, error: upErr } = await supabase.storage
              .from('generation-uploads')
              .upload(path, img.file, { upsert: false, cacheControl: '3600', contentType })
            if (upErr) throw new Error(`Reference upload failed: ${upErr.message}`)
            const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(uploadData.path)
            url = publicUrl
          }
          uploadedRefUrls.push(url)
          if (img.role) imageRefsMeta.push({ url, role: img.role, label: img.label || null })
        }
      }

      if (type === 'image_to_video' && (startFrameUrl || uploadedRefUrls.length)) {
        const { data: checkData } = await supabase.functions.invoke(
          'video-generate',
          { body: { lipsync_check_only: true, prompt, image_url: startFrameUrl ?? uploadedRefUrls[0], aspect_ratio: aspectRatio } }
        )
        if (checkData?.lipsync_redirect) {
          setPhase(null)
          handleLipsyncRedirect({
            extractedSpeech: checkData.extracted_speech,
            startFrameFile:  activeStartFrame?.file ?? null,
            startFrameUrl:   startFrameUrl ?? checkData.image_url,
          })
          return
        }
      }

      let resolvedAudioUrl = null
      if (caps.requiresAudio) {
        if (audioSlots.filter(Boolean).length === 0) {
          setPhase(null)
          return toast.error('Add an audio track before generating.')
        }
        resolvedAudioUrl = await buildAudioUrl(audioSlots)
        if (!resolvedAudioUrl) {
          setPhase(null)
          return toast.error('Audio upload failed — please try again.')
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
        audio_url:              resolvedAudioUrl || null,
        generation_metadata:    imageRefsMeta.length ? { image_refs: imageRefsMeta } : null,
        is_system_prompt:       false,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      const { data: invokeData, error: invokeErr } = await supabase.functions.invoke(
        'video-generate',
        { body: { generationId: genRow.id } }
      )

      if (invokeErr || invokeData?.error) {
        const msg = invokeData?.error || invokeErr?.message || 'Generation blocked'
        toast.error(msg)
        await refreshProfile()
        return
      }

      refreshProfile()
      toast.success('Your video is being generated. Check your Media page.', { duration: 4000 })
      setPrompt('')
      setStartFrame(null); setEndFrame(null); setRefImages([])
      setAutoRatio(false); setAspectRatio('9:16'); setWithSound(true)
      setAudioSlots([])
      draftDelete(DRAFT_PROMPT)
      draftDelete(DRAFT_START_FRAME)
      draftDelete(DRAFT_END_FRAME)
      draftDelete(DRAFT_REF_IMAGES)

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
    || (caps.requiresEndFrame && !activeEndFrame)
    || (caps.requiresImage && !multiMode && !activeStartFrame)
    || (caps.requiresImage &&  multiMode && refImages.length === 0)
    || (caps.requiresVideo && !caps.isVideoEdit && !editVideo)
    || (caps.requiresAudio && audioSlots.filter(Boolean).length === 0)
    || (creditCost === 0 && !!selectedModel && !caps.isVideoEdit && !selectedModel?.is_render_window)

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      <AnimatePresence>
        {isProcessing && <ProcessingOverlay phase={phase} convertProgress={convertProgress} />}
      </AnimatePresence>

      <AnimatePresence>
        {fullscreenImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)' }}
            onClick={() => setFullscreenIdx(null)}>
            <button onClick={() => setFullscreenIdx(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}>
              <X size={18} />
            </button>
            {fullscreenImage.isVideo ? (
              <motion.video initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.93, opacity: 0 }} src={fullscreenImage.url} controls autoPlay
                className="rounded-2xl" style={{ maxWidth: '100%', maxHeight: '90dvh' }}
                onClick={(e) => e.stopPropagation()} />
            ) : (
              <motion.img initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.93, opacity: 0 }} src={fullscreenImage.url} alt="Reference full"
                className="rounded-2xl" style={{ maxWidth: '100%', maxHeight: '90dvh', objectFit: 'contain' }}
                onClick={(e) => e.stopPropagation()} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Video</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>{modeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && (
            <ModelDropdown
              models={models} value={model} onChange={setModel}
              accent={ACCENT} accentSub={ACCENT_SUB} accentBdr={ACCENT_BDR}
            />
          )}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {caps.isVideoEdit ? (
            <>
              <div className="rounded-2xl px-4 py-3 flex gap-3 items-start"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                <Film size={16} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Upload a video and describe the style transformation. The model edits across all frames.
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Source Video
                </p>
                <VideoUploadZone value={editVideo} onUpload={handleEditVideoUpload} onRemove={handleRemoveEditVideo}
                  compatStatus={editCompatStatus} tooShort={!!editCompat?.tooShort} />

                <AnimatePresence>
                  {editCompat?.tooShort && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }} className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}>
                      <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: '#ef4444' }}>{editCompat.reason}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {(editCompat?.ok || editVideo?._converted) && editVideo && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Video is{' '}
                    <strong style={{ color: ACCENT }}>{editVideo.duration}s{editVideo._converted ? ' · trimmed' : ''}</strong>{' '}
                    — ready to generate.
                    {convertedSettings && (
                      <span className="ml-1" style={{ color: 'var(--text-muted)' }}>
                        · Billing locked to <strong style={{ color: ACCENT }}>{convertedSettings.duration}s</strong>.
                      </span>
                    )}
                  </p>
                )}
              </div>

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
                        <button key={d} disabled={tooLong} onClick={() => { setTrimTarget(d); setTrimStart(0) }}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                          style={{
                            background: d === trimTarget ? ACCENT    : 'var(--bg-card)',
                            color:      d === trimTarget ? '#ffffff' : 'var(--text-secondary)',
                            opacity:    tooLong ? 0.3 : 1, cursor: tooLong ? 'not-allowed' : 'pointer',
                          }}>
                          {d}s
                        </button>
                      )
                    })}
                  </div>
                  {trimTarget != null && editVideo.duration > trimTarget && (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Start time</p>
                        <p className="text-xs font-bold" style={{ color: ACCENT }}>{trimStart}s → {trimStart + trimTarget}s</p>
                      </div>
                      <input type="range" min={0} max={Math.max(0, editVideo.duration - trimTarget)} step={1}
                        value={trimStart} onChange={(e) => setTrimStart(Number(e.target.value))}
                        className="w-full" style={{ accentColor: ACCENT }} />
                    </>
                  )}
                </div>
              )}

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

              <AnimatePresence>
                {needsTrim && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }} className="rounded-2xl p-4 flex flex-col gap-3"
                    style={{ background: 'rgba(239,160,20,0.08)', border: '1px solid rgba(239,160,20,0.25)' }}>
                    <div className="flex items-start gap-2">
                      <RefreshCw size={14} style={{ color: '#efa014', marginTop: 2, flexShrink: 0 }} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#efa014' }}>Video needs trimming</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                          {editCompat?.reason}
                          {trimTarget && <> · Clip: <strong>{trimStart}s → {trimStart + trimTarget}s</strong></>}
                        </p>
                        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                          Trim cost: <strong style={{ color: 'var(--text-primary)' }}>{VIDEO_EDIT_CONVERT_COST} credits</strong>.
                          Trimmed video loads here — no redirect needed.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleConvert}
                        disabled={credits < VIDEO_EDIT_CONVERT_COST || isProcessing || !trimTarget}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{
                          background: credits >= VIDEO_EDIT_CONVERT_COST && !isProcessing && trimTarget ? ACCENT : 'var(--bg-elevated)',
                          color:      credits >= VIDEO_EDIT_CONVERT_COST && !isProcessing && trimTarget ? '#fff'  : 'var(--text-muted)',
                          cursor:     credits >= VIDEO_EDIT_CONVERT_COST && !isProcessing && trimTarget ? 'pointer' : 'not-allowed',
                        }}>
                        Trim &amp; Continue · {VIDEO_EDIT_CONVERT_COST} cr
                      </button>
                      <button onClick={handleRemoveEditVideo} className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
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
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {caps.supportsMultiImage && multiMode ? 'Reference' : 'Frames'}
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    {caps.requiresImage ? ' — required' : ' — optional'}
                  </span>
                </p>
                {caps.supportsMultiImage && (
                  <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                    {[{ value: false, label: 'Frames' }, { value: true, label: 'Multi-ref' }].map((opt) => (
                      <button key={String(opt.value)}
                        onClick={() => {
                          setMultiMode(opt.value)
                          if (!opt.value) { setRefImages([]); draftDelete(DRAFT_REF_IMAGES) }
                        }}
                        className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                        style={{ background: multiMode === opt.value ? ACCENT : 'transparent', color: multiMode === opt.value ? '#ffffff' : 'var(--text-muted)' }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {caps.supportsMultiImage && multiMode ? (
                <MultiRefGrid images={refImages} maxImages={caps.maxRefImages} onAdd={handleAddRefImage}
                  onRemove={handleRemoveRefImage} onTagInsert={insertAtCursor}
                  onFullscreen={(idx) => setFullscreenIdx(idx)} />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <FrameUpload label="Start Frame" value={startFrame}
                      onChange={handleFrameUpload(setStartFrame, DRAFT_START_FRAME)}
                      onRemove={() => handleRemoveFrame(setStartFrame, DRAFT_START_FRAME, true)}
                      disabled={!caps.supportsStartFrame && !startFrame}
                      inactive={!!startFrame && !caps.supportsStartFrame} />
                    <FrameUpload label={caps.requiresEndFrame ? 'End Frame (required)' : 'End Frame'} value={endFrame}
                      onChange={handleFrameUpload(setEndFrame, DRAFT_END_FRAME)}
                      onRemove={() => handleRemoveFrame(setEndFrame, DRAFT_END_FRAME, false)}
                      disabled={!(caps.supportsEndFrame || caps.supportsFrameToFrame) && !endFrame}
                      inactive={!!endFrame && !(caps.supportsEndFrame || caps.supportsFrameToFrame)} />
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

          {caps.requiresAudio && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Audio <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>— required</span>
                </p>
                {audioSlots.filter(Boolean).length > 0 && (() => {
                  const used      = totalSlotDuration(audioSlots)
                  const dur       = parseInt(duration || '5', 10)
                  const remaining = Math.max(0, dur - used)
                  const isFull    = remaining <= 0.1
                  const fmtS      = (s) => s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`
                  return (
                    <span className="text-xs px-2 py-0.5 rounded-lg font-semibold"
                      style={{ background: isFull ? ACCENT : ACCENT_SUB, color: isFull ? '#fff' : ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                      {fmtS(used)} / {dur}s {isFull ? '· full' : `· ${fmtS(remaining)} left`}
                    </span>
                  )
                })()}
              </div>

              <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Upload audio up to {duration}s. The model syncs it to the generated video natively.
                Longer files are trimmed automatically.
              </p>

              {audioSlots.filter(Boolean).length > 0 && (
                <ChainedAudioPlayer
                  audioSlots={audioSlots}
                  onSlotClear={handleAudioSlotClear}
                  onSlotStartChange={handleAudioSlotStartChange}
                />
              )}

              {(() => {
                const used      = totalSlotDuration(audioSlots)
                const dur       = parseInt(duration || '5', 10)
                const remaining = Math.max(0, dur - used)
                const isFull    = remaining <= 0.1
                const filled    = audioSlots.filter(Boolean).length
                if (isFull) return (
                  <p className="text-xs text-center py-1 font-semibold" style={{ color: ACCENT }}>
                    Audio budget full · {dur}s ✓
                  </p>
                )
                return (
                  <AudioSourcePicker
                    onAudioUpload={(e) => handleAudioSlotFill(filled, e)}
                    onImport={(gen) => handleAudioSlotFill(filled, null, gen)}
                    userId={user?.id}
                    maxDurationS={remaining}
                    slotIndex={filled}
                  />
                )
              })()}
            </div>
          )}

         <MentionPicker
            mention={mention}
            accent={ACCENT} accentSub={ACCENT_SUB} accentBdr={ACCENT_BDR}
            images={refImages}
            onSelectImage={handleSelectMentionUpload}
            characters={mentionLibrary.characters}
            brands={mentionLibrary.brands}
            brandProducts={brandProducts}
            brandProductsLoading={brandProductsLoading}
            onSelectCharacter={handleSelectMentionCharacter}
            onSelectBrand={handleDrillIntoBrand}
            onSelectLogo={handleSelectMentionLogo}
            onSelectProduct={handleSelectMentionProduct}
            onBack={backToRoot}
          />

          <Textarea ref={textareaRef} label="Prompt" value={prompt}
            onChange={handlePromptChange}
            onSelect={trackSelection}
            onKeyUp={trackSelection}
            onClick={trackSelection}
            onFocus={trackSelection}
            onKeyDown={(e) => { if (e.key === 'Escape' && mention) closeMention() }}
            placeholder={
              caps.isVideoEdit
                ? 'Describe the style transformation e.g. "animate style with vibrant colors"'
                : caps.supportsMultiImage && multiMode && refImages.length > 0
                  ? `e.g. ${tagForSlot(0)} walks through a neon-lit street. Type @ for uploads, / for characters & brands.`
                  : 'Describe the motion, scene, or action… Type @ for uploads, / for characters & brands.'
            }
            rows={3} maxLength={500} />

          <div>
            <SettingChips label="Aspect Ratio"
              options={ALL_ASPECT_RATIOS.map((o) => ({ ...o, disabled: !caps.supportedAspectRatios.includes(o.value) }))}
              value={aspectRatio} onChange={(v) => { setAspectRatio(v); setAutoRatio(false) }} accent={ACCENT} />
            {caps.supportedDurations.length > 0 && (
              <SettingChips label="Duration"
                options={caps.supportedDurations.map((d) => ({ label: `${d}s`, value: d, disabled: false }))}
                value={duration} onChange={setDuration} accent={ACCENT} />
            )}
            {caps.supportsSound && (
              <SettingChips label="Sound"
                options={[
                  { label: '🔇 Silent',     value: 'false' },
                  { label: '🔊 With Sound', value: 'true'  },
                ]}
                value={String(withSound)} onChange={(v) => setWithSound(v === 'true')} accent={ACCENT} />
            )}
          </div>

        </div>
      </div>

      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button onClick={handleGenerate} disabled={generateDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{ background: generateDisabled ? 'var(--bg-elevated)' : ACCENT, color: generateDisabled ? 'var(--text-muted)' : '#ffffff' }}>
            <Zap size={15} fill="currentColor" />
            {isProcessing
              ? phase === 'converting' ? 'Trimming…' : 'Generating…'
              : `Generate · ${creditCost} cr`}
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
          {caps.requiresImage && !multiMode && !activeStartFrame && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              This model requires a start frame image.
            </p>
          )}
          {caps.requiresImage && multiMode && refImages.length === 0 && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              This model requires at least one reference image.
            </p>
          )}
          {caps.requiresVideo && !caps.isVideoEdit && !editVideo && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              This model requires a source video.
            </p>
          )}
          {caps.requiresAudio && audioSlots.filter(Boolean).length === 0 && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              This model requires an audio track.
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
