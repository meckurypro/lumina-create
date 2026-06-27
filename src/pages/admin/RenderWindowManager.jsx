// src/pages/admin/RenderWindowManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Check, Clock, Zap, ZapOff,
  CalendarDays, Users, ChevronDown, ChevronUp,
  AlertTriangle, RefreshCw, Pencil, Trash2,
} from 'lucide-react'
import { supabase, renderWindows } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  scheduled: { label: 'Scheduled', color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  active:    { label: 'Live Now',  color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  closed:    { label: 'Closed',    color: '#888',    bg: 'rgba(255,255,255,0.06)' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.10)'   },
}

const fmtDatetimeLocal = (iso) => {
  if (!iso) return ''
  // Convert ISO → datetime-local input value (YYYY-MM-DDTHH:MM)
  return new Date(iso).toISOString().slice(0, 16)
}

const fmtDisplay = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

const timeUntil = (iso) => {
  if (!iso) return ''
  const diff = new Date(iso) - new Date()
  if (diff < 0) return 'passed'
  const mins  = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`
  return `in ${Math.floor(hrs / 24)}d`
}

const timeLeft = (iso) => {
  if (!iso) return ''
  const diff = new Date(iso) - new Date()
  if (diff < 0) return 'ended'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m left`
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`
}

// ─── Price Editor ─────────────────────────────────────────────────────────────

const PriceEditor = ({ currentPrice, onSaved }) => {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)

  const open  = () => { setDraft(String(currentPrice ?? '')); setEditing(true) }
  const close = () => setEditing(false)

  const save = async () => {
    const price = parseInt(draft, 10)
    if (isNaN(price) || price < 100) {
      toast.error('Price must be at least ₦100')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('app_settings')
      .update({ value: String(price), updated_at: new Date().toISOString() })
      .eq('key', 'render_window_price_ngn')
    setSaving(false)
    if (error) { toast.error('Failed to save price'); return }
    toast.success(`Price updated to ₦${price.toLocaleString()}`)
    onSaved(price)
    setEditing(false)
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
        Subscription Price
      </p>

      {editing ? (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>₦</span>
          <input
            autoFocus
            type="number"
            min={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') close() }}
            className="input-base flex-1 text-lg font-black"
            style={{ color: 'var(--brand)' }}
          />
          <button
            onClick={save}
            disabled={saving}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            {saving ? '…' : <Check size={15} />}
          </button>
          <button
            onClick={close}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
              {currentPrice != null ? `₦${Number(currentPrice).toLocaleString()}` : '—'}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              per 24-hour access
            </p>
          </div>
          <button
            onClick={open}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <Pencil size={11} /> Edit
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Window Form ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  label:     '',
  starts_at: '',
  ends_at:   '',
  capacity:  '',
  notes:     '',
}

const WindowForm = ({ initial, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const isValid =
    form.label.trim().length > 0 &&
    form.starts_at &&
    form.ends_at &&
    new Date(form.ends_at) > new Date(form.starts_at)

  const handleSubmit = () => {
    if (!isValid) return
    onSave({
      label:     form.label.trim(),
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at:   new Date(form.ends_at).toISOString(),
      capacity:  form.capacity ? parseInt(form.capacity, 10) : null,
      notes:     form.notes.trim() || null,
    })
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      {/* Label */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Window Label *
        </label>
        <input
          value={form.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder="e.g. Tuesday Evening Window"
          className="input-base w-full text-sm"
        />
      </div>

      {/* Start / End */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Opens *
          </label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => set('starts_at', e.target.value)}
            className="input-base w-full text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Closes *
          </label>
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => set('ends_at', e.target.value)}
            className="input-base w-full text-sm"
          />
        </div>
      </div>

      {/* Validation hint */}
      {form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at) && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#ef4444' }}>
          <AlertTriangle size={11} /> End time must be after start time
        </p>
      )}

      {/* Capacity */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Capacity (optional)
        </label>
        <input
          type="number"
          min={1}
          value={form.capacity}
          onChange={(e) => set('capacity', e.target.value)}
          placeholder="Leave blank for unlimited"
          className="input-base w-full text-sm"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Notes (optional)
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Internal admin notes…"
          rows={2}
          className="input-base w-full text-sm resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all"
          style={{
            background: isValid ? 'var(--brand)' : 'var(--bg-card)',
            color:      isValid ? 'white'        : 'var(--text-muted)',
            opacity:    saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Window'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-3 rounded-2xl text-sm font-bold"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Window Card ──────────────────────────────────────────────────────────────

const WindowCard = ({ win, onOpen, onClose, onEdit, onDelete, actionLoading }) => {
  const [expanded, setExpanded] = useState(false)
  const meta    = STATUS_META[win.status] ?? STATUS_META.closed
  const isLive  = win.status === 'active'
  const loading = actionLoading === win.id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: isLive ? 'rgba(16,185,129,0.04)' : 'var(--bg-card)',
        border:     `1px solid ${isLive ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
      }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Status dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            background: meta.color,
            boxShadow:  isLive ? `0 0 8px ${meta.color}` : 'none',
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {win.label}
            </p>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
            {isLive && (
              <span className="text-xs font-bold" style={{ color: '#10b981' }}>
                · {timeLeft(win.ends_at)}
              </span>
            )}
            {win.status === 'scheduled' && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                · {timeUntil(win.starts_at)}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {fmtDisplay(win.starts_at)} → {fmtDisplay(win.ends_at)}
          </p>
        </div>

        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-4 pb-4 flex flex-col gap-3"
              style={{ borderTop: '1px solid var(--border-color)' }}
            >
              {/* Details */}
              <div className="grid grid-cols-2 gap-2 pt-3">
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Opens</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {fmtDisplay(win.starts_at)}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Closes</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {fmtDisplay(win.ends_at)}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Capacity</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {win.capacity ?? 'Unlimited'}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Created</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {fmtDisplay(win.created_at)}
                  </p>
                </div>
              </div>

              {win.notes && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{win.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {/* Open / Close toggle */}
                {win.status !== 'cancelled' && (
                  isLive ? (
                    <button
                      onClick={() => onClose(win.id)}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                    >
                      <ZapOff size={12} />
                      {loading ? 'Closing…' : 'Close Window'}
                    </button>
                  ) : win.status !== 'closed' ? (
                    <button
                      onClick={() => onOpen(win.id)}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                    >
                      <Zap size={12} />
                      {loading ? 'Opening…' : 'Open Now'}
                    </button>
                  ) : null
                )}

                {/* Edit — only for scheduled or closed */}
                {(win.status === 'scheduled' || win.status === 'closed') && (
                  <button
                    onClick={() => onEdit(win)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                  >
                    <Pencil size={11} /> Edit
                  </button>
                )}

                {/* Delete — only for scheduled or cancelled */}
                {(win.status === 'scheduled' || win.status === 'cancelled') && (
                  <button
                    onClick={() => onDelete(win.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Summary Bar ──────────────────────────────────────────────────────────────

const SummaryBar = ({ summary, loading }) => {
  if (loading || !summary) return null

  const isOpen    = summary.window_open
  const subCount  = summary.active_sub_count ?? 0
  const nextWin   = summary.next_window

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: isOpen ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
        border:     `1px solid ${isOpen ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            background: isOpen ? '#10b981' : '#888',
            boxShadow:  isOpen ? '0 0 8px #10b981' : 'none',
          }}
        />
        <p className="text-sm font-black" style={{ color: isOpen ? '#10b981' : 'var(--text-primary)' }}>
          {isOpen ? 'Window is OPEN' : 'Window is CLOSED'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={11} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Active subs</p>
          </div>
          <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{subCount}</p>
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarDays size={11} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Next window</p>
          </div>
          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            {nextWin?.label
              ? `${nextWin.label} · ${timeUntil(nextWin.starts_at)}`
              : 'None scheduled'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RenderWindowManager() {
  const { user }                              = useAuth()
  const [windows,       setWindows]           = useState([])
  const [summary,       setSummary]           = useState(null)
  const [rwPrice,       setRwPrice]           = useState(null)
  const [loading,       setLoading]           = useState(true)
  const [summaryLoad,   setSummaryLoad]       = useState(true)
  const [actionLoading, setActionLoading]     = useState(null)
  const [showForm,      setShowForm]          = useState(false)
  const [editingWindow, setEditingWindow]     = useState(null)
  const [formSaving,    setFormSaving]        = useState(false)
  const [filter,        setFilter]            = useState('all')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setSummaryLoad(true)

    const [windowsRes, summaryRes, priceRes] = await Promise.all([
      renderWindows.getUpcoming(),
      renderWindows.getAdminSummary(),
      supabase.from('app_settings').select('value').eq('key', 'render_window_price_ngn').single(),
    ])

    setWindows(windowsRes.data  || [])
    setSummary(summaryRes.data  ?? null)
    setRwPrice(priceRes.data?.value ? Number(priceRes.data.value) : null)
    setLoading(false)
    setSummaryLoad(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Create window ────────────────────────────────────────────────────────
  const handleCreate = async (payload) => {
    setFormSaving(true)
    const { data, error } = await renderWindows.create({
      ...payload,
      created_by: user.id,
      status:     'scheduled',
    })
    setFormSaving(false)
    if (error) { toast.error(`Failed to create window: ${error.message}`); return }
    toast.success('Window created')
    setShowForm(false)
    setWindows((prev) => [data, ...prev].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))
    loadAll()
  }

  // ── Edit window ──────────────────────────────────────────────────────────
  const handleEdit = async (payload) => {
    if (!editingWindow) return
    setFormSaving(true)
    const { data, error } = await renderWindows.update(editingWindow.id, payload)
    setFormSaving(false)
    if (error) { toast.error(`Failed to update window: ${error.message}`); return }
    toast.success('Window updated')
    setEditingWindow(null)
    setWindows((prev) => prev.map((w) => w.id === data.id ? data : w))
  }

  // ── Open window manually ─────────────────────────────────────────────────
  const handleOpen = async (windowId) => {
    setActionLoading(windowId)
    const { data, error } = await renderWindows.adminOpen(user.id, windowId)
    setActionLoading(null)
    if (error || !data?.success) {
      toast.error(data?.error || 'Failed to open window')
      return
    }
    toast.success('Window is now LIVE')
    // Optimistic update
    setWindows((prev) => prev.map((w) => ({
      ...w,
      status: w.id === windowId ? 'active' : (w.status === 'active' ? 'closed' : w.status),
    })))
    loadAll()
  }

  // ── Close window manually ────────────────────────────────────────────────
  const handleClose = async (windowId) => {
    setActionLoading(windowId)
    const { data, error } = await renderWindows.adminClose(user.id, windowId)
    setActionLoading(null)
    if (error || !data?.success) {
      toast.error(data?.error || 'Failed to close window')
      return
    }
    toast.success('Window closed')
    setWindows((prev) => prev.map((w) => w.id === windowId ? { ...w, status: 'closed' } : w))
    loadAll()
  }

  // ── Delete window ─────────────────────────────────────────────────────────
  const handleDelete = async (windowId) => {
    if (!window.confirm('Delete this window? This cannot be undone.')) return
    setActionLoading(windowId)
    const { error } = await renderWindows.delete(windowId)
    setActionLoading(null)
    if (error) { toast.error('Failed to delete window'); return }
    toast.success('Window deleted')
    setWindows((prev) => prev.filter((w) => w.id !== windowId))
    loadAll()
  }

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = windows.filter((w) => {
    if (filter === 'all')       return true
    if (filter === 'active')    return w.status === 'active'
    if (filter === 'scheduled') return w.status === 'scheduled'
    if (filter === 'closed')    return w.status === 'closed'
    if (filter === 'cancelled') return w.status === 'cancelled'
    return true
  })

  const filters = ['all', 'active', 'scheduled', 'closed', 'cancelled']

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Render Windows
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Schedule and manage GPU render windows. Only one can be active at a time.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadAll}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => { setEditingWindow(null); setShowForm((s) => !s) }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: showForm ? 'var(--bg-elevated)' : 'var(--brand)',
              color:      showForm ? 'var(--text-muted)'  : 'white',
            }}
          >
            {showForm ? <X size={13} /> : <Plus size={13} />}
            {showForm ? 'Cancel' : 'New Window'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <SummaryBar summary={summary} loading={summaryLoad} />

      {/* Price editor */}
      <PriceEditor currentPrice={rwPrice} onSaved={setRwPrice} />

      {/* Create form */}
      <AnimatePresence>
        {showForm && !editingWindow && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <WindowForm
              onSave={handleCreate}
              onCancel={() => setShowForm(false)}
              saving={formSaving}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit form */}
      <AnimatePresence>
        {editingWindow && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                Editing: {editingWindow.label}
              </p>
              <button
                onClick={() => setEditingWindow(null)}
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>
            <WindowForm
              initial={{
                label:     editingWindow.label,
                starts_at: fmtDatetimeLocal(editingWindow.starts_at),
                ends_at:   fmtDatetimeLocal(editingWindow.ends_at),
                capacity:  editingWindow.capacity ?? '',
                notes:     editingWindow.notes ?? '',
              }}
              onSave={handleEdit}
              onCancel={() => setEditingWindow(null)}
              saving={formSaving}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map((f) => {
          const meta  = f === 'all' ? null : STATUS_META[f]
          const count = f === 'all'
            ? windows.length
            : windows.filter((w) => w.status === f).length
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
              style={{
                background: filter === f
                  ? (meta?.bg ?? 'var(--bg-elevated)')
                  : 'var(--bg-card)',
                color: filter === f
                  ? (meta?.color ?? 'var(--text-primary)')
                  : 'var(--text-muted)',
                border: `1px solid ${filter === f
                  ? (meta?.color ?? 'var(--border-color)') + '44'
                  : 'var(--border-color)'}`,
              }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} {count > 0 && `· ${count}`}
            </button>
          )
        })}
      </div>

      {/* Window list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-2xl animate-pulse"
              style={{ background: 'var(--bg-card)', opacity: 0.5 - i * 0.1 }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <CalendarDays size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {filter === 'all' ? 'No windows yet' : `No ${filter} windows`}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {filter === 'all' ? 'Create your first render window above.' : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((win) => (
              <WindowCard
                key={win.id}
                win={win}
                onOpen={handleOpen}
                onClose={handleClose}
                onEdit={(w) => { setShowForm(false); setEditingWindow(w) }}
                onDelete={handleDelete}
                actionLoading={actionLoading}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
