import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, Mic, Zap, Play, Pause,
  MoreVertical, Archive, Search, X, Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcVoices, VOICE_CREDITS } from '@/lib/ugcVoices'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

// ── Audio preview hook ────────────────────────────────────────
function useAudioPreview() {
  const audioRef   = useRef(null)
  const [playing, setPlaying] = useState(null) // voice id

  const play = (voiceId, previewUrl) => {
    if (!previewUrl) return
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (playing === voiceId) {
      setPlaying(null)
      return
    }
    const audio = new Audio(previewUrl)
    audio.onended = () => setPlaying(null)
    audio.play()
    audioRef.current = audio
    setPlaying(voiceId)
  }

  useEffect(() => () => audioRef.current?.pause(), [])

  return { playing, play }
}

// ── Skeleton card ─────────────────────────────────────────────
const SkeletonCard = () => (
  <div
    className="flex items-center gap-3 p-4 rounded-2xl animate-pulse"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div className="w-12 h-12 rounded-2xl flex-shrink-0" style={{ background: 'var(--bg-elevated)' }} />
    <div className="flex-1 flex flex-col gap-2">
      <div className="h-3 rounded-full w-1/2" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-2.5 rounded-full w-1/3" style={{ background: 'var(--bg-elevated)' }} />
    </div>
  </div>
)

// ── Saved voice card ──────────────────────────────────────────
const SavedVoiceCard = ({ voice, index, onSelect, onArchive, playing, onPlay }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const isPlaying = playing === voice.id

  const sourceLabel = {
    elevenlabs_library: 'Library',
    instant_clone:      'Instant Clone',
    professional_clone: 'Pro Clone',
  }[voice.source] || 'Library'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-4 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Play button */}
      <button
        onClick={() => onPlay(voice.id, voice.preview_url)}
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
        style={{ background: isPlaying ? ACCENT : ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
      >
        {isPlaying
          ? <Pause size={18} style={{ color: '#ffffff' }} fill="currentColor" />
          : <Play  size={18} style={{ color: ACCENT }} fill="currentColor" />
        }
      </button>

      {/* Info */}
      <button onClick={() => onSelect(voice)} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {voice.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span
            className="text-xs px-1.5 py-0.5 rounded-lg font-medium"
            style={{ background: ACCENT_SUB, color: ACCENT }}
          >
            {sourceLabel}
          </span>
          {voice.generation_count > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {voice.generation_count} gen{voice.generation_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>

      {/* Menu */}
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
          className="p-2 rounded-xl"
          style={{ color: 'var(--text-muted)' }}
        >
          <MoreVertical size={15} />
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
    </motion.div>
  )
}

// ── Add voice sheet ───────────────────────────────────────────
const AddVoiceSheet = ({ onClose, onSave, userId, credits }) => {
  const [tab,          setTab]          = useState('browse') // 'browse' | 'clone'
  const [query,        setQuery]        = useState('')
  const [results,      setResults]      = useState([])
  const [searching,    setSearching]    = useState(false)
  const [saving,       setSaving]       = useState(null)
  const [cloneFiles,   setCloneFiles]   = useState([])
  const [cloneName,    setCloneName]    = useState('')
  const [cloning,      setCloning]      = useState(false)
  const { playing, play } = useAudioPreview()
  const canClone = credits >= VOICE_CREDITS.CLONE

  const searchVoices = async (q) => {
    setSearching(true)
    try {
      // Proxy through our edge function to keep API key server-side
      const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
        body: { action: 'search_voices', query: q || '' },
      })
      if (error) throw error
      setResults(data?.voices || [])
    } catch (err) {
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
      // Step 1: Add to our ElevenLabs account to get a usable voice_id
      const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
        body: {
          action:          'add_shared_voice',
          public_owner_id: voice.public_owner_id,
          voice_id:        voice.voice_id,
          new_name:        voice.name,
        },
      })
      if (error || !data?.voice_id) throw new Error(error?.message || 'Could not add voice to account')

      // Step 2: Save to Meckury's ugc_voices with the account-scoped voice_id
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
    if (!cloneName.trim() || cloneFiles.length === 0) return
    if (!canClone) {
      toast.error('You need 800 credits to clone a voice')
      return
    }
    setCloning(true)
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
        body: {
          action: 'clone_voice',
          name:   cloneName.trim(),
          files:  await Promise.all(
            cloneFiles.map(async (f) => {
              const buf = await f.arrayBuffer()
              return {
                name: f.name,
                type: f.type,
                data: btoa(String.fromCharCode(...new Uint8Array(buf))),
              }
            })
          ),
        },
      })
      if (error || !data?.voice_id) throw new Error(error?.message || 'Clone failed')

      // Deduct 800 credits for cloning
      await supabase.rpc('deduct_credits', {
        p_user_id:    userId,
        p_amount:     VOICE_CREDITS.CLONE,
        p_description:'Voice clone — ' + cloneName.trim(),
      })

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
          maxHeight:  '88dvh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Add Voice</p>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mx-4 p-1 rounded-xl mb-3 flex-shrink-0" style={{ background: 'var(--bg-elevated)' }}>
          {[
            { value: 'browse', label: 'Voice Library' },
            { value: 'clone',  label: 'Clone Voice'    },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: tab === t.value ? 'var(--bg-card)' : 'transparent',
                color:      tab === t.value ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow:  tab === t.value ? 'var(--shadow)' : 'none',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Browse tab */}
        {tab === 'browse' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Search */}
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

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              {searching ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={20} style={{ color: ACCENT }} className="animate-spin" />
                </div>
              ) : results.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
                  No voices found
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {results.map((voice) => (
                    <div
                      key={voice.voice_id}
                      className="flex items-center gap-3 p-3 rounded-2xl"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                    >
                      <button
                        onClick={() => play(voice.voice_id, voice.preview_url)}
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: playing === voice.voice_id ? ACCENT : ACCENT_SUB }}
                      >
                        {playing === voice.voice_id
                          ? <Pause size={14} style={{ color: '#fff' }} fill="currentColor" />
                          : <Play  size={14} style={{ color: ACCENT }} fill="currentColor" />
                        }
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {voice.name}
                        </p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          {voice.labels?.gender || ''} {voice.labels?.accent || ''}
                        </p>
                      </div>
                      <button
                        onClick={() => handleSaveLibraryVoice(voice)}
                        disabled={!!saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
                        style={{ background: ACCENT, color: '#fff', opacity: saving === voice.voice_id ? 0.6 : 1 }}
                      >
                        {saving === voice.voice_id
                          ? <Loader2 size={11} className="animate-spin" />
                          : <Plus size={11} />
                        }
                        Save
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clone tab */}
        {tab === 'clone' && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {/* Credit notice */}
            <div
              className="flex items-start gap-3 p-3 rounded-xl mb-4"
              style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
            >
              <Zap size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} fill="currentColor" />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Cloning costs <strong style={{ color: ACCENT }}>800 credits</strong>.
                Upload 1–5 clean audio samples (30 sec – 3 min each) to create your voice.
              </p>
            </div>

            {/* Name */}
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                Voice Name
              </p>
              <input
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                placeholder="e.g. My Voice, Brand Voice"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border:     '1px solid var(--border-color)',
                  color:      'var(--text-primary)',
                }}
              />
            </div>

            {/* File upload */}
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
                Audio Samples (1–5 files)
              </p>
              <label
                className="flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer py-6 gap-2"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
              >
                <input
                  type="file"
                  accept="audio/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).slice(0, 5)
                    setCloneFiles(files)
                  }}
                />
                <Mic size={22} style={{ color: ACCENT }} />
                <span className="text-xs font-medium" style={{ color: ACCENT }}>
  {cloneFiles.length > 0 ? `${cloneFiles.length} file(s) selected` : 'Upload audio samples'}
