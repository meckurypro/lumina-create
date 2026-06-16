// FILMA SHOT PAGE — FULL REFACTORED FILE
// src/pages/filma/FilmaShotPage.jsx
//
// Changes from original:
// 1. Audio modes: 'ai_voice' → 'native', adds 'ugc_library' (import from UGC)
// 2. UGC audio import: AudioSourcePicker pattern from CreateTalkingHeadPage
// 3. Prop suggestions UI: shows AI-flagged props, lets user upload refs
// 4. First frame generation: "Generate First Frame" button on shot #1
// 5. Native audio mode: sets with_sound: true, no audio file needed
// 6. Model selector: user can override auto-selected model per shot

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ImagePlus, X, Mic, FileText, Play, Pause,
  Plus, Trash2, Zap, RotateCcw, Check,
  ArrowRight, Loader2, ScanLine, Library,
  AlertCircle, ChevronDown, Volume2, Sparkles,
  Download, RefreshCw,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  filmaShots, filmaShotRefs, filmaFilms,
  filmaUpload, filmaGenerateShot, filmaGenerateFirstFrame,
  filmaSuggestShotProps, getAudioDuration,
} from '@/lib/filma'
import { ugcAudioChunks } from '@/lib/ugcVoices'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

const DURATION_OPTIONS = [5, 8, 10, 15]

const PRIORITY_COLOR = {
  high:   '#ef4444',
  medium: '#E8A020',
  low:    '#34D399',
}

const CATEGORY_ICON = {
  prop:             '📦',
  costume_detail:   '👗',
  environment:      '🏛',
  character_ref:    '👤',
  brand_logo:       '🏷',
}

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

// ── Shared audio ref for picker (stops audio on new play) ─────────────────
const sharedPickerAudio = { ref: null }

// ── Frame upload slot ─────────────────────────────────────────────────────
const FrameSlot = ({ label, url, onUpload, onRemove, uploading }) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-xs font-semibold uppercase tracking-widest"
      style={{ color: 'var(--text-muted)' }}>{label}</p>
    {url ? (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1' }}>
        <img src={url} alt={label} className="w-full h-full object-cover" />
        <button onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}>
          <X size={12} />
        </button>
      </div>
    ) : (
      <label
        className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
        style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
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
const ExtraRefCard = ({ refItem, onUpdateDesc, onDelete }) => {
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
            <input autoFocus value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Describe what this reference is…"
              className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none"
              style={{ background: 'var(--bg-primary)', border: `1px solid ${ACCENT_BDR}`, color: 'var(--text-primary)' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && desc.trim()) { onUpdateDesc(refItem.id, desc.trim()); setEditing(false) }
              }} />
            <button
              onClick={() => { if (desc.trim()) { onUpdateDesc(refItem.id, desc.trim()); setEditing(false) } }}
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT }}>
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
      <button onClick={() => onDelete(refItem.id)}
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ color: 'rgba(239,68,68,0.6)' }}>
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
      <button onClick={toggle}
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: ACCENT, color: '#000' }}>
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
        {playing ? 'Playing…' : 'Preview audio'}
      </span>
    </div>
  )
}

