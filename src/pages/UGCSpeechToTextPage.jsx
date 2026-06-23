import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, Mic, Upload, Play, Pause, Download,
  Trash2, Loader2, MoreHorizontal, FileText, Copy, Crown, Pencil, Check, X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ugcAudioGenerations, ugcAudioChunks,
  calcTranscriptionCredits, isTranscriptionFree,
} from '@/lib/ugcVoices'
import { useVoiceChunker } from '@/hooks/useVoiceChunker'
import VoiceRecorder from '@/components/ugc/VoiceRecorder'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const POLL_MS   = 3000
const PAGE_SIZE = 20

// ── Get audio duration from a File/Blob ─────────────────────────
function getAudioDuration(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url   = URL.createObjectURL(fileOrBlob)
    const audio = new Audio()
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(audio.duration) }
    audio.onerror          = () => { URL.revokeObjectURL(url); reject(new Error('Could not read audio duration')) }
    audio.src = url
  })
}

// ── Upload a File/Blob to storage, return public URL ─────────────
async function uploadAudioToStorage(userId, fileOrBlob, name = 'recording.webm') {
  const ext  = (name.split('.').pop() || 'webm').toLowerCase()
  const path = `${userId}/stt/${crypto.randomUUID()}.${ext}`
  const { data, error } = await supabase.storage
    .from('ugc-profiles')
    .upload(path, fileOrBlob, {
      contentType:  fileOrBlob.type || 'audio/webm',
      upsert:       false,
      cacheControl: '3600',
    })
  if (error) throw new Error(error.message || 'Upload failed')
  const { data: { publicUrl } } = supabase.storage.from('ugc-profiles').getPublicUrl(data.path)
  return publicUrl
}

// ── Audio player hook (single shared instance) ────────────────────
function useAudioPlayer() {
  const audioRef = useRef(null)
  const [playing, setPlaying]   = useState(null)
  const [progress, setProgress] = useState({})

  const toggle = (id, url) => {
    if (audioRef.current) {
      audioRef.current.pause()
      if (playing === id) { setPlaying(null); audioRef.current = null; return }
    }
    if (!url) return
    const audio = new Audio(url)
    audio.ontimeupdate = () => {
      setProgress((p) => ({ ...p, [id]: audio.duration ? audio.currentTime / audio.duration : 0 }))
    }
    audio.onended = () => { setPlaying(null); audioRef.current = null }
    audio.play()
    audioRef.current = audio
    setPlaying(id)
  }

  useEffect(() => () => audioRef.current?.pause(), [])
  return { playing, progress, toggle }
}

// ── Upload-or-record picker ───────────────────────────────────────
const SourcePicker = ({ mode, onModeChange, onFileUpload, recorderProps }) => (
  <div className="flex flex-col gap-4">
    <div className="flex gap-1 p-1 rounded-xl self-start" style={{ background: 'var(--bg-elevated)' }}>
      {[
        { value: 'record', label: 'Record', icon: Mic    },
        { value: 'upload', label: 'Upload',  icon: Upload },
      ].map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => onModeChange(value)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: mode === value ? ACCENT : 'transparent',
            color:      mode === value ? '#ffffff' : 'var(--text-muted)',
          }}
        >
          <Icon size={12} />{label}
        </button>
      ))}
    </div>

    {mode === 'record' && <VoiceRecorder {...recorderProps} />}

    {mode === 'upload' && (
      <label
        className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all py-8 gap-2"
        style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
      >
        <input type="file" accept="audio/*" className="hidden" onChange={onFileUpload} />
        <Upload size={24} style={{ color: ACCENT }} />
        <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload an audio file</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>MP3, WAV, M4A, WEBM</span>
      </label>
    )}
  </div>
)

// ── Inline rename widget ──────────────────────────────────────────
const InlineRename = ({ value, onSave, onCancel }) => {
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select() }, [])
  const commit = () => { const v = draft.trim(); if (v) onSave(v); else onCancel() }
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel() }}
        className="flex-1 min-w-0 text-xs font-semibold rounded-lg px-2 py-1 outline-none"
        style={{
          background: 'var(--bg-elevated)',
          color:      'var(--text-primary)',
          border:     `1px solid ${ACCENT_BDR}`,
        }}
      />
      <button onClick={commit} className="p-1 rounded-lg" style={{ color: ACCENT }}>
        <Check size={13} />
      </button>
      <button onClick={onCancel} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
        <X size={13} />
      </button>
    </div>
  )
}

