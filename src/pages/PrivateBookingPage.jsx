// src/pages/PrivateBookingPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Check, Tag, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRenderWindowBooking } from '@/hooks/useRenderWindowBooking'
import { bookableModels, renderWindowBookingDurations, renderWindowBookingCoupons } from '@/lib/renderWindowBooking'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'

// ── Config ───────────────────────────────────────────────────────────────

const MIN_BOOKING_LEAD_HOURS = 2 // admin needs time to confirm and schedule the session

// ── Helpers ──────────────────────────────────────────────────────────────

const fmtDateTime = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

const fmtCountdown = (ms) => {
  if (ms == null) return null
  if (ms <= 0) return 'starting now'
  const totalSec = Math.floor(ms / 1000)
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

const STATUS_META = {
  pending:       { label: 'Awaiting admin confirmation', color: '#f59e0b' },
  accepted:      { label: 'Confirmed',                   color: '#10b981' },
  cancelled:     { label: 'Cancelled',                    color: '#ef4444' },
  reset_pending: { label: 'Needs a new time',             color: '#6366f1' },
  expired:       { label: 'Expired',                      color: '#888'    },
}

// ── Bookings tab status dot ─────────────────────────────────────────────
// Derives a single glanceable indicator for the tab bar from the full
// bookings list, without the user needing to open the tab first.
const getTabIndicator = (bookings, now) => {
  if (!bookings || bookings.length === 0) return null

  const isLive = (b) =>
    b.status === 'accepted' &&
    b.requested_start_at && new Date(b.requested_start_at) <= now &&
    b.ends_at && new Date(b.ends_at) > now

  if (bookings.some(isLive)) return { color: '#10b981', pulse: true }
  if (bookings.some((b) => b.status === 'pending' || b.status === 'reset_pending')) {
    return { color: '#f59e0b', pulse: false }
  }
  if (bookings.some((b) => b.status === 'accepted')) return { color: '#10b981', pulse: false }
  return { color: '#888', pulse: false } // only history (cancelled/expired) left
}

// ── Booking form (used for both new bookings and reconfiguring a reset) ──

const BookingForm = ({ userId, models, durations, onSubmit, submitting, maxAmountNgn, submitLabel }) => {
  const [selectedIds, setSelectedIds]   = useState([])
  const [expandedId,  setExpandedId]    = useState(null) // which model card is expanded, if any
  const [startAt,      setStartAt]      = useState('')
  const [durationId,   setDurationId]   = useState(durations[0]?.id ?? '')
  const [whatsapp,     setWhatsapp]     = useState('')
  const [couponInput,   setCouponInput]   = useState('')
  const [coupon,        setCoupon]        = useState(null) // validated result from the server, or null
  const [couponChecking, setCouponChecking] = useState(false)
  const [couponError,    setCouponError]    = useState(null)

  const toggleModel = (id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const selectedDuration = durations.find((d) => d.id === durationId) ?? null

  const subtotal = useMemo(() => {
    if (!selectedDuration) return 0
    return Number(selectedDuration.price_ngn) * selectedIds.length
  }, [selectedDuration, selectedIds])

  // A previously-applied coupon's discount was computed against a specific
  // subtotal — if the selection or duration changes, that number is stale.
  // Require the user to re-apply rather than silently trust an old discount.
  useEffect(() => {
    setCoupon(null)
    setCouponError(null)
  }, [selectedIds.join(','), durationId])

  const discount = coupon?.discount_ngn ? Number(coupon.discount_ngn) : 0
  const total = Math.max(0, subtotal - discount)

  const applyCoupon = async () => {
    const code = couponInput.trim()
    if (!code || subtotal <= 0) return
    setCouponChecking(true)
    setCouponError(null)
    const { data, error } = await renderWindowBookingCoupons.validate(code, userId, subtotal)
    setCouponChecking(false)
    if (error || !data?.valid) {
      setCoupon(null)
      setCouponError(data?.error || error?.message || 'Invalid coupon')
      return
    }
    setCoupon(data)
  }

  const removeCoupon = () => {
    setCoupon(null)
    setCouponInput('')
    setCouponError(null)
  }

  const overBudget = maxAmountNgn != null && total > maxAmountNgn + 1
  const minStart = new Date(Date.now() + MIN_BOOKING_LEAD_HOURS * 60 * 60 * 1000).toISOString().slice(0, 16)

  const isValid =
    selectedIds.length > 0 &&
    startAt &&
    new Date(startAt) >= new Date(minStart) &&
    !!durationId &&
    !overBudget

  const handleSubmit = () => {
    if (!isValid) return
    onSubmit({ modelIds: selectedIds, startAt, durationId, whatsappNumber: whatsapp, couponCode: coupon?.code || null })
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-2" style={{ color: 'var(--text-muted)' }}>
          Select model(s)
        </label>
        <div className="flex flex-col gap-2">
          {models.map((m) => {
            const isSelected = selectedIds.includes(m.id)
            const isExpanded = expandedId === m.id
            // description is a per-model DB field (models.description) — plain-language
            // explanation of what the model is for, editable by admins without a deploy.
            const blurb = m.description || m.sublabel || null

            return (
              <div
                key={m.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{
                  background: isSelected ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                  border:     `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : 'var(--border-color)'}`,
                }}
              >
                {/* Header row — expands the description if there is one,
                    otherwise just toggles selection directly. */}
                <button
                  onClick={() => blurb ? setExpandedId(isExpanded ? null : m.id) : toggleModel(m.id)}
                  className="w-full flex items-center justify-between gap-3 py-3 px-3.5 text-left active:scale-[0.99] transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isSelected && <Check size={14} style={{ color: '#818cf8', flexShrink: 0 }} />}
                    <span
                      className="text-sm font-bold truncate"
                      style={{ color: isSelected ? '#818cf8' : 'var(--text-primary)' }}
                    >
                      {m.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedDuration && (
                      <span
                        className="text-xs font-semibold"
                        style={{ color: isSelected ? '#818cf8' : 'var(--text-primary)' }}
                      >
                        ₦{Number(selectedDuration.price_ngn).toLocaleString()}
                      </span>
                    )}
                    {blurb && (
                      isExpanded
                        ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                        : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>
                </button>

                {/* Expanded panel — read the description, then an explicit
                    CTA to add/remove it from the booking. */}
                {isExpanded && blurb && (
                  <div className="px-3.5 pb-3.5 flex flex-col gap-3">
                    <p className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
                      {blurb}
                    </p>
                    <button
                      onClick={() => toggleModel(m.id)}
                      className="w-full py-2.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98]"
                      style={{
                        background: isSelected ? 'rgba(239,68,68,0.12)' : 'var(--brand)',
                        color:      isSelected ? '#ef4444' : 'white',
                      }}
                    >
                      {isSelected ? 'Remove from booking' : 'Add to booking'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Start time
        </label>
        <input
          type="datetime-local"
          min={minStart}
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          className="input-base w-full text-sm"
        />
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          At least 2 hours from now — admin needs time to confirm and schedule the session.
        </p>
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Duration
        </label>
        {durations.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No durations are currently available.
          </p>
        ) : (
          <select
            value={durationId}
            onChange={(e) => setDurationId(e.target.value)}
            className="input-base w-full text-sm"
          >
            {durations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} · ₦{Number(d.price_ngn).toLocaleString()}/model
              </option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          WhatsApp number (optional)
        </label>
        <input
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="e.g. 0803 000 0000"
          className="input-base w-full text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Coupon code (optional)
        </label>
        {coupon ? (
          <div
            className="flex items-center justify-between rounded-xl px-3.5 py-2.5"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#10b981' }}>
              <Tag size={12} /> {coupon.code} applied — ₦{Number(coupon.discount_ngn).toLocaleString()} off
            </span>
            <button onClick={removeCoupon} className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ color: '#10b981' }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon() }}
              placeholder="e.g. WELCOME10"
              className="input-base flex-1 text-sm"
            />
            <button
              onClick={applyCoupon}
              disabled={!couponInput.trim() || subtotal <= 0 || couponChecking}
              className="px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap"
              style={{
                background: couponInput.trim() ? 'var(--brand)' : 'var(--bg-card)',
                color:      couponInput.trim() ? 'white' : 'var(--text-muted)',
              }}
            >
              {couponChecking ? '…' : 'Apply'}
            </button>
          </div>
        )}
        {couponError && (
          <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: '#ef4444' }}>
            <AlertTriangle size={11} /> {couponError}
          </p>
        )}
      </div>

      <div
        className="rounded-xl px-3.5 py-3 flex flex-col gap-1"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        {discount > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Subtotal</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>₦{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: '#10b981' }}>Discount</span>
              <span className="text-xs" style={{ color: '#10b981' }}>-₦{discount.toLocaleString()}</span>
            </div>
          </>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>Total</span>
          <span className="text-lg font-black" style={{ color: overBudget ? '#ef4444' : 'var(--text-primary)' }}>
            ₦{total.toLocaleString()}
          </span>
        </div>
      </div>

      {overBudget && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#ef4444' }}>
          <AlertTriangle size={12} /> This exceeds the ₦{maxAmountNgn.toLocaleString()} you already paid. Reduce hours or models.
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid || submitting}
        className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
        style={{
          background: isValid ? 'var(--brand)' : 'var(--bg-card)',
          color:      isValid ? 'white'        : 'var(--text-muted)',
          opacity:    submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'Processing…' : submitLabel}
      </button>
    </div>
  )
}

// ── Booking Card (read-only, for pending/accepted/cancelled) ──────────────

const BookingCard = ({ b, now }) => {
  const meta = STATUS_META[b.status] ?? STATUS_META.pending
  const modelLabels = (b.models || []).map((m) => m.model?.label).filter(Boolean).join(', ')
  const isUpcoming = b.status === 'accepted' && b.requested_start_at && new Date(b.requested_start_at) > now
  const isLive     = b.status === 'accepted' && new Date(b.requested_start_at) <= now && new Date(b.ends_at) > now
  const countdown  = isUpcoming ? fmtCountdown(new Date(b.requested_start_at).getTime() - now.getTime()) : null

  return (
    <div
      className="rounded-2xl p-4 mb-3"
      style={{
        background: isLive ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
        border:     `1px solid ${isLive ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{modelLabels || 'Booking'}</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: `${meta.color}20`, color: meta.color }}>
          {isLive ? 'Live now' : meta.label}
        </span>
      </div>

      {b.requested_start_at && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {fmtDateTime(b.requested_start_at)} → {fmtDateTime(b.ends_at)}
        </p>
      )}

      {countdown && (
        <p className="text-lg font-black mt-2" style={{ color: '#10b981' }}>⏳ {countdown}</p>
      )}

      {isLive && (
        <p className="text-xs mt-2 font-semibold" style={{ color: '#10b981' }}>
          Your private session is live — use {modelLabels} as much as you like, no credit charges, until it ends.
        </p>
      )}

      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
        ₦{Number(b.amount_ngn).toLocaleString()} paid
        {b.duration_hours ? ` · ${b.duration_hours}h` : ''}
      </p>

      {b.admin_notes && (
        <p className="text-xs mt-2 italic" style={{ color: 'var(--text-muted)' }}>"{b.admin_notes}"</p>
      )}
    </div>
  )
}

// ── Tab bar ──────────────────────────────────────────────────────────────

const TabBar = ({ activeTab, setActiveTab, indicator }) => {
  const tabs = [
    { id: 'book',     label: 'Book' },
    { id: 'bookings', label: 'Your Bookings' },
  ]

  return (
    <div
      className="flex gap-1 p-1 rounded-2xl mb-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {tabs.map((t) => {
        const isActive = activeTab === t.id
        return (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: isActive ? 'var(--bg-elevated)' : 'transparent',
              color:      isActive ? 'var(--text-primary)' : 'var(--text-muted)',
            }}
          >
            {t.label}
            {t.id === 'bookings' && indicator && (
              <span
                className="inline-block rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  background: indicator.color,
                  boxShadow: indicator.pulse ? `0 0 0 3px ${indicator.color}33` : 'none',
                  animation: indicator.pulse ? 'pulse-dot 1.6s ease-in-out infinite' : 'none',
                }}
              />
            )}
          </button>
        )
      })}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function PrivateBookingPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const {
    bookings, loading, booking, book, reconfigure, refresh,
    resetPendingBookings, countdownMs,
  } = useRenderWindowBooking()

  const [models,        setModels]        = useState([])
  const [modelsLoading,  setModelsLoading] = useState(true)
  const [durations,      setDurations]     = useState([])
  const [durationsLoading, setDurationsLoading] = useState(true)
  const [activeTab,      setActiveTab]     = useState('book')

  useEffect(() => {
    bookableModels.getAll().then(({ data }) => {
      setModels(data || [])
      setModelsLoading(false)
    })
    renderWindowBookingDurations.getActive().then(({ data }) => {
      setDurations(data || [])
      setDurationsLoading(false)
    })
  }, [])

  const now = new Date()
  const activeReset = resetPendingBookings[0] ?? null
  const indicator = useMemo(() => getTabIndicator(bookings, now), [bookings])

  // If a reset needs attention, surface it by default — same reasoning as
  // before, just now expressed as a tab switch instead of a reorder.
  useEffect(() => {
    if (activeReset) setActiveTab('book')
  }, [activeReset])

  return (
    <>
      <TopBar showBack title="Book Private Session" showCredits />
      <PageWrapper>

        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} indicator={indicator} />

        {activeTab === 'book' && (
          <>
            {activeReset && (
              <div
                className="rounded-2xl p-4 mb-4"
                style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.25)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={14} style={{ color: '#6366f1' }} />
                  <p className="text-sm font-bold" style={{ color: '#6366f1' }}>
                    Pick a new time — ₦{Number(activeReset.amount_ngn).toLocaleString()} already paid
                  </p>
                </div>
                {activeReset.admin_notes && (
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>"{activeReset.admin_notes}"</p>
                )}
                {!modelsLoading && !durationsLoading && (
                  <BookingForm
                    userId={user?.id}
                    models={models}
                    durations={durations}
                    maxAmountNgn={Number(activeReset.amount_ngn)}
                    submitting={booking}
                    submitLabel="Save new time"
                    onSubmit={(cfg) => reconfigure(activeReset.id, cfg)}
                  />
                )}
              </div>
            )}

            {!activeReset && (
              <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={15} style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    New Private Booking
                  </p>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Reserve a private creative session on the model(s) of your choice — no credit costs,
                  use it as much as you like for the time you book. Payment is instant; we'll confirm
                  your session shortly after, and you'll see a countdown here once it's locked in.
                </p>
                {modelsLoading || durationsLoading ? (
                  <div className="h-40 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                ) : models.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                    No models are currently available for private booking.
                  </p>
                ) : durations.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
                    No booking durations are currently available.
                  </p>
                ) : (
                  <BookingForm
                    userId={user?.id}
                    models={models}
                    durations={durations}
                    maxAmountNgn={null}
                    submitting={booking}
                    submitLabel="Pay & Request Booking"
                    onSubmit={book}
                  />
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'bookings' && (
          <div>
            {loading ? (
              <div className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
            ) : bookings.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>No bookings yet.</p>
            ) : (
              bookings
                .filter((b) => b.status !== 'reset_pending')
                .map((b) => <BookingCard key={b.id} b={b} now={now} />)
            )}
          </div>
        )}

      </PageWrapper>
    </>
  )
}
