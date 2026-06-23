import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, Mic, Upload, Play, Pause, Download,
  Trash2, Loader2, MoreHorizontal, FileText, Copy, Pencil, Check, X,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ugcAudioGenerations, ugcAudioChunks,
  calcTranscriptionCredits,
} from '@/lib/ugcVoices'
import { useVoiceChunker } from '@/hooks/useVoiceChunker'
import VoiceRecorder from '@/components/ugc/VoiceRecorder'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const PAGE_SIZE = 20

// Minimum credits charged when duration is unknown — prevents free transcription
const MIN_TRANSCRIPTION_CREDITS = 20

// ── Safe credit calculation — never returns 0 ─────────────────────
function safeTranscribeCost(durationSeconds) {
  const cost = calcTranscriptionCredits(durationSeconds)
  return cost > 0 ? cost : MIN_TRANSCRIPTION_CREDITS
}

// ── Get audio duration from a File/Blob ──────────────────────────
function getAudioDuration(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url   = URL.createObjectURL(fileOrBlob)
    const audio = new Audio()
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const d = audio.duration
      if (!d || !isFinite(d) || d <= 0) reject(new Error('Invalid duration'))
      else resolve(d)
    }
    audio.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read audio')) }
    audio.src = url
  })
}

// ── Upload a File/Blob to storage, return public URL ─────────────
async function uploadAudioToStorage(userId, fileOrBlob, name = 'recording.webm') {
  const blobType    = fileOrBlob?.type?.split(';')[0].trim() ?? ''
  const extFromName = (name.split('.').pop() ?? '').toLowerCase()
  const mimeToExt   = {
    'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
    'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/wave': 'wav',
    'audio/x-wav': 'wav', 'audio/flac': 'flac',
  }
  const ext = mimeToExt[blobType] || extFromName || 'webm'
  const contentType = blobType || ({
    webm: 'audio/webm', ogg: 'audio/ogg', m4a: 'audio/mp4',
    aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac',
  }[ext]) || 'application/octet-stream'

  const path = `${userId}/stt/${crypto.randomUUID()}.${ext}`
  const { data, error } = await supabase.storage
    .from('ugc-profiles')
    .upload(path, fileOrBlob, { contentType, upsert: false, cacheControl: '3600' })
  if (error) throw new Error(error.message || 'Upload failed')

  const { data: { publicUrl } } = supabase.storage.from('ugc-profiles').getPublicUrl(data.path)
  return publicUrl
}

// ── Audio player hook (single shared instance) ───────────────────
function useAudioPlayer() {
  const audioRef = useRef(null)
  const [playing, setPlaying]   = useState(null)
  const [progress, setProgress] = useState({})

  const toggle = useCallback((id, url) => {
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
    audio.play().catch(() => {}) // suppress autoplay warnings
    audioRef.current = audio
    setPlaying(id)
  }, [playing])

  useEffect(() => () => audioRef.current?.pause(), [])
  return { playing, progress, toggle }
}

// ── Supabase Realtime subscription for a single row ──────────────
// Returns a cleanup function. Calls onUpdate(newRow) when the row changes.
function subscribeToGeneration(genId, onUpdate) {
  const channel = supabase
    .channel(`stt-gen-${genId}`)
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'ugc_audio_generations',
        filter: `id=eq.${genId}`,
      },
      (payload) => { if (payload.new) onUpdate(payload.new) }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}