// ── Saved recording card ───────────────────────────────────────────
const RecordingCard = ({
  gen, index, playing, progress,
  onToggle, onDelete, onDownload, onTranscribe, onRename,
  isChunking, isTranscribing, freeTier,
}) => {
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [renaming,   setRenaming]   = useState(false)

  const displayName    = gen.display_name || `Recording ${index + 1}`
  const isPlaying      = playing === gen.id
  const hasTranscript  = gen.transcript_status === 'completed' && gen.script
  const transcriptFailed = gen.transcript_status === 'failed'
  const transcribing   = gen.transcript_status === 'pending' || isTranscribing
  const transcribeCost = calcTranscriptionCredits(gen.duration_seconds)

  const handleCopy = () => {
    if (!gen.script) return
    navigator.clipboard.writeText(gen.script)
    toast.success('Transcript copied')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="p-4 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Name row */}
      <div className="flex items-center gap-2 mb-3">
        {renaming ? (
          <InlineRename
            value={displayName}
            onSave={(v) => { onRename(gen, v); setRenaming(false) }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <span
              className="text-xs font-semibold flex-1 truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {displayName}
            </span>
            <button
              onClick={() => setRenaming(true)}
              className="p-1 rounded-lg flex-shrink-0 transition-opacity opacity-50 hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
            >
              <Pencil size={11} />
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => onToggle(gen.id, gen.output_url)}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
          style={{ background: isPlaying ? ACCENT : ACCENT_SUB }}
        >
          {isPlaying
            ? <Pause size={15} style={{ color: '#fff' }} fill="currentColor" />
            : <Play  size={15} style={{ color: ACCENT }} fill="currentColor" />
          }
        </button>

        <div className="flex-1">
          <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--bg-elevated)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: ACCENT }}
              animate={{ width: isPlaying ? `${(progress[gen.id] || 0) * 100}%` : '0%' }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isChunking
                ? 'Slicing into parts…'
                : gen.duration_seconds
                  ? `${Math.round(gen.duration_seconds)}s · ${gen.chunk_count ?? 0} parts`
                  : ''}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(gen.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {isChunking && <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: ACCENT }} />}

        {!isChunking && (
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              <MoreHorizontal size={15} />
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
                    className="absolute right-0 bottom-9 z-50 rounded-xl overflow-hidden"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 140 }}
                  >
                    <button
                      onClick={() => { setRenaming(true); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Pencil size={12} /> Rename
                    </button>
                    <div style={{ height: 1, background: 'var(--border-color)', margin: '0 8px' }} />
                    <button
                      onClick={() => { onDownload(gen); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Download size={12} /> Download
                    </button>
                    <div style={{ height: 1, background: 'var(--border-color)', margin: '0 8px' }} />
                    <button
                      onClick={() => { onDelete(gen); setMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                      style={{ color: '#ef4444' }}
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Transcript section */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
        {hasTranscript ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
              {gen.script}
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              <Copy size={11} /> Copy transcript
            </button>
          </div>
        ) : (
          <button
            onClick={() => onTranscribe(gen)}
            disabled={transcribing}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
            style={{
              background: transcribing ? 'var(--bg-elevated)' : ACCENT_SUB,
              color:      transcribing ? 'var(--text-muted)'  : ACCENT,
              border:     `1px solid ${ACCENT_BDR}`,
            }}
          >
            {transcribing
              ? <><Loader2 size={12} className="animate-spin" /> Transcribing…</>
              : <>
                  <FileText size={12} />
                  {transcriptFailed ? 'Retry transcript' : 'Get transcript'}
                  {' · '}
                  {freeTier
                    ? <span className="flex items-center gap-1"><Crown size={10} />Free</span>
                    : `${transcribeCost} cr`
                  }
                </>
            }
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function UGCSpeechToTextPage() {
  const navigate                                   = useNavigate()
  const { user, credits, profile, refreshProfile } = useAuth()
  const isMaster = profile?.user_tier === 'master'

  const [sourceMode,   setSourceMode]  = useState('record') // 'record' | 'upload'
  const [pendingFile,  setPendingFile] = useState(null)     // { file, url, name, duration }
  const [pendingName,  setPendingName] = useState('')
  const [saving,       setSaving]      = useState(false)

  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page,    setPage]    = useState(0)

  const [chunkingIds,     setChunkingIds]     = useState(new Set())
  const [transcribingIds, setTranscribingIds] = useState(new Set())
  const chunkedThisSession = useRef(new Set())

  const { playing, progress, toggle } = useAudioPlayer()
  const { chunkAndStore }             = useVoiceChunker()
  const pollRef = useRef(null)

  useEffect(() => { loadItems(0, true) }, [user])

  // ── Build default name for next recording ──────────────────────
  const nextDefaultName = (existingItems) => {
    const nums = existingItems
      .map((g) => g.display_name)
      .filter(Boolean)
      .map((n) => { const m = n.match(/^Recording (\d+)$/i); return m ? parseInt(m[1], 10) : null })
      .filter((n) => n !== null)
    const max = nums.length ? Math.max(...nums) : 0
    return `Recording ${max + 1}`
  }

  const loadItems = async (offset = 0, reset = false) => {
    if (!user) return
    if (offset === 0) setLoading(true)
    const { data, count } = await ugcAudioGenerations.getSttRecordings(user.id, { limit: PAGE_SIZE, offset })
    const rows = data || []
    setItems((prev) => {
      const next = reset ? rows : [...prev, ...rows]
      return next
    })
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
  }

  // ── Chunk a freshly-saved recording ──────────────────────────────
  const maybeChunk = async (gen) => {
    if (!gen.output_url || (gen.chunk_count > 0) || chunkedThisSession.current.has(gen.id)) return
    chunkedThisSession.current.add(gen.id)
    setChunkingIds((prev) => new Set(prev).add(gen.id))

    const { chunks, error } = await chunkAndStore(gen, gen.output_url, user.id)

    setChunkingIds((prev) => { const next = new Set(prev); next.delete(gen.id); return next })

    if (error) {
      console.error('[STT] chunking failed:', error)
      toast.error('Could not slice audio into parts. The full audio is still available.', { duration: 4000 })
      return
    }
    setItems((prev) => prev.map((g) => g.id === gen.id ? { ...g, chunk_count: chunks.length } : g))
  }

  // ── Recording / upload handlers ──────────────────────────────────
  const handleRecordingReady = (file) => {
    const defaultName = nextDefaultName(items)
    setPendingFile({ file, url: URL.createObjectURL(file), name: file.name })
    setPendingName(defaultName)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const defaultName = nextDefaultName(items)
    // Use the file's own name (without extension) as initial suggestion
    const baseName = file.name.replace(/\.[^.]+$/, '') || defaultName
    setPendingFile({ file, url: URL.createObjectURL(file), name: file.name })
    setPendingName(baseName)
    e.target.value = ''
  }

  const handleSaveToLibrary = async () => {
    if (!pendingFile || !user) return
    setSaving(true)
    const displayName = pendingName.trim() || nextDefaultName(items)
    try {
      let durationS = null
      try { durationS = await getAudioDuration(pendingFile.file) } catch {}

      const publicUrl = await uploadAudioToStorage(user.id, pendingFile.file, pendingFile.name)

      const { data: genRow, error: genErr } = await ugcAudioGenerations.create({
        user_id:          user.id,
        voice_id:         null,
        source_type:      'stt',
        status:           'completed',
        output_url:       publicUrl,
        duration_seconds: durationS != null ? Math.round(durationS) : null,
        character_count:  0,
        credits_charged:  0,
        transcript_status: 'none',
        display_name:     displayName,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not save recording')

      setItems((prev) => [{ ...genRow, chunk_count: 0 }, ...prev])
      setPendingFile(null)
      setPendingName('')
      toast.success('Saved to your voice library')

      maybeChunk(genRow)
    } catch (err) {
      toast.error(err.message || 'Could not save recording')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (pendingFile?.url) URL.revokeObjectURL(pendingFile.url)
    setPendingFile(null)
    setPendingName('')
  }

  // ── Rename ───────────────────────────────────────────────────────
  const handleRename = async (gen, newName) => {
    try {
      await ugcAudioGenerations.update(gen.id, { display_name: newName })
      setItems((prev) => prev.map((g) => g.id === gen.id ? { ...g, display_name: newName } : g))
    } catch {
      toast.error('Could not rename')
    }
  }

  // ── Transcription ────────────────────────────────────────────────
  const handleTranscribe = async (gen) => {
    if (!user) return toast.error('Please sign in')
    const cost = calcTranscriptionCredits(gen.duration_seconds)
    const free = isTranscriptionFree(profile?.user_tier)

    if (!free && credits < cost) {
      toast.error('Not enough credits for transcription')
      return
    }

    setTranscribingIds((prev) => new Set(prev).add(gen.id))
    try {
      await ugcAudioGenerations.update(gen.id, { transcript_status: 'pending' })
      setItems((prev) => prev.map((g) => g.id === gen.id ? { ...g, transcript_status: 'pending' } : g))

      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { generationId: gen.id },
      })
      if (error || !data?.success) throw new Error(error?.message || data?.error || 'Transcription failed')

      refreshProfile()
      setItems((prev) => prev.map((g) => g.id === gen.id
        ? { ...g, transcript_status: 'completed', script: data.transcript }
        : g))
      toast.success('Transcript ready')
    } catch (err) {
      await ugcAudioGenerations.update(gen.id, { transcript_status: 'failed' })
      setItems((prev) => prev.map((g) => g.id === gen.id ? { ...g, transcript_status: 'failed' } : g))
      toast.error(err.message || 'Transcription failed')
    } finally {
      setTranscribingIds((prev) => { const next = new Set(prev); next.delete(gen.id); return next })
    }
  }

  // ── Delete / download ────────────────────────────────────────────
  const handleDelete = async (gen) => {
    try {
      const { data: chunks } = await ugcAudioChunks.getByGeneration(gen.id)
      if (chunks?.length) {
        const paths = chunks.map((c) => c.storage_path)
        await supabase.storage.from('ugc-profiles').remove(paths)
      }
      await ugcAudioChunks.deleteByGeneration(gen.id)
      await ugcAudioGenerations.delete(gen.id)
      setItems((prev) => prev.filter((g) => g.id !== gen.id))
      toast.success('Deleted')
    } catch {
      toast.error('Could not delete')
    }
  }

  const handleDownload = async (gen) => {
    if (!gen.output_url) return
    try {
      const res  = await fetch(gen.output_url)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${gen.display_name || 'recording'}-${gen.id.slice(0, 8)}.wav`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button onClick={() => navigate('/create/ugc/voices')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Speech to Text</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Record · Upload · Transcribe</span>
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
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* Capture / pending preview */}
          {!pendingFile ? (
            <SourcePicker
              mode={sourceMode}
              onModeChange={setSourceMode}
              onFileUpload={handleFileUpload}
              recorderProps={{ hideTellMe: true, onRecordingReady: handleRecordingReady }}
            />
          ) : (
            <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_BDR}` }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ready to save</p>

              {/* Filename input */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Name</label>
                <input
                  type="text"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  placeholder="Recording name…"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    color:      'var(--text-primary)',
                    border:     `1px solid ${ACCENT_BDR}`,
                  }}
                />
              </div>

              <audio src={pendingFile.url} controls className="w-full" />

              <div className="flex gap-2">
                <button
                  onClick={handleSaveToLibrary}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                  style={{ background: ACCENT, color: '#fff', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Save to library
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={saving}
                  className="px-4 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Saved recordings list */}
          {!loading && items.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Your Recordings
              </p>
              <div className="flex flex-col gap-3">
                {items.map((gen, i) => (
                  <RecordingCard
                    key={gen.id}
                    gen={gen}
                    index={i}
                    playing={playing}
                    progress={progress}
                    onToggle={toggle}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    onTranscribe={handleTranscribe}
                    onRename={handleRename}
                    isChunking={chunkingIds.has(gen.id)}
                    isTranscribing={transcribingIds.has(gen.id)}
                    freeTier={isMaster}
                  />
                ))}
              </div>
              {hasMore && (
                <button
                  onClick={() => { const next = page + 1; setPage(next); loadItems(next * PAGE_SIZE) }}
                  className="w-full mt-4 py-3 rounded-2xl text-sm font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                >
                  Load more
                </button>
              )}
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
              Recordings you save will appear here, ready to use on Talking Head or Text extraction.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
