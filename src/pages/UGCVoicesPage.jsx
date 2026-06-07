import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, Mic, Zap, Play, Pause,
  MoreVertical, Archive, Search, X, Loader2,
  Upload, Radio, Lock, Crown, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcVoices, VOICE_CREDITS } from '@/lib/ugcVoices'
import { supabase } from '@/lib/supabase'
import VoiceRecorder   from '@/components/ugc/VoiceRecorder'
import ScriptGenerator from '@/components/ugc/ScriptGenerator'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

// ── Shared audio singleton — one playback across all hook instances ──
const sharedAudio = { ref: null }

// ── Audio preview hook ────────────────────────────────────────
function useAudioPreview() {
  const cacheRef              = useRef({})
  const [playing, setPlaying] = useState(null)
  const [loading, setLoading] = useState(null)

  const play = async (voiceId, previewUrl, elevenlabsVoiceId, userId, onPreviewUrlSaved) => {
    if (sharedAudio.ref) {
      sharedAudio.ref.pause()
      sharedAudio.ref = null
    }
    if (playing === voiceId) { setPlaying(null); return }

    const playUrl = (url) => {
      const audio = new Audio(url)
      audio.onended = () => setPlaying(null)
      audio.play()
      sharedAudio.ref = audio
      setPlaying(voiceId)
    }

    if (previewUrl) { playUrl(previewUrl); return }
    if (!elevenlabsVoiceId || !userId) return
    if (cacheRef.current[voiceId]) { playUrl(cacheRef.current[voiceId]); return }

    setLoading(voiceId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-proxy`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action:              'preview_voice',
            elevenlabs_voice_id: elevenlabsVoiceId,
          }),
        }
      )
      if (!res.ok) throw new Error(`Preview fetch failed: ${res.status}`)

      const blob    = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      cacheRef.current[voiceId] = blobUrl
      playUrl(blobUrl)

      const storagePath = `${userId}/voice-previews/${voiceId}.mp3`
      const { error: uploadError } = await supabase.storage
        .from('ugc-profiles')
        .upload(storagePath, blob, { contentType: 'audio/mpeg', upsert: true, cacheControl: '31536000' })

      if (uploadError) { console.error('[voice-preview] storage upload failed:', uploadError.message); return }

      const { data: { publicUrl } } = supabase.storage.from('ugc-profiles').getPublicUrl(storagePath)
      const { error: dbError } = await supabase
        .from('ugc_voices')
        .update({ preview_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', voiceId)
        .eq('user_id', userId)

      if (dbError) { console.error('[voice-preview] DB update failed:', dbError.message); return }
      onPreviewUrlSaved?.(voiceId, publicUrl)
    } catch (err) {
      console.error('[voice-preview] error:', err.message)
      toast.error('Could not load voice preview')
    } finally {
      setLoading(null)
    }
  }

  useEffect(() => () => {
    Object.values(cacheRef.current).forEach((url) => URL.revokeObjectURL(url))
  }, [])

  return { playing, loading, play }
}

// ── Skeleton card — matches ProfileCard grid skeleton ─────────
const SkeletonCard = () => (
  <div
    className="rounded-2xl overflow-hidden animate-pulse"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }} />
    <div className="p-3 flex flex-col gap-2">
      <div className="h-3 rounded-full w-2/3" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-2.5 rounded-full w-1/2" style={{ background: 'var(--bg-elevated)' }} />
    </div>
  </div>
)

// ── Voice card — portrait grid card matching ProfileCard ──────
const VoiceCard = ({ voice, index, onSelect, onArchive, playing, loading, onPlay, muted, onMutedClick }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const isPlaying = playing === voice.id
  const isLoading = loading === voice.id

  const sourceLabel = {
    elevenlabs_library: 'Library',
    instant_clone:      'My Clone',
    professional_clone: 'Pro Clone',
  }[voice.source] || 'Library'

  const isClone = voice.source === 'instant_clone' || voice.source === 'professional_clone'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Portrait area */}
      <button
        onClick={() => muted ? onMutedClick?.() : onSelect(voice)}
        className="w-full relative overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ aspectRatio: '3/4', background: ACCENT_SUB }}
      >
        {/* Waveform / mic visual */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-end gap-[3px] h-16 opacity-20">
            {[4, 7, 12, 9, 14, 8, 5, 11, 7, 13, 6, 10].map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full"
                style={{
                  height: `${h * (isPlaying ? (Math.sin(Date.now() / 200 + i) * 0.3 + 0.7) : 1) * 4}px`,
                  background: ACCENT,
                }}
              />
            ))}
          </div>
        </div>

        {/* Mic icon centered */}
        <div
          className="relative z-10 w-16 h-16 rounded-3xl flex items-center justify-center"
          style={{
            background: isClone ? ACCENT : 'var(--bg-elevated)',
            border: `1px solid ${ACCENT_BDR}`,
            opacity: muted ? 0.5 : 1,
          }}
        >
          <Mic size={28} style={{ color: isClone ? '#fff' : ACCENT, opacity: 0.8 }} />
        </div>

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)' }}
        />

        {/* Master-only lock overlay */}
        {muted && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
            style={{ background: 'rgba(0,0,0,0.45)' }}
          >
            <Lock size={20} style={{ color: '#fff' }} />
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#fff' }}>
              <Crown size={10} /> Master only
            </span>
          </div>
        )}

        {/* Generation count badge */}
        {voice.generation_count > 0 && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            <Sparkles size={9} />
            {voice.generation_count}
          </div>
        )}

        {/* Play / pause button — bottom right */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!muted) onPlay(voice.id, voice.preview_url, voice.elevenlabs_voice_id)
          }}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
          style={{
            background: isPlaying ? ACCENT : 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {isLoading
            ? <Loader2 size={13} style={{ color: '#fff' }} className="animate-spin" />
            : isPlaying
              ? <Pause size={13} style={{ color: '#fff' }} fill="currentColor" />
              : <Play  size={13} style={{ color: '#fff' }} fill="currentColor" />
          }
        </button>
      </button>

      {/* Bottom info row */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <button
          onClick={() => muted ? onMutedClick?.() : onSelect(voice)}
          className="flex flex-col min-w-0 flex-1 text-left"
        >
          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {voice.name}
          </p>
          <span
            className="text-xs px-1.5 py-0.5 rounded-lg font-medium mt-0.5 inline-block"
            style={{ background: ACCENT_SUB, color: ACCENT, fontSize: '10px' }}
          >
            {sourceLabel}
          </span>
        </button>

        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            <MoreVertical size={13} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -4 }}
                  animate={{ opacity: 1, scale: 1,    y: 0  }}
                  exit={{    opacity: 0, scale: 0.92, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 bottom-8 z-50 rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--bg-card)',
                    border:     '1px solid var(--border-color)',
                    boxShadow:  '0 8px 24px rgba(0,0,0,0.3)',
                    minWidth:   130,
                  }}
                >
                  <button
                    onClick={() => { onArchive(voice); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Archive size={12} />
                    Remove
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ── Create new voice card — matches CreateCard in Characters ──
const AddVoiceCard = ({ onClick, index }) => (
  <motion.button
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.06 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3 transition-all"
    style={{
      aspectRatio: '3/4',
      border:      `1.5px dashed ${ACCENT_BDR}`,
      background:  ACCENT_SUB,
    }}
  >
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center"
      style={{ background: ACCENT_BDR }}
    >
      <Plus size={20} style={{ color: ACCENT }} />
    </div>
    <span className="text-xs font-semibold" style={{ color: ACCENT }}>
      Add Voice
    </span>
  </motion.button>
)

// ── Add voice sheet (unchanged logic, same UI) ────────────────
const AddVoiceSheet = ({ onClose, onSave, userId, credits, isMaster }) => {
  const [tab,           setTab]           = useState('browse')
  const [cloneMode,     setCloneMode]     = useState('upload')
  const [query,         setQuery]         = useState('')
  const [results,       setResults]       = useState([])
  const [searching,     setSearching]     = useState(false)
  const [saving,        setSaving]        = useState(null)
  const [cloneFiles,    setCloneFiles]    = useState([])
  const [recordedFile,  setRecordedFile]  = useState(null)
  const [cloneName,     setCloneName]     = useState('')
  const [cloning,       setCloning]       = useState(false)
  const [showScriptGen, setShowScriptGen] = useState(false)
  const [script,        setScript]        = useState(null)
  const { playing, loading, play } = useAudioPreview()

  const canClone  = credits >= VOICE_CREDITS.CLONE
  const hasAudio  = cloneMode === 'record' ? !!recordedFile : cloneFiles.length > 0
  const canSubmit = canClone && cloneName.trim() && hasAudio && !cloning

  const searchVoices = async (q) => {
    setSearching(true)
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
        body: { action: 'search_voices', query: q || '' },
      })
      if (error) throw error
      setResults(data?.voices || [])
    } catch {
      toast.error('Could not load voices')
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  useEffect(() => {
    if (tab === 'browse') searchVoices('')
  }, [tab])

  const handleSearch = (e) => {
    const q = e.target.value
    setQuery(q)
    const timer = setTimeout(() => searchVoices(q), 400)
    return () => clearTimeout(timer)
  }

  const handleSaveLibraryVoice = async (voice) => {
    setSaving(voice.voice_id)
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
        body: {
          action:          'add_shared_voice',
          public_owner_id: voice.public_owner_id,
          voice_id:        voice.voice_id,
          new_name:        voice.name,
        },
      })
      if (error || !data?.voice_id) throw new Error(error?.message || 'Could not add voice')
      await onSave({
        elevenlabs_voice_id: data.voice_id,
        name:                voice.name,
        description:         voice.description || null,
        source:              'elevenlabs_library',
        preview_url:         voice.preview_url  || null,
        labels:              voice.labels        || {},
      })
      toast.success(`${voice.name} added to your voices`)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Could not save voice')
    } finally {
      setSaving(null)
    }
  }

  const handleClone = async () => {
    if (!canSubmit) return
    setCloning(true)
    try {
      const filesToSend  = cloneMode === 'record' ? [recordedFile] : cloneFiles
      const encodedFiles = await Promise.all(
        filesToSend.map(async (f) => {
          const buf    = await f.arrayBuffer()
          const bytes  = new Uint8Array(buf)
          let   binary = ''
          const chunk  = 8192
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
          }
          return { name: f.name, type: f.type, data: btoa(binary) }
        })
      )

      const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
        body: { action: 'clone_voice', name: cloneName.trim(), files: encodedFiles },
      })
      if (error || !data?.voice_id) throw new Error(error?.message || 'Clone failed')

      const { data: deduct } = await supabase.rpc('deduct_credits', {
        p_user_id:       userId,
        p_amount:        VOICE_CREDITS.CLONE,
        p_generation_id: null,
        p_description:   'Voice clone — ' + cloneName.trim(),
      })
      if (!deduct?.success) throw new Error('Credit deduction failed')

      await onSave({
        elevenlabs_voice_id: data.voice_id,
        name:                cloneName.trim(),
        source:              'instant_clone',
        preview_url:         null,
        labels:              {},
      })
      toast.success('Voice cloned and saved!')
      onClose()
    } catch (err) {
      toast.error(err.message || 'Clone failed')
    } finally {
      setCloning(false)
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{    y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          className="w-full rounded-t-3xl flex flex-col"
          style={{
            background: 'var(--bg-card)',
            maxWidth:   480,
            border:     '1px solid var(--border-color)',
            maxHeight:  '92dvh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
          </div>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Add Voice</p>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
              <X size={16} />
            </button>
          </div>

          <div className="flex gap-1 mx-4 p-1 rounded-xl mb-3 flex-shrink-0" style={{ background: 'var(--bg-elevated)' }}>
            {[
              { value: 'browse', label: 'Voice Library' },
              { value: 'clone',  label: isMaster ? 'Clone Voice' : 'Clone (Master)' },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  if (t.value === 'clone' && !isMaster) {
                    toast.error('Voice cloning is available for Master users only')
                    return
                  }
                  setTab(t.value)
                }}
                className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: tab === t.value ? 'var(--bg-card)' : 'transparent',
                  color:      tab === t.value ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow:  tab === t.value ? 'var(--shadow)' : 'none',
                  opacity:    t.value === 'clone' && !isMaster ? 0.6 : 1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'browse' && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="px-4 mb-3 flex-shrink-0">
                <div
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                >
                  <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input
                    value={query}
                    onChange={handleSearch}
                    placeholder="Search voices..."
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                {searching ? (
                  <div className="flex justify-center py-8">
                    <Loader2 size={20} style={{ color: ACCENT }} className="animate-spin" />
                  </div>
                ) : results.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No voices found</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {results.map((voice) => (
                      <div
                        key={voice.voice_id}
                        className="flex items-center gap-3 p-3 rounded-2xl"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                      >
                        <button
                          onClick={() => play(voice.voice_id, voice.preview_url, null, null, null)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: playing === voice.voice_id ? ACCENT : ACCENT_SUB }}
                        >
                          {loading === voice.voice_id
                            ? <Loader2 size={14} style={{ color: ACCENT }} className="animate-spin" />
                            : playing === voice.voice_id
                              ? <Pause size={14} style={{ color: '#fff'  }} fill="currentColor" />
                              : <Play  size={14} style={{ color: ACCENT }} fill="currentColor" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {voice.name}
                          </p>
                          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {[voice.gender, voice.accent].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSaveLibraryVoice(voice)}
                          disabled={!!saving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                          style={{ background: ACCENT, color: '#fff', opacity: saving === voice.voice_id ? 0.6 : 1 }}
                        >
                          {saving === voice.voice_id ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                          Save
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'clone' && (
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <div
                className="flex items-start gap-3 p-3 rounded-xl mb-4"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
              >
                <Zap size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} fill="currentColor" />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Cloning costs <strong style={{ color: ACCENT }}>800 credits</strong>.
                  1–3 minutes of clean audio produces the best result.
                </p>
              </div>

              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                  Voice Name
                </p>
                <input
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="e.g. My Voice, Brand Voice"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--bg-elevated)' }}>
                {[
                  { value: 'upload', label: 'Upload Audio', icon: Upload },
                  { value: 'record', label: 'Record Voice', icon: Radio  },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setCloneMode(value)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: cloneMode === value ? 'var(--bg-card)' : 'transparent',
                      color:      cloneMode === value ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow:  cloneMode === value ? 'var(--shadow)' : 'none',
                    }}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>

              {cloneMode === 'upload' && (
                <div className="mb-5">
                  <label
                    className="flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer py-6 gap-2"
                    style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
                  >
                    <input
                      type="file" accept="audio/*" multiple className="hidden"
                      onChange={(e) => setCloneFiles(Array.from(e.target.files || []).slice(0, 5))}
                    />
                    <Upload size={22} style={{ color: ACCENT }} />
                    <span className="text-xs font-medium" style={{ color: ACCENT }}>
                      {cloneFiles.length > 0 ? `${cloneFiles.length} file(s) selected` : 'Upload audio samples'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>MP3, WAV, M4A · up to 5 files</span>
                  </label>
                  {cloneFiles.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {cloneFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{f.name}</p>
                          <button
                            onClick={() => setCloneFiles(prev => prev.filter((_, idx) => idx !== i))}
                            className="p-1 ml-2 flex-shrink-0"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {cloneMode === 'record' && (
                <div className="mb-5">
                  <VoiceRecorder
                    script={script}
                    onRecordingReady={(file) => setRecordedFile(file)}
                    onRequestScript={() => setShowScriptGen(true)}
                  />
                  {recordedFile && (
                    <p className="text-xs mt-2 text-center" style={{ color: ACCENT }}>
                      ✓ Recording ready — {recordedFile.name}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleClone}
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: canSubmit ? ACCENT : 'var(--bg-elevated)', color: canSubmit ? '#fff' : 'var(--text-muted)' }}
              >
                {cloning
                  ? <><Loader2 size={15} className="animate-spin" /> Cloning…</>
                  : <><Mic size={15} /> Clone Voice · 800 cr</>
                }
              </button>

              {!canClone && (
                <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                  You need at least 800 credits to clone a voice.
                </p>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showScriptGen && (
          <ScriptGenerator
            onClose={() => setShowScriptGen(false)}
            onScriptReady={(text) => { setScript(text); setShowScriptGen(false) }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function UGCVoicesPage() {
  const navigate                   = useNavigate()
  const { user, credits, profile } = useAuth()
  const [voices,  setVoices]       = useState([])
  const [loading, setLoading]      = useState(true)
  const [showAdd, setShowAdd]      = useState(false)
  const { playing, loading: previewLoading, play } = useAudioPreview()

  useEffect(() => {
    if (!user) return
    loadVoices()
  }, [user])

  const loadVoices = async () => {
    setLoading(true)
    const { data, error } = await ugcVoices.getAll(user.id)
    if (!error) setVoices(data || [])
    setLoading(false)
  }

  const handleSave = async (payload) => {
    const { data, error } = await ugcVoices.save(user.id, payload)
    if (error) throw error
    setVoices((prev) => [data, ...prev])
  }

  const handleArchive = async (voice) => {
    const { error } = await ugcVoices.archive(voice.id)
    if (error) { toast.error('Could not remove voice'); return }
    setVoices((prev) => prev.filter((v) => v.id !== voice.id))
    toast.success(`${voice.name} removed`)
  }

  const handlePreviewUrlSaved = (voiceId, publicUrl) => {
    setVoices((prev) =>
      prev.map((v) => v.id === voiceId ? { ...v, preview_url: publicUrl } : v)
    )
  }

  const handlePlay = (voiceId, previewUrl, elevenlabsVoiceId) => {
    play(voiceId, previewUrl, elevenlabsVoiceId, user?.id, handlePreviewUrlSaved)
  }

  const handleSelect    = (voice) => navigate(`/create/ugc/voice/${voice.id}`)
  const isMaster        = profile?.user_tier === 'master'
  const isVoiceMuted    = (v) => !isMaster && v.source !== 'elevenlabs_library'
  const hasMutedVoices  = voices.some(isVoiceMuted)

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header — identical to CreateUGCPage */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button onClick={() => navigate('/create/ugc')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Voices</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Voice Studio</span>
        </div>
        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
          {Math.floor(credits)}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6">

          {loading ? (
            /* Skeleton grid — matches Characters skeleton */
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>

          ) : voices.length === 0 ? (
            /* Empty state — matches Brands empty state exactly */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-5 text-center"
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
              >
                <Mic size={36} style={{ color: ACCENT, opacity: 0.6 }} />
              </div>
              <div>
                <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No voices yet</p>
                <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  Add a voice from our library or clone your own.
                </p>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: ACCENT, color: '#ffffff' }}
              >
                <Plus size={16} />
                Add Voice
              </button>
            </motion.div>

          ) : (
            <>
              {/* Voices section label */}
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Voices
              </p>

              {/* Card grid — matches Characters 2-col grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {voices.map((voice, i) => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    index={i}
                    onSelect={handleSelect}
                    onArchive={handleArchive}
                    playing={playing}
                    loading={previewLoading}
                    onPlay={handlePlay}
                    muted={isVoiceMuted(voice)}
                    onMutedClick={() =>
                      toast.error('Cloned voices are Master-only. Upgrade to use this voice.')
                    }
                  />
                ))}
                {/* Add voice inline card at end of grid */}
                <AddVoiceCard onClick={() => setShowAdd(true)} index={voices.length} />
              </div>

              {/* Master upsell banner — matches Characters muted banner */}
              {hasMutedVoices && (
                <div
                  className="flex items-start gap-2.5 p-3 rounded-2xl mt-1"
                  style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                >
                  <Crown size={14} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Your cloned voices are muted on the Novice tier. Upgrade to Master
                    to unlock all of your cloned voices.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sticky footer CTA — matches Brands "+ Create Brand" button */}
      {voices.length > 0 && (
        <div
          className="flex-shrink-0 px-4 lg:px-8 py-4"
          style={{ borderTop: `1px solid ${ACCENT_BDR}` }}
        >
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: ACCENT, color: '#ffffff' }}
            >
              <Plus size={15} />
              Add Voice
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <AddVoiceSheet
            onClose={() => setShowAdd(false)}
            onSave={handleSave}
            userId={user?.id}
            credits={credits}
            isMaster={isMaster}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