// ── Upload-or-record picker ──────────────────────────────────────
const SourcePicker = ({ mode, onModeChange, onFileUpload, recorderProps }) => (
  <div className="flex flex-col gap-4">
    <div className="flex gap-1 p-1 rounded-xl self-start" style={{ background: 'var(--bg-elevated)' }}>
      {[
        { value: 'record', label: 'Record', icon: Mic    },
        { value: 'upload', label: 'Upload', icon: Upload },
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

// ── Inline rename widget ─────────────────────────────────────────
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
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: `1px solid ${ACCENT_BDR}` }}
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

// ── Saved recording card ─────────────────────────────────────────
const RecordingCard = ({
  gen, index, playing, progress,
  onToggle, onDelete, onDownload, onTranscribe, onRename,
  isChunking, isTranscribing,
}) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const displayName      = gen.display_name || `Recording ${index + 1}`
  const isPlaying        = playing === gen.id
  const hasTranscript    = gen.transcript_status === 'completed' && gen.script
  const transcriptFailed = gen.transcript_status === 'failed'
  const transcribing     = gen.transcript_status === 'pending' || isTranscribing
  const durationUnknown  = !gen.duration_seconds
  const transcribeCost   = safeTranscribeCost(gen.duration_seconds)
  const costLabel        = durationUnknown ? `~${transcribeCost} cr` : `${transcribeCost} cr`

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
            <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
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
        {/* Play button */}
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

        {/* Progress bar + meta */}
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
                  : `${gen.chunk_count ?? 0} parts`
              }
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {new Date(gen.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {isChunking && <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: ACCENT }} />}

        {/* Context menu */}
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
                    style={{
                      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 140,
                    }}
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
              cursor:     transcribing ? 'not-allowed' : 'pointer',
            }}
          >
            {transcribing ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Transcribing… this may take a moment
              </>
            ) : (
              <>
                <FileText size={12} />
                {transcriptFailed ? 'Retry transcript' : 'Get transcript'}
                {' · '}
                <span style={{ opacity: 0.8 }}>{costLabel}</span>
                {durationUnknown && (
                  <AlertCircle size={11} style={{ opacity: 0.6 }} title="Duration unknown — estimated cost" />
                )}
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}

