// src/pages/filma/FilmaShotPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ImagePlus, X, Mic, FileText, Play, Pause,
  Plus, Trash2, Zap, RotateCcw, Check,
  ArrowRight, Loader2, ScanLine,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  filmaShots, filmaShotRefs, filmaFilms,
  filmaUpload, filmaGenerateShot, getAudioDuration,
} from '@/lib/filma'

// filmaShots.syncFromGeneration is called on load to pick up results from
// any generation that completed while the user was away.
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

const DURATION_OPTIONS = [5, 8, 10, 15]

const TYPE_COLOR = {
  dialogue:     '#E8A020',
  action:       '#ef4444',
  establishing: '#34D399',
  wide:         '#7C9EFF',
  close_up:     '#FB7BB8',
  medium:       '#A78BFA',
  reaction:     '#60A5FA',
  aerial:       '#34D399',
  default:      'var(--text-muted)',
}

// ── Frame upload slot ─────────────────────────────────────────────────────
const FrameSlot = ({ label, url, onUpload, onRemove, uploading }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs font-semibold uppercase tracking-widest"
      style={{ color: 'var(--text-muted)' }}>{label}</p>
    {url ? (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1' }}>
        <img src={url} alt={label} className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}
        >
          <X size={12} />
        </button>
      </div>
    ) : (
      <label
        className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
        style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
      >
        <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
        {uploading ? (
          <Loader2 size={18} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
        ) : (
          <>
            <ImagePlus size={18} style={{ color: ACCENT, marginBottom: 4 }} />
            <span className="text-xs font-medium" style={{ color: ACCENT }}>Upload</span>
          </>
        )}
      </label>
    )}
  </div>
)

// ── Extra ref card ────────────────────────────────────────────────────────
const ExtraRefCard = ({ ref: refItem, onUpdateDesc, onDelete }) => {
  const [desc,    setDesc]    = useState(refItem.description)
  const [editing, setEditing] = useState(!refItem.description)

  return (
    <div className="flex gap-3 p-3 rounded-xl"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0">
        <img src={refItem.image_url} alt="ref" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {editing ? (
          <div className="flex gap-1.5">
            <input
              autoFocus
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe what this reference is…"
              className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'var(--bg-primary)', border: `1px solid ${ACCENT_BDR}`, color: 'var(--text-primary)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && desc.trim()) {
                  onUpdateDesc(refItem.id, desc.trim())
                  setEditing(false)
                }
              }}
            />
            <button
              onClick={() => { if (desc.trim()) { onUpdateDesc(refItem.id, desc.trim()); setEditing(false) } }}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT }}
            >
              <Check size={11} color="#000" />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="text-xs text-left"
            style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {refItem.description || <span style={{ color: 'var(--text-muted)' }}>Add description…</span>}
          </button>
        )}
      </div>
      <button
        onClick={() => onDelete(refItem.id)}
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ color: 'rgba(239,68,68,0.6)' }}
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

