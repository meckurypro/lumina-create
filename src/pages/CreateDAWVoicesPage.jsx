// src/pages/CreateDAWVoicesPage.jsx
//
// DAW AI — voice cloning management. Record or upload a clean vocal
// sample (10–30s ideal, per ACE-Step's Reference Audio node guidance —
// this cap is intentionally separate from the tier-based reference-audio
// cap on CreateDAWPage, which is for full-track compositional reference,
// not vocal identity). List/rename/delete existing daw_voices rows,
// which populate the Voice dropdown on CreateDAWPage.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Mic, Square, Play, Pause, Trash2, UploadCloud,
  Loader2, X, Check, Music2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── theme — same fallback-literal pattern as CreateDAWPage ────────────────
const ACCENT     = 'var(--tool-music, #a855f7)'
const ACCENT_SUB = 'var(--tool-music-subtle, rgba(168,85,247,0.12))'
const ACCENT_BDR = 'var(--tool-music-border, rgba(168,85,247,0.32))'

// Vocal-identity sample caps — deliberately different from the full-track
// reference-audio caps on CreateDAWPage. Short and clean is what the
// Reference Audio node actually uses well; long files don't help here.
const SAMPLE_MIN_SECONDS = 5
const SAMPLE_MAX_SECONDS = 120
const SAMPLE_MAX_BYTES   = 20 * 1024 * 1024

function getAudioDuration(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url   = URL.createObjectURL(fileOrBlob)
    const audio = new Audio()
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(audio.duration) }
    audio.onerror          = () => { URL.revokeObjectURL(url); reject(new Error('Could not read audio duration')) }
    audio.src = url
  })
}

function formatSeconds(s) {
  if (!Number.isFinite(s)) return '—'
  const m = Math.floor(s / 60)
  const r = Math.floor(s % 60)
  return `${m}:${String(r).padStart(2, '0')}`
}

// ─────────────────────────────────────────────────────────────────────────
// RECORDER — MediaRecorder + a simple live level meter (AnalyserNode).
// No canvas waveform-after-the-fact — just enough visual feedback while
// recording, kept intentionally lighter than a full waveform editor.
// ─────────────────────────────────────────────────────────────────────────