// ── Main page ────────────────────────────────────────────────────
export default function UGCSpeechToTextPage() {
  const navigate                                   = useNavigate()
  const { user, credits, refreshProfile }          = useAuth()

  const [sourceMode,  setSourceMode]  = useState('record')
  const [pendingFile, setPendingFile] = useState(null)
  const [pendingName, setPendingName] = useState('')
  const [saving,      setSaving]      = useState(false)

  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page,    setPage]    = useState(0)

  const [chunkingIds,     setChunkingIds]     = useState(new Set())
  const [transcribingIds, setTranscribingIds] = useState(new Set())

  // Track which IDs have active Realtime subscriptions so we don't double-subscribe
  const realtimeSubs   = useRef({})   // { [genId]: unsubscribeFn }
  const chunkedSession = useRef(new Set())

  const { playing, progress, toggle } = useAudioPlayer()
  const { chunkAndStore }             = useVoiceChunker()

  // ── Helpers ────────────────────────────────────────────────────
  const updateItem = useCallback((id, patch) => {
    setItems((prev) => prev.map((g) => g.id === id ? { ...g, ...patch } : g))
  }, [])

  const nextDefaultName = (existingItems) => {
    const nums = existingItems
      .map((g) => g.display_name)
      .filter(Boolean)
      .map((n) => { const m = n.match(/^Recording (\d+)$/i); return m ? parseInt(m[1], 10) : null })
      .filter((n) => n !== null)
    const max = nums.length ? Math.max(...nums) : 0
    return `Recording ${max + 1}`
  }

  // ── Load recordings ────────────────────────────────────────────
  const loadItems = useCallback(async (offset = 0, reset = false) => {
    if (!user) return
    if (offset === 0) setLoading(true)
    const { data, count } = await ugcAudioGenerations.getSttRecordings(user.id, { limit: PAGE_SIZE, offset })
    const rows = data || []
    setItems((prev) => reset ? rows : [...prev, ...rows])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
  }, [user])

  useEffect(() => { loadItems(0, true) }, [loadItems])

  // Cleanup all realtime subs on unmount
  useEffect(() => {
    return () => {
      Object.values(realtimeSubs.current).forEach((unsub) => unsub())
    }
  }, [])

  // ── Realtime: subscribe to a single generation's updates ───────
  const subscribeGen = useCallback((genId) => {
    if (realtimeSubs.current[genId]) return // already subscribed

    const unsub = subscribeToGeneration(genId, (newRow) => {
      updateItem(genId, newRow)

      // Transcript completed or failed — tear down the subscription and clear spinner
      if (newRow.transcript_status === 'completed') {
        setTranscribingIds((prev) => { const next = new Set(prev); next.delete(genId); return next })
        realtimeSubs.current[genId]?.()
        delete realtimeSubs.current[genId]
        refreshProfile() // sync credit balance in header
        toast.success('Transcript ready')
      } else if (newRow.transcript_status === 'failed') {
        setTranscribingIds((prev) => { const next = new Set(prev); next.delete(genId); return next })
        realtimeSubs.current[genId]?.()
        delete realtimeSubs.current[genId]
        toast.error(newRow.transcript_error || 'Transcription failed')
      }
    })

    realtimeSubs.current[genId] = unsub
  }, [updateItem, refreshProfile])

  // ── Re-subscribe for any items already in pending state on mount ─
  useEffect(() => {
    items.forEach((gen) => {
      if (gen.transcript_status === 'pending') {
        subscribeGen(gen.id)
        setTranscribingIds((prev) => new Set(prev).add(gen.id))
      }
    })
  // Only run when items first load (reset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // ── Chunk a freshly-saved recording ───────────────────────────
  const maybeChunk = useCallback(async (gen) => {
    if (!gen.output_url || gen.chunk_count > 0 || chunkedSession.current.has(gen.id)) return
    chunkedSession.current.add(gen.id)
    setChunkingIds((prev) => new Set(prev).add(gen.id))

    const { chunks, error } = await chunkAndStore(gen, gen.output_url, user.id)

    setChunkingIds((prev) => { const next = new Set(prev); next.delete(gen.id); return next })

    if (error) {
      console.error('[STT] chunking failed:', error)
      toast.error('Could not slice audio into parts. The full audio is still available.', { duration: 4000 })
      return
    }
    updateItem(gen.id, { chunk_count: chunks.length })
  }, [chunkAndStore, user, updateItem])

  // ── Recording / upload handlers ───────────────────────────────
  const handleRecordingReady = (file) => {
    setPendingFile({ file, url: URL.createObjectURL(file), name: file.name })
    setPendingName(nextDefaultName(items))
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const baseName = file.name.replace(/\.[^.]+$/, '') || nextDefaultName(items)
    setPendingFile({ file, url: URL.createObjectURL(file), name: file.name })
    setPendingName(baseName)
    e.target.value = ''
  }

  const handleSaveToLibrary = async () => {
    if (!pendingFile || !user) return
    setSaving(true)
    const displayName = pendingName.trim() || nextDefaultName(items)

    try {
      // Get duration — single attempt, clean error
      let durationS = null
      try {
        durationS = await getAudioDuration(pendingFile.file)
      } catch {
        // Duration unavailable — edge function will apply minimum credit charge
        console.warn('[STT] Could not read audio duration — will use minimum credit charge on transcription')
      }

      const publicUrl = await uploadAudioToStorage(user.id, pendingFile.file, pendingFile.name)

      const { data: genRow, error: genErr } = await ugcAudioGenerations.create({
        user_id:           user.id,
        voice_id:          null,
        source_type:       'stt',
        status:            'completed',
        output_url:        publicUrl,
        duration_seconds:  durationS !== null ? Math.round(durationS) : null,
        character_count:   0,
        credits_charged:   0,
        transcript_status: 'none',
        display_name:      displayName,
        script:            null,
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

  // ── Rename ────────────────────────────────────────────────────
  const handleRename = async (gen, newName) => {
    try {
      await ugcAudioGenerations.update(gen.id, { display_name: newName })
      updateItem(gen.id, { display_name: newName })
    } catch {
      toast.error('Could not rename')
    }
  }

  // ── Transcription ─────────────────────────────────────────────
  // Best practice:
  //   1. Validate credits client-side (UX guard — edge fn is the real enforcer)
  //   2. Optimistically set pending in local state
  //   3. Invoke edge function — it runs async via EdgeRuntime.waitUntil
  //   4. Subscribe to Realtime UPDATE on this row
  //   5. When DB row flips to completed/failed, Realtime fires → update UI + toast
  //   No polling. No loadItems() reset. Spinner clears exactly when transcript arrives.
  const handleTranscribe = async (gen) => {
    if (!user) return toast.error('Please sign in')

    const cost = safeTranscribeCost(gen.duration_seconds)

    if (credits < cost) {
      toast.error(`Not enough credits — this transcription costs ${cost} cr`)
      return
    }

    // Optimistic update
    setTranscribingIds((prev) => new Set(prev).add(gen.id))
    updateItem(gen.id, { transcript_status: 'pending' })

    // Subscribe to Realtime BEFORE invoking edge function — no race condition
    subscribeGen(gen.id)

    try {
      // Mark pending in DB (idempotent — edge fn also does this)
      await ugcAudioGenerations.update(gen.id, { transcript_status: 'pending' })

      const { data, error } = await supabase.functions.invoke('speech-to-text', {
        body: { generationId: gen.id },
      })

      // Edge fn returns 202 (fire-and-forget) or 200 (fast-path already completed).
      // A non-success response is a real error (auth, 404, 500).
      if (error) throw new Error(error.message || 'Could not reach transcription service')

   // Fast-path: edge fn returned transcript synchronously (already-completed row)
      if (data?.success && data?.transcript) {
        updateItem(gen.id, { transcript_status: 'completed', script: data.transcript })
        setTranscribingIds((prev) => { const next = new Set(prev); next.delete(gen.id); return next })
        realtimeSubs.current[gen.id]?.()
        delete realtimeSubs.current[gen.id]
        await refreshProfile()
        toast.success('Transcript ready')
        return
      }

      // Race guard — check DB once after invoke resolves.
      // The pipeline runs via EdgeRuntime.waitUntil and can write 'failed' or 'completed'
      // before the Realtime subscription is fully established. This catches that window.
      const { data: currentRow } = await supabase
        .from('ugc_audio_generations')
        .select('transcript_status, script, transcript_error')
        .eq('id', gen.id)
        .single()

      if (currentRow?.transcript_status === 'completed') {
        updateItem(gen.id, { transcript_status: 'completed', script: currentRow.script })
        setTranscribingIds((prev) => { const next = new Set(prev); next.delete(gen.id); return next })
        realtimeSubs.current[gen.id]?.()
        delete realtimeSubs.current[gen.id]
        await refreshProfile()
        toast.success('Transcript ready')
        return
      }

      if (currentRow?.transcript_status === 'failed') {
        updateItem(gen.id, { transcript_status: 'failed' })
        setTranscribingIds((prev) => { const next = new Set(prev); next.delete(gen.id); return next })
        realtimeSubs.current[gen.id]?.()
        delete realtimeSubs.current[gen.id]
        toast.error(currentRow.transcript_error || 'Transcription failed')
        return
      }

      // Still pending — Realtime subscription handles the rest.
      // Spinner stays until the DB row updates to completed or failed.

    } catch (err) {
      // Invoke itself failed — rollback
      updateItem(gen.id, { transcript_status: 'failed' })
      setTranscribingIds((prev) => { const next = new Set(prev); next.delete(gen.id); return next })
      realtimeSubs.current[gen.id]?.()
      delete realtimeSubs.current[gen.id]
      await ugcAudioGenerations.update(gen.id, { transcript_status: 'failed' }).catch(() => {})
      toast.error(err.message || 'Transcription failed')
    }
  }

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async (gen) => {
    // Tear down any live subscription for this gen
    realtimeSubs.current[gen.id]?.()
    delete realtimeSubs.current[gen.id]

    try {
      const { data: chunks } = await ugcAudioChunks.getByGeneration(gen.id)
      if (chunks?.length) {
        await supabase.storage.from('ugc-profiles').remove(chunks.map((c) => c.storage_path))
      }
      await ugcAudioChunks.deleteByGeneration(gen.id)
      await ugcAudioGenerations.delete(gen.id)
      setItems((prev) => prev.filter((g) => g.id !== gen.id))
      toast.success('Deleted')
    } catch {
      toast.error('Could not delete')
    }
  }

  // ── Download ──────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => navigate('/create/ugc/voices')}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
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
            <div
              className="flex flex-col gap-3 p-4 rounded-2xl"
              style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_BDR}` }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ready to save</p>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Name</label>
                <input
                  type="text"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  placeholder="Recording name…"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: `1px solid ${ACCENT_BDR}` }}
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
                  {saving && <Loader2 size={14} className="animate-spin" />}
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

          {/* Recordings list */}
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

          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
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
