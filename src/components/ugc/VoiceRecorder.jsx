import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, Square, Play, Pause, RotateCcw,
  CheckCircle2, ChevronUp,
} from 'lucide-react'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const MAX_SECONDS   = 180  // 3 min hard cap
const GOOD_SECONDS  = 60   // 1 min = good
const GREAT_SECONDS = 120  // 2 min = great

const BAR_COUNT = 40

// ── Pick the best supported MIME type for this browser/device ──
function getBestMimeType() {
  const candidates = [
    'audio/mp4',
    'audio/aac',
    'audio/ogg;codecs=opus',
    'audio/webm;codecs=opus',
    'audio/webm',
  ]
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

// ── Map a MIME type to a sane file extension ───────────────────
function mimeToExt(mimeType) {
  if (!mimeType) return 'webm'
  if (mimeType.startsWith('audio/mp4'))  return 'm4a'
  if (mimeType.startsWith('audio/aac'))  return 'm4a'
  if (mimeType.startsWith('audio/ogg'))  return 'ogg'
  return 'webm'
}

function formatTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function qualityLabel(secs) {
  if (secs >= GREAT_SECONDS) return { label: 'Excellent',   color: '#10b981' }
  if (secs >= GOOD_SECONDS)  return { label: 'Good',        color: '#f59e0b' }
  return                            { label: 'Keep going…', color: 'var(--text-muted)' }
}

export default function VoiceRecorder({ script, onRecordingReady }) {
  // ── State ─────────────────────────────────────────────────
  const [phase,        setPhase]        = useState('idle')   // idle | recording | preview
  const [elapsed,      setElapsed]      = useState(0)
  const [bars,         setBars]         = useState(Array(BAR_COUNT).fill(0.05))
  const [audioBlob,    setAudioBlob]    = useState(null)
  const [audioUrl,     setAudioUrl]     = useState(null)
  const [mimeType,     setMimeType]     = useState('')
  const [isPlaying,    setIsPlaying]    = useState(false)
  const [playProgress, setPlayProgress] = useState(0)
  const [showScript,   setShowScript]   = useState(!!script)

  // ── Refs ───────────────────────────────────────────────────
  const mediaRecorderRef = useRef(null)
  const audioCtxRef      = useRef(null)
  const analyserRef      = useRef(null)
  const sourceRef        = useRef(null)
  const chunksRef        = useRef([])
  const timerRef         = useRef(null)
  const animFrameRef     = useRef(null)
  const streamRef        = useRef(null)
  const playbackRef      = useRef(null)

  // ── Sync script visibility when script prop changes ────────
  useEffect(() => {
    if (script) setShowScript(true)
  }, [script])

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      stopAll()
      if (audioUrl) URL.revokeObjectURL(audioUrl)
    }
  }, [])

  const stopAll = () => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    playbackRef.current?.pause()
  }

  // ── Waveform animation loop ────────────────────────────────
  const animateWaveform = useCallback(() => {
    if (!analyserRef.current) return
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)
    const step    = Math.floor(dataArray.length / BAR_COUNT)
    const newBars = Array.from({ length: BAR_COUNT }, (_, i) => Math.max(dataArray[i * step] / 255, 0.04))
    setBars(newBars)
    animFrameRef.current = requestAnimationFrame(animateWaveform)
  }, [])

  // ── Start recording ────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Web Audio API for waveform
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize              = 256
      analyser.smoothingTimeConstant = 0.7
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      sourceRef.current   = source

      // Pick best MIME type for this device
      const best = getBestMimeType()
      setMimeType(best)

      const recorderOptions = best ? { mimeType: best } : {}
      const mediaRecorder   = new MediaRecorder(stream, recorderOptions)
      chunksRef.current     = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const actualMime = mediaRecorder.mimeType || best || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: actualMime })
        const url  = URL.createObjectURL(blob)
        setAudioBlob(blob)
        setAudioUrl(url)
        setMimeType(actualMime)
        setPhase('preview')
      }

      mediaRecorder.start(100)
      mediaRecorderRef.current = mediaRecorder

      // Timer
      setElapsed(0)
      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev + 1 >= MAX_SECONDS) { stopRecording(); return MAX_SECONDS }
          return prev + 1
        })
      }, 1000)

      animFrameRef.current = requestAnimationFrame(animateWaveform)
      setPhase('recording')
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access and try again.')
      } else {
        alert('Could not access microphone. Please check your device settings.')
      }
    }
  }

  // ── Stop recording ─────────────────────────────────────────
  const stopRecording = useCallback(() => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    mediaRecorderRef.current?.stop()
    setBars(Array(BAR_COUNT).fill(0.05))
  }, [])

  // ── Playback controls ──────────────────────────────────────
  const togglePlayback = () => {
    if (!audioUrl) return
    if (isPlaying) {
      playbackRef.current?.pause()
      setIsPlaying(false)
      return
    }
    if (!playbackRef.current) {
      const audio = new Audio(audioUrl)
      audio.ontimeupdate = () => {
        setPlayProgress(audio.duration ? audio.currentTime / audio.duration : 0)
      }
      audio.onended = () => { setIsPlaying(false); setPlayProgress(0) }
      playbackRef.current = audio
    }
    playbackRef.current.play()
    setIsPlaying(true)
  }

  // ── Re-record ──────────────────────────────────────────────
  const handleReRecord = () => {
    playbackRef.current?.pause()
    playbackRef.current = null
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioBlob(null)
    setAudioUrl(null)
    setIsPlaying(false)
    setPlayProgress(0)
    setElapsed(0)
    setBars(Array(BAR_COUNT).fill(0.05))
    setPhase('idle')
  }

  // ── Confirm and submit ─────────────────────────────────────
  const handleConfirm = () => {
    if (!audioBlob) return
    const ext  = mimeToExt(mimeType)
    const file = new File([audioBlob], `voice-recording-${Date.now()}.${ext}`, { type: audioBlob.type })
    onRecordingReady(file)
  }

  const quality     = qualityLabel(elapsed)
  const progressPct = (elapsed / MAX_SECONDS) * 100
  const isGood      = elapsed >= GOOD_SECONDS

  return (
    <div className="flex flex-col gap-4">

      {/* Script panel (collapsible) */}
      {script && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: `1px solid ${ACCENT_BDR}`, background: ACCENT_SUB }}
        >
          <button
            onClick={() => setShowScript(!showScript)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <span className="text-xs font-semibold" style={{ color: ACCENT }}>Reading Script</span>
            <motion.div animate={{ rotate: showScript ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronUp size={14} style={{ color: ACCENT }} />
            </motion.div>
          </button>
          <AnimatePresence initial={false}>
            {showScript && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                style={{ overflow: 'hidden' }}
              >
                <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: 200 }}>
                  <p
                    className="leading-relaxed"
                    style={{ color: 'var(--text-primary)', fontSize: '0.9rem', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}
                  >
                    {script}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── IDLE phase ── */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={startRecording}
            className="w-20 h-20 rounded-full flex items-center justify-center transition-all"
            style={{ background: ACCENT, boxShadow: `0 0 0 0 ${ACCENT}40` }}
          >
            <Mic size={28} color="#fff" />
          </motion.button>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Tap to start</p>
        </div>
      )}

      {/* ── RECORDING phase ── */}
      {phase === 'recording' && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <span
              className="text-2xl font-black tabular-nums"
              style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
            >
              {formatTime(elapsed)}
            </span>
            <motion.span
              key={quality.label}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${quality.color}20`, color: quality.color }}
            >
              {quality.label}
            </motion.span>
          </div>

          <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--bg-elevated)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: ACCENT }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          <div
            className="w-full flex items-center justify-center gap-[2px] rounded-2xl py-4 px-3"
            style={{ background: 'var(--bg-elevated)', height: 72 }}
          >
            {bars.map((v, i) => (
              <motion.div
                key={i}
                animate={{ scaleY: v }}
                transition={{ duration: 0.05, ease: 'linear' }}
                className="rounded-full flex-shrink-0"
                style={{ width: 3, height: 48, background: ACCENT, opacity: 0.4 + v * 0.6, transformOrigin: 'center' }}
              />
            ))}
          </div>

          <div className="w-full flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>0:00</span>
            <span style={{ color: elapsed >= GOOD_SECONDS  ? '#f59e0b' : 'var(--text-muted)' }}>1:00 good</span>
            <span style={{ color: elapsed >= GREAT_SECONDS ? '#10b981' : 'var(--text-muted)' }}>2:00 great</span>
            <span>3:00</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={stopRecording}
            className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
            style={{
              background: isGood ? ACCENT : 'var(--bg-elevated)',
              border:     isGood ? 'none' : `2px solid ${ACCENT_BDR}`,
            }}
          >
            <Square size={20} fill={isGood ? '#fff' : ACCENT} color={isGood ? '#fff' : ACCENT} />
          </motion.button>

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {isGood ? 'Ready to stop — or keep going' : 'Keep speaking…'}
          </p>
        </div>
      )}

      {/* ── PREVIEW phase ── */}
      {phase === 'preview' && (
        <div className="flex flex-col gap-4">
          <div
            className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}` }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT_SUB }}
            >
              <CheckCircle2 size={18} style={{ color: ACCENT }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Recording complete</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {formatTime(elapsed)} recorded · Listen back before confirming
              </p>
            </div>
          </div>

          <div
            className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <button
              onClick={togglePlayback}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
              style={{ background: isPlaying ? ACCENT : ACCENT_SUB }}
            >
              {isPlaying
                ? <Pause size={16} style={{ color: '#fff' }} fill="#fff" />
                : <Play  size={16} style={{ color: ACCENT }} fill={ACCENT} />
              }
            </button>
            <div className="flex-1">
              <div
                className="w-full rounded-full overflow-hidden cursor-pointer"
                style={{ height: 4, background: 'var(--bg-elevated)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: ACCENT }}
                  animate={{ width: `${playProgress * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>{formatTime(elapsed)}</p>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: ACCENT, color: '#fff' }}
          >
            <CheckCircle2 size={15} />
            Use This Recording
          </button>

          <button
            onClick={handleReRecord}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <RotateCcw size={14} />
            Record Again
          </button>
        </div>
      )}
    </div>
  )
}