// ── Audio preview ─────────────────────────────────────────────────────────
const AudioPreview = ({ url }) => {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}` }}>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} />
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: ACCENT, color: '#000' }}
      >
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {playing ? 'Playing…' : 'Preview audio'}
      </span>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function FilmaShotPage() {
  const navigate           = useNavigate()
  const { filmId, shotId } = useParams()
  const { user }           = useAuth()

  const [film,          setFilm]         = useState(null)
  const [shot,          setShot]         = useState(null)
  const [refs,          setRefs]         = useState([])
  const [loading,       setLoading]      = useState(true)
  const [generating,    setGenerating]   = useState(false)
  const [extractingEnd, setExtractingEnd]= useState(false)

  const [uploadingStart, setUploadingStart] = useState(false)
  const [uploadingEnd,   setUploadingEnd]   = useState(false)
  const [uploadingRef,   setUploadingRef]   = useState(false)
  const [uploadingAudio, setUploadingAudio] = useState(false)

  const [audioMode,  setAudioMode]  = useState('ai_voice')
  const [firstWord,  setFirstWord]  = useState('')
  const [lastWord,   setLastWord]   = useState('')
  const [duration,   setDuration]   = useState(null)

  // Holds the poll stop-function so we can cancel on unmount or re-generate
  const stopPollRef = useRef(null)

  // ── Cleanup poll on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => { stopPollRef.current?.() }
  }, [])

  useEffect(() => { load() }, [shotId]) // eslint-disable-line

  const load = async () => {
    setLoading(true)
    const [shotRes, filmRes, refsRes] = await Promise.all([
      filmaShots.getById(shotId),
      filmaFilms.getById(filmId),
      filmaShotRefs.getByShot(shotId),
    ])

    let shotData = shotRes.data

    // If the shot was generating when we left, sync from the linked generation now
    if (shotData && (shotData.status === 'generating' || shotData.status === 'processing')) {
      const synced = await filmaShots.syncFromGeneration(shotId)
      if (synced) shotData = synced
    }

    if (shotData) {
      setShot(shotData)
      setAudioMode(shotData.audio_mode || 'ai_voice')
      setFirstWord(shotData.audio_first_word || '')
      setLastWord(shotData.audio_last_word || '')
      setDuration(shotData.duration_seconds || null)
    }
    if (filmRes.data) setFilm(filmRes.data)
    setRefs(refsRes.data || [])
    setLoading(false)
  }

  // ── Frame uploads ─────────────────────────────────────────────────────────
  const handleFrameUpload = async (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return
    const setter = type === 'start' ? setUploadingStart : setUploadingEnd
    setter(true)
    try {
      const { url } = await filmaUpload(user.id, file, 'shots/frames')
      if (type === 'start') {
        await filmaShots.setStartFrame(shotId, url)
        setShot((prev) => ({ ...prev, start_frame_url: url }))
      } else {
        await filmaShots.setEndFrame(shotId, url)
        setShot((prev) => ({ ...prev, end_frame_url: url }))
      }
    } catch { toast.error('Frame upload failed') }
    finally { setter(false) }
  }

  const handleRemoveFrame = async (type) => {
    if (type === 'start') {
      await filmaShots.setStartFrame(shotId, null)
      setShot((prev) => ({ ...prev, start_frame_url: null }))
    } else {
      await filmaShots.setEndFrame(shotId, null)
      setShot((prev) => ({ ...prev, end_frame_url: null }))
    }
  }

  // ── Audio ─────────────────────────────────────────────────────────────────
  const handleAudioUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    let dur
    try { dur = await getAudioDuration(file) }
    catch { toast.error('Could not read audio file'); return }

    if (dur < 1)  { toast.error('Audio must be at least 1 second'); return }
    if (dur > 15) { toast.error('Audio must be 15 seconds or less'); return }

    setUploadingAudio(true)
    try {
      const { url } = await filmaShots.uploadAudio(user.id, file)
      await filmaShots.setAudio(shotId, {
        audioUrl:        url,
        firstWord:       firstWord.trim() || null,
        lastWord:        lastWord.trim()  || null,
        durationSeconds: Math.round(dur),
      })
      setShot((prev) => ({
        ...prev,
        audio_url:              url,
        audio_mode:             'uploaded',
        audio_duration_seconds: Math.round(dur),
        duration_seconds:       Math.round(dur),
      }))
      setAudioMode('uploaded')
      setDuration(Math.round(dur))
      toast.success('Audio uploaded')
    } catch { toast.error('Audio upload failed') }
    finally { setUploadingAudio(false) }
  }

  const handleClearAudio = async () => {
    await filmaShots.clearAudio(shotId)
    setShot((prev) => ({
      ...prev,
      audio_url: null, audio_mode: 'ai_voice',
      audio_duration_seconds: null, duration_seconds: null,
    }))
    setAudioMode('ai_voice')
    setDuration(null)
  }

  const handleSaveAnchorWords = async () => {
    if (!shot?.audio_url) return
    await filmaShots.update(shotId, {
      audio_first_word: firstWord.trim() || null,
      audio_last_word:  lastWord.trim()  || null,
    })
    toast.success('Lipsync anchors saved')
  }

  // ── Duration ──────────────────────────────────────────────────────────────
  const handleDurationChange = async (val) => {
    setDuration(val)
    await filmaShots.update(shotId, { duration_seconds: val })
  }

  // ── Extra refs ────────────────────────────────────────────────────────────
  const handleRefUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingRef(true)
    try {
      const { url } = await filmaShotRefs.upload(user.id, file)
      const { data } = await filmaShotRefs.add(filmId, shot.scene_id, shotId, url, '', refs.length)
      setRefs((prev) => [...prev, data])
    } catch { toast.error('Ref upload failed') }
    finally { setUploadingRef(false) }
  }

  const handleRefDescUpdate = async (refId, desc) => {
    await filmaShotRefs.updateDescription(refId, desc)
    setRefs((prev) => prev.map((r) => r.id === refId ? { ...r, description: desc } : r))
  }

  const handleRefDelete = async (refId) => {
    await filmaShotRefs.delete(refId)
    setRefs((prev) => prev.filter((r) => r.id !== refId))
  }

  // ── Generate — uses filmaShots.poll(), cleaned up on unmount ─────────────
  const handleGenerate = async () => {
    // Cancel any existing poll before starting a new one
    stopPollRef.current?.()
    stopPollRef.current = null

    setGenerating(true)
    try {
      await filmaGenerateShot(shotId)
      toast.success('Generation started')

      stopPollRef.current = filmaShots.poll(shotId, {
        intervalMs: 5000,
        timeoutMs:  600000,
        onUpdate: (data) => {
          setShot((prev) => ({ ...prev, ...data }))
        },
        onDone: ({ success, data, error }) => {
          stopPollRef.current = null
          setGenerating(false)
          if (success) {
            setShot((prev) => ({ ...prev, ...data }))
            toast.success('Shot generated!')
          } else {
            toast.error(error || 'Generation failed. Try again.')
          }
        },
      })
    } catch (err) {
      toast.error(err.message || 'Generation failed')
      setGenerating(false)
    }
  }

  // ── Push end frame ────────────────────────────────────────────────────────
  const handlePushEnd = async () => {
    if (!shot?.output_url) return
    setExtractingEnd(true)
    try {
      const frameBlob = await extractLastFrame(shot.output_url)
      const result    = await filmaShots.pushEndFrame(user.id, shotId, frameBlob)
      toast.success('End frame pushed to next shot')
      navigate(`/filma/${filmId}/shot/${result.nextShotId}`)
    } catch (err) {
      toast.error(err.message || 'Could not push end frame')
    } finally {
      setExtractingEnd(false)
    }
  }

  // ── Extract last frame ────────────────────────────────────────────────────
  async function extractLastFrame(videoUrl) {
    const res    = await fetch(videoUrl)
    const blob   = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    return new Promise((resolve, reject) => {
      const video       = document.createElement('video')
      video.muted       = true
      video.preload     = 'auto'
      video.crossOrigin = 'anonymous'
      video.onerror = () => { URL.revokeObjectURL(objUrl); reject(new Error('Video load failed')) }
      video.onloadedmetadata = () => { video.currentTime = Math.max(0, video.duration - 0.001) }
      video.onseeked = () => {
        const canvas  = document.createElement('canvas')
        canvas.width  = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d').drawImage(video, 0, 0)
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(objUrl)
          pngBlob ? resolve(pngBlob) : reject(new Error('Canvas toBlob failed'))
        }, 'image/png')
      }
      video.src = objUrl
    })
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <Loader2 size={24} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
    </div>
  )

  const isDialogue = shot?.shot_type === 'dialogue'
  const typeColor  = TYPE_COLOR[shot?.shot_type] || TYPE_COLOR.default
  const shotTitle  = `Shot ${shot?.shot_number} — ${shot?.shot_type?.replace(/_/g, ' ')}`
  const hasOutput  = !!shot?.output_url

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => navigate(`/filma/${filmId}/scene/${shot?.scene_id}`)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
            {shotTitle}
          </h1>
          <span className="text-xs font-medium" style={{ color: typeColor }}>
            {film?.title}
          </span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Generating overlay */}
      <AnimatePresence>
        {(generating || extractingEnd) && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.6)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>
              {extractingEnd ? 'Extracting end frame…' : 'AI is generating your shot…'}
            </p>
            {generating && (
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                This may take a minute
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* ── AI Director notes ── */}
          <div
            className="px-4 py-3 rounded-2xl flex flex-col gap-1"
            style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div
                className="px-2 py-0.5 rounded-full text-xs font-bold capitalize"
                style={{ background: `${typeColor}20`, color: typeColor }}
              >
                {shot?.shot_type?.replace(/_/g, ' ')}
              </div>
              {shot?.duration_seconds && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {shot.duration_seconds}s
                </span>
              )}
              {!shot?.duration_seconds && isDialogue && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Flexible duration</span>
              )}
            </div>
            {shot?.description && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {shot.description}
              </p>
            )}
            {shot?.emotion_note && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: ACCENT }}>Emotion:</span> {shot.emotion_note}
              </p>
            )}
            {shot?.camera_note && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: ACCENT }}>Camera:</span> {shot.camera_note}
              </p>
            )}
          </div>

          {/* ── Dialogue section ── */}
          {isDialogue && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>Dialogue</p>

              {shot?.dialogue_text && (
                <div className="px-4 py-3 rounded-xl mb-3"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                    {shot.filma_actors?.name || 'Character'} says:
                  </p>
                  <p className="text-sm italic" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    "{shot.dialogue_text}"
                  </p>
                </div>
              )}

              {/* Audio mode toggle */}
              <div className="flex gap-2 mb-4">
                {[
                  { value: 'ai_voice', label: 'AI Voice',      icon: FileText },
                  { value: 'uploaded', label: 'Upload Audio',  icon: Mic      },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setAudioMode(value); if (value === 'ai_voice') handleClearAudio() }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: audioMode === value ? ACCENT_SUB : 'var(--bg-elevated)',
                      color:      audioMode === value ? ACCENT     : 'var(--text-muted)',
                      border:     `1px solid ${audioMode === value ? ACCENT_BDR : 'var(--border-color)'}`,
                    }}
                  >
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>

              {audioMode === 'ai_voice' && (
                <div className="px-4 py-3 rounded-xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    AI will generate the voice and sync it to the character's lip movements.
                    Duration will be determined naturally by the dialogue length.
                  </p>
                </div>
              )}

              {audioMode === 'uploaded' && (
                <div className="flex flex-col gap-3">
                  {shot?.audio_url ? (
                    <>
                      <AudioPreview url={shot.audio_url} />
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                            style={{ color: 'var(--text-muted)' }}>First Word</p>
                          <input
                            type="text" value={firstWord}
                            onChange={(e) => setFirstWord(e.target.value)}
                            placeholder="e.g. Kofi"
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                            style={{ background: 'var(--bg-elevated)', border: `1px solid var(--border-color)`, color: 'var(--text-primary)' }}
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                            style={{ color: 'var(--text-muted)' }}>Last Word</p>
                          <input
                            type="text" value={lastWord}
                            onChange={(e) => setLastWord(e.target.value)}
                            placeholder="e.g. tonight"
                            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                            style={{ background: 'var(--bg-elevated)', border: `1px solid var(--border-color)`, color: 'var(--text-primary)' }}
                          />
                        </div>
                      </div>
                      <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                        First and last word help AI anchor lipsync precisely to your audio.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveAnchorWords}
                          className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                          style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
                        >
                          Save Anchors
                        </button>
                        <button
                          onClick={handleClearAudio}
                          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold"
                          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                        >
                          <Trash2 size={11} /> Remove
                        </button>
                      </div>
                    </>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center py-6 rounded-2xl cursor-pointer"
                      style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
                    >
                      <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                      {uploadingAudio ? (
                        <Loader2 size={20} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <>
                          <Mic size={20} style={{ color: ACCENT, marginBottom: 6 }} />
                          <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload Audio</span>
                          <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            1–15 seconds · MP3, WAV, M4A
                          </span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Duration ── */}
          {(!isDialogue || audioMode === 'uploaded') && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>
                Duration
                {audioMode === 'uploaded' && (
                  <span className="ml-2 font-normal normal-case" style={{ color: 'var(--text-muted)' }}>
                    — auto-set from audio
                  </span>
                )}
              </p>
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map((d) => (
                  <button
                    key={d}
                    onClick={() => audioMode !== 'uploaded' && handleDurationChange(d)}
                    disabled={audioMode === 'uploaded'}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: duration === d ? ACCENT           : 'var(--bg-elevated)',
                      color:      duration === d ? '#000'           : 'var(--text-secondary)',
                      opacity:    audioMode === 'uploaded' ? 0.5    : 1,
                      cursor:     audioMode === 'uploaded' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Start / End Frames ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>Frames — optional</p>
            <div className="grid grid-cols-2 gap-3">
              <FrameSlot
                label="Start Frame"
                url={shot?.start_frame_url}
                onUpload={(e) => handleFrameUpload(e, 'start')}
                onRemove={() => handleRemoveFrame('start')}
                uploading={uploadingStart}
              />
              <FrameSlot
                label="End Frame"
                url={shot?.end_frame_url}
                onUpload={(e) => handleFrameUpload(e, 'end')}
                onRemove={() => handleRemoveFrame('end')}
                uploading={uploadingEnd}
              />
            </div>
          </div>

          {/* ── Extra references ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>
              Extra References
              <span className="ml-2 font-normal normal-case">— optional</span>
            </p>
            <div className="flex flex-col gap-2">
              {refs.map((ref) => (
                <ExtraRefCard
                  key={ref.id}
                  ref={ref}
                  onUpdateDesc={handleRefDescUpdate}
                  onDelete={handleRefDelete}
                />
              ))}
              <label
                className="flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer transition-all"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
              >
                <input type="file" accept="image/*" className="hidden" onChange={handleRefUpload} />
                {uploadingRef ? (
                  <Loader2 size={14} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>
                    <Plus size={13} style={{ color: ACCENT }} />
                    <span className="text-xs font-semibold" style={{ color: ACCENT }}>Add Reference</span>
                  </>
                )}
              </label>
              <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                Add props, locations, logos, costumes, or any visual reference with a description.
              </p>
            </div>
          </div>

          {/* ── Output preview ── */}
          {hasOutput && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>Generated Output</p>
              <div
                className="relative w-full rounded-2xl overflow-hidden"
                style={{ aspectRatio: '16/9', background: 'var(--bg-elevated)' }}
              >
                <video
                  src={shot.output_url}
                  controls
                  className="w-full h-full object-cover"
                  style={{ outline: 'none' }}
                />
              </div>
            </div>
          )}

          <div style={{ height: 100 }} />
        </div>
      </div>

      {/* Bottom actions */}
      <div
        className="flex-shrink-0 px-4 lg:px-8 py-4 flex flex-col gap-2"
        style={{ borderTop: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-primary)' }}
      >
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: generating ? 'var(--bg-elevated)' : ACCENT,
              color:      generating ? 'var(--text-muted)'  : '#000',
            }}
          >
            {generating ? (
              <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            ) : hasOutput ? (
              <><RotateCcw size={15} /> Regenerate Shot</>
            ) : (
              <><Zap size={15} fill="currentColor" /> Generate Shot</>
            )}
          </button>

          {hasOutput && (
            <button
              onClick={handlePushEnd}
              disabled={extractingEnd}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              <ScanLine size={15} />
              {extractingEnd ? 'Extracting…' : 'Push End Frame → Next Shot'}
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
