// src/pages/UGCVoiceGeneratePage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, Mic, Play, Pause, Download,
  Trash2, Loader2, MoreHorizontal, Lock, Crown,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcVoices, ugcAudioGenerations, ugcAudioChunks, calcTTSCredits, ELEVENLABS_MODELS } from '@/lib/ugcVoices'
import { useVoiceChunker } from '@/hooks/useVoiceChunker'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const POLL_MS   = 3000
const PAGE_SIZE = 20

// ── Audio player hook ─────────────────────────────────────────
function useAudioPlayer() {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(null)
  const [progress, setProgress] = useState({})

  const toggle = (genId, url) => {
    if (audioRef.current) {
      audioRef.current.pause()
      if (playing === genId) { setPlaying(null); audioRef.current = null; return }
    }
    const audio = new Audio(url)
    audio.ontimeupdate = () => {
      setProgress((p) => ({
        ...p,
        [genId]: audio.duration ? audio.currentTime / audio.duration : 0,
      }))
    }
    audio.onended = () => { setPlaying(null); audioRef.current = null }
    audio.play()
    audioRef.current = audio
    setPlaying(genId)
  }

  useEffect(() => () => audioRef.current?.pause(), [])
  return { playing, progress, toggle }
}

// ── Audio generation card ─────────────────────────────────────
const AudioCard = ({ gen, index, playing, progress, onToggle, onDelete, onDownload, isChunking }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const isPlaying   = playing === gen.id
  const isPending   = gen.status === 'pending' || gen.status === 'processing'
  const isCompleted = gen.status === 'completed'
  const isFailed    = gen.status === 'failed'
  const pct         = progress[gen.id] || 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="p-4 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <p className="text-sm font-medium mb-3 line-clamp-2" style={{ color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {gen.refined_script || gen.script}
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => isCompleted && onToggle(gen.id, gen.output_url)}
          disabled={!isCompleted}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95"
          style={{ background: isPlaying ? ACCENT : ACCENT_SUB, opacity: isCompleted ? 1 : 0.5 }}
        >
          {isPending
            ? <Loader2 size={15} style={{ color: ACCENT }} className="animate-spin" />
            : isPlaying
              ? <Pause size={15} style={{ color: '#fff' }} fill="currentColor" />
              : <Play  size={15} style={{ color: ACCENT }} fill="currentColor" />
          }
        </button>

        <div className="flex-1">
          <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--bg-elevated)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: ACCENT }}
              animate={{ width: isPlaying ? `${pct * 100}%` : '0%' }}
              transition={{ duration: 0.2 }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {isPending
                ? 'Generating…'
                : isChunking
                  ? 'Slicing into parts…'
                  : isFailed
                    ? 'Failed'
                    : gen.duration_seconds
                      ? `${gen.duration_seconds}s · ${gen.chunk_count ?? 0} parts`
                      : ''}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ⚡ {gen.credits_charged} cr
            </span>
          </div>
        </div>

        {isChunking && (
          <Loader2
            size={14}
            className="animate-spin flex-shrink-0"
            style={{ color: ACCENT }}
          />
        )}

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
                      background: 'var(--bg-card)',
                      border:     '1px solid var(--border-color)',
                      boxShadow:  '0 8px 24px rgba(0,0,0,0.3)',
                      minWidth:   130,
                    }}
                  >
                    {isCompleted && (
                      <>
                        <button
                          onClick={() => { onDownload(gen); setMenuOpen(false) }}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <Download size={12} /> Download
                        </button>
                        <div style={{ height: 1, background: 'var(--border-color)', margin: '0 8px' }} />
                      </>
                    )}
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
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function UGCVoiceGeneratePage() {
  const { voiceId }                                             = useParams()
  const navigate                                                = useNavigate()
  const { user, credits, refreshProfile, profile: authProfile } = useAuth()
  const isMaster = authProfile?.user_tier === 'master'

  const [voice,        setVoice]        = useState(null)
  const [voiceLoading, setVoiceLoading] = useState(true)
  const [items,        setItems]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [hasMore,      setHasMore]      = useState(false)
  const [page,         setPage]         = useState(0)
  const [script,       setScript]       = useState('')
  const [model,        setModel]        = useState('eleven_multilingual_v2')
  const [stability,    setStability]    = useState(0.5)
  const [similarity,   setSimilarity]   = useState(0.75)
  const [submitting,   setSubmitting]   = useState(false)

  const [chunkingIds, setChunkingIds] = useState(new Set())
  const chunkedThisSession = useRef(new Set())

  const { playing, progress, toggle } = useAudioPlayer()
  const { chunkAndStore }             = useVoiceChunker()
  const pollRef    = useRef(null)
  const textareaRef = useRef(null)

  const creditCost   = calcTTSCredits(script)
  const canAfford    = credits >= creditCost
  const isVoiceMuted = !!voice && !isMaster && voice.source !== 'elevenlabs_library'
  const isClonedVoice = !!voice && voice.source !== 'elevenlabs_library'
  const canGenerate  = script.trim().length > 0 && canAfford && !submitting && !isVoiceMuted

  // Shorten voice name to first word only
  const shortName = voice?.name?.split(/[\s\-–]/)[0] ?? ''

  useEffect(() => {
    loadVoice()
    loadItems(0, true)
  }, [voiceId])

  const loadVoice = async () => {
    setVoiceLoading(true)
    const { data, error } = await ugcVoices.getById(voiceId)
    if (error || !data) {
      toast.error('Voice not found')
      navigate('/create/ugc/voices')
      return
    }
    setVoice(data)
    setVoiceLoading(false)
  }

  const loadItems = async (offset = 0, reset = false) => {
    if (!user) return
    if (offset === 0) setLoading(true)
    const { data, count } = await ugcAudioGenerations.getByVoice(voiceId, { limit: PAGE_SIZE, offset })
    setItems((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
  }

  const maybeChunk = async (gen) => {
    if (
      gen.status !== 'completed'   ||
      !gen.output_url              ||
      (gen.chunk_count > 0)        ||
      chunkedThisSession.current.has(gen.id)
    ) return

    chunkedThisSession.current.add(gen.id)
    setChunkingIds((prev) => new Set(prev).add(gen.id))

    const { chunks, error } = await chunkAndStore(gen, gen.output_url, user.id)

    setChunkingIds((prev) => {
      const next = new Set(prev)
      next.delete(gen.id)
      return next
    })

    if (error) {
      console.error('[VoiceGeneratePage] chunking failed:', error)
      toast.error('Could not slice audio into parts. The full audio is still available.', { duration: 4000 })
      return
    }

    setItems((prev) =>
      prev.map((g) => g.id === gen.id ? { ...g, chunk_count: chunks.length } : g)
    )
  }

  useEffect(() => {
    const hasPending = items.some((g) => g.status === 'pending' || g.status === 'processing')
    if (hasPending) {
      pollRef.current = setInterval(async () => {
        if (!user) return
        const { data } = await ugcAudioGenerations.getByVoice(voiceId, { limit: PAGE_SIZE, offset: 0 })
        if (data) {
          setItems((prev) => {
            const map = new Map(data.map((g) => [g.id, g]))
            return prev.map((g) => map.get(g.id) || g)
          })
          data.forEach((g) => maybeChunk(g))
        }
      }, POLL_MS)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [items, user, voiceId])

  const handleGenerate = async () => {
    if (isVoiceMuted)    return toast.error('Cloned voices are Master-only. Upgrade to use this voice.')
    if (!script.trim())  return toast.error('Write something to generate')
    if (!canAfford)      return toast.error('Not enough credits')
    if (!user)           return toast.error('Please sign in')

    setSubmitting(true)
    try {
      const { data: genRow, error: genErr } = await ugcAudioGenerations.create({
        user_id:             user.id,
        voice_id:            voiceId,
        elevenlabs_voice_id: voice.elevenlabs_voice_id,
        script:              script.trim(),
        model_id:            model,
        stability,
        similarity_boost:    similarity,
        style:               0.0,
        character_count:     script.trim().length,
        credits_charged:     creditCost,
        status:              'pending',
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await supabase.rpc('deduct_credits', {
        p_user_id:       user.id,
        p_amount:        creditCost,
        p_generation_id: null,
        p_description:   'Audio TTS — ' + script.trim().slice(0, 40),
      })
      if (dErr || !deduct?.success) {
        await ugcAudioGenerations.update(genRow.id, { status: 'failed', error_message: 'Insufficient credits' })
        throw new Error('Not enough credits')
      }

      supabase.functions.invoke('audio-generate', { body: { audioGenId: genRow.id } })
        .catch((e) => console.error('audio-generate invoke error', e))

      setItems((prev) => [{ ...genRow, chunk_count: 0 }, ...prev])
      refreshProfile()
      setScript('')
      toast.success('Generating audio…')

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (gen) => {
    try {
      const { data: chunks } = await ugcAudioChunks.getByGeneration(gen.id)
      if (chunks?.length) {
        const paths = chunks.map((c) => c.storage_path)
        await supabase.storage.from('ugc-profiles').remove(paths)
      }
      await ugcAudioChunks.deleteByGeneration(gen.id)
      await ugcAudioGenerations.delete(gen.id)
      const fullAudioPath = `${user.id}/audio/${gen.id}.mp3`
      await supabase.storage.from('generations').remove([fullAudioPath])
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
      a.download = `audio-${gen.id.slice(0, 8)}.mp3`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded')
    } catch {
      toast.error('Download failed')
    }
  }

  if (voiceLoading) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
        />
      </div>
    )
  }

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

        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: ACCENT_SUB, border: `2px solid ${ACCENT_BDR}` }}
          >
            <Mic size={14} style={{ color: ACCENT }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {shortName}
          </p>
        </div>

        {/* spacer to keep name centered */}
        <div style={{ width: 36 }} />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* Only show tier banners for cloned voices */}
          {isClonedVoice && (
            isVoiceMuted ? (
              <div
                className="flex items-start gap-2.5 p-3 rounded-2xl"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
              >
                <Lock size={14} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This cloned voice is muted on the Novice tier.{' '}
                  <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>
                    Upgrade to Master
                  </button>
                  {' '}to generate audio with it.
                </p>
              </div>
            ) : !isMaster && (
              <div
                className="flex items-start gap-2.5 p-3 rounded-2xl"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
              >
                <Crown size={14} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>
                    Upgrade to Master
                  </button>
                  {' '}to clone your own voice and use cloned voices for audio generation.
                </p>
              </div>
            )
          )}

          {/* Script input */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Script
            </p>
            <textarea
              ref={textareaRef}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Write your script for ${shortName}…`}
              rows={5}
              maxLength={5000}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border:     '1px solid var(--border-color)',
                color:      'var(--text-primary)',
                lineHeight: 1.6,
              }}
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {script.length} chars · {creditCost} cr
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {script.length}/5000
              </span>
            </div>
          </div>

          {/* Model selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-muted)' }}>
              Voice Model
            </p>
            <div className="flex gap-2">
              {ELEVENLABS_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className="flex-1 py-3 px-4 rounded-xl text-left transition-all"
                  style={{
                    background: model === m.id ? ACCENT_SUB : 'var(--bg-elevated)',
                    border:     `1px solid ${model === m.id ? ACCENT_BDR : 'var(--border-color)'}`,
                  }}
                >
                  <p className="text-sm font-semibold" style={{ color: model === m.id ? ACCENT : 'var(--text-primary)' }}>
                    {m.label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{m.sublabel}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Voice settings */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
              Voice Settings
            </p>
            {[
              { label: 'Stability',  value: stability,  onChange: setStability,  min: 0, max: 1, step: 0.05, left: 'Expressive', right: 'Stable'     },
              { label: 'Similarity', value: similarity, onChange: setSimilarity, min: 0, max: 1, step: 0.05, left: 'Natural',    right: 'Clone-like' },
            ].map((s) => (
              <div key={s.label} className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                  <span className="text-xs font-semibold" style={{ color: ACCENT }}>
                    {Math.round(s.value * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={s.min} max={s.max} step={s.step}
                  value={s.value}
                  onChange={(e) => s.onChange(parseFloat(e.target.value))}
                  className="w-full"
                  style={{ accentColor: ACCENT }}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.left}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.right}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Past generations */}
          {!loading && items.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Generated Audio
              </p>
              <div className="flex flex-col gap-3">
                {items.map((gen, i) => (
                  <AudioCard
                    key={gen.id}
                    gen={gen}
                    index={i}
                    playing={playing}
                    progress={progress}
                    onToggle={toggle}
                    onDelete={handleDelete}
                    onDownload={handleDownload}
                    isChunking={chunkingIds.has(gen.id)}
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

        </div>
      </div>

      {/* Generate button */}
      <div
        className="flex-shrink-0 px-4 lg:px-8 py-4"
        style={{ borderTop: `1px solid ${ACCENT_BDR}` }}
      >
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: canGenerate ? ACCENT : 'var(--bg-elevated)',
              color:      canGenerate ? '#fff'  : 'var(--text-muted)',
            }}
          >
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
              : <><Mic size={15} /> Generate · {creditCost} cr</>
            }
          </button>
          {!canAfford && script.trim() && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                Top up
              </button>
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
