// src/pages/admin/RenderWindowBookingsManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { Check, X, RefreshCw, MessageCircle, Mail, Plus, Pencil, Trash2, Tag } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  adminGetBookings, adminAcceptBooking, adminCancelBooking, adminResetBooking,
  renderWindowBookingCoupons,
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

// ─── Coupons Manager ────────────────────────────────────────────────────
// Admin creates/edits/disables/deletes coupons here. Redemption is entirely
// server-side (validate_render_window_coupon + a row-locked check inside
// process_render_window_booking_payment) — this UI only manages the rows.

const EMPTY_COUPON = {
  code: '', discount_type: 'percent', discount_value: '',
  max_discount_ngn: '', min_amount_ngn: '', max_redemptions: '', per_user_limit: '1',
  expires_at: '',
}

const couponFormToPayload = (draft) => {
  const discountValue = parseFloat(draft.discount_value)
  if (!draft.code.trim()) return { error: 'Enter a coupon code' }
  if (isNaN(discountValue) || discountValue <= 0) return { error: 'Enter a valid discount value' }
  if (draft.discount_type === 'percent' && discountValue > 100) return { error: 'Percent discount cannot exceed 100' }

  const perUserLimit = parseInt(draft.per_user_limit, 10)
  if (isNaN(perUserLimit) || perUserLimit <= 0) return { error: 'Per-user limit must be at least 1' }

  return {
    payload: {
      code:             draft.code.trim(),
      discount_type:    draft.discount_type,
      discount_value:   discountValue,
      max_discount_ngn: draft.discount_type === 'percent' && draft.max_discount_ngn !== ''
        ? parseFloat(draft.max_discount_ngn) : null,
      min_amount_ngn:   draft.min_amount_ngn !== '' ? parseFloat(draft.min_amount_ngn) : 0,
      max_redemptions:  draft.max_redemptions !== '' ? parseInt(draft.max_redemptions, 10) : null,
      per_user_limit:   perUserLimit,
      expires_at:       draft.expires_at ? new Date(draft.expires_at).toISOString() : null,
    },
  }
}