function VoiceRecorder({ onCaptured }) {
  const [recording,   setRecording]   = useState(false)
  const [elapsed,     setElapsed]     = useState(0)
  const [level,       setLevel]       = useState(0)
  const [previewBlob, setPreviewBlob] = useState(null)
  const [previewUrl,  setPreviewUrl]  = useState(null)
  const [playing,     setPlaying]     = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const streamRef         = useRef(null)
  const audioCtxRef       = useRef(null)
  const analyserRef       = useRef(null)
  const rafRef             = useRef(null)
  const timerRef            = useRef(null)
  const audioElRef          = useRef(null)

  const cleanupStream = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
    streamRef.current = null
    audioCtxRef.current = null
  }

  useEffect(() => () => cleanupStream(), [])

  const tickLevel = () => {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(data)
    const avg = data.reduce((a, b) => a + b, 0) / data.length
    setLevel(Math.min(1, avg / 90))
    rafRef.current = requestAnimationFrame(tickLevel)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const source    = audioCtx.createMediaStreamSource(stream)
      const analyser  = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser

      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        setPreviewBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        cleanupStream()
      }
      mediaRecorderRef.current = mr
      mr.start()

      setRecording(true)
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed((e) => {
          const next = e + 1
          if (next >= SAMPLE_MAX_SECONDS) stopRecording()
          return next
        })
      }, 1000)
      tickLevel()
    } catch (err) {
      toast.error('Microphone access denied or unavailable')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
    setLevel(0)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const discardPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewBlob(null); setPreviewUrl(null); setElapsed(0); setPlaying(false)
  }

  const togglePreviewPlay = () => {
    if (!audioElRef.current) return
    if (playing) { audioElRef.current.pause(); setPlaying(false) }
    else         { audioElRef.current.play();  setPlaying(true)  }
  }

  const handleUsePreview = async () => {
    if (!previewBlob) return
    let duration = elapsed
    try { duration = await getAudioDuration(previewBlob) } catch {}
    if (duration < SAMPLE_MIN_SECONDS) {
      toast.error(`Recording too short — need at least ${SAMPLE_MIN_SECONDS}s.`)
      return
    }
    onCaptured({ file: previewBlob, name: `voice-sample-${Date.now()}.webm`, duration, mimeType: previewBlob.type })
    discardPreview()
  }

  if (previewBlob) {
    return (
      <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}` }}>
        <audio ref={audioElRef} src={previewUrl} onEnded={() => setPlaying(false)} className="hidden" />
        <div className="flex items-center gap-3">
          <button onClick={togglePreviewPlay}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: ACCENT }}>
            {playing ? <Pause size={15} style={{ color: '#fff' }} fill="currentColor" /> : <Play size={15} style={{ color: '#fff' }} fill="currentColor" />}
          </button>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Recording ready</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatSeconds(elapsed)}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={discardPreview}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            Discard
          </button>
          <button onClick={handleUsePreview}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
            style={{ background: ACCENT, color: '#fff' }}>
            <Check size={14} /> Use this
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}` }}>
      <div className="relative w-16 h-16 flex items-center justify-center">
        {recording && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: ACCENT_SUB }}
            animate={{ scale: 1 + level * 0.6, opacity: 0.5 + level * 0.3 }}
            transition={{ duration: 0.1 }}
          />
        )}
        <button
          onClick={recording ? stopRecording : startRecording}
          className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95"
          style={{ background: recording ? '#ef4444' : ACCENT }}
        >
          {recording ? <Square size={18} style={{ color: '#fff' }} fill="currentColor" /> : <Mic size={20} style={{ color: '#fff' }} />}
        </button>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {recording ? formatSeconds(elapsed) : 'Tap to record'}
      </p>
      <p className="text-xs text-center" style={{ color: 'var(--text-muted)', maxWidth: 260, lineHeight: 1.5 }}>
        Clean, solo vocal — no music or background noise. {SAMPLE_MIN_SECONDS}–{SAMPLE_MAX_SECONDS}s works best.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// VOICE CARD
// ─────────────────────────────────────────────────────────────────────────

