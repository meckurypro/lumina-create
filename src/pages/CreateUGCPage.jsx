// src/pages/CreateUGCPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, User, Building2, Zap, Sparkles,
  MoreVertical, Archive, Pencil, Lock, Crown,
  Mic, Play, Pause, Loader2, Search, X, Upload, Radio,
  Mic2, MessageSquareText,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcProfiles } from '@/lib/ugc'
import { ugcBrandProfiles, BRAND_CREDIT_COST } from '@/lib/ugcBrands'
import { ugcVoices, VOICE_CREDITS } from '@/lib/ugcVoices'
import { supabase } from '@/lib/supabase'
import VoiceRecorder   from '@/components/ugc/VoiceRecorder'
import ScriptGenerator from '@/components/ugc/ScriptGenerator'
import { TopBar } from '@/components/layout/TopBar'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const CHARACTER_CREDIT_COST = 200

// ─────────────────────────────────────────────────────────────
// VOICES — shared audio singleton + hook
// ─────────────────────────────────────────────────────────────
const sharedAudio = { ref: null }

function useAudioPreview() {
  const cacheRef              = useRef({})
  const [playing, setPlaying] = useState(null)
  const [loading, setLoading] = useState(null)

  const play = async (voiceId, previewUrl, elevenlabsVoiceId, userId, onPreviewUrlSaved) => {
    if (sharedAudio.ref) { sharedAudio.ref.pause(); sharedAudio.ref = null }
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
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'preview_voice', elevenlabs_voice_id: elevenlabsVoiceId }),
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
        .eq('id', voiceId).eq('user_id', userId)
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

// ── Skeleton card ─────────────────────────────────────────────
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

