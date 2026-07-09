// src/pages/admin/CohortManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Check, RefreshCw, ChevronDown, ChevronUp,
  Trash2, Copy, Users, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cohortAdmin } from '@/lib/renderWindowCohort'
import toast from 'react-hot-toast'

const STATUS_META = {
  active:    { label: 'Active',    bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  ended:     { label: 'Ended',     bg: 'rgba(255,255,255,0.06)', color: '#888' },
  cancelled: { label: 'Cancelled', bg: 'rgba(239,68,68,0.10)',  color: '#ef4444' },
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const EMPTY_FORM = {
  name:             '',
  cohort_code:      '',
  seat_count:       '50',
  daily_unit_quota: '15',
  duration_days:    '30',
}

// ─── Create Form ────────────────────────────────────────────────────────

const CreateForm = ({ onCreate, onCancel, creating }) => {
  const [form, setForm] = useState(EMPTY_FORM)
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const isValid =
    form.name.trim().length > 0 &&
    form.cohort_code.trim().length >= 3 &&
    Number(form.seat_count) > 0 &&
    Number(form.daily_unit_quota) > 0 &&
    Number(form.duration_days) > 0

  const handleSubmit = () => {
    if (!isValid) return
    onCreate({
      name:           form.name.trim(),
      cohortCode:     form.cohort_code.trim().toUpperCase(),
      seatCount:      parseInt(form.seat_count, 10),
      dailyUnitQuota: parseInt(form.daily_unit_quota, 10),
      durationDays:   parseInt(form.duration_days, 10),
    })
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Cohort Name *
        </label>
        <input
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. St Anne AI Community"
          className="input-base w-full text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Cohort Code * (you choose this — must be unique)
        </label>
        <input
          value={form.cohort_code}
          onChange={(e) => set('cohort_code', e.target.value.toUpperCase())}
          placeholder="e.g. STANNEJULY"
          className="input-base w-full text-sm font-mono"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Seats
          </label>
          <input type="number" min={1} value={form.seat_count} onChange={(e) => set('seat_count', e.target.value)} className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Units/day
          </label>
          <input type="number" min={1} value={form.daily_unit_quota} onChange={(e) => set('daily_unit_quota', e.target.value)} className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Days
          </label>
          <input type="number" min={1} value={form.duration_days} onChange={(e) => set('duration_days', e.target.value)} className="input-base w-full text-sm" />
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Starts immediately on creation. Ends automatically after the number of days above — you can extend it later before it ends.
      </p>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!isValid || creating}
          className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all"
          style={{
            background: isValid ? 'var(--brand)' : 'var(--bg-card)',
            color:      isValid ? 'white'        : 'var(--text-muted)',
            opacity:    creating ? 0.7 : 1,
          }}
        >
          {creating ? 'Creating…' : 'Create Cohort'}
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

// ─── Extend Form (inline, for extending end date / quota / seats) ───────

const ExtendForm = ({ cohort, onSave, onCancel, saving }) => {
  const [endsAt,   setEndsAt]   = useState(new Date(cohort.ends_at).toISOString().slice(0, 16))
  const [quota,    setQuota]    = useState(String(cohort.daily_unit_quota))
  const [addSeats, setAddSeats] = useState('0')

  const handleSubmit = () => {
    onSave({
      endsAt:         new Date(endsAt).toISOString(),
      dailyUnitQuota: parseInt(quota, 10),
      addSeats:       parseInt(addSeats, 10) || 0,
    })
  }

  return (
    <div className="flex flex-col gap-2 mt-2" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
      <div>
        <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>End date</label>
        <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="input-base w-full text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Units/day</label>
          <input type="number" min={1} value={quota} onChange={(e) => setQuota(e.target.value)} className="input-base w-full text-sm" />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Add seats</label>
          <input type="number" min={0} value={addSeats} onChange={(e) => setAddSeats(e.target.value)} className="input-base w-full text-sm" />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold flex-1 justify-center"
          style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
        >
          {saving ? '…' : <><Check size={12} /> Save</>}
        </button>
       <button onClick={onCancel} className="px-4 py-2.5 rounded-xl text-xs font-bold" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Add Member Search (admin manual add) ──────────────────────────────

const AddMemberSearch = ({ cohortId, onAdded }) => {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingId, setAddingId] = useState(null)

  useEffect(() => {
    if (!open || query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await cohortAdmin.searchUsers(query.trim())
      setResults(data)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [open, query, user.id])

  const handleAdd = async (userId) => {
    setAddingId(userId)
    const { data, error } = await cohortAdmin.addMember(user.id, cohortId, userId)
    setAddingId(null)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to add member'); return }
    toast.success(`Added — seat #${data.seat_number}`)
    setQuery('')
    setResults([])
    setOpen(false)
    onAdded()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
      >
        <Plus size={12} /> Add member
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl p-3" style={{ background: 'var(--bg-elevated)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Add member</p>
        <button onClick={() => { setOpen(false); setQuery(''); setResults([]) }} style={{ color: 'var(--text-muted)' }}>
          <X size={13} />
        </button>
      </div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by username, name, or email…"
        className="input-base w-full text-sm"
      />
      {searching && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Searching…</p>}
      {results.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--bg-card)' }}>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                  @{r.username}{r.display_name ? ` · ${r.display_name}` : ''}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{r.email}</p>
              </div>
              <button
                onClick={() => handleAdd(r.id)}
                disabled={addingId === r.id}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
              >
                {addingId === r.id ? '…' : 'Add'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
// ─── Cohort Card ────────────────────────────────────────────────────────

const CohortCard = ({ cohort, filledCount, onExtend, onCancelCohort, onRemoveMember, busy }) => {
  const [expanded, setExpanded] = useState(false)
  const [extending, setExtending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [seats, setSeats] = useState(null)
  const [seatUsageMap, setSeatUsageMap] = useState({})
  const meta = STATUS_META[cohort.status] ?? STATUS_META.active

  const loadSeats = useCallback(async () => {
    const [seatsRes, usageRes] = await Promise.all([
      cohortAdmin.getSeats(cohort.id),
      cohortAdmin.getSeatUsageMap(cohort.id),
    ])
    setSeats(seatsRes.data)
    setSeatUsageMap(usageRes.data)
  }, [cohort.id])

  useEffect(() => { if (expanded && seats === null) loadSeats() }, [expanded, seats, loadSeats])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cohort.cohort_code)
    setCopied(true)
    toast.success('Code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

 const expandedFilledCount = seats ? seats.filter((s) => s.member_id).length : filledCount

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{cohort.name}</p>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
              {meta.label}
            </span>
          </div>
         <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
            {cohort.cohort_code} · {filledCount}/{cohort.seat_count} seats · {cohort.daily_unit_quota} units/day
          </p>
        </div>
        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4 flex flex-col gap-3" style={{ borderTop: '1px solid var(--border-color)' }}>

              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 mt-3" style={{ background: 'var(--bg-elevated)' }}>
                <p className="flex-1 text-sm font-mono font-bold tracking-wider" style={{ color: 'var(--text-primary)' }}>
                  {cohort.cohort_code}
                </p>
                <button onClick={handleCopy} className="flex-shrink-0">
                  {copied ? <Check size={14} style={{ color: 'var(--brand)' }} /> : <Copy size={14} style={{ color: 'var(--text-muted)' }} />}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Started</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{fmtDate(cohort.starts_at)}</p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ends</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>{fmtDate(cohort.ends_at)}</p>
                </div>
              </div>

              {cohort.status === 'active' && (
                <AddMemberSearch cohortId={cohort.id} onAdded={loadSeats} />
              )}

              {/* Seats */}
              <div>
               <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Seats {expandedFilledCount !== null && `· ${expandedFilledCount}/${cohort.seat_count} filled`}
                </p>
                {seats === null ? (
                  <div className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                ) : (
                  <div className="flex flex-col gap-2 max-h-64 overflow-y-auto no-scrollbar">
                    {seats.map((seat) => {
                      const used = seatUsageMap?.[seat.seat_number] ?? 0
                      return (
                        <div key={seat.id} className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: 'var(--bg-elevated)' }}>
                          <div className="min-w-0">
                            <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Seat #{seat.seat_number}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                              {seat.member
                                ? `@${seat.member.username} · ${used}/${cohort.daily_unit_quota} used today`
                                : 'Open'}
                            </p>
                          </div>
                          {seat.member_id && (
                            <button
                              onClick={() => onRemoveMember(cohort.id, seat.seat_number)}
                              disabled={busy}
                              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                              aria-label="Remove member"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              {cohort.status === 'active' && !extending && (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setExtending(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                  >
                    Extend / Edit
                  </button>
                  <button
                    onClick={() => onCancelCohort(cohort.id)}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                  >
                    <X size={11} /> Cancel Cohort
                  </button>
                </div>
              )}

              {extending && (
                <ExtendForm
                  cohort={cohort}
                  saving={busy}
                  onCancel={() => setExtending(false)}
                  onSave={(updates) => { onExtend(cohort.id, updates); setExtending(false) }}
                />
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function CohortManager() {
  const { user } = useAuth()
 const [cohorts,      setCohorts]      = useState([])
  const [filledCounts, setFilledCounts] = useState({})
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [creating,     setCreating]     = useState(false)
  const [busy,         setBusy]         = useState(false)
  const [filter,       setFilter]       = useState('active')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data }, { data: counts }] = await Promise.all([
      cohortAdmin.getAll(),
      cohortAdmin.getFilledCounts(),
    ])
    setCohorts(data)
    setFilledCounts(counts)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (payload) => {
    setCreating(true)
    const { data, error } = await cohortAdmin.create(user.id, payload)
    setCreating(false)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to create cohort'); return }
    toast.success(`${payload.name} created`)
    setShowForm(false)
    load()
  }

  const handleExtend = async (cohortId, updates) => {
    setBusy(true)
    const { data, error } = await cohortAdmin.update(user.id, cohortId, updates)
    setBusy(false)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to update cohort'); return }
    toast.success('Cohort updated')
    load()
  }

  const handleCancel = async (cohortId) => {
    if (!window.confirm('Cancel this cohort? Members will lose access immediately.')) return
    setBusy(true)
    const { data, error } = await cohortAdmin.update(user.id, cohortId, { status: 'cancelled' })
    setBusy(false)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to cancel cohort'); return }
    toast.success('Cohort cancelled')
    load()
  }

  const handleRemoveMember = async (cohortId, seatNumber) => {
    setBusy(true)
    const { data, error } = await cohortAdmin.removeMember(user.id, cohortId, seatNumber)
    setBusy(false)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to remove member'); return }
    toast.success(`Seat #${seatNumber} freed`)
    load()
  }

  const filtered = cohorts.filter((c) => filter === 'all' ? true : c.status === filter)
  const filters = ['active', 'ended', 'cancelled', 'all']

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Cohort Access</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Free training-group access. No payment — create a cohort, share the code.
          </p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <button
        onClick={() => setShowForm((s) => !s)}
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
        style={{ background: showForm ? 'var(--bg-elevated)' : 'var(--brand)', color: showForm ? 'var(--text-muted)' : 'white' }}
      >
        {showForm ? <X size={13} /> : <Plus size={13} />}
        {showForm ? 'Cancel' : 'New Cohort'}
      </button>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <CreateForm onCreate={handleCreate} onCancel={() => setShowForm(false)} creating={creating} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap capitalize"
            style={{
              background: filter === f ? 'var(--bg-elevated)' : 'var(--bg-card)',
              color:      filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
              border:     '1px solid var(--border-color)',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)', opacity: 0.5 - i * 0.1 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No {filter !== 'all' ? filter : ''} cohorts</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((cohort) => (
             <CohortCard
                key={cohort.id}
                cohort={cohort}
                filledCount={filledCounts[cohort.id] ?? 0}
                onExtend={handleExtend}
                onCancelCohort={handleCancel}
                onRemoveMember={handleRemoveMember}
                busy={busy}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
