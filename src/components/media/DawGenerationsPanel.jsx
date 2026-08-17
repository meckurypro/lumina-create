// src/components/media/DawGenerationsPanel.jsx
//
// DAW AI's tab on the Media page. Deliberately NOT built on top of
// MediaPageCore — that component assumes one output_url per row
// (`generations`), but a daw_generations row can have several
// variations, each with its own output. Lighter, purpose-built list
// instead: poll in-progress rows, click through to the result page
// for playback / mastering / stem export.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Music2, Loader2, CheckCircle2, XCircle, Clock, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

const ACCENT     = 'var(--tool-music, #a855f7)'
const ACCENT_SUB = 'var(--tool-music-subtle, rgba(168,85,247,0.12))'
const ACCENT_BDR = 'var(--tool-music-border, rgba(168,85,247,0.32))'

const PAGE_SIZE = 12
const POLL_MS   = 4_000

const STATUS_FILTERS = [
  { label: 'All',          value: 'all' },
  { label: 'Completed',    value: 'completed' },
  { label: 'In Progress',  value: 'in_progress' },
  { label: 'Failed',       value: 'failed' },
]

function isInProgress(g) { return g.status === 'pending' || g.status === 'processing' }

const STATUS_CONFIG = {
  completed:   { icon: CheckCircle2, tone: '#10b981', label: 'Completed' },
  failed:      { icon: XCircle,      tone: '#ef4444', label: 'Failed' },
  pending:     { icon: Clock,        tone: '#eab308', label: 'Queued' },
  processing:  { icon: Loader2,      tone: '#eab308', label: 'Generating' },
}

function DawGenerationCard({ gen, onClick }) {
  const cfg = STATUS_CONFIG[gen.status] || STATUS_CONFIG.pending
  const Icon = cfg.icon
  const date = new Date(gen.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const label = gen.prompt?.length > 60 ? gen.prompt.slice(0, 60) + '…' : gen.prompt

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all active:scale-[0.99]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: ACCENT_SUB }}>
        <Music2 size={18} style={{ color: ACCENT }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
          {label || (gen.mode === 'instrumental' ? 'Instrumental' : 'Untitled song')}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Icon size={11} style={{ color: cfg.tone }} className={gen.status === 'processing' ? 'animate-spin' : ''} />
          <span className="text-xs font-medium" style={{ color: cfg.tone }}>{cfg.label}</span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            · {gen.mode === 'song' ? 'Song' : 'Instrumental'} · {gen.variation_count}v · {date}
          </span>
        </div>
      </div>
      <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </motion.button>
  )
}

export default function DawGenerationsPanel() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [items,        setItems]        = useState([])
  const [loading,       setLoading]      = useState(true)
  const [loadingMore,   setLoadingMore]  = useState(false)
  const [hasMore,       setHasMore]      = useState(false)
  const [page,          setPage]         = useState(0)
  const [statusFilter,  setStatusFilter] = useState('all')

  const pollRef        = useRef(null)
  const prevPendingKey  = useRef('')

  const load = useCallback(async ({ offset = 0, reset = false } = {}) => {
    if (!user) return
    if (offset === 0) setLoading(true); else setLoadingMore(true)

    const { data, count } = await supabase
      .from('daw_generations')
      .select('id, mode, prompt, status, variation_count, error_message, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    setItems((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
  }, [user])

  useEffect(() => { setPage(0); load({ offset: 0, reset: true }) }, [load])

  // Poll in-progress rows, same pattern as MediaPageCore
  useEffect(() => {
    const pendingIds = items.filter(isInProgress).map((g) => g.id)
    const key = pendingIds.sort().join(',')
    if (key === prevPendingKey.current) return
    prevPendingKey.current = key

    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (!pendingIds.length) return

    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from('daw_generations')
        .select('id, status, error_message')
        .in('id', pendingIds)
      if (!data) return
      const map = new Map(data.map((g) => [g.id, g]))
      setItems((prev) => prev.map((g) => map.has(g.id) ? { ...g, ...map.get(g.id) } : g))
    }, POLL_MS)

    return () => { clearInterval(pollRef.current); pollRef.current = null }
  }, [items])

  const visibleItems = statusFilter === 'all'
    ? items
    : statusFilter === 'in_progress'
      ? items.filter(isInProgress)
      : items.filter((g) => g.status === statusFilter)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-5">

        <div className="flex gap-2 mb-4 flex-wrap justify-end">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: statusFilter === f.value ? ACCENT : 'var(--bg-elevated)',
                color:      statusFilter === f.value ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${statusFilter === f.value ? ACCENT_BDR : 'var(--border-color)'}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-full h-[70px] rounded-2xl" style={{ background: 'var(--bg-card)' }} />
            ))}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <Music2 size={36} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
            <div>
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No tracks yet</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Start creating in DAW AI.</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <AnimatePresence>
              {visibleItems.map((gen) => (
                <DawGenerationCard key={gen.id} gen={gen} onClick={() => navigate(`/daw/result/${gen.id}`)} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {hasMore && !loadingMore && visibleItems.length > 0 && (
          <button
            onClick={() => { const next = page + 1; setPage(next); load({ offset: next * PAGE_SIZE }) }}
            className="w-full mt-4 py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
          >
            Load more
          </button>
        )}

        {loadingMore && (
          <div className="flex justify-center py-5">
            <Loader2 size={20} className="animate-spin" style={{ color: ACCENT }} />
          </div>
        )}
      </div>
    </div>
  )
}