// ── Voice skeleton row ────────────────────────────────────────
const VoiceSkeletonRow = () => (
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

// ── Search bar ────────────────────────────────────────────────
const SearchBar = ({ value, onChange, onClear, placeholder }) => (
  <div
    className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3"
    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
  >
    <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="flex-1 bg-transparent text-sm outline-none"
      style={{ color: 'var(--text-primary)' }}
    />
    {value && (
      <button onClick={onClear} style={{ color: 'var(--text-muted)' }}>
        <X size={13} />
      </button>
    )}
  </div>
)

// ── Character profile card ────────────────────────────────────
const ProfileCard = ({ profile, index, onSelect, onArchive, onEdit, muted, onMutedClick }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <button
        onClick={() => (muted ? onMutedClick?.() : onSelect(profile))}
        className="w-full relative overflow-hidden flex-shrink-0"
        style={{ aspectRatio: '3/4' }}
      >
        {profile.thumbnail_url ? (
          <img
            src={profile.thumbnail_url}
            alt={profile.name}
            className="w-full h-full object-cover"
            style={{ filter: muted ? 'grayscale(1) brightness(0.55)' : 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: ACCENT_SUB }}>
            <User size={32} style={{ color: ACCENT, opacity: 0.5 }} />
          </div>
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)' }} />
        {muted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <Lock size={20} style={{ color: '#fff' }} />
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#fff' }}>
              <Crown size={10} /> Master only
            </span>
          </div>
        )}
        {profile.generation_count > 0 && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            <Sparkles size={9} />
            {profile.generation_count}
          </div>
        )}
        {profile.status === 'draft' && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)' }}
          >
            Draft
          </div>
        )}
      </button>

      <div className="px-3 py-2.5 flex items-center justify-between">
        <button onClick={() => onSelect(profile)} className="flex flex-col min-w-0 flex-1 text-left">
          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{profile.name}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {profile.age} · {profile.nationality}
          </p>
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
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 120 }}
                >
                  <button
                    onClick={() => { onEdit(profile); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 8px' }} />
                  <button
                    onClick={() => { onArchive(profile); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Archive size={12} /> Archive
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

// ── Brand card ────────────────────────────────────────────────
const BrandCard = ({ brand, index, onSelect, onArchive, onEdit, muted, onMutedClick }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <button
        onClick={() => (muted ? onMutedClick?.() : onSelect(brand))}
        className="w-full relative overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ aspectRatio: '3/4', background: ACCENT_SUB }}
      >
        {brand.logo_url ? (
          <img
            src={brand.logo_url}
            alt={brand.brand_name}
            className="w-full h-full object-contain p-6"
            style={{ filter: muted ? 'grayscale(1) brightness(0.55)' : 'none' }}
          />
        ) : (
          <Building2 size={36} style={{ color: ACCENT, opacity: muted ? 0.25 : 0.5 }} />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }} />
        {muted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <Lock size={20} style={{ color: '#fff' }} />
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#fff' }}>
              <Crown size={10} /> Master only
            </span>
          </div>
        )}
        {brand.generation_count > 0 && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            <Sparkles size={9} />
            {brand.generation_count}
          </div>
        )}
        {brand.status === 'draft' && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)' }}
          >
            Draft
          </div>
        )}
      </button>

      <div className="px-3 py-2.5 flex items-center justify-between">
        <button onClick={() => muted ? onMutedClick?.() : onSelect(brand)} className="flex flex-col min-w-0 flex-1 text-left">
          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{brand.brand_name}</p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{brand.tagline}</p>
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
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 120 }}
                >
                  <button
                    onClick={() => { onEdit(brand); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 8px' }} />
                  <button
                    onClick={() => { onArchive(brand); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Archive size={12} /> Archive
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

// ── Saved voice row ───────────────────────────────────────────
const SavedVoiceRow = ({ voice, index, onSelect, onArchive, playing, loading, onPlay, muted, onMutedClick }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const isPlaying = playing === voice.id
  const isLoading = loading === voice.id

  const sourceLabel = {
    elevenlabs_library: 'Library',
    instant_clone:      'My Clone',
    professional_clone: 'Pro Clone',
  }[voice.source] || 'Library'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-4 rounded-2xl relative"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', opacity: muted ? 0.55 : 1 }}
    >
      <button
        onClick={() => onPlay(voice.id, voice.preview_url, voice.elevenlabs_voice_id)}
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
        style={{ background: isPlaying ? ACCENT : ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
      >
        {isLoading
          ? <Loader2 size={18} style={{ color: ACCENT }} className="animate-spin" />
          : isPlaying
            ? <Pause size={18} style={{ color: '#ffffff' }} fill="currentColor" />
            : <Play  size={18} style={{ color: ACCENT   }} fill="currentColor" />
        }
      </button>

      <button onClick={() => muted ? onMutedClick?.() : onSelect(voice)} className="flex-1 min-w-0 text-left">
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
          {muted && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-lg font-medium inline-flex items-center gap-1"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              <Lock size={9} /> Master only
            </span>
          )}
          {voice.generation_count > 0 && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {voice.generation_count} gen{voice.generation_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </button>

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
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 130 }}
              >
                <button
                  onClick={() => { onArchive(voice); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <Archive size={12} /> Remove
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

  const canClone  = credits >= 100
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

  useEffect(() => { if (tab === 'browse') searchVoices('') }, [tab])

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
        body: { action: 'add_shared_voice', public_owner_id: voice.public_owner_id, voice_id: voice.voice_id, new_name: voice.name },
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
          const buf = await f.arrayBuffer(); const bytes = new Uint8Array(buf)
          let binary = ''; const chunk = 8192
          for (let i = 0; i < bytes.length; i += chunk)
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
          return { name: f.name, type: f.type, data: btoa(binary) }
        })
      )
      const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
        body: { action: 'clone_voice', name: cloneName.trim(), files: encodedFiles },
      })
      if (error || !data?.voice_id) throw new Error(error?.message || 'Clone failed')
      const { data: deduct } = await supabase.rpc('deduct_credits', {
        p_user_id: userId, p_amount: 100, p_generation_id: null,
        p_description: 'Voice clone — ' + cloneName.trim(),
      })
      if (!deduct?.success) throw new Error('Credit deduction failed')
      await onSave({ elevenlabs_voice_id: data.voice_id, name: cloneName.trim(), source: 'instant_clone', preview_url: null, labels: {} })
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
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
          className="w-full rounded-t-3xl flex flex-col"
          style={{ background: 'var(--bg-card)', maxWidth: 480, border: '1px solid var(--border-color)', maxHeight: '92dvh' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
          </div>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Add Voice</p>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>

          <div className="flex gap-1 mx-4 p-1 rounded-xl mb-3 flex-shrink-0" style={{ background: 'var(--bg-elevated)' }}>
            {[
              { value: 'browse', label: 'Voice Library' },
              { value: 'clone',  label: isMaster ? 'Clone Voice' : 'Clone (Master)' },
            ].map((t) => (
              <button
                key={t.value}
                onClick={() => {
                  if (t.value === 'clone' && !isMaster) { toast.error('Voice cloning is available for Master users only'); return }
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
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <input value={query} onChange={handleSearch} placeholder="Search voices..." className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--text-primary)' }} />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-6">
                {searching ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} style={{ color: ACCENT }} className="animate-spin" /></div>
                ) : results.length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No voices found</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {results.map((voice) => (
                      <div key={voice.voice_id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                        <button
                          onClick={() => play(voice.voice_id, voice.preview_url, null, null, null)}
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: playing === voice.voice_id ? ACCENT : ACCENT_SUB }}
                        >
                          {loading === voice.voice_id
                            ? <Loader2 size={14} style={{ color: ACCENT }} className="animate-spin" />
                            : playing === voice.voice_id
                              ? <Pause size={14} style={{ color: '#fff' }} fill="currentColor" />
                              : <Play  size={14} style={{ color: ACCENT }} fill="currentColor" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{voice.name}</p>
                          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{[voice.gender, voice.accent].filter(Boolean).join(' · ')}</p>
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
              <div className="flex items-start gap-3 p-3 rounded-xl mb-4" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                <Zap size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} fill="currentColor" />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Cloning costs <strong style={{ color: ACCENT }}>100 credits</strong>. 1–3 minutes of clean audio produces the best result.
                </p>
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Voice Name</p>
                <input
                  value={cloneName} onChange={(e) => setCloneName(e.target.value)}
                  placeholder="e.g. My Voice, Brand Voice" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'var(--bg-elevated)' }}>
                {[{ value: 'upload', label: 'Upload Audio', icon: Upload }, { value: 'record', label: 'Record Voice', icon: Radio }].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value} onClick={() => setCloneMode(value)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: cloneMode === value ? 'var(--bg-card)' : 'transparent', color: cloneMode === value ? 'var(--text-primary)' : 'var(--text-muted)', boxShadow: cloneMode === value ? 'var(--shadow)' : 'none' }}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
              {cloneMode === 'upload' && (
                <div className="mb-5">
                  <label className="flex flex-col items-center justify-center rounded-2xl transition-all cursor-pointer py-6 gap-2" style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                    <input type="file" accept="audio/*" multiple className="hidden" onChange={(e) => setCloneFiles(Array.from(e.target.files || []).slice(0, 5))} />
                    <Upload size={22} style={{ color: ACCENT }} />
                    <span className="text-xs font-medium" style={{ color: ACCENT }}>{cloneFiles.length > 0 ? `${cloneFiles.length} file(s) selected` : 'Upload audio samples'}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>MP3, WAV, M4A · up to 5 files</span>
                  </label>
                  {cloneFiles.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {cloneFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{f.name}</p>
                          <button onClick={() => setCloneFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-1 ml-2 flex-shrink-0" style={{ color: 'var(--text-muted)' }}><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {cloneMode === 'record' && (
                <div className="mb-5">
                  <VoiceRecorder script={script} onRecordingReady={(file) => setRecordedFile(file)} onRequestScript={() => setShowScriptGen(true)} />
                  {recordedFile && <p className="text-xs mt-2 text-center" style={{ color: ACCENT }}>✓ Recording ready — {recordedFile.name}</p>}
                </div>
              )}
              <button
                onClick={handleClone} disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: canSubmit ? ACCENT : 'var(--bg-elevated)', color: canSubmit ? '#fff' : 'var(--text-muted)' }}
              >
                {cloning ? <><Loader2 size={15} className="animate-spin" /> Cloning…</> : <><Mic size={15} /> Clone Voice · 100 cr</>}
              </button>
              {!canClone && <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>You need at least 100 credits to clone a voice.</p>}
            </div>
          )}
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {showScriptGen && (
          <ScriptGenerator onClose={() => setShowScriptGen(false)} onScriptReady={(text) => { setScript(text); setShowScriptGen(false) }} />
        )}
      </AnimatePresence>
    </>
  )
}

// ── Voice mode gate ───────────────────────────────────────────
// Shown whenever the Voices tab is active and no mode is selected.
// Choosing TTS reveals the existing voice library/clone flow.
// Choosing STT navigates to /create/ugc/voices/stt.
const VoiceModeGate = ({ onSelectTTS, onSelectSTT }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col gap-4 py-6"
  >
    <div className="text-center mb-2">
      <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
        How do you want to work with voice?
      </p>
      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
        Pick one to get started — you can switch anytime.
      </p>
    </div>

    <button
      onClick={onSelectTTS}
      className="flex items-start gap-4 p-5 rounded-2xl text-left transition-all active:scale-[0.98]"
      style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_BDR}` }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: ACCENT_SUB }}
      >
        <Mic2 size={22} style={{ color: ACCENT }} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Use TTS — Text to Speech
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Browse voices from our library, clone your own voice, and generate
          speech from a script.
        </p>
      </div>
    </button>

    <button
      onClick={onSelectSTT}
      className="flex items-start gap-4 p-5 rounded-2xl text-left transition-all active:scale-[0.98]"
      style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_BDR}` }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: ACCENT_SUB }}
      >
        <MessageSquareText size={22} style={{ color: ACCENT }} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Use STT — Speech to Text
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Record or upload your own voiceover and save it to your library.
          Extract a transcript whenever you need the text back.
        </p>
      </div>
    </button>
  </motion.div>
)

