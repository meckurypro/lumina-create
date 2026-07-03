// src/pages/admin/RenderWindowAnalytics.jsx
import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  Users, Search, ChevronLeft, ChevronRight,
  RefreshCw, CalendarClock,
} from 'lucide-react'
import { renderWindowAnalytics } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Modal, Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

// ─── Drill-down Modal ──────────────────────────────────────────────────────

const DrillDownModal = ({ dayOffset, dayLabel, onClose }) => {
  const { user } = useAuth()
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    renderWindowAnalytics.getEligibleUsersForDay(user.id, dayOffset).then(({ data, error }) => {
      if (cancelled) return
      if (error) toast.error('Failed to load users for this day')
      setRows(data || [])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user.id, dayOffset])

  return (
    <Modal isOpen onClose={onClose} title={`Eligible · ${dayLabel}`}>
      <div className="flex flex-col gap-2" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)
        ) : rows.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No users eligible on this day.
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={`${r.user_id}-${r.expires_at}`}
              className="rounded-xl p-3"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {r.display_name || r.username}
                </p>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
                >
                  {r.tier_display_name || r.tier_name || '—'}
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{r.email}</p>
              <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span>Start: {fmtDateTime(r.starts_at)}</span>
                <span>·</span>
                <span>Expiry: {fmtDateTime(r.expires_at)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}

// ─── Upcoming Eligibility Grid ─────────────────────────────────────────────

const UpcomingGrid = ({ upcoming, onDrillDown }) => (
  <div className="grid grid-cols-3 gap-2">
    {upcoming.map((u) => (
      <button
        key={u.day_offset}
        onClick={() => onDrillDown(u.day_offset)}
        className="rounded-xl p-3 text-left transition-all active:scale-[0.97]"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {u.day_offset === 0 ? 'Today' : u.day_offset === 1 ? 'Tomorrow' : `Day +${u.day_offset}`}
        </p>
        <p className="text-lg font-black mt-0.5" style={{ color: 'var(--text-primary)' }}>
          {u.eligible_count}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(u.date)}</p>
      </button>
    ))}
  </div>
)

// ─── Active Members Table ──────────────────────────────────────────────────

const PAGE_SIZE = 10

const ActiveMembersTable = () => {
  const { user }        = useAuth()
  const [search,   setSearch]   = useState('')
  const [rows,     setRows]     = useState([])
  const [total,    setTotal]    = useState(0)
  const [page,     setPage]     = useState(0)
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await renderWindowAnalytics.getActiveMembers(user.id, {
      search,
      limit:  PAGE_SIZE,
      offset: page * PAGE_SIZE,
    })
    if (error || !data?.success) {
      toast.error('Failed to load active members')
      setLoading(false)
      return
    }
    setRows(data.rows  || [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [user.id, search, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(0) }, [search])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Currently Active Members · {total}
        </p>
        <button onClick={load} style={{ color: 'var(--text-muted)' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <Search size={13} style={{ color: 'var(--text-muted)' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email…"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>

      <div className="flex flex-col gap-2">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)
        ) : rows.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
            No active members{search ? ' match your search' : ''}.
          </p>
        ) : (
          rows.map((r) => (
            <div
              key={r.user_id}
              className="rounded-xl p-3 flex items-center justify-between"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  {r.display_name || r.username}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.email}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-3">
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
                >
                  {r.tier_display || r.tier_name || '—'}
                </span>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {r.days_remaining}d left
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', opacity: page === 0 ? 0.4 : 1 }}
          >
            <ChevronLeft size={14} />
          </button>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Page {page + 1} of {totalPages}
          </p>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', opacity: page >= totalPages - 1 ? 0.4 : 1 }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function RenderWindowAnalytics() {
  const { user }        = useAuth()
  const [summary,  setSummary]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [drillDay, setDrillDay] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await renderWindowAnalytics.getSummary(user.id)
    if (error || !data?.success) {
      toast.error('Failed to load analytics')
      setLoading(false)
      return
    }
    setSummary(data)
    setLoading(false)
  }, [user.id])

  useEffect(() => { load() }, [load])

  const drillLabel = drillDay === null
    ? ''
    : drillDay === 0 ? 'Today' : drillDay === 1 ? 'Tomorrow' : `Day +${drillDay}`

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Render Window Analytics
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Estimate demand to plan GPU pod capacity.
          </p>
        </div>
        <button
          onClick={load}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : summary ? (
        <>
          {/* Active users now */}
          <div
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.15)' }}>
              <Users size={18} style={{ color: '#10b981' }} />
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Active Users Now</p>
              <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
                {summary.active_users_now}
              </p>
            </div>
          </div>

          {/* Upcoming eligibility */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock size={13} style={{ color: 'var(--text-muted)' }} />
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Upcoming Eligible Users
              </p>
            </div>
            <UpcomingGrid upcoming={summary.upcoming || []} onDrillDown={setDrillDay} />
          </div>

          {/* Active members */}
          <ActiveMembersTable />
        </>
      ) : (
        <p style={{ color: 'var(--text-muted)' }}>Failed to load analytics.</p>
      )}

      {/* Drill-down modal */}
      <AnimatePresence>
        {drillDay !== null && (
          <DrillDownModal
            dayOffset={drillDay}
            dayLabel={drillLabel}
            onClose={() => setDrillDay(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
