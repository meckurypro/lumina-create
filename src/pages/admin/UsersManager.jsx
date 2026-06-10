// src/pages/admin/UsersManager.jsx
import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ChevronRight, Zap, Clock, Star, TrendingDown, User, Calendar, Layers, ShieldCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import PromptIQAccessManager from '@/pages/admin/PromptIQAccessManager'
import toast from 'react-hot-toast'

// ─── Helpers ─────────────────────────────────────────────

const fmt = (n) => (n ?? 0).toFixed(1)
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const timeAgo = (d) => {
  if (!d) return 'Never'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(d)
}
const daysLeft = (expires) => {
  if (!expires) return null
  return Math.max(0, Math.ceil((new Date(expires) - new Date()) / 86400000))
}

// ─── Credit Adjuster ──────────────────────────────────────

const CreditAdjuster = ({ user, onClose, onUpdated }) => {
  const { user: admin } = useAuth()
  const [amount, setAmount] = useState('')
  const [note, setNote]     = useState('')
  const [saving, setSaving] = useState(false)
  const isNegative          = amount.startsWith('-')
  const parsed              = parseFloat(amount)
  const isValid             = !isNaN(parsed) && parsed !== 0

  const handleAdjust = async () => {
    if (!isValid) return
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_adjust_credits', {
      p_admin_id: admin.id,
      p_user_id:  user.id,
      p_amount:   parsed,
      p_note:     note.trim() || (parsed > 0 ? 'Credits added by admin' : 'Credits deducted by admin'),
    })
    setSaving(false)
    if (error) { toast.error(`RPC error: ${error.message}`); return }
    if (!data?.success) { toast.error(`Failed: ${data?.error || 'Unknown error'}`); return }
    toast.success(parsed > 0 ? `+${parsed} credits added to @${user.username}` : `${parsed} credits deducted from @${user.username}`)
    onUpdated(user.id, data.balance_after)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="rounded-t-3xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Adjust Credits</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              @{user.username} · current balance: ⚡{fmt(user.credits)}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Quick add</p>
          <div className="flex gap-2">
            {[50, 100, 250, 500].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: amount === String(v) ? 'var(--brand)' : 'var(--bg-elevated)', color: amount === String(v) ? 'white' : 'var(--text-secondary)' }}>
                +{v}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {[-50, -100, -250, -500].map((v) => (
              <button key={v} onClick={() => setAmount(String(v))} className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: amount === String(v) ? 'rgba(239,68,68,0.15)' : 'var(--bg-elevated)', color: amount === String(v) ? '#ef4444' : 'var(--text-secondary)' }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Custom amount</p>
          <div className="flex gap-2">
            <button
              onClick={() => setAmount((v) => v.startsWith('-') ? v.slice(1) : v ? `-${v}` : '-')}
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: isNegative ? 'rgba(239,68,68,0.15)' : 'var(--bg-elevated)', color: isNegative ? '#ef4444' : 'var(--text-muted)' }}
            >
              {isNegative ? '−' : '+'}
            </button>
            <input
              type="number" value={amount.replace('-', '')}
              onChange={(e) => { const raw = e.target.value; setAmount(isNegative ? (raw ? `-${raw}` : '-') : raw) }}
              placeholder="0" className="input-base flex-1 text-center text-lg font-bold"
              style={{ color: isNegative ? '#ef4444' : 'var(--brand)' }}
            />
          </div>
        </div>

        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)…" className="input-base text-sm" />

        {isValid && (
          <div className="rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background: parsed > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${parsed > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>New balance</p>
              <p className="text-lg font-black" style={{ color: parsed > 0 ? '#10b981' : '#ef4444' }}>⚡ {((user.credits || 0) + parsed).toFixed(1)}</p>
            </div>
            <p className="text-sm font-bold" style={{ color: parsed > 0 ? '#10b981' : '#ef4444' }}>{parsed > 0 ? `+${parsed}` : parsed}</p>
          </div>
        )}

        <button onClick={handleAdjust} disabled={!isValid || saving} className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
          style={{ background: !isValid ? 'var(--bg-elevated)' : parsed > 0 ? '#10b981' : '#ef4444', color: !isValid ? 'var(--text-muted)' : 'white', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Saving…' : !isValid ? 'Enter an amount' : parsed > 0 ? `Add ${parsed} credits` : `Deduct ${Math.abs(parsed)} credits`}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Tier Adjuster ────────────────────────────────────────

const TierAdjuster = ({ user, onClose, onUpdated }) => {
  const [saving, setSaving] = useState(false)
  const isMaster = user.user_tier === 'master'

  const handleSetMaster = async () => {
    setSaving(true)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)
    const { error } = await supabase.from('profiles').update({ user_tier: 'master', tier_started_at: new Date().toISOString(), tier_expires_at: expiresAt.toISOString() }).eq('id', user.id)
    setSaving(false)
    if (error) { toast.error('Failed to update tier'); return }
    toast.success(`@${user.username} is now Master for 30 days`)
    onUpdated(user.id, { user_tier: 'master', tier_expires_at: expiresAt.toISOString() })
    onClose()
  }

  const handleSetNovice = async () => {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ user_tier: 'novice', tier_started_at: null, tier_expires_at: null }).eq('id', user.id)
    setSaving(false)
    if (error) { toast.error('Failed to update tier'); return }
    toast.success(`@${user.username} set back to Novice`)
    onUpdated(user.id, { user_tier: 'novice', tier_expires_at: null })
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="rounded-t-3xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Set Tier</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              @{user.username} · currently{' '}
              <span style={{ color: isMaster ? '#f59e0b' : 'var(--text-muted)', fontWeight: 700 }}>{isMaster ? 'Master' : 'Novice'}</span>
              {isMaster && user.tier_expires_at && <span> · expires {fmtDate(user.tier_expires_at)}</span>}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>

        <div className="rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: isMaster ? 'rgba(245,158,11,0.08)' : 'var(--bg-elevated)', border: `1px solid ${isMaster ? 'rgba(245,158,11,0.25)' : 'var(--border-color)'}` }}>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Current tier</p>
            <p className="text-lg font-black" style={{ color: isMaster ? '#f59e0b' : 'var(--text-primary)' }}>{isMaster ? '⭐ Master' : 'Novice'}</p>
          </div>
          {isMaster && user.tier_expires_at && (
            <div className="text-right">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Expires</p>
              <p className="text-sm font-bold" style={{ color: '#f59e0b' }}>{daysLeft(user.tier_expires_at)} days</p>
            </div>
          )}
        </div>

        {!isMaster ? (
          <button onClick={handleSetMaster} disabled={saving} className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
            style={{ background: '#f59e0b', color: 'white', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : '⭐ Make Master (30 days)'}
          </button>
        ) : (
          <button onClick={handleSetNovice} disabled={saving} className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Saving…' : 'Downgrade to Novice'}
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── User Detail Sheet ────────────────────────────────────

const SPEND_WINDOWS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: 'All', days: null },
]

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="flex flex-col gap-1 rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
    <div className="flex items-center gap-1.5">
      <Icon size={11} style={{ color: accent || 'var(--text-muted)' }} />
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
    <p className="text-sm font-black" style={{ color: accent || 'var(--text-primary)' }}>{value}</p>
  </div>
)

const UserDetailSheet = ({ user, onClose, onAdjust, onSetTier, onUpdated }) => {
  const [email,        setEmail]        = useState(null)
  const [emailLoading, setEmailLoading] = useState(true)
  const [spend,        setSpend]        = useState({})
  const [spendLoading, setSpendLoading] = useState(true)
  const [activeWindow, setActiveWindow] = useState('30d')
  const isMaster   = user.user_tier === 'master'
  const isStaffUser = user.is_staff || user.role === 'admin'

  useEffect(() => {
    const fetchEmail = async () => {
      setEmailLoading(true)
      const { data, error } = await supabase.rpc('admin_get_user_email', { p_user_id: user.id })
      setEmailLoading(false)
      if (!error && data) setEmail(data)
    }
    fetchEmail()
  }, [user.id])

  useEffect(() => {
    const fetchSpend = async () => {
      setSpendLoading(true)
      const results = {}
      for (const w of SPEND_WINDOWS) {
        let query = supabase
          .from('credit_transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('type', 'debit')
          .eq('status', 'completed')
        if (w.days) {
          const since = new Date()
          since.setDate(since.getDate() - w.days)
          query = query.gte('created_at', since.toISOString())
        }
        const { data } = await query
        results[w.label] = (data || []).reduce((sum, r) => sum + Math.abs(r.amount), 0)
      }
      setSpend(results)
      setSpendLoading(false)
    }
    fetchSpend()
  }, [user.id])

  const handleAdjustFromDetail = () => { onClose(); setTimeout(() => onAdjust(user), 200) }
  const handleTierFromDetail   = () => { onClose(); setTimeout(() => onSetTier(user), 200) }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        className="rounded-t-3xl flex flex-col"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', maxHeight: '88vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>

        <div className="overflow-y-auto flex flex-col gap-5 px-5 pb-8 pt-3">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg flex-shrink-0"
                style={{ background: 'var(--brand)', color: 'white' }}>
                {user.username?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className="font-bold text-base leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {user.display_name || user.username}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>@{user.username}</p>
                {emailLoading
                  ? <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Loading email…</p>
                  : email
                    ? <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{email}</p>
                    : <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Email unavailable</p>
                }
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
              <X size={15} />
            </button>
          </div>

          {/* Tier + last seen + joined */}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5"
              style={{ background: isMaster ? 'rgba(245,158,11,0.08)' : 'var(--bg-elevated)', border: `1px solid ${isMaster ? 'rgba(245,158,11,0.2)' : 'var(--border-color)'}` }}>
              <Star size={13} style={{ color: isMaster ? '#f59e0b' : 'var(--text-muted)' }} />
              <div>
                <p className="text-xs font-black" style={{ color: isMaster ? '#f59e0b' : 'var(--text-primary)' }}>
                  {isMaster ? 'Master' : 'Novice'}
                </p>
                {isMaster && user.tier_expires_at && (
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{daysLeft(user.tier_expires_at)}d left</p>
                )}
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
              <Clock size={13} style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Last seen</p>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{timeAgo(user.last_seen_at)}</p>
              </div>
            </div>
            <div className="flex-1 flex items-center gap-2 rounded-2xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
              <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Joined</p>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{fmtDate(user.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Credits */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Credits</p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={Zap}          label="Available"  value={`⚡ ${fmt(user.credits)}`}                 accent="var(--brand)" />
              <StatCard icon={TrendingDown} label="Used"       value={`⚡ ${fmt(user.total_credits_used)}`}      accent="#ef4444" />
              <StatCard icon={ShieldCheck}  label="Purchased"  value={`⚡ ${fmt(user.total_credits_purchased)}`} accent="#10b981" />
            </div>
          </div>

          {/* Activity */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Activity</p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={Layers} label="Total generations" value={user.total_generations ?? 0} />
              <StatCard icon={User}   label="Purchase count"    value={user.purchase_count ?? 0} />
            </div>
          </div>

          {/* Credits spent */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Credits spent</p>
              <div className="flex gap-1">
                {SPEND_WINDOWS.map((w) => (
                  <button key={w.label} onClick={() => setActiveWindow(w.label)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                    style={{
                      background: activeWindow === w.label ? 'var(--brand)' : 'var(--bg-elevated)',
                      color:      activeWindow === w.label ? 'white'        : 'var(--text-muted)',
                    }}>
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl px-4 py-4 flex items-center justify-between"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
              {spendLoading ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Calculating…</p>
              ) : (
                <>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Spent in last {activeWindow}</p>
                    <p className="text-2xl font-black" style={{ color: '#ef4444' }}>⚡ {fmt(spend[activeWindow])}</p>
                  </div>
                  <TrendingDown size={28} style={{ color: 'rgba(239,68,68,0.25)' }} />
                </>
              )}
            </div>
          </div>

          {/* ── PromptIQ Access — only for staff / admin users ── */}
          {isStaffUser && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                PromptIQ
              </p>
              <PromptIQAccessManager staffUser={user} />
            </div>
          )}

          {/* Flags */}
          {(user.is_banned || user.is_staff) && (
            <div className="flex gap-2">
              {user.is_staff && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                  <ShieldCheck size={12} />
                  <p className="text-xs font-bold">Staff</p>
                </div>
              )}
              {user.is_banned && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  <X size={12} />
                  <p className="text-xs font-bold">Banned</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button onClick={handleAdjustFromDetail}
              className="flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand)' }}>
              <Zap size={14} fill="var(--brand)" /> Adjust Credits
            </button>
            <button onClick={handleTierFromDetail}
              className="flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: isMaster ? 'rgba(245,158,11,0.1)' : 'var(--bg-elevated)', color: isMaster ? '#f59e0b' : 'var(--text-muted)' }}>
              <Star size={14} /> {isMaster ? 'Change Tier' : 'Make Master'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── User Row ─────────────────────────────────────────────

const UserRow = ({ user, onSelect, onAdjust, onSetTier }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    onClick={() => onSelect(user)}
  >
    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ background: 'var(--brand)', color: 'white' }}>
      {user.username?.[0]?.toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>@{user.username}</p>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>⚡ {fmt(user.credits)} cr</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.total_generations} gens</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(user.last_seen_at)}</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full capitalize"
          style={{
            background: user.user_tier === 'master' ? 'rgba(245,158,11,0.12)' : 'var(--bg-elevated)',
            color:      user.user_tier === 'master' ? '#f59e0b' : 'var(--text-muted)',
            fontWeight: 700,
          }}>
          {user.user_tier === 'master' ? '⭐ Master' : 'Novice'}
        </span>
        {user.is_staff && (
          <span className="text-xs px-1.5 py-0.5 rounded-full"
            style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 700 }}>
            Staff
          </span>
        )}
      </div>
    </div>
    <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
  </motion.div>
)

// ─── Skeleton Rows ────────────────────────────────────────

const SkeletonRows = ({ count = 8 }) => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-[62px] rounded-2xl animate-pulse"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', opacity: 0.5 }} />
    ))}
  </div>
)

// ─── Users Manager ────────────────────────────────────────

const FIELDS = 'id, username, display_name, avatar_url, credits, total_credits_used, total_credits_purchased, total_generations, user_tier, tier_expires_at, tier_started_at, last_seen_at, created_at, is_staff, is_banned, purchase_count, role'

export default function UsersManager() {
  const [query,         setQuery]         = useState('')
  const [users,         setUsers]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [isSearching,   setIsSearching]   = useState(false)
  const [selectedUser,  setSelectedUser]  = useState(null)
  const [adjustingUser, setAdjustingUser] = useState(null)
  const [tierUser,      setTierUser]      = useState(null)
  const debounceRef                       = useRef(null)

  useEffect(() => {
    const loadRecent = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select(FIELDS)
        .order('last_seen_at', { ascending: false })
        .limit(15)
      setLoading(false)
      if (error) { toast.error('Failed to load users'); return }
      setUsers(data || [])
    }
    loadRecent()
  }, [])

  const search = useCallback(async (q) => {
    const trimmed = q.trim()
    if (!trimmed) {
      setIsSearching(false)
      setLoading(true)
      const { data } = await supabase
        .from('profiles')
        .select(FIELDS)
        .order('last_seen_at', { ascending: false })
        .limit(15)
      setLoading(false)
      setUsers(data || [])
      return
    }
    setIsSearching(true)
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select(FIELDS)
      .or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
      .order('username')
      .limit(30)
    setLoading(false)
    if (error) { toast.error('Search failed'); return }
    setUsers(data || [])
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 280)
  }

  const handleClear = () => { setQuery(''); search('') }

  const handleCreditUpdated = useCallback((userId, newBalance) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, credits: newBalance } : u))
    setSelectedUser((prev) => prev?.id === userId ? { ...prev, credits: newBalance } : prev)
  }, [])

  const handleTierUpdated = useCallback((userId, patch) => {
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...patch } : u))
    setSelectedUser((prev) => prev?.id === userId ? { ...prev, ...patch } : prev)
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Showing {isSearching ? 'search results' : 'recently active users'}. Tap a user to view details.
      </p>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          value={query}
          onChange={handleChange}
          placeholder="Search by username or name…"
          className="input-base w-full pl-9 pr-9 text-sm"
          autoComplete="off"
        />
        {query && (
          <button onClick={handleClear} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {loading ? (
          <SkeletonRows count={isSearching ? 5 : 8} />
        ) : users.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {isSearching ? 'No users found' : 'No users yet'}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {isSearching ? 'Try a different username or name.' : 'Users will appear here once they sign up.'}
            </p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((user) => (
              <UserRow key={user.id} user={user} onSelect={setSelectedUser} onAdjust={setAdjustingUser} onSetTier={setTierUser} />
            ))}
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedUser && (
          <UserDetailSheet
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onAdjust={setAdjustingUser}
            onSetTier={setTierUser}
            onUpdated={handleCreditUpdated}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adjustingUser && (
          <CreditAdjuster
            user={adjustingUser}
            onClose={() => setAdjustingUser(null)}
            onUpdated={handleCreditUpdated}
          />
        )}
        {tierUser && (
          <TierAdjuster
            user={tierUser}
            onClose={() => setTierUser(null)}
            onUpdated={handleTierUpdated}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