// ── Main page ─────────────────────────────────────────────────
export default function CreateUGCPage() {
  const navigate          = useNavigate()
  const location          = useLocation()
  const { user, credits, profile } = useAuth()

  // Characters state
  const [charProfiles,    setCharProfiles]    = useState([])
  const [charLoading,     setCharLoading]     = useState(true)
  const [archivingChar,   setArchivingChar]   = useState(null)

  // Brands state
  const [brandProfiles,   setBrandProfiles]   = useState([])
  const [brandLoading,    setBrandLoading]    = useState(true)

  // Voices state
  const [voices,          setVoices]          = useState([])
  const [voicesLoading,   setVoicesLoading]   = useState(false)
  const [voicesLoaded,    setVoicesLoaded]    = useState(false)
  const [showAddVoice,    setShowAddVoice]    = useState(false)
  const { playing: voicePlaying, loading: voicePreviewLoading, play: playVoice } = useAudioPreview()

  // Search state
  const [charSearch,  setCharSearch]  = useState('')
  const [brandSearch, setBrandSearch] = useState('')
  const [voiceSearch, setVoiceSearch] = useState('')

  // Tab — support direct-link to voices via location.state or pathname
  const initTab = location.state?.tab || (location.pathname.endsWith('/voices') ? 'voices' : 'characters')
  const [ugcTab,     setUgcTab]     = useState(initTab)
  const [voiceMode,  setVoiceMode]  = useState(null) // null = gate visible

  // Restore tab when navigating back from sub-pages
  useEffect(() => {
    if (location.state?.tab) setUgcTab(location.state.tab)
  }, [location.state?.tab])

  // Always reset the gate when the user leaves and re-enters the Voices tab
  const handleSetTab = (tab) => {
    if (tab !== 'voices') setVoiceMode(null)
    setUgcTab(tab)
  }

  const isMaster       = profile?.user_tier === 'master'
  const canCreateChar  = credits >= CHARACTER_CREDIT_COST
  const canCreateBrand = credits >= BRAND_CREDIT_COST

  useEffect(() => {
    if (!user) return
    loadCharProfiles()
    loadBrandProfiles()
  }, [user])

  // Voice fetch is now triggered inside VoiceModeGate's onSelectTTS callback (Change 5).
  // The useEffect trigger is removed to avoid a wasted fetch when the user picks STT.

  const loadCharProfiles = async () => {
    setCharLoading(true)
    const { data, error } = await ugcProfiles.getAll(user.id)
    if (!error) setCharProfiles(data || [])
    setCharLoading(false)
  }

  const loadBrandProfiles = async () => {
    setBrandLoading(true)
    const { data, error } = await ugcBrandProfiles.getAll(user.id)
    if (!error) setBrandProfiles(data || [])
    setBrandLoading(false)
  }

  const loadVoices = async () => {
    setVoicesLoading(true)
    const { data, error } = await ugcVoices.getAll(user.id)
    if (!error) setVoices(data || [])
    setVoicesLoading(false)
    setVoicesLoaded(true)
  }

  // ── Character handlers ────────────────────────────────────
  const handleSelectProfile = (p) => {
    if (p.status === 'draft') navigate('/create/ugc/new', { state: { resumeProfileId: p.id } })
    else navigate(`/create/ugc/${p.id}`)
  }
  const handleArchiveChar = async (p) => {
    setArchivingChar(p.id)
    const { error } = await ugcProfiles.archive(p.id)
    if (error) toast.error('Could not archive profile')
    else { setCharProfiles((prev) => prev.filter((c) => c.id !== p.id)); toast.success(`${p.name} archived`) }
    setArchivingChar(null)
  }
  const handleEditChar = (p) => navigate('/create/ugc/new', { state: { editProfileId: p.id } })

  const oldestActiveCharId = charProfiles
    .filter((p) => p.status === 'active').slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]?.id

  const isProfileMuted    = (p) => !isMaster && p.status === 'active' && p.id !== oldestActiveCharId
  const noviceAtCharLimit = !isMaster && charProfiles.some((p) => p.status === 'active' || p.status === 'draft')

  const handleMutedCharClick = () => { toast.error('Upgrade to Master to use additional characters.', { duration: 4000 }); navigate('/profile') }
  const handleCreateNewChar  = () => {
    if (noviceAtCharLimit) { toast.error('Novice users can only have one UGC character. Upgrade to Master for more.', { duration: 4500 }); return }
    if (!canCreateChar)    { toast.error(`You need at least ${CHARACTER_CREDIT_COST} credits to create a UGC character.`, { duration: 4000 }); return }
    navigate('/create/ugc/new')
  }

  // ── Brand handlers ────────────────────────────────────────
  const handleSelectBrand = (b) => {
    if (b.status === 'draft') navigate('/create/ugc/brand/new', { state: { resumeBrandId: b.id } })
    else navigate(`/create/ugc/brand/${b.id}`)
  }
  const handleArchiveBrand = async (b) => {
    const { error } = await ugcBrandProfiles.archive(b.id)
    if (error) toast.error('Could not archive brand')
    else { setBrandProfiles((prev) => prev.filter((br) => br.id !== b.id)); toast.success(`${b.brand_name} archived`) }
  }
  const handleEditBrand = (b) => navigate('/create/ugc/brand/new', { state: { editBrandId: b.id } })

  const oldestActiveBrandId = brandProfiles
    .filter((b) => b.status === 'active').slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]?.id

  const isBrandMuted       = (b) => !isMaster && b.status === 'active' && b.id !== oldestActiveBrandId
  const noviceAtBrandLimit = !isMaster && brandProfiles.some((b) => b.status === 'active' || b.status === 'draft')

  const handleMutedBrandClick = () => { toast.error('Upgrade to Master to use additional brands.', { duration: 4000 }); navigate('/profile') }
  const handleCreateNewBrand  = () => {
    if (noviceAtBrandLimit) { toast.error('Novice users can only have one brand profile. Upgrade to Master for more.', { duration: 4500 }); return }
    if (!canCreateBrand)    { toast.error(`You need at least ${BRAND_CREDIT_COST} credits to create a brand profile.`, { duration: 4000 }); return }
    navigate('/create/ugc/brand/new')
  }

  // ── Voice handlers ────────────────────────────────────────
  const handleSaveVoice = async (payload) => {
    const { data, error } = await ugcVoices.save(user.id, payload)
    if (error) throw error
    setVoices((prev) => [data, ...prev])
  }
  const handleArchiveVoice = async (voice) => {
    const { error } = await ugcVoices.archive(voice.id)
    if (error) { toast.error('Could not remove voice'); return }
    setVoices((prev) => prev.filter((v) => v.id !== voice.id))
    toast.success(`${voice.name} removed`)
  }
  const handlePreviewUrlSaved = (voiceId, publicUrl) => {
    setVoices((prev) => prev.map((v) => v.id === voiceId ? { ...v, preview_url: publicUrl } : v))
  }
  const handlePlayVoice  = (voiceId, previewUrl, elevenlabsVoiceId) => {
    playVoice(voiceId, previewUrl, elevenlabsVoiceId, user?.id, handlePreviewUrlSaved)
  }
  const handleSelectVoice = (voice) => navigate(`/create/ugc/voice/${voice.id}`)
  const isVoiceMuted      = (v) => !isMaster && v.source !== 'elevenlabs_library'
  const hasMutedVoices    = voices.some(isVoiceMuted)

  // ── Derived / filtered lists ──────────────────────────────
  const q = (str) => str?.toLowerCase() ?? ''

  const activeCharProfiles  = charProfiles.filter((p) => p.status === 'active')
  const draftCharProfiles   = charProfiles.filter((p) => p.status === 'draft')
  const activeBrandProfiles = brandProfiles.filter((b) => b.status === 'active')
  const draftBrandProfiles  = brandProfiles.filter((b) => b.status === 'draft')

  const sortedActiveChars = [...activeCharProfiles].sort((a, b) => {
    const aLocked = isProfileMuted(a) ? 1 : 0
    const bLocked = isProfileMuted(b) ? 1 : 0
    return aLocked - bLocked
  })
  const filteredActiveChars  = charSearch
    ? sortedActiveChars.filter((p) => q(p.name).includes(q(charSearch)) || q(p.nationality).includes(q(charSearch)))
    : sortedActiveChars
  const filteredDraftChars   = charSearch
    ? draftCharProfiles.filter((p) => q(p.name).includes(q(charSearch)) || q(p.nationality).includes(q(charSearch)))
    : draftCharProfiles
  const sortedActiveBrands = [...activeBrandProfiles].sort((a, b) => {
    const aLocked = isBrandMuted(a) ? 1 : 0
    const bLocked = isBrandMuted(b) ? 1 : 0
    return aLocked - bLocked
  })
  const filteredActiveBrands = brandSearch
    ? sortedActiveBrands.filter((b) => q(b.brand_name).includes(q(brandSearch)) || q(b.tagline).includes(q(brandSearch)))
    : sortedActiveBrands
  const filteredDraftBrands  = brandSearch
    ? draftBrandProfiles.filter((b) => q(b.brand_name).includes(q(brandSearch)) || q(b.tagline).includes(q(brandSearch)))
    : draftBrandProfiles
  const sortedVoices = [...voices].sort((a, b) => {
    const aLocked = isVoiceMuted(a) ? 1 : 0
    const bLocked = isVoiceMuted(b) ? 1 : 0
    return aLocked - bLocked
  })
  const filteredVoices = voiceSearch
    ? sortedVoices.filter((v) => q(v.name).includes(q(voiceSearch)))
    : sortedVoices

  const currentTabLabel = { characters: 'Your Characters', voices: 'Voice Studio', brands: 'Your Brands' }[ugcTab] || ''

  // ── Sticky footer visibility ──────────────────────────────
  const showCharFooter  = ugcTab === 'characters' && !charLoading  && charProfiles.length  > 0 && (isMaster || !noviceAtCharLimit)
  const showBrandFooter = ugcTab === 'brands'     && !brandLoading && brandProfiles.length > 0 && (isMaster || !noviceAtBrandLimit)
  const showVoiceFooter = ugcTab === 'voices' && voiceMode === 'tts' && voices.length > 0

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      <TopBar showLogo showCredits showBack onBack={() => navigate('/create')} />

      {/* Tab switcher */}
      <div className="flex-shrink-0 flex gap-1 mx-4 lg:mx-8 p-1 rounded-2xl mt-3 mb-1" style={{ background: 'var(--bg-elevated)' }}>
        {[
          { value: 'characters', label: 'Characters' },
          { value: 'voices',     label: 'Voices'     },
          { value: 'brands',     label: 'Brands'     },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => handleSetTab(t.value)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all duration-200"
            style={{
              background: ugcTab === t.value ? 'var(--bg-card)'      : 'transparent',
              color:      ugcTab === t.value ? 'var(--text-primary)'  : 'var(--text-muted)',
              boxShadow:  ugcTab === t.value ? 'var(--shadow)'        : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6">

          {/* ── Characters Tab ───────────────────────────────── */}
          {ugcTab === 'characters' && (
            <>
              {!canCreateChar && !charLoading && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-2xl mb-5"
                  style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                >
                  <Zap size={16} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} fill="currentColor" />
                  <div>
                    <p className="text-xs font-bold" style={{ color: ACCENT }}>{CHARACTER_CREDIT_COST} credits required</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      You need at least {CHARACTER_CREDIT_COST} credits to create a new UGC character.{' '}
                      <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Top up</button>
                    </p>
                  </div>
                </motion.div>
              )}

              {charLoading ? (
                <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
              ) : (
                <>
                  {activeCharProfiles.length > 0 && (
                    <div className="mb-6">
                      <SearchBar
                        value={charSearch}
                        onChange={(e) => setCharSearch(e.target.value)}
                        onClear={() => setCharSearch('')}
                        placeholder="Search characters…"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        {filteredActiveChars.map((p, i) => (
                          <ProfileCard
                            key={p.id} profile={p} index={i}
                            onSelect={handleSelectProfile} onArchive={handleArchiveChar} onEdit={handleEditChar}
                            muted={isProfileMuted(p)} onMutedClick={handleMutedCharClick}
                          />
                        ))}
                      </div>
                      {filteredActiveChars.length === 0 && charSearch && (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No characters match "{charSearch}"</p>
                      )}
                      {!isMaster && activeCharProfiles.length >= 1 && (
                        <div className="mt-4 flex items-start gap-3 p-3 rounded-2xl" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                          <Crown size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Novice plan supports 1 active character.{' '}
                            <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Upgrade to Master</button>{' '}
                            to create and use more.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {draftCharProfiles.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Drafts</p>
                      <div className="grid grid-cols-2 gap-3">
                        {filteredDraftChars.map((p, i) => (
                          <ProfileCard key={p.id} profile={p} index={i} onSelect={handleSelectProfile} onArchive={handleArchiveChar} onEdit={handleEditChar} />
                        ))}
                      </div>
                    </div>
                  )}
                  {charProfiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-5">
                      <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                        <User size={36} style={{ color: ACCENT, opacity: 0.6 }} />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No characters yet</p>
                        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>Create your first UGC character to start generating hyper-realistic content.</p>
                      </div>
                      <button
                        onClick={handleCreateNewChar} disabled={!canCreateChar}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                        style={{ background: canCreateChar ? ACCENT : 'var(--bg-elevated)', color: canCreateChar ? '#ffffff' : 'var(--text-muted)', border: canCreateChar ? 'none' : '1px solid var(--border-color)' }}
                      >
                        <Plus size={16} /> Create Character
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Voices Tab ───────────────────────────────────── */}
          {ugcTab === 'voices' && (
            <>
              {voiceMode === null ? (
                <VoiceModeGate
                  onSelectTTS={() => {
                    setVoiceMode('tts')
                    // Lazy-load voices only when TTS mode is first entered
                    if (!voicesLoaded && user) loadVoices()
                  }}
                  onSelectSTT={() => navigate('/create/ugc/voices/stt')}
                />
              ) : voicesLoading ? (
                <div className="flex flex-col gap-3">
                  {[...Array(3)].map((_, i) => <VoiceSkeletonRow key={i} />)}
                </div>
              ) : voices.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 gap-5 text-center"
                >
                  <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                    <Mic size={36} style={{ color: ACCENT, opacity: 0.6 }} />
                  </div>
                  <div>
                    <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No voices yet</p>
                    <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>Add a voice from our library or clone your own.</p>
                  </div>
                  <button
                    onClick={() => setShowAddVoice(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                    style={{ background: ACCENT, color: '#ffffff' }}
                  >
                    <Plus size={16} /> Add Voice
                  </button>
                </motion.div>
              ) : (
                <div className="flex flex-col gap-3 mb-5">
                  <SearchBar
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    onClear={() => setVoiceSearch('')}
                    placeholder="Search voices…"
                  />
                  {filteredVoices.length === 0 ? (
                    <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No voices match "{voiceSearch}"</p>
                  ) : (
                    filteredVoices.map((voice, i) => (
                      <SavedVoiceRow
                        key={voice.id}
                        voice={voice}
                        index={i}
                        onSelect={handleSelectVoice}
                        onArchive={handleArchiveVoice}
                        playing={voicePlaying}
                        loading={voicePreviewLoading}
                        onPlay={handlePlayVoice}
                        muted={isVoiceMuted(voice)}
                        onMutedClick={() => toast.error('Cloned voices are Master-only. Upgrade to use this voice.')}
                      />
                    ))
                  )}
                  {hasMutedVoices && (
                    <div className="flex items-start gap-2.5 p-3 rounded-2xl mt-1" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                      <Crown size={14} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        Your cloned voices are muted on the Novice tier. Upgrade to Master to unlock all of your cloned voices.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Brands Tab ───────────────────────────────────── */}
          {ugcTab === 'brands' && (
            <>
              {!canCreateBrand && !brandLoading && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-2xl mb-5"
                  style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                >
                  <Zap size={16} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} fill="currentColor" />
                  <div>
                    <p className="text-xs font-bold" style={{ color: ACCENT }}>{BRAND_CREDIT_COST} credits required</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      You need at least {BRAND_CREDIT_COST} credits to create a brand profile.{' '}
                      <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Top up</button>
                    </p>
                  </div>
                </motion.div>
              )}
              {brandLoading ? (
                <div className="grid grid-cols-2 gap-3">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
              ) : (
                <>
                  {activeBrandProfiles.length > 0 && (
                    <div className="mb-6">
                      <SearchBar
                        value={brandSearch}
                        onChange={(e) => setBrandSearch(e.target.value)}
                        onClear={() => setBrandSearch('')}
                        placeholder="Search brands…"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        {filteredActiveBrands.map((b, i) => (
                          <BrandCard
                            key={b.id} brand={b} index={i}
                            onSelect={handleSelectBrand} onArchive={handleArchiveBrand} onEdit={handleEditBrand}
                            muted={isBrandMuted(b)} onMutedClick={handleMutedBrandClick}
                          />
                        ))}
                      </div>
                      {filteredActiveBrands.length === 0 && brandSearch && (
                        <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No brands match "{brandSearch}"</p>
                      )}
                      {!isMaster && activeBrandProfiles.length >= 1 && (
                        <div className="mt-4 flex items-start gap-3 p-3 rounded-2xl" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                          <Crown size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Novice plan supports 1 active brand.{' '}
                            <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Upgrade to Master</button>{' '}
                            to create and use more.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {draftBrandProfiles.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Brand Drafts</p>
                      <div className="grid grid-cols-2 gap-3">
                        {filteredDraftBrands.map((b, i) => (
                          <BrandCard key={b.id} brand={b} index={i} onSelect={handleSelectBrand} onArchive={handleArchiveBrand} onEdit={handleEditBrand} />
                        ))}
                      </div>
                    </div>
                  )}
                  {brandProfiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-5">
                      <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                        <Building2 size={36} style={{ color: ACCENT, opacity: 0.6 }} />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No brands yet</p>
                        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>Set up your brand profile and let the AI generate premium, on-brand content for you.</p>
                      </div>
                      <button
                        onClick={handleCreateNewBrand} disabled={!canCreateBrand}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                        style={{ background: canCreateBrand ? ACCENT : 'var(--bg-elevated)', color: canCreateBrand ? '#ffffff' : 'var(--text-muted)', border: canCreateBrand ? 'none' : '1px solid var(--border-color)' }}
                      >
                        <Plus size={16} /> Create Brand
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </div>

      {/* Sticky footer — unified CTA style across all tabs */}
      {(showCharFooter || showBrandFooter || showVoiceFooter) && (
        <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
          <div className="mx-auto w-full max-w-xl">
            {showCharFooter && (
              <button
                onClick={handleCreateNewChar}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: ACCENT, color: '#ffffff' }}
              >
                <Plus size={15} /> New Character
              </button>
            )}
            {showBrandFooter && (
              <button
                onClick={handleCreateNewBrand}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: ACCENT, color: '#ffffff' }}
              >
                <Plus size={15} /> New Brand
              </button>
            )}
            {showVoiceFooter && (
              <button
                onClick={() => setShowAddVoice(true)}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: ACCENT, color: '#ffffff' }}
              >
                <Plus size={15} /> Add Voice
              </button>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {showAddVoice && (
          <AddVoiceSheet
            onClose={() => setShowAddVoice(false)}
            onSave={handleSaveVoice}
            userId={user?.id}
            credits={credits}
            isMaster={isMaster}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