</span>
              </label>
              {cloneFiles.length > 0 && (
                <div className="mt-2 flex flex-col gap-1">
                  {cloneFiles.map((f, i) => (
                    <p key={i} className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {f.name}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleClone}
              disabled={!canClone || !cloneName.trim() || cloneFiles.length === 0 || cloning}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: (canClone && cloneName.trim() && cloneFiles.length > 0 && !cloning)
                  ? ACCENT : 'var(--bg-elevated)',
                color: (canClone && cloneName.trim() && cloneFiles.length > 0 && !cloning)
                  ? '#fff' : 'var(--text-muted)',
              }}
            >
              {cloning
                ? <><Loader2 size={15} className="animate-spin" /> Cloning…</>
                : <><Mic size={15} /> Clone Voice · 800 cr</>
              }
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function UGCVoicesPage() {
  const navigate          = useNavigate()
  const { user, credits } = useAuth()
  const [voices,    setVoices]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showAdd,   setShowAdd]   = useState(false)
  const { playing, play } = useAudioPreview()

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
    if (error) {
      toast.error('Could not remove voice')
      return
    }
    setVoices((prev) => prev.filter((v) => v.id !== voice.id))
    toast.success(`${voice.name} removed`)
  }

  const handleSelect = (voice) => {
    navigate(`/create/ugc/voice/${voice.id}`)
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
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
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : voices.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-20 gap-5 text-center"
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
              >
                <Mic size={36} style={{ color: ACCENT, opacity: 0.6 }} />
              </div>
              <div>
                <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No voices yet</p>
                // REPLACE
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
              <div className="flex flex-col gap-3 mb-5">
                {voices.map((voice, i) => (
                  <SavedVoiceCard
                    key={voice.id}
                    voice={voice}
                    index={i}
                    onSelect={handleSelect}
                    onArchive={handleArchive}
                    playing={playing}
                    onPlay={play}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add voice FAB */}
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

      {/* Add voice sheet */}
      <AnimatePresence>
        {showAdd && (
          <AddVoiceSheet
            onClose={() => setShowAdd(false)}
            onSave={handleSave}
            userId={user?.id}
            credits={credits}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
