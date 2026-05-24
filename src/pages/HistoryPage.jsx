// src/pages/HistoryPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Film, Image, ChevronRight } from 'lucide-react'
import { generations as generationsDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton, EmptyState } from '@/components/ui/Modal'

// ─── Status Badge ─────────────────────────────────────────

const STATUS_STYLES = {
  completed:  { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', label: 'Done'       },
  processing: { bg: 'rgba(234,179,8,0.1)',   color: '#eab308', label: 'Processing' },
  pending:    { bg: 'rgba(234,179,8,0.1)',   color: '#eab308', label: 'Pending'    },
  failed:     { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', label: 'Failed'     },
}

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.pending
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}

// ─── History Card ─────────────────────────────────────────

const HistoryCard = ({ gen, onClick }) => {
  const isVideo    = gen.output_type === 'video'
  const typeLabel  = gen.generation_type?.replace(/_/g, ' ')
  const isComplete = gen.status === 'completed'

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      disabled={!isComplete}
      className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Thumbnail */}
      <div
        className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {gen.output_url ? (
          isVideo ? (
            <video src={gen.output_url} className="w-full h-full object-cover" muted preload="metadata" />
          ) : (
            <img src={gen.output_url} alt={gen.templates?.name || typeLabel} className="w-full h-full object-cover" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {isVideo
              ? <Film  size={20} style={{ color: 'var(--text-muted)' }} />
              : <Image size={20} style={{ color: 'var(--text-muted)' }} />
            }
          </div>
        )}
        <div
          className="absolute bottom-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          aria-hidden="true"
        >
          {isVideo
            ? <Film  size={8} className="text-white" />
            : <Image size={8} className="text-white" />
          }
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate capitalize" style={{ color: 'var(--text-primary)' }}>
          {gen.templates?.name || typeLabel || 'Generation'}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
          {new Date(gen.created_at).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <StatusBadge status={gen.status} />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ⚡ {gen.credits_charged} credits
          </span>
        </div>
      </div>

      {isComplete && (
        <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      )}
    </motion.button>
  )
}

// ─── Filters ──────────────────────────────────────────────

const FILTERS   = ['all', 'completed', 'failed']
const PAGE_SIZE = 20

// ─── History Page ─────────────────────────────────────────

export default function HistoryPage() {
  const navigate  = useNavigate()
  const { user }  = useAuth()

  const [history,     setHistory]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter,      setFilter]      = useState('all')
  const [page,        setPage]        = useState(0)
  const [hasMore,     setHasMore]     = useState(true)
  const [totalCount,  setTotalCount]  = useState(0)

  const loadHistory = useCallback(async (offset = 0, reset = false) => {
    if (!user) return
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    const { data, count } = await generationsDb.getUserGenerations(user.id, {
      limit: PAGE_SIZE,
      offset,
    })

    setTotalCount(count || 0)
    setHistory((prev) => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
  }, [user])

  useEffect(() => { loadHistory(0, true) }, [loadHistory])

  const filtered = filter === 'all'
    ? history
    : history.filter((g) => g.status === filter)

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadHistory(nextPage * PAGE_SIZE)
  }

  return (
    <>
      <TopBar title="History" showCredits />
      <PageWrapper>

        {/* Header */}
        <div className="pt-2 pb-5">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            My Creations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalCount} total generation{totalCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mb-5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
              style={{
                background: filter === f ? 'var(--text-primary)' : 'var(--bg-elevated)',
                color:      filter === f ? 'var(--text-inverse)' : 'var(--text-muted)',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading && history.length === 0 ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Film}
            title={filter === 'all' ? 'No creations yet' : `No ${filter} generations`}
            description={
              filter === 'all'
                ? 'Start creating something amazing!'
                : `You have no ${filter} generations in this page`
            }
            action={
              filter === 'all' && (
                <button
                  onClick={() => navigate('/create')}
                  className="py-3 px-6 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
                  style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                >
                  Create something
                </button>
              )
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((gen, i) => (
              <motion.div
                key={gen.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <HistoryCard
                  gen={gen}
                  onClick={() => {
                    if (gen.status === 'completed') navigate(`/result/${gen.id}`)
                  }}
                />
              </motion.div>
            ))}

            {hasMore && !loadingMore && (
              <button
                onClick={handleLoadMore}
                className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{
                  background: 'var(--bg-elevated)',
                  color:      'var(--text-secondary)',
                  border:     '1px solid var(--border)',
                }}
              >
                Load more
              </button>
            )}

            {loadingMore && <Skeleton className="h-20 w-full" />}
          </div>
        )}
      </PageWrapper>
    </>
  )
}
