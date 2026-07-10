// src/pages/RenderWindowPage.jsx
import { useState } from 'react'
import {
  Copy, Check, Users, RefreshCw, Trash2, AlertTriangle, KeyRound, LogOut,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRenderWindowSubscription } from '@/hooks/useRenderWindowSubscription'
import { useRenderWindowTeam } from '@/hooks/useRenderWindowTeam'
import { useRenderWindowCohort } from '@/hooks/useRenderWindowCohort'
import { useRenderWindowBooking } from '@/hooks/useRenderWindowBooking'
import { joinRenderWindowCode } from '@/lib/renderWindowCohort'
import { ActiveModelsTab } from '@/components/renderWindow/ActiveModelsTab'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import toast from 'react-hot-toast'

// ─── Helpers ────────────────────────────────────────────────

const fmtDate = (iso) => {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

const fmtDateTime = (iso) => {
  if (!iso) return null
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const fmtCountdown = (iso) => {
  if (!iso) return null
  const diffMs = new Date(iso) - new Date()
  if (diffMs <= 0) return null
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`
}

const daysRemaining = (iso) => {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso) - new Date()) / (1000 * 60 * 60 * 24)))
}

const expiryLabel = (days) =>
  days === 0 ? 'less than a day' : days === 1 ? '1 day' : `${days} days`

// ─── Studio Access Card (formerly "Individual Plan") ───────
// NOTE: Weekend Access needs no changes here — it's just another row in
// `tiers` (render_window_tiers), same as Daily/Weekly/Monthly. The tier's
// `duration_type` ('fixed_days' vs 'weekend') only affects how expires_at
// is computed server-side on subscribe; this card already renders whatever
// tiers come back generically. Tier display names ("Day Pass" etc.) live
// in the DB (`display_name` column) — not renamed here.

const IndividualPlanCard = ({
  hasActiveSub, windowIsOpen, canUseRW, windowClosesAt, windowOpensAt,
  activeSub, activeTier, tiers, subscribing, onSubscribe, loading,
}) => {
  const [pendingTier, setPendingTier] = useState(null)

  const handleSubscribe = (tierName) => {
    setPendingTier(tierName)
    onSubscribe(tierName)
  }

  return (
    <div
      className="rounded-2xl p-5 mb-3"
      style={{
        background: canUseRW
          ? 'rgba(16,185,129,0.06)'
          : hasActiveSub
            ? 'rgba(99,102,241,0.06)'
            : 'var(--bg-card)',
        border: `1px solid ${
          canUseRW
            ? 'rgba(16,185,129,0.25)'
            : hasActiveSub
              ? 'rgba(99,102,241,0.2)'
              : 'var(--border-color)'
        }`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: canUseRW ? '#10b981' : hasActiveSub ? '#6366f1' : '#888',
            boxShadow:  canUseRW ? '0 0 6px #10b981' : 'none',
          }}
        />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Studio Access
        </p>
        {canUseRW && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            LIVE NOW
          </span>
        )}
        {hasActiveSub && !windowIsOpen && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8' }}
          >
            ACTIVE
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-8 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
      ) : hasActiveSub ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-black" style={{ color: canUseRW ? '#10b981' : 'var(--text-primary)' }}>
                {canUseRW ? '🪟 Free access is live' : '🕐 Waiting for next window'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {canUseRW
                  ? (fmtCountdown(windowClosesAt)
                      ? `Premium models free for ${fmtCountdown(windowClosesAt)} more`
                      : 'Use premium models for free right now')
                  : (windowOpensAt
                      ? `Next window opens ${fmtDateTime(windowOpensAt)}`
                      : 'No window scheduled yet')}
              </p>
            </div>
          </div>

          <div
            className="rounded-xl px-3 py-2.5 flex items-center justify-between"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Your pass</p>
              <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {activeTier?.display_name ? `${activeTier.display_name} · ` : ''}
                expires {fmtDate(activeSub?.expires_at)}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Get access to premium models. Use them for free whenever the studio window is open.
          </p>

          <div className="flex flex-col gap-2 mb-4">
            {[
              { icon: '⚡', text: 'Zero credits charged during open windows' },
              { icon: '📅', text: 'Pick the pass length that fits how often you create' },
            ].map(({ icon, text }) => (
              <div key={text} className="flex items-start gap-2.5">
                <span style={{ fontSize: 13, lineHeight: '18px', flexShrink: 0 }}>{icon}</span>
                <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>{text}</p>
              </div>
            ))}
          </div>

          {tiers.length === 0 ? (
            <div className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
          ) : (
            <div className="flex flex-col gap-2">
              {tiers.map((t) => {
                const isPending = subscribing && pendingTier === t.tier_name
                const disabled  = !t.is_active || subscribing
                return (
                  <button
                    key={t.id}
                    onClick={() => t.is_active && handleSubscribe(t.tier_name)}
                    disabled={disabled}
                    className="w-full flex items-center justify-between gap-2 py-3 px-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                    style={{
                      background: !t.is_active
                        ? 'var(--bg-elevated)'
                        : isPending
                          ? 'rgba(99,102,241,0.08)'
                          : 'rgba(99,102,241,0.12)',
                      color:      !t.is_active ? 'var(--text-muted)' : '#818cf8',
                      border:     `1px solid ${!t.is_active ? 'var(--border-color)' : 'rgba(99,102,241,0.3)'}`,
                      opacity:    disabled && t.is_active ? 0.7 : 1,
                      cursor:     !t.is_active ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <span>🪟 {t.display_name}</span>
                    <span className="text-xs font-semibold">
                      {!t.is_active
                        ? 'Currently unavailable'
                        : isPending
                          ? 'Activating…'
                          : `₦${Number(t.price_ngn).toLocaleString()} · ${
                              t.duration_type === 'weekend' ? 'Weekend' : `${t.duration_days}d`
                            }`}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Unified "Have a Code?" Join Card ──────────────────────
// Tries Team codes and Cohort codes transparently — the user doesn't need
// to know which kind of code they were given.

const CodeJoinCard = ({ onJoin, joining }) => {
  const [code, setCode] = useState('')

  return (
    <div
      className="rounded-2xl p-5 mb-3"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <KeyRound size={15} style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Have a code?
        </p>
      </div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter team or cohort code"
          className="input-base flex-1 text-sm font-mono"
        />
        <button
          onClick={() => onJoin(code)}
          disabled={joining || !code.trim()}
          className="px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0"
          style={{
            background: code.trim() ? 'var(--brand)' : 'var(--bg-elevated)',
            color:      code.trim() ? 'white' : 'var(--text-muted)',
            opacity:    joining ? 0.7 : 1,
          }}
        >
          {joining ? '…' : 'Join'}
        </button>
      </div>
    </div>
  )
}

// ─── Team Purchase Card (RW Sellers only) ─────────────────

const TeamPurchaseCard = ({ tiers, purchasing, onPurchase }) => {
  const [pendingTier, setPendingTier] = useState(null)

  const handlePurchase = (tierId) => {
    setPendingTier(tierId)
    onPurchase(tierId)
  }

  return (
    <div
      className="rounded-2xl p-5 mb-3"
      style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Users size={15} style={{ color: '#f59e0b' }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>
          Team Plans · Studio Seller
        </p>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Buy a Team plan and share your invite code — each seat gets its own daily quota.
      </p>

      {tiers.length === 0 ? (
        <div className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
      ) : (
        <div className="flex flex-col gap-2">
          {tiers.map((t) => {
            const isPending = purchasing && pendingTier === t.id
            return (
              <button
                key={t.id}
                onClick={() => handlePurchase(t.id)}
                disabled={purchasing}
                className="w-full flex items-center justify-between gap-2 py-3 px-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  color:      '#f59e0b',
                  border:     '1px solid rgba(245,158,11,0.3)',
                  opacity:    purchasing ? 0.7 : 1,
                }}
              >
                <span>👥 {t.display_name} · {t.seat_count} seats</span>
                <span className="text-xs font-semibold">
                  {isPending ? 'Activating…' : `₦${Number(t.price_ngn).toLocaleString()} · ${t.duration_days}d`}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Team Owner Dashboard ──────────────────────────────────

const TeamOwnerCard = ({ ownerTeam, seatUsageMap, busySeat, resetting, onRemove, onReset, windowIsOpen, windowClosesAt }) => {
  const [copied, setCopied] = useState(false)
  const { team, seats } = ownerTeam
  const tier = team.tier
  const days = daysRemaining(team.expires_at)
  const showWarning = days !== null && days <= 3

  const handleCopy = async () => {
    await navigator.clipboard.writeText(team.team_invite_code)
    setCopied(true)
    toast.success('Code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="rounded-2xl p-5 mb-3"
      style={{
        background: windowIsOpen ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
        border:     `1px solid ${windowIsOpen ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Users size={15} style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Your Team · {tier?.display_name}
        </p>
        {windowIsOpen && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            LIVE NOW
          </span>
        )}
      </div>

      {windowIsOpen && (
        <p className="text-sm font-black mb-3" style={{ color: '#10b981' }}>
          🪟 Free access is live for your team{fmtCountdown(windowClosesAt) ? ` — ${fmtCountdown(windowClosesAt)} left` : ''}
        </p>
      )}

      {showWarning && (
        <div
          className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p className="text-xs font-bold" style={{ color: '#ef4444' }}>
            Team expires in {expiryLabel(days)} — the team will be dissolved when it expires.
          </p>
        </div>
      )}

      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-4"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <p className="flex-1 text-sm font-mono font-bold tracking-wider" style={{ color: 'var(--text-primary)' }}>
          {team.team_invite_code}
        </p>
        <button onClick={handleCopy} className="flex-shrink-0 transition-all active:scale-90">
          {copied
            ? <Check size={14} style={{ color: 'var(--brand)' }} />
            : <Copy size={14} style={{ color: 'var(--text-muted)' }} />
          }
        </button>
      </div>

      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        Seats · {seats.filter((s) => s.member_id).length}/{seats.length} filled · {tier?.daily_unit_quota} units/day each · expires {fmtDate(team.expires_at)}
      </p>

      <div className="flex flex-col gap-2 mb-3">
        {seats.map((seat) => {
          const used = seatUsageMap?.[seat.seat_number] ?? 0
          const isOwnerSeat = seat.member_id === team.owner_id
          return (
            <div
              key={seat.id}
              className="rounded-xl px-3 py-2.5 flex items-center justify-between"
              style={{ background: 'var(--bg-elevated)' }}
            >
              <div className="min-w-0">
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  Seat #{seat.seat_number}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {seat.member
                    ? `@${seat.member.username}${isOwnerSeat ? ' (you)' : ''} · ${used}/${tier?.daily_unit_quota} used today`
                    : 'Open — share your code'}
                </p>
              </div>
              {seat.member_id && !isOwnerSeat && (
                <button
                  onClick={() => onRemove(seat.seat_number)}
                  disabled={busySeat === seat.seat_number}
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

      <button
        onClick={onReset}
        disabled={resetting}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
      >
        <RefreshCw size={12} />
        {resetting ? 'Resetting…' : 'Reset team code'}
      </button>
    </div>
  )
}

// ─── Team Member Card ──────────────────────────────────────

const TeamMemberCard = ({ memberTeam, usageToday, windowIsOpen, windowClosesAt }) => {
  const { team, seat } = memberTeam
  const tier = team.tier
  const days = daysRemaining(team.expires_at)
  const showWarning = days !== null && days <= 3

  return (
    <div
      className="rounded-2xl p-5 mb-3"
      style={{
        background: windowIsOpen ? 'rgba(16,185,129,0.06)' : 'rgba(99,102,241,0.06)',
        border:     `1px solid ${windowIsOpen ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.2)'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Users size={15} style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Team Member · Seat #{seat.seat_number}
        </p>
        {windowIsOpen && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            LIVE NOW
          </span>
        )}
      </div>

      {windowIsOpen && (
        <p className="text-sm font-black mb-2" style={{ color: '#10b981' }}>
          🪟 Free access is live{fmtCountdown(windowClosesAt) ? ` — ${fmtCountdown(windowClosesAt)} left` : ''}
        </p>
      )}

      {showWarning && (
        <div
          className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p className="text-xs font-bold" style={{ color: '#ef4444' }}>
            Team access expires in {expiryLabel(days)}
          </p>
        </div>
      )}

      <div
        className="rounded-xl px-3 py-2.5"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Today's usage</p>
        <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
          {usageToday}/{tier?.daily_unit_quota} units · expires {fmtDate(team.expires_at)}
        </p>
      </div>
    </div>
  )
}

// ─── Cohort Member Card ─────────────────────────────────────
// Same experience as Team Member — seat, quota, expiry — plus a Leave
// button, since cohorts have no owner to manage the roster for you.

const CohortMemberCard = ({ memberCohort, usageToday, leaving, onLeave, windowIsOpen, windowClosesAt }) => {
  const { cohort, seat } = memberCohort
  const days = daysRemaining(cohort.ends_at)
  const showWarning = days !== null && days <= 3

  return (
    <div
      className="rounded-2xl p-5 mb-3"
      style={{
        background: windowIsOpen ? 'rgba(16,185,129,0.06)' : 'rgba(99,102,241,0.06)',
        border:     `1px solid ${windowIsOpen ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.2)'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Users size={15} style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          {cohort.name} · Seat #{seat.seat_number}
        </p>
        {windowIsOpen && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            LIVE NOW
          </span>
        )}
      </div>

      {windowIsOpen && (
        <p className="text-sm font-black mb-2" style={{ color: '#10b981' }}>
          🪟 Free access is live{fmtCountdown(windowClosesAt) ? ` — ${fmtCountdown(windowClosesAt)} left` : ''}
        </p>
      )}

      {showWarning && (
        <div
          className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          <AlertTriangle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p className="text-xs font-bold" style={{ color: '#ef4444' }}>
            Cohort access ends in {expiryLabel(days)}
          </p>
        </div>
      )}

      <div
        className="rounded-xl px-3 py-2.5 mb-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Today's usage</p>
        <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
          {usageToday}/{cohort.daily_unit_quota} units · ends {fmtDate(cohort.ends_at)}
        </p>
      </div>

      <button
        onClick={onLeave}
        disabled={leaving}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
      >
        <LogOut size={12} />
        {leaving ? 'Leaving…' : 'Leave cohort'}
      </button>
    </div>
  )
}

// ─── AI Session Card (private booking) ─────────────────────

const fmtCountdownMs = (ms) => {
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

const PrivateBookingCard = () => {
  const navigate = useNavigate()
  const {
    loading, activeBookings, upcomingBooking, pendingBookings,
    resetPendingBookings, countdownMs,
  } = useRenderWindowBooking()

  if (loading) return null

  const hasLive     = activeBookings.length > 0
  const hasUpcoming = !!upcomingBooking
  const hasPending  = pendingBookings.length > 0
  const hasReset    = resetPendingBookings.length > 0

  return (
    <div
      className="rounded-2xl p-5 mb-3"
      style={{
        background: hasLive ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
        border:     `1px solid ${hasLive ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <CalendarClock size={15} style={{ color: hasLive ? '#10b981' : 'var(--text-muted)' }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          AI Session
        </p>
        {hasLive && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
            LIVE NOW
          </span>
        )}
      </div>

    {hasLive && (
  <p className="text-sm font-black mb-1" style={{ color: '#10b981' }}>
    Your session is live — enjoy creating with your Model(s), no credit charges.
  </p>
)}

      {!hasLive && hasUpcoming && (
        <>
          <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Your session starts in</p>
         <p className="text-2xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
            {fmtCountdownMs(countdownMs)}
          </p>
        </>
      )}

      {!hasLive && !hasUpcoming && hasPending && (
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          You have a booking awaiting admin confirmation.
        </p>
      )}

      {hasReset && (
        <p className="text-xs mb-2 font-semibold" style={{ color: '#6366f1' }}>
          One of your bookings needs a new time — pick one below.
        </p>
      )}

      {!hasLive && !hasUpcoming && !hasPending && !hasReset && (
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Reserve a session on the model(s) of your choice — no credit costs, use it as much as you like.
        </p>
      )}

      <button
        onClick={() => navigate('/render-window/book')}
        className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
      >
        {hasReset ? 'Pick a new time' : 'Book AI Session'}
      </button>
    </div>
  )
}

// ─── Render Window Page ────────────────────────────────

export default function RenderWindowPage() {
  const { user } = useAuth()
  const rw = useRenderWindowSubscription()
  const {
    isRwSeller, tiers: teamTiers, ownerTeam, memberTeam, usageToday, seatUsageMap,
    loading: teamLoading, purchasing, busySeat, resetting,
    purchase, removeMember, resetCode, refresh: refreshTeam,
  } = useRenderWindowTeam()
  const {
    memberCohort, usageToday: cohortUsageToday, loading: cohortLoading,
    leaving, leave: leaveCohort, refresh: refreshCohort,
  } = useRenderWindowCohort()

  const [joining, setJoining] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Unified join — tries Team code, then Cohort code, server-side.
  // Mutual exclusivity (can't join a cohort while in a team, and vice
  // versa, one of each at a time) is enforced by the RPC, not here.
  const handleJoin = async (code) => {
    if (!user?.id) return
    if (!code?.trim()) { toast.error('Enter a code'); return }
    setJoining(true)
    const { data, error } = await joinRenderWindowCode(user.id, code.trim())
    setJoining(false)
    if (error || !data?.success) {
      toast.error(data?.error || 'Could not join')
      return
    }
    toast.success(data.seat_number ? `Joined — seat #${data.seat_number}` : 'Joined')
    refreshTeam()
    refreshCohort()
  }

  const groupsLoading = teamLoading || cohortLoading
  const showJoinCard  = !groupsLoading && !ownerTeam && !memberTeam && !memberCohort

  // Active Models tab is only shown to "Community" users — active Individual
  // subscribers, Team members/owners, or Cohort members. Private-booking-only
  // and credit-only users never see the tab exists. This check uses state
  // already loaded by the hooks above (no extra round trip), and is purely
  // for whether to SHOW the tab — the RPC behind it enforces the real
  // eligibility boundary server-side regardless of what the UI does.
  const isCommunityUser = rw.hasActiveSub || !!ownerTeam || !!memberTeam || !!memberCohort

  return (
    <>
      <TopBar showBack title="Studio" showCredits />
      <PageWrapper>

        {!groupsLoading && isCommunityUser && (
          <div
            className="flex gap-1 p-1 rounded-2xl mb-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            {[
              { id: 'overview',      label: 'Overview' },
              { id: 'active_models', label: 'Active Models' },
            ].map((t) => {
              const isActive = activeTab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={{
                    background: isActive ? 'var(--bg-elevated)' : 'transparent',
                    color:      isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        )}

        {activeTab === 'active_models' && isCommunityUser ? (
          <ActiveModelsTab />
        ) : (
          <>
            <PrivateBookingCard />

            <IndividualPlanCard
              hasActiveSub={rw.hasActiveSub}
              windowIsOpen={rw.windowIsOpen}
              canUseRW={rw.canUseRWModels}
              windowClosesAt={rw.windowClosesAt}
              windowOpensAt={rw.windowOpensAt}
              activeSub={rw.activeSub}
              activeTier={rw.activeTier}
              tiers={rw.tiers}
              subscribing={rw.subscribing}
              onSubscribe={rw.subscribe}
              loading={rw.loading}
            />

           {!teamLoading && ownerTeam && (
              <TeamOwnerCard
                ownerTeam={ownerTeam}
                seatUsageMap={seatUsageMap}
                busySeat={busySeat}
                resetting={resetting}
                onRemove={removeMember}
                onReset={resetCode}
                windowIsOpen={rw.windowIsOpen}
                windowClosesAt={rw.windowClosesAt}
              />
            )}

            {!teamLoading && !ownerTeam && memberTeam && (
              <TeamMemberCard
                memberTeam={memberTeam}
                usageToday={usageToday}
                windowIsOpen={rw.windowIsOpen}
                windowClosesAt={rw.windowClosesAt}
              />
            )}

            {!cohortLoading && memberCohort && (
              <CohortMemberCard
                memberCohort={memberCohort}
                usageToday={cohortUsageToday}
                leaving={leaving}
                onLeave={leaveCohort}
                windowIsOpen={rw.windowIsOpen}
                windowClosesAt={rw.windowClosesAt}
              />
            )}
            {!teamLoading && isRwSeller && !ownerTeam && (
              <TeamPurchaseCard tiers={teamTiers} purchasing={purchasing} onPurchase={purchase} />
            )}

            {showJoinCard && (
              <CodeJoinCard onJoin={handleJoin} joining={joining} />
            )}
          </>
        )}

      </PageWrapper>
    </>
  )
          }
