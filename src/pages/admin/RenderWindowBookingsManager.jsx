// src/pages/admin/RenderWindowBookingsManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { Check, X, RefreshCw, MessageCircle, Mail } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  adminGetBookings, adminAcceptBooking, adminCancelBooking, adminResetBooking,
} from '@/lib/renderWindowBooking'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_META = {
  pending:       { label: 'Pending',       bg: 'rgba(245,158,11,0.12)', color: '#f59e0b' },
  accepted:      { label: 'Accepted',      bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  cancelled:     { label: 'Cancelled',     bg: 'rgba(239,68,68,0.10)',  color: '#ef4444' },
  reset_pending: { label: 'Reset — awaiting user', bg: 'rgba(99,102,241,0.12)', color: '#6366f1' },
  expired:       { label: 'Expired',       bg: 'rgba(255,255,255,0.06)', color: '#888' },
}

const FILTERS = ['all', 'pending', 'accepted', 'reset_pending', 'cancelled']

const BookingRow = ({ b, onAccept, onCancel, onReset, busy }) => {
  const [notesOpen, setNotesOpen] = useState(null) // 'cancel' | 'reset' | null
  const [notes,     setNotes]     = useState('')
  const meta = STATUS_META[b.status] ?? STATUS_META.pending
  const modelLabels = (b.models || []).map((m) => m.model?.label).filter(Boolean).join(', ')
  const isBusy = busy === b.id

  const submitAction = (action) => {
    if (action === 'cancel') onCancel(b.id, notes)
    if (action === 'reset')  onReset(b.id, notes)
    setNotesOpen(null)
    setNotes('')
  }

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {b.user?.display_name || b.user?.username || 'User'}
        </p>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: meta.bg, color: meta.color }}>
          {meta.label}
        </span>
      </div>

      <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
        {modelLabels || 'No models selected'}
      </p>

      {b.requested_start_at && (
        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
          {fmtDateTime(b.requested_start_at)} → {fmtDateTime(b.ends_at)} · {b.duration_hours}h
        </p>
      )}

      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        ₦{Number(b.amount_ngn).toLocaleString()} paid
      </p>

      <div className="flex items-center gap-3 mb-3">
        {b.whatsapp_number && (
          <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <MessageCircle size={11} /> {b.whatsapp_number}
          </span>
        )}
      </div>

      {b.admin_notes && (
        <p className="text-xs mb-3 italic" style={{ color: 'var(--text-muted)' }}>"{b.admin_notes}"</p>
      )}

      {notesOpen ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={notesOpen === 'cancel' ? 'Reason for cancelling (visible to user)…' : 'Note for the user about why this was reset…'}
            rows={2}
            className="input-base w-full text-xs resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => submitAction(notesOpen)}
              disabled={isBusy}
              className="flex-1 py-2 rounded-xl text-xs font-bold"
              style={{ background: notesOpen === 'cancel' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)', color: notesOpen === 'cancel' ? '#ef4444' : '#6366f1' }}
            >
              Confirm {notesOpen === 'cancel' ? 'Cancel' : 'Reset'}
            </button>
            <button onClick={() => setNotesOpen(null)} className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {b.status === 'pending' && (
            <button
              onClick={() => onAccept(b.id)}
              disabled={isBusy}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
            >
              <Check size={12} /> {isBusy ? 'Accepting…' : 'Accept'}
            </button>
          )}
          {(b.status === 'pending' || b.status === 'accepted') && (
            <button
              onClick={() => setNotesOpen('reset')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
            >
              <RefreshCw size={12} /> Reset
            </button>
          )}
          {b.status !== 'cancelled' && (
            <button
              onClick={() => setNotesOpen('cancel')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
            >
              <X size={12} /> Cancel
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function RenderWindowBookingsManager() {
  const { user }   = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('pending')
  const [busy,     setBusy]     = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await adminGetBookings({ status: filter })
    if (error) toast.error('Failed to load bookings')
    setBookings(data)
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleAccept = async (id) => {
    setBusy(id)
    const { data, error } = await adminAcceptBooking(user.id, id)
    setBusy(null)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to accept booking'); return }
    toast.success('Booking accepted — user will see their countdown')
    load()
  }

  const handleCancel = async (id, notes) => {
    setBusy(id)
    const { data, error } = await adminCancelBooking(user.id, id, notes)
    setBusy(null)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to cancel booking'); return }
    toast.success('Booking cancelled')
    load()
  }

  const handleReset = async (id, notes) => {
    setBusy(id)
    const { data, error } = await adminResetBooking(user.id, id, notes)
    setBusy(null)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to reset booking'); return }
    toast.success('Booking reset — user can pick a new time worth the same amount')
    load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Private Bookings</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Accept, cancel, or reset user requests for private model access.
          </p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap"
            style={{
              background: filter === f ? 'var(--bg-elevated)' : 'var(--bg-card)',
              color:      filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
              border:     '1px solid var(--border-color)',
            }}
          >
            {f === 'all' ? 'All' : (STATUS_META[f]?.label ?? f)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)', opacity: 0.5 - i * 0.1 }} />)}
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-center py-12" style={{ color: 'var(--text-muted)' }}>No bookings in this filter.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b) => (
            <BookingRow key={b.id} b={b} onAccept={handleAccept} onCancel={handleCancel} onReset={handleReset} busy={busy} />
          ))}
        </div>
      )}
    </div>
  )
}