const CouponRow = ({ coupon, onSaved, onRemoved }) => {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(EMPTY_COUPON)
  const [saving,  setSaving]  = useState(false)

  const open = () => {
    setDraft({
      code:             coupon.code,
      discount_type:    coupon.discount_type,
      discount_value:   String(coupon.discount_value),
      max_discount_ngn: coupon.max_discount_ngn != null ? String(coupon.max_discount_ngn) : '',
      min_amount_ngn:   coupon.min_amount_ngn != null ? String(coupon.min_amount_ngn) : '',
      max_redemptions:  coupon.max_redemptions != null ? String(coupon.max_redemptions) : '',
      per_user_limit:   String(coupon.per_user_limit),
      expires_at:       coupon.expires_at ? coupon.expires_at.slice(0, 16) : '',
    })
    setEditing(true)
  }

  const save = async () => {
    const { payload, error: formError } = couponFormToPayload(draft)
    if (formError) { toast.error(formError); return }
    setSaving(true)
    const { data, error } = await renderWindowBookingCoupons.update(coupon.id, payload)
    setSaving(false)
    if (error) { toast.error(error.message?.includes('duplicate') ? 'That code is already in use' : 'Failed to save coupon'); return }
    toast.success(`${data.code} updated`)
    onSaved(data)
    setEditing(false)
  }

  const toggleActive = async () => {
    setSaving(true)
    const { data, error } = await renderWindowBookingCoupons.update(coupon.id, { is_active: !coupon.is_active })
    setSaving(false)
    if (error) { toast.error('Failed to update status'); return }
    toast.success(`${coupon.code} ${!coupon.is_active ? 'enabled' : 'disabled'}`)
    onSaved(data)
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${coupon.code}"? This cannot be undone.`)) return
    setSaving(true)
    const { error } = await renderWindowBookingCoupons.remove(coupon.id)
    setSaving(false)
    if (error) { toast.error('Failed to delete — it may already have redemptions on record'); return }
    toast.success(`${coupon.code} deleted`)
    onRemoved(coupon.id)
  }

  const discountLabel = coupon.discount_type === 'percent'
    ? `${coupon.discount_value}% off${coupon.max_discount_ngn ? ` (max ₦${Number(coupon.max_discount_ngn).toLocaleString()})` : ''}`
    : `₦${Number(coupon.discount_value).toLocaleString()} off`

  const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date()
  const isMaxedOut = coupon.max_redemptions != null && coupon.redemption_count >= coupon.max_redemptions

  if (editing) {
    return (
      <div className="rounded-xl p-3.5 flex flex-col gap-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Code</label>
            <input
              value={draft.code}
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
              placeholder="e.g. WELCOME10"
              className="input-base w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Type</label>
            <select
              value={draft.discount_type}
              onChange={(e) => setDraft((d) => ({ ...d, discount_type: e.target.value }))}
              className="input-base w-full text-sm"
            >
              <option value="percent">Percent off</option>
              <option value="fixed">Flat ₦ off</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              {draft.discount_type === 'percent' ? 'Percent (%)' : 'Amount (₦)'}
            </label>
            <input
              type="number" min={0} step={draft.discount_type === 'percent' ? '1' : '100'}
              value={draft.discount_value}
              onChange={(e) => setDraft((d) => ({ ...d, discount_value: e.target.value }))}
              className="input-base w-full text-sm"
            />
          </div>
          {draft.discount_type === 'percent' && (
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max discount (₦, optional)</label>
              <input
                type="number" min={0} step="100"
                value={draft.max_discount_ngn}
                onChange={(e) => setDraft((d) => ({ ...d, max_discount_ngn: e.target.value }))}
                placeholder="No cap"
                className="input-base w-full text-sm"
              />
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Min booking (₦, optional)</label>
            <input
              type="number" min={0} step="100"
              value={draft.min_amount_ngn}
              onChange={(e) => setDraft((d) => ({ ...d, min_amount_ngn: e.target.value }))}
              placeholder="No minimum"
              className="input-base w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Total uses (optional)</label>
            <input
              type="number" min={1}
              value={draft.max_redemptions}
              onChange={(e) => setDraft((d) => ({ ...d, max_redemptions: e.target.value }))}
              placeholder="Unlimited"
              className="input-base w-full text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Uses per user</label>
            <input
              type="number" min={1}
              value={draft.per_user_limit}
              onChange={(e) => setDraft((d) => ({ ...d, per_user_limit: e.target.value }))}
              className="input-base w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Expires (optional)</label>
            <input
              type="datetime-local"
              value={draft.expires_at}
              onChange={(e) => setDraft((d) => ({ ...d, expires_at: e.target.value }))}
              className="input-base w-full text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold flex-1 justify-center" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            {saving ? '…' : <><Check size={12} /> Save</>}
          </button>
          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl p-3.5 flex items-center justify-between gap-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{coupon.code}</p>
          {!coupon.is_active && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>Disabled</span>
          )}
          {isExpired && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}>Expired</span>
          )}
          {isMaxedOut && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.10)', color: '#f59e0b' }}>Maxed out</span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {discountLabel} · {coupon.redemption_count}{coupon.max_redemptions != null ? `/${coupon.max_redemptions}` : ''} used · {coupon.per_user_limit}/user
        </p>
        {coupon.expires_at && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Expires {fmtDateTime(coupon.expires_at)}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button onClick={toggleActive} disabled={saving} className="text-xs font-bold px-2.5 py-1.5 rounded-lg" style={{ background: coupon.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.12)', color: coupon.is_active ? '#ef4444' : '#10b981' }}>
          {coupon.is_active ? 'Disable' : 'Enable'}
        </button>
        <button onClick={open} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
          <Pencil size={12} />
        </button>
        <button onClick={remove} disabled={saving} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

const CouponsManager = () => {
  const { user } = useAuth()
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding,  setAdding]  = useState(false)
  const [draft,   setDraft]   = useState(EMPTY_COUPON)
  const [saving,  setSaving]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await renderWindowBookingCoupons.getAll()
    setCoupons(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async () => {
    const { payload, error: formError } = couponFormToPayload(draft)
    if (formError) { toast.error(formError); return }
    setSaving(true)
    const { data, error } = await renderWindowBookingCoupons.create(user.id, payload)
    setSaving(false)
    if (error) { toast.error(error.message?.includes('duplicate') ? 'That code is already in use' : 'Failed to create coupon'); return }
    toast.success(`${data.code} created`)
    setCoupons((prev) => [data, ...prev])
    setDraft(EMPTY_COUPON)
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Tag size={13} style={{ color: '#6366f1' }} />
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#6366f1' }}>Private Booking Coupons</p>
          </div>
          <button
            onClick={() => { setDraft(EMPTY_COUPON); setAdding((a) => !a) }}
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg"
            style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            {adding ? <X size={11} /> : <Plus size={11} />}
            {adding ? 'Cancel' : 'Add coupon'}
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Discounts apply to a booking's subtotal at checkout. Redemption limits are enforced
          server-side, so a coupon can't be over-redeemed even under concurrent checkouts.
        </p>

        {adding && (
          <div className="rounded-xl p-3.5 flex flex-col gap-2 mb-2" style={{ background: 'var(--bg-card)', border: '1px dashed var(--border-color)' }}>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Code</label>
                <input
                  value={draft.code}
                  onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. WELCOME10"
                  className="input-base w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Type</label>
                <select
                  value={draft.discount_type}
                  onChange={(e) => setDraft((d) => ({ ...d, discount_type: e.target.value }))}
                  className="input-base w-full text-sm"
                >
                  <option value="percent">Percent off</option>
                  <option value="fixed">Flat ₦ off</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  {draft.discount_type === 'percent' ? 'Percent (%)' : 'Amount (₦)'}
                </label>
                <input
                  type="number" min={0} step={draft.discount_type === 'percent' ? '1' : '100'}
                  value={draft.discount_value}
                  onChange={(e) => setDraft((d) => ({ ...d, discount_value: e.target.value }))}
                  className="input-base w-full text-sm"
                />
              </div>
              {draft.discount_type === 'percent' && (
                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Max discount (₦, optional)</label>
                  <input
                    type="number" min={0} step="100"
                    value={draft.max_discount_ngn}
                    onChange={(e) => setDraft((d) => ({ ...d, max_discount_ngn: e.target.value }))}
                    placeholder="No cap"
                    className="input-base w-full text-sm"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Min booking (₦, optional)</label>
                <input
                  type="number" min={0} step="100"
                  value={draft.min_amount_ngn}
                  onChange={(e) => setDraft((d) => ({ ...d, min_amount_ngn: e.target.value }))}
                  placeholder="No minimum"
                  className="input-base w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Total uses (optional)</label>
                <input
                  type="number" min={1}
                  value={draft.max_redemptions}
                  onChange={(e) => setDraft((d) => ({ ...d, max_redemptions: e.target.value }))}
                  placeholder="Unlimited"
                  className="input-base w-full text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Uses per user</label>
                <input
                  type="number" min={1}
                  value={draft.per_user_limit}
                  onChange={(e) => setDraft((d) => ({ ...d, per_user_limit: e.target.value }))}
                  className="input-base w-full text-sm"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Expires (optional)</label>
                <input
                  type="datetime-local"
                  value={draft.expires_at}
                  onChange={(e) => setDraft((d) => ({ ...d, expires_at: e.target.value }))}
                  className="input-base w-full text-sm"
                />
              </div>
            </div>
            <button
              onClick={create}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
            >
              {saving ? 'Adding…' : <><Check size={12} /> Add Coupon</>}
            </button>
          </div>
        )}

        {loading ? (
          <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
        ) : coupons.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
            No coupons yet — add one above.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {coupons.map((c) => (
              <CouponRow
                key={c.id}
                coupon={c}
                onSaved={(updated) => setCoupons((prev) => prev.map((x) => x.id === updated.id ? updated : x))}
                onRemoved={(id) => setCoupons((prev) => prev.filter((x) => x.id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function RenderWindowBookingsManager() {
  const { user }   = useAuth()
  const [bookings, setBookings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('pending')
  const [busy,     setBusy]     = useState(null)
  const [activeTab, setActiveTab] = useState('bookings') // 'bookings' | 'coupons'

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await adminGetBookings({ status: filter })
    if (error) toast.error('Failed to load bookings')
    setBookings(data)
    setLoading(false)
  }, [filter])

  useEffect(() => { if (activeTab === 'bookings') load() }, [load, activeTab])

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
        {activeTab === 'bookings' && (
          <button onClick={load} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} />
          </button>
        )}
      </div>

      <div className="flex gap-1 p-1 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        {[
          { id: 'bookings', label: 'Bookings' },
          { id: 'coupons',  label: 'Coupons' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex-1 py-2 rounded-xl text-sm font-bold transition-all"
            style={{
              background: activeTab === t.id ? 'var(--bg-elevated)' : 'transparent',
              color:      activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'coupons' ? (
        <CouponsManager />
      ) : (
        <>
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
        </>
      )}
    </div>
  )
}
