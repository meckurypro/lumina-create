import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Plus, Minus, X, ChevronRight, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

// ─── Credit Adjuster ──────────────────────────────────────

const CreditAdjuster = ({ user, onClose, onUpdated }) => {
  const { user: admin }      = useAuth()
  const [amount,  setAmount] = useState('')
  const [note,    setNote]   = useState('')
  const [saving,  setSaving] = useState(false)
  const isNegative           = amount.startsWith('-')
  const parsed               = parseFloat(amount)
  const isValid              = !isNaN(parsed) && parsed !== 0

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

    if (error) {
      toast.error(`RPC error: ${error.message}`)
      console.error('admin_adjust_credits error:', error)
      return
    }
    if (!data?.success) {
      toast.error(`Failed: ${data?.error || 'Unknown error'}`)
      console.error('admin_adjust_credits result:', data)
      return
    }

    toast.success(
      parsed > 0
        ? `+${parsed} credits added to @${user.username}`
        : `${parsed} credits deducted from @${user.username}`
    )
    onUpdated(user.id, data.balance_after)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{ y: 60,    opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="rounded-t-3xl p-6 flex flex-col gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>Adjust Credits</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              @{user.username} · current balance: ⚡{user.credits?.toFixed(1)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick amounts */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Quick add</p>
          <div className="flex gap-2">
            {[50, 100, 250, 500].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: amount === String(v)  ? 'var(--brand)' : 'var(--bg-elevated)',
                  color:      amount === String(v)  ? 'white' : 'var(--text-secondary)',
                }}
              >
                +{v}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            {[-50, -100, -250, -500].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: amount === String(v) ? 'rgba(239,68,68,0.15)' : 'var(--bg-elevated)',
                  color:      amount === String(v) ? '#ef4444' : 'var(--text-secondary)',
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Custom amount */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Custom amount</p>
          <div className="flex gap-2">
            <button
              onClick={() => setAmount((v) => v.startsWith('-') ? v.slice(1) : v ? `-${v}` : '-')}
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: isNegative ? 'rgba(239,68,68,0.15)' : 'var(--bg-elevated)',
                color:      isNegative ? '#ef4444' : 'var(--text-muted)',
              }}
            >
              {isNegative ? <Minus size={16} /> : <Plus size={16} />}
            </button>
            <input
              type="number"
              value={amount.replace('-', '')}
              onChange={(e) => {
                const raw = e.target.value
                setAmount(isNegative ? (raw ? `-${raw}` : '-') : raw)
              }}
              placeholder="0"
              className="input-base flex-1 text-center text-lg font-bold"
              style={{ color: isNegative ? '#ef4444' : 'var(--brand)' }}
            />
          </div>
        </div>

        {/* Note */}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)…"
          className="input-base text-sm"
        />

        {/* Preview */}
        {isValid && (
          <div
            className="rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{
              background: parsed > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
              border:     `1px solid ${parsed > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}
          >
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>New balance</p>
              <p className="text-lg font-black" style={{ color: parsed > 0 ? '#10b981' : '#ef4444' }}>
                ⚡ {((user.credits || 0) + parsed).toFixed(1)}
              </p>
            </div>
            <p className="text-sm font-bold" style={{ color: parsed > 0 ? '#10b981' : '#ef4444' }}>
              {parsed > 0 ? `+${parsed}` : parsed}
            </p>
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={handleAdjust}
          disabled={!isValid || saving}
          className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
          style={{
            background: !isValid ? 'var(--bg-elevated)' : parsed > 0 ? '#10b981' : '#ef4444',
            color:      !isValid ? 'var(--text-muted)' : 'white',
            opacity:    saving ? 0.7 : 1,
          }}
        >
          {saving
            ? 'Saving…'
            : !isValid
            ? 'Enter an amount'
            : parsed > 0
            ? `Add ${parsed} credits`
            : `Deduct ${Math.abs(parsed)} credits`}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── User Row ─────────────────────────────────────────────

const UserRow = ({ user, onAdjust }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3 p-3 rounded-2xl"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{ background: 'var(--brand)', color: 'white' }}
    >
      {user.username?.[0]?.toUpperCase()}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>@{user.username}</p>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>⚡ {user.credits?.toFixed(1)} cr</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>·</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{user.total_generations} gens</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full capitalize"
          style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand)' }}
        >
          {user.tier}
        </span>
      </div>
    </div>
    <button
      onClick={() => onAdjust(user)}
      className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
      style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand)' }}
    >
      <Zap size={11} fill="var(--brand)" />
      Credits
      <ChevronRight size={11} />
    </button>
  </motion.div>
)

// ─── Users Manager ────────────────────────────────────────

export default function UsersManager() {
  const [query,         setQuery]         = useState('')
  const [users,         setUsers]         = useState([])
  const [loading,       setLoading]       = useState(false)
  const [searched,      setSearched]      = useState(false)
  const [adjustingUser, setAdjustingUser] = useState(null)
  const debounceRef                       = useRef(null)

  const search = useCallback(async (q) => {
    const trimmed = q.trim()
    if (!trimmed) { setUsers([]); setSearched(false); return }
    setLoading(true)
    setSearched(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, credits, total_generations, tier, created_at')
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
    debounceRef.current = setTimeout(() => search(val), 250)
  }

  const handleClear = () => {
    setQuery('')
    setUsers([])
    setSearched(false)
  }

  const handleUpdated = useCallback((userId, newBalance) => {
    setUsers((prev) =>
      prev.map((u) => u.id === userId ? { ...u, credits: newBalance } : u)
    )
  }, [])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Search users by username or display name, then adjust their credit balance.
      </p>

      {/* Search bar */}
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
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results */}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-2xl"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', opacity: 0.5 }}
              />
            ))}
          </div>
        ) : searched && users.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-10"
          >
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No users found</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Try a different username or name.</p>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-2">
            {users.map((user) => (
              <UserRow key={user.id} user={user} onAdjust={setAdjustingUser} />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Credit adjuster sheet */}
      <AnimatePresence>
        {adjustingUser && (
          <CreditAdjuster
            user={adjustingUser}
            onClose={() => setAdjustingUser(null)}
            onUpdated={handleUpdated}
          />
        )}
      </AnimatePresence>
    </div>
  )
        }