function VoiceCard({ voice, onDelete, deleting }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else         { audioRef.current.play();  setPlaying(true)  }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <audio ref={audioRef} src={voice.reference_audio_url} onEnded={() => setPlaying(false)} className="hidden" />
      <button onClick={togglePlay}
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: playing ? ACCENT : ACCENT_SUB }}>
        {playing
          ? <Pause size={14} style={{ color: '#fff' }} fill="currentColor" />
          : <Play  size={14} style={{ color: ACCENT }} fill="currentColor" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{voice.name}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {voice.duration_seconds ? `${Math.round(voice.duration_seconds)}s` : '—'}
          {voice.generation_count > 0 && ` · used ${voice.generation_count}×`}
        </p>
      </div>
      <button
        onClick={() => onDelete(voice)}
        disabled={deleting}
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
      >
        {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────

export default function CreateDAWVoicesPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [voices,   setVoices]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [deleting, setDeleting] = useState(null)

  const [mode,     setMode]     = useState(null)   // null | 'record' | 'upload'
  const [pending,  setPending]  = useState(null)   // { file, name, duration, mimeType }
  const [voiceName, setVoiceName] = useState('')
  const [saving,   setSaving]   = useState(false)

  const loadVoices = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('daw_voices')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setVoices(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { loadVoices() }, [loadVoices])

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > SAMPLE_MAX_BYTES) {
      toast.error('File must be under 20MB')
      e.target.value = ''; return
    }
    let duration = null
    try { duration = await getAudioDuration(file) } catch {}
    if (duration != null && (duration < SAMPLE_MIN_SECONDS || duration > SAMPLE_MAX_SECONDS)) {
      toast.error(`Sample must be ${SAMPLE_MIN_SECONDS}–${SAMPLE_MAX_SECONDS}s long.`)
      e.target.value = ''; return
    }
    setPending({ file, name: file.name, duration, mimeType: file.type })
    setVoiceName(file.name.replace(/\.[^.]+$/, ''))
    e.target.value = ''
  }

  const handleRecorderCaptured = (captured) => {
    setPending(captured)
    setVoiceName(`My voice ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)
  }

  const cancelPending = () => { setPending(null); setVoiceName(''); setMode(null) }

  const handleSave = async () => {
    if (!pending || !voiceName.trim() || !user) return
    setSaving(true)
    try {
      const ext  = pending.mimeType?.includes('webm') ? 'webm'
                 : pending.mimeType?.includes('wav')  ? 'wav'
                 : (pending.name.split('.').pop() || 'wav')
      const path = `${user.id}/daw-voices/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('generation-uploads')
        .upload(path, pending.file, { upsert: false, cacheControl: '3600', contentType: pending.mimeType || 'audio/wav' })
      if (upErr) throw new Error(upErr.message || 'Upload failed')
      const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)

      const { error: insErr } = await supabase.from('daw_voices').insert({
        user_id:              user.id,
        name:                  voiceName.trim(),
        reference_audio_url:   publicUrl,
        duration_seconds:      pending.duration ?? null,
      })
      if (insErr) throw new Error(insErr.message || 'Could not save voice')

      toast.success('Voice saved')
      cancelPending()
      loadVoices()
    } catch (err) {
      toast.error(err.message || 'Could not save voice')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (voice) => {
    if (!window.confirm(`Delete "${voice.name}"? This can't be undone.`)) return
    setDeleting(voice.id)
    try {
      const { error } = await supabase.from('daw_voices').delete().eq('id', voice.id)
      if (error) throw new Error(error.message)
      setVoices((prev) => prev.filter((v) => v.id !== voice.id))
      toast.success('Deleted')
    } catch (err) {
      toast.error(err.message || 'Could not delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate('/create/daw')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>My Voices</h1>
        <div style={{ width: 20 }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-5">

          {/* Capture flow */}
          {pending ? (
            <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_BDR}` }}>
              <div className="flex items-center gap-2">
                <Music2 size={14} style={{ color: ACCENT }} />
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                  {pending.duration != null ? `${Math.round(pending.duration)}s captured` : 'Sample ready'}
                </p>
              </div>
              <input
                type="text"
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                placeholder="Name this voice"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold outline-none"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              />
              <div className="flex gap-2">
                <button onClick={cancelPending}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving || !voiceName.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5"
                  style={{ background: !saving && voiceName.trim() ? ACCENT : 'var(--bg-elevated)', color: !saving && voiceName.trim() ? '#fff' : 'var(--text-muted)' }}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Save voice
                </button>
              </div>
            </div>
          ) : mode === 'record' ? (
            <div className="flex flex-col gap-3">
              <VoiceRecorder onCaptured={handleRecorderCaptured} />
              <button onClick={() => setMode(null)} className="text-xs font-medium self-center" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
            </div>
          ) : mode === 'upload' ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all py-8"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                <input type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
                <UploadCloud size={20} style={{ color: ACCENT, marginBottom: 6 }} />
                <span className="text-xs font-semibold" style={{ color: ACCENT }}>Choose audio file</span>
                <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {SAMPLE_MIN_SECONDS}–{SAMPLE_MAX_SECONDS}s · under 20MB
                </span>
              </label>
              <button onClick={() => setMode(null)} className="text-xs font-medium self-center" style={{ color: 'var(--text-muted)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setMode('record')}
                className="flex-1 flex flex-col items-center justify-center rounded-2xl transition-all gap-1.5 py-5"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                <Mic size={20} style={{ color: ACCENT }} />
                <span className="text-xs font-semibold" style={{ color: ACCENT }}>Record</span>
              </button>
              <button onClick={() => setMode('upload')}
                className="flex-1 flex flex-col items-center justify-center rounded-2xl transition-all gap-1.5 py-5"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                <UploadCloud size={20} style={{ color: ACCENT }} />
                <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload</span>
              </button>
            </div>
          )}

          {/* Existing voices */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Your Voices
            </p>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="animate-spin" style={{ color: ACCENT }} />
              </div>
            ) : voices.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No saved voices yet — record or upload one above.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {voices.map((v) => (
                    <motion.div key={v.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
                      <VoiceCard voice={v} onDelete={handleDelete} deleting={deleting === v.id} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