// ── UGC audio picker (mirrors CreateTalkingHeadPage pattern) ──────────────
function UGCAudioPicker({ onImport, onClose, userId, maxDurationS }) {
  const [generations,   setGens]          = useState([])
  const [loading,       setLoading]        = useState(true)
  const [playing,       setPlaying]        = useState(null)
  const [expandedId,    setExpandedId]     = useState(null)
  const [chunksMap,     setChunksMap]      = useState({})
  const [loadingChunks, setLoadingChunks]  = useState(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('ugc_audio_generations')
        .select('id, script, duration_seconds, output_url, created_at, chunk_count, voice:ugc_voices(name)')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50)
      setGens(data || [])
      setLoading(false)
    }
    load()
  }, [userId])

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
    if (!gen.chunk_count || gen.chunk_count === 0) {
      setChunksMap((p) => ({ ...p, [gen.id]: [] })); return
    }
    setLoadingChunks(gen.id)
    const { data } = await ugcAudioChunks.getByGeneration(gen.id)
    setChunksMap((p) => ({ ...p, [gen.id]: data || [] }))
    setLoadingChunks(null)
  }

  const handleUse = (url, name, durationSeconds) => {
    stopAudio()
    onImport({ url, name, duration_seconds: durationSeconds })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="w-full max-w-xl rounded-t-3xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-color)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>My Generated Audio</p>
          <button onClick={onClose}><X size={16} style={{ color: 'var(--text-muted)' }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
            </div>
          ) : generations.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>
              No generated audio yet
            </p>
          ) : generations.map((gen) => {
            const dur     = gen.duration_seconds ? `${Math.round(gen.duration_seconds)}s` : '—'
            const snippet = gen.script?.length > 60 ? gen.script.slice(0, 60) + '…' : gen.script
            const hasChunks = gen.chunk_count > 0
            const chunks  = chunksMap[gen.id] || []
            const isExpanded = expandedId === gen.id

            return (
              <div key={gen.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <button onClick={() => togglePlay(gen.id, gen.output_url)}
                    disabled={!gen.output_url}
                    className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: playing === gen.id ? ACCENT : ACCENT_SUB }}>
                    {playing === gen.id
                      ? <Pause size={13} style={{ color: '#fff' }} fill="currentColor" />
                      : <Play  size={13} style={{ color: ACCENT }} fill="currentColor" />}
                  </button>
                  <button className="flex-1 min-w-0 text-left" onClick={() => hasChunks && handleExpand(gen)}>
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{snippet}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {gen.voice?.name ?? 'Voice'} · {dur}{hasChunks ? ` · ${gen.chunk_count} parts` : ''}
                    </p>
                  </button>
                  {hasChunks ? (
                    <button onClick={() => handleExpand(gen)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                      style={{ background: isExpanded ? ACCENT : ACCENT_SUB, color: isExpanded ? '#fff' : ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                      <ChevronDown size={12} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                      Parts
                    </button>
                  ) : (
                    <button onClick={() => handleUse(gen.output_url, gen.script?.slice(0, 40), gen.duration_seconds)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold"
                      style={{ background: ACCENT, color: '#fff' }}>
                      Use
                    </button>
                  )}
                </div>
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden' }}>
                      <div className="px-3 pb-2 pt-1 flex flex-col gap-1.5"
                        style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                        {loadingChunks === gen.id ? (
                          <div className="flex justify-center py-3">
                            <Loader2 size={15} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
                          </div>
                        ) : chunks.length === 0 ? (
                          <button onClick={() => handleUse(gen.output_url, gen.script?.slice(0, 40), gen.duration_seconds)}
                            className="flex items-center justify-between py-2 px-2 rounded-xl text-xs"
                            style={{ background: 'var(--bg-elevated)' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Use full audio</span>
                            <span className="font-semibold px-2 py-1 rounded-lg" style={{ background: ACCENT, color: '#fff' }}>Use</span>
                          </button>
                        ) : chunks.map((chunk) => {
                          const chunkDur = chunk.duration_ms ? (chunk.duration_ms / 1000).toFixed(1) : null
                          return (
                            <div key={chunk.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl"
                              style={{ background: 'var(--bg-elevated)' }}>
                              <button onClick={() => togglePlay(chunk.id, chunk.public_url)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: playing === chunk.id ? ACCENT : ACCENT_SUB }}>
                                {playing === chunk.id
                                  ? <Pause size={11} style={{ color: '#fff' }} fill="currentColor" />
                                  : <Play  size={11} style={{ color: ACCENT }} fill="currentColor" />}
                              </button>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{chunk.label}</p>
                                {chunkDur && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{chunkDur}s</p>}
                              </div>
                              <button onClick={() => handleUse(chunk.public_url, chunk.label, chunkDur ? Number(chunkDur) : null)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold"
                                style={{ background: ACCENT, color: '#fff' }}>
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
      </motion.div>
    </motion.div>
  )
}

// ── Prop suggestion card ──────────────────────────────────────────────────
const PropSuggestionCard = ({ suggestion, onUploadRef, onDismiss }) => (
  <div className="flex items-start gap-3 px-3 py-3 rounded-xl"
    style={{
      background: 'var(--bg-elevated)',
      border: `1px solid ${PRIORITY_COLOR[suggestion.priority]}30`,
    }}>
    <span className="text-base flex-shrink-0">{CATEGORY_ICON[suggestion.category] || '📌'}</span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{suggestion.prop}</p>
        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
          style={{ background: `${PRIORITY_COLOR[suggestion.priority]}15`, color: PRIORITY_COLOR[suggestion.priority] }}>
          {suggestion.priority}
        </span>
        {suggestion.shot_type_hint === 'insert' && (
          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
            style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
            insert shot
          </span>
        )}
      </div>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {suggestion.reason}
      </p>
    </div>
    <div className="flex flex-col gap-1.5 flex-shrink-0">
      <label className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
        style={{ background: ACCENT, color: '#000' }}>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => onUploadRef(e, suggestion)} />
        <Plus size={10} /> Upload
      </label>
      <button onClick={onDismiss}
        className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Dismiss
      </button>
    </div>
  </div>
)

// ── Main ──────────────────────────────────────────────────────────────────
export default function FilmaShotPage() {
  const navigate           = useNavigate()
  const { filmId, shotId } = useParams()
  const { user }           = useAuth()

  const [film,               setFilm]              = useState(null)
  const [shot,               setShot]              = useState(null)
  const [refs,               setRefs]              = useState([])
  const [propSuggestions,    setPropSuggestions]   = useState([])
  const [loading,            setLoading]           = useState(true)
  const [generating,         setGenerating]        = useState(false)
  const [generatingFrame,    setGeneratingFrame]   = useState(false)
  const [extractingEnd,      setExtractingEnd]     = useState(false)
  const [suggestingProps,    setSuggestingProps]   = useState(false)
  const [firstFrameModel,    setFirstFrameModel]   = useState('')
const [firstFrameModels,   setFirstFrameModels]  = useState([])

  const [uploadingStart,  setUploadingStart]  = useState(false)
  const [uploadingEnd,    setUploadingEnd]    = useState(false)
  const [uploadingRef,    setUploadingRef]    = useState(false)
  const [uploadingAudio,  setUploadingAudio]  = useState(false)

  // Audio state
  const [audioMode,  setAudioMode]  = useState('native')
  const [audioUrl,   setAudioUrl]   = useState(null)
  const [audioDur,   setAudioDur]   = useState(null)
  const [firstWord,  setFirstWord]  = useState('')
  const [lastWord,   setLastWord]   = useState('')
  const [duration,   setDuration]   = useState(null)
  const [showUGCPicker, setShowUGCPicker] = useState(false)

 const [downloading,    setDownloading]    = useState(false)
  const [refreshingShot, setRefreshingShot] = useState(false)
  const stopPollRef = useRef(null)

  useEffect(() => { return () => { stopPollRef.current?.() } }, [])
  useEffect(() => { load() }, [shotId]) // eslint-disable-line
  useEffect(() => {
  supabase
    .from('models')
    .select('*')
    .eq('type', 'image')
    .eq('is_active', true)
    .eq('is_user_facing', true)
    .order('sort_order')
    .then(({ data }) => {
      const list = (data || []).filter((m) => !m.is_locked)
      setFirstFrameModels(list)
      setFirstFrameModel(list[0]?.value || '')
    })
}, [])

  const load = async () => {
    setLoading(true)
    const [shotRes, filmRes, refsRes] = await Promise.all([
      filmaShots.getById(shotId),
      filmaFilms.getById(filmId),
      filmaShotRefs.getByShot(shotId),
    ])

    let shotData = shotRes.data

    if (shotData && (shotData.status === 'generating' || shotData.status === 'processing')) {
      const synced = await filmaShots.syncFromGeneration(shotId)
      if (synced) shotData = synced
    }

    if (shotData) {
      setShot(shotData)
      setAudioMode(shotData.audio_mode || 'native')
      setAudioUrl(shotData.audio_url || null)
      setFirstWord(shotData.audio_first_word || '')
      setLastWord(shotData.audio_last_word || '')
      setDuration(shotData.duration_seconds || null)
      // Load persisted prop suggestions
      if (shotData.prop_suggestions && Array.isArray(shotData.prop_suggestions)) {
        setPropSuggestions(shotData.prop_suggestions)
      }
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

  // ── Audio: set mode ───────────────────────────────────────────────────────
  const handleSetAudioMode = async (mode) => {
    setAudioMode(mode)
    if (mode === 'native') {
      // Clear any existing audio
      await filmaShots.clearAudio(shotId)
      setAudioUrl(null)
      setAudioDur(null)
      setDuration(null)
    }
    await filmaShots.update(shotId, { audio_mode: mode })
  }

  // ── Audio: upload file ────────────────────────────────────────────────────
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
      await filmaShots.update(shotId, { audio_mode: 'uploaded' })
      setAudioUrl(url)
      setAudioDur(Math.round(dur))
      setAudioMode('uploaded')
      setDuration(Math.round(dur))
      toast.success('Audio uploaded')
    } catch { toast.error('Audio upload failed') }
    finally { setUploadingAudio(false) }
  }

  // ── Audio: import from UGC library ────────────────────────────────────────
  const handleImportUGCAudio = async ({ url, name, duration_seconds }) => {
    setShowUGCPicker(false)
    const dur = duration_seconds ? Math.round(duration_seconds) : null
    await filmaShots.setAudio(shotId, {
      audioUrl:        url,
      firstWord:       null,
      lastWord:        null,
      durationSeconds: dur,
    })
    await filmaShots.update(shotId, { audio_mode: 'ugc_library' })
    setAudioUrl(url)
    setAudioDur(dur)
    setAudioMode('ugc_library')
    setDuration(dur)
    toast.success('Audio imported from library')
  }

  const handleClearAudio = async () => {
    await filmaShots.clearAudio(shotId)
    setAudioUrl(null)
    setAudioDur(null)
    setAudioMode('native')
    setDuration(null)
  }

  const handleSaveAnchorWords = async () => {
    if (!audioUrl) return
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
  const handleRefUpload = async (e, fromSuggestion = null) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingRef(true)
    try {
      const { url } = await filmaShotRefs.upload(user.id, file)
      const desc = fromSuggestion
        ? `${fromSuggestion.prop}${fromSuggestion.shot_type_hint === 'insert' ? ' (insert ref)' : ''}`
        : ''
      const { data } = await filmaShotRefs.add(filmId, shot.scene_id, shotId, url, desc, refs.length)
      setRefs((prev) => [...prev, data])
      // Dismiss suggestion if it was uploaded via suggestion card
      if (fromSuggestion) {
        setPropSuggestions((prev) => prev.filter((s) => s.prop !== fromSuggestion.prop))
      }
      toast.success('Reference added')
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

  // ── Prop suggestions ──────────────────────────────────────────────────────
  const handleSuggestProps = async () => {
    setSuggestingProps(true)
    try {
      const result = await filmaSuggestShotProps(shotId)
      setPropSuggestions(result.suggestions || [])
      if (result.suggestions?.length === 0) {
        toast.success('No specific props needed for this shot')
      } else {
        toast.success(`${result.suggestions.length} prop suggestion${result.suggestions.length !== 1 ? 's' : ''} ready`)
      }
    } catch (err) {
      toast.error(err.message || 'Could not suggest props')
    } finally {
      setSuggestingProps(false)
    }
  }

  // ── First frame generation (shot #1 only) ─────────────────────────────────
const handleGenerateFirstFrame = async () => {
    setGeneratingFrame(true)
    try {
      const result = await filmaGenerateFirstFrame(shotId, firstFrameModel)
      setShot((prev) => ({ ...prev, start_frame_url: result.imageUrl, first_frame_generated: true }))
      toast.success('First frame generated')
    } catch (err) {
      toast.error(err.message || 'First frame generation failed')
    } finally {
      setGeneratingFrame(false)
    }
  }

  // ── Generate shot ─────────────────────────────────────────────────────────
 const handleGenerate = async () => {
    stopPollRef.current?.()
    stopPollRef.current = null

    setGenerating(true)
    try {
      await filmaGenerateShot(shotId)
      toast.success('Generation started')
      setShot((prev) => ({ ...prev, status: 'generating' }))
    } catch (err) {
      toast.error(err.message || 'Generation failed')
      setGenerating(false)
      return
    }

    setGenerating(false)

    stopPollRef.current = filmaShots.poll(shotId, {
      intervalMs: 5000,
      timeoutMs:  600000,
      onUpdate: (data) => { setShot((prev) => ({ ...prev, ...data })) },
      onDone: ({ success, data, error }) => {
        stopPollRef.current = null
        if (success) {
          setShot((prev) => ({ ...prev, ...data }))
          toast.success('Shot generated!')
        } else {
          setShot((prev) => ({ ...prev, status: 'failed' }))
          toast.error(error || 'Generation failed. Try again.')
        }
      },
    })
  }

  // ── Download output ───────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!shot?.output_url) return
    setDownloading(true)
    try {
      const res  = await fetch(shot.output_url)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `filma-shot-${shot.shot_number}-${shotId.slice(0, 8)}.mp4`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded')
    } catch {
      toast.error('Download failed')
    } finally {
      setDownloading(false)
    }
  }

  // ── Refresh from provider ─────────────────────────────────────────────────
  const handleRefreshShot = async () => {
    if (!shot?.generation_id) {
      toast.error('No generation linked to this shot yet')
      return
    }
    setRefreshingShot(true)
    try {
      await supabase.functions.invoke('video-poll-single', {
        body: { generationId: shot.generation_id },
      })
      const synced = await filmaShots.syncFromGeneration(shotId)
      if (synced) {
        setShot((prev) => ({ ...prev, ...synced }))
        if (synced.status === 'completed' && synced.output_url) {
          toast.success('Shot is ready!')
        } else if (synced.status === 'failed') {
          toast.error('Generation failed')
        } else {
          toast('Still processing — check back soon', { icon: '⏳' })
        }
      }
    } catch {
      toast.error('Refresh failed')
    } finally {
      setRefreshingShot(false)
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

  if (loading) return (
    <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <Loader2 size={24} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
    </div>
  )

  const isDialogue    = shot?.shot_type === 'dialogue'
  const typeColor     = TYPE_COLOR[shot?.shot_type] || TYPE_COLOR.default
  const shotTitle     = `Shot ${shot?.shot_number} — ${shot?.shot_type?.replace(/_/g, ' ')}`
  const hasOutput     = !!shot?.output_url
  const isFirstShot   = shot?.shot_number === 1
  const hasExternalAudio = audioMode === 'uploaded' || audioMode === 'ugc_library'
  const hasHighPriorityProps = propSuggestions.some((s) => s.priority === 'high')

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate(`/filma/${filmId}/scene/${shot?.scene_id}`)}
          className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold capitalize" style={{ color: 'var(--text-primary)' }}>
            {shotTitle}
          </h1>
          <span className="text-xs font-medium" style={{ color: typeColor }}>{film?.title}</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {(extractingEnd || generatingFrame) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.6)' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }} />
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>
              {extractingEnd ? 'Extracting end frame…' : 'Generating first frame…'}
            </p>
          </motion.div>
        )}
        {showUGCPicker && (
          <UGCAudioPicker
            userId={user.id}
            maxDurationS={15}
            onImport={handleImportUGCAudio}
            onClose={() => setShowUGCPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* ── Director notes ── */}
          <div className="px-4 py-3 rounded-2xl flex flex-col gap-1"
            style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
            <div className="flex items-center gap-2 mb-1">
              <div className="px-2 py-0.5 rounded-full text-xs font-bold capitalize"
                style={{ background: `${typeColor}20`, color: typeColor }}>
                {shot?.shot_type?.replace(/_/g, ' ')}
              </div>
              {shot?.duration_seconds && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{shot.duration_seconds}s</span>
              )}
            </div>
            {shot?.description && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{shot.description}</p>
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

          {/* ── First frame generation (shot #1 only) ── */}
          {isFirstShot && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>First Frame</p>
              {shot?.start_frame_url ? (
                <div className="flex flex-col gap-2">
                  <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    <img src={shot.start_frame_url} alt="First frame" className="w-full h-full object-cover" />
                  </div>
                  <button onClick={handleGenerateFirstFrame} disabled={generatingFrame}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold"
                    style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                    <RotateCcw size={12} />
                    {generatingFrame ? 'Regenerating…' : 'Regenerate First Frame'}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="px-4 py-3 rounded-xl text-xs"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    Shot #1 needs a start frame — the visual anchor for the entire scene.
                    AI generates it using your scene environment, actor references, and film context.
                  </div>
                  {firstFrameModels.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {firstFrameModels.map((m) => (
                        <button key={m.value}
                          onClick={() => setFirstFrameModel(m.value)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                          style={{
                            background: firstFrameModel === m.value ? ACCENT_SUB : 'var(--bg-elevated)',
                            color:      firstFrameModel === m.value ? ACCENT     : 'var(--text-muted)',
                            border:     `1px solid ${firstFrameModel === m.value ? ACCENT_BDR : 'var(--border-color)'}`,
                          }}>
                          {m.aka || m.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={handleGenerateFirstFrame} disabled={generatingFrame || !firstFrameModel}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
                    style={{ background: ACCENT, color: '#000' }}>
                    <Sparkles size={15} />
                    {generatingFrame ? 'Generating…' : 'Generate First Frame'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Dialogue section ── */}
          {isDialogue && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>Dialogue & Audio</p>

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

              {/* Audio mode toggle — three options */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {[
                  { value: 'native',      label: 'AI Audio',      icon: Volume2   },
                  { value: 'ugc_library', label: 'My Library',    icon: Library   },
                  { value: 'uploaded',    label: 'Upload Audio',  icon: Mic       },
                ].map(({ value, label, icon: Icon }) => (
                  <button key={value}
                    onClick={() => {
                      if (value === 'ugc_library') { setShowUGCPicker(true); return }
                      handleSetAudioMode(value)
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: audioMode === value ? ACCENT_SUB : 'var(--bg-elevated)',
                      color:      audioMode === value ? ACCENT     : 'var(--text-muted)',
                      border:     `1px solid ${audioMode === value ? ACCENT_BDR : 'var(--border-color)'}`,
                    }}>
                    <Icon size={13} />{label}
                  </button>
                ))}
              </div>

              {audioMode === 'native' && (
                <div className="px-4 py-3 rounded-xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    The AI video model will generate audio natively from the dialogue text.
                    Duration is set by the shot's duration field below.
                  </p>
                </div>
              )}

              {hasExternalAudio && audioUrl && (
                <div className="flex flex-col gap-3">
                  <AudioPreview url={audioUrl} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                        style={{ color: 'var(--text-muted)' }}>First Word</p>
                      <input type="text" value={firstWord} onChange={(e) => setFirstWord(e.target.value)}
                        placeholder="e.g. Kofi"
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg-elevated)', border: `1px solid var(--border-color)`, color: 'var(--text-primary)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-1.5 uppercase tracking-widest"
                        style={{ color: 'var(--text-muted)' }}>Last Word</p>
                      <input type="text" value={lastWord} onChange={(e) => setLastWord(e.target.value)}
                        placeholder="e.g. tonight"
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                        style={{ background: 'var(--bg-elevated)', border: `1px solid var(--border-color)`, color: 'var(--text-primary)' }} />
                    </div>
                  </div>
                  <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                    First and last word help AI anchor lipsync precisely to your audio.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={handleSaveAnchorWords}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold"
                      style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                      Save Anchors
                    </button>
                    <button onClick={handleClearAudio}
                      className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                      <Trash2 size={11} /> Remove
                    </button>
                  </div>
                </div>
              )}

              {audioMode === 'uploaded' && !audioUrl && (
                <label className="flex flex-col items-center justify-center py-6 rounded-2xl cursor-pointer"
                  style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                  <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                  {uploadingAudio ? (
                    <Loader2 size={20} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <Mic size={20} style={{ color: ACCENT, marginBottom: 6 }} />
                      <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload Audio</span>
                      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>1–15 seconds · MP3, WAV, M4A</span>
                    </>
                  )}
                </label>
              )}
            </div>
          )}

          {/* ── Duration ── */}
          {(!isDialogue || audioMode === 'native') && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>Duration</p>
              <div className="flex gap-2 flex-wrap">
                {DURATION_OPTIONS.map((d) => (
                  <button key={d}
                    onClick={() => handleDurationChange(d)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: duration === d ? ACCENT         : 'var(--bg-elevated)',
                      color:      duration === d ? '#000'         : 'var(--text-secondary)',
                    }}>
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Frames ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>
              Frames{isFirstShot ? '' : ' — optional'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FrameSlot label="Start Frame" url={shot?.start_frame_url}
                onUpload={(e) => handleFrameUpload(e, 'start')}
                onRemove={() => handleRemoveFrame('start')}
                uploading={uploadingStart} />
              <FrameSlot label="End Frame" url={shot?.end_frame_url}
                onUpload={(e) => handleFrameUpload(e, 'end')}
                onRemove={() => handleRemoveFrame('end')}
                uploading={uploadingEnd} />
            </div>
          </div>

          {/* ── Prop suggestions ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Reference Images</p>
                {hasHighPriorityProps && (
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: '#ef4444' }}>
                    <AlertCircle size={10} /> High-priority props flagged
                  </p>
                )}
              </div>
              <button onClick={handleSuggestProps} disabled={suggestingProps}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                {suggestingProps
                  ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Sparkles size={11} />}
                {suggestingProps ? 'Analysing…' : 'Suggest Props'}
              </button>
            </div>

            {propSuggestions.length > 0 && (
              <div className="flex flex-col gap-2 mb-3">
                <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                  Upload references for these to prevent AI hallucination:
                </p>
                {propSuggestions.map((s, i) => (
                  <PropSuggestionCard
                    key={i}
                    suggestion={s}
                    onUploadRef={(e) => handleRefUpload(e, s)}
                    onDismiss={() => setPropSuggestions((prev) => prev.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              {refs.map((ref) => (
                <ExtraRefCard key={ref.id} refItem={ref}
                  onUpdateDesc={handleRefDescUpdate} onDelete={handleRefDelete} />
              ))}
              <label className="flex items-center justify-center gap-2 py-3 rounded-xl cursor-pointer transition-all"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleRefUpload(e)} />
                {uploadingRef ? (
                  <Loader2 size={14} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <><Plus size={13} style={{ color: ACCENT }} />
                  <span className="text-xs font-semibold" style={{ color: ACCENT }}>Add Reference</span></>
                )}
              </label>
              <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                Props, locations, logos, costumes, or any visual reference the AI needs to generate this shot accurately.
              </p>
            </div>
          </div>

         {/* ── Generation status ── */}
          {(shot?.status === 'generating' || shot?.status === 'processing') && !hasOutput && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
              <Loader2 size={16} style={{ color: ACCENT, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: ACCENT }}>Generating…</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>This may take a minute. You can leave and come back.</p>
              </div>
            </div>
          )}

          {shot?.status === 'failed' && !hasOutput && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
              <p className="text-sm font-semibold" style={{ color: '#ef4444' }}>Generation failed. Try again.</p>
            </div>
          )}

          {/* ── Output preview ── */}
          {hasOutput && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>Generated Output</p>
              <div className="relative w-full rounded-2xl overflow-hidden"
                style={{ aspectRatio: '16/9', background: 'var(--bg-elevated)' }}>
                <video src={shot.output_url} controls className="w-full h-full object-cover"
                  style={{ outline: 'none' }} />
              </div>
            </div>
          )}

          <div style={{ height: 100 }} />
        </div>
      </div>

      {/* Bottom actions */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4 flex flex-col gap-2"
        style={{ borderTop: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-primary)' }}>
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">

          {/* Generate / Regenerate */}
          <button onClick={handleGenerate} disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: generating ? 'var(--bg-elevated)' : ACCENT,
              color:      generating ? 'var(--text-muted)'  : '#000',
            }}>
            {generating ? (
              <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
            ) : hasOutput ? (
              <><RotateCcw size={15} /> Regenerate Shot</>
            ) : (
              <><Zap size={15} fill="currentColor" /> Generate Shot</>
            )}
          </button>

          {/* Output actions row */}
          {hasOutput && (
            <div className="flex gap-2">
              <button onClick={handleDownload} disabled={downloading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                {downloading
                  ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  : <Download size={14} />}
                {downloading ? 'Downloading…' : 'Download'}
              </button>
              <button onClick={handlePushEnd} disabled={extractingEnd}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                <ScanLine size={14} />
                {extractingEnd ? 'Extracting…' : 'Push End Frame'}
                <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* Refresh from provider — shown when generating or after failure */}
          {(shot?.status === 'generating' || shot?.status === 'processing' || shot?.status === 'failed') && shot?.generation_id && (
            <button onClick={handleRefreshShot} disabled={refreshingShot}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
              {refreshingShot
                ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <RefreshCw size={14} />}
              {refreshingShot ? 'Checking provider…' : 'Refresh from Provider'}
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
