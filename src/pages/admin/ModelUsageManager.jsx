// src/pages/admin/ModelUsageManager.jsx
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  RotateCcw, TrendingUp, Users, Zap, DollarSign,
  ChevronUp, ChevronDown, Check, X, Pencil, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'

// ─── Constants ────────────────────────────────────────────
const CREDIT_VAL_USD = 0.0067
const NGN_USD        = 1600

// ─── Helpers ─────────────────────────────────────────────
const fmt   = (n, d = 0) => Number(n ?? 0).toFixed(d)
const fmtMs = (ms) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`

// ─── Sub-components ───────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color = 'var(--brand)' }) => (
  <div
    className="rounded-2xl p-4 flex flex-col gap-2"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon size={15} style={{ color }} />
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</p>
    {sub && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
  </div>
)

const Badge = ({ children, color, bg }) => (
  <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: bg, color }}>
    {children}
  </span>
)

const Pill = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
    style={{
      background: active ? 'var(--brand)' : 'var(--bg-elevated)',
      color:      active ? 'white'         : 'var(--text-muted)',
    }}
  >
    {children}
  </button>
)

// ─── Inline Price Editor ──────────────────────────────────
const PriceEditor = ({ row, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [t2i, setT2i]         = useState(row.credit_cost_t2i)
  const [i2i, setI2i]         = useState(row.credit_cost_i2i)
  const [saving, setSaving]   = useState(false)

  const handleSave = async () => {
    if (t2i < 1 || i2i < 1) { toast.error('Credits must be ≥ 1'); return }
    setSaving(true)
    const { data, error } = await supabase.rpc('update_model_pricing', {
      p_model_value: row.value,
      p_cost_t2i:    Number(t2i),
      p_cost_i2i:    Number(i2i),
    })
    setSaving(false)
    if (error || !data?.success) { toast.error('Failed to update pricing'); return }
    toast.success(`${row.label} pricing updated`)
    setEditing(false)
    onSave()
  }

  const handleCancel = () => {
    setT2i(row.credit_cost_t2i)
    setI2i(row.credit_cost_i2i)
    setEditing(false)
  }

  if (!editing) return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
        {row.credit_cost_t2i} / {row.credit_cost_i2i}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="p-1 rounded-lg opacity-40 hover:opacity-100 transition-opacity"
        style={{ color: 'var(--brand)' }}
        title="Edit pricing"
      >
        <Pencil size={11} />
      </button>
    </div>
  )

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min="1"
        value={t2i}
        onChange={e => setT2i(e.target.value)}
        className="w-12 text-xs text-center rounded-lg px-1 py-1 font-mono"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--brand)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
        title="T2I cost"
      />
      <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>/</span>
      <input
        type="number"
        min="1"
        value={i2i}
        onChange={e => setI2i(e.target.value)}
        className="w-12 text-xs text-center rounded-lg px-1 py-1 font-mono"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--brand)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
        title="I2I cost"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="p-1 rounded-lg"
        style={{ color: '#1D9E75' }}
        title="Save"
      >
        <Check size={13} />
      </button>
      <button
        onClick={handleCancel}
        className="p-1 rounded-lg"
        style={{ color: '#E24B4A' }}
        title="Cancel"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Margin Badge ─────────────────────────────────────────
const MarginBadge = ({ creditCost }) => {
  const revenue = creditCost * CREDIT_VAL_USD
  // rough WaveSpeed cost estimate by credit tier
  const wsCost =
    creditCost <= 5  ? 0.004 :
    creditCost <= 10 ? 0.012 :
    creditCost <= 15 ? 0.075 :
    creditCost <= 25 ? 0.15  :
    creditCost <= 40 ? 0.22  : 0.35
  const margin = ((revenue - wsCost) / revenue * 100)
  const label  = margin > 40 ? '✓ healthy' : margin > 0 ? '~ thin' : '✗ loss'
  const bg     = margin > 40 ? '#EAF3DE' : margin > 0 ? '#FAEEDA' : '#FCEBEB'
  const color  = margin > 40 ? '#3B6D11' : margin > 0 ? '#854F0B' : '#A32D2D'
  return <Badge bg={bg} color={color}>{label}</Badge>
}

// ─── Sort Header ──────────────────────────────────────────
const SortHeader = ({ col, label, sortKey, sortDir, onSort }) => (
  <th
    onClick={() => onSort(col)}
    className="text-left px-3 py-2 cursor-pointer select-none whitespace-nowrap"
    style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}
  >
    <span className="flex items-center gap-1">
      {label}
      {sortKey === col
        ? sortDir === 1 ? <ChevronUp size={11} style={{ color: 'var(--brand)' }} /> : <ChevronDown size={11} style={{ color: 'var(--brand)' }} />
        : <ChevronUp size={11} style={{ opacity: 0.25 }} />}
    </span>
  </th>
)

// ─── Main Component ───────────────────────────────────────
export default function ModelUsageManager() {
  const [rows,    setRows]    = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [search,  setSearch]  = useState('')
  const [sortKey, setSortKey] = useState('total_gens')
  const [sortDir, setSortDir] = useState(-1)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('model_usage_stats')
      .select('*')
    if (error) { toast.error('Failed to load usage stats'); setLoading(false); return }
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Summary stats ──
  const summary = useMemo(() => {
    const totalGens     = rows.reduce((s, r) => s + Number(r.total_gens   ?? 0), 0)
    const totalCredits  = rows.reduce((s, r) => s + Number(r.total_credits_consumed ?? 0), 0)
    const totalRevUSD   = totalCredits * CREDIT_VAL_USD
    const activeModels  = rows.filter(r => Number(r.total_gens) > 0).length
    const topModel      = [...rows].sort((a, b) => Number(b.total_gens) - Number(a.total_gens))[0]
    return { totalGens, totalCredits, totalRevUSD, activeModels, topModel }
  }, [rows])

  // ── Filter + search + sort ──
  const filtered = useMemo(() => {
    let r = rows.filter(row => {
      if (filter === 'image')   return row.type === 'image'
      if (filter === 'video')   return row.type === 'video'
      if (filter === 'used')    return Number(row.total_gens) > 0
      if (filter === 'unused')  return Number(row.total_gens) === 0
      if (filter === 'active')  return row.is_active
      return true
    })
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter(row =>
        row.label?.toLowerCase().includes(q) ||
        row.aka?.toLowerCase().includes(q)   ||
        row.feature?.toLowerCase().includes(q)
      )
    }
    return [...r].sort((a, b) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (typeof av === 'boolean') return (av === bv ? 0 : av ? -1 : 1) * sortDir
      return (Number(av) - Number(bv)) * sortDir
    })
  }, [rows, filter, search, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(-1) }
  }

  if (loading) return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 rounded-2xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Model Usage & Pricing</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Live from generations table · click pencil to edit prices inline
          </p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-xl"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
        >
          <RotateCcw size={15} />
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={Zap}
          label="Total generations"
          value={summary.totalGens.toLocaleString()}
          sub={`across ${summary.activeModels} models used`}
          color="#7F77DD"
        />
        <StatCard
          icon={DollarSign}
          label="Est. revenue (USD)"
          value={`$${fmt(summary.totalRevUSD, 2)}`}
          sub={`₦${Math.round(summary.totalRevUSD * NGN_USD).toLocaleString()}`}
          color="#1D9E75"
        />
        <StatCard
          icon={TrendingUp}
          label="Credits consumed"
          value={summary.totalCredits.toLocaleString()}
          sub="all time"
          color="#378ADD"
        />
        <StatCard
          icon={Users}
          label="Top model"
          value={summary.topModel?.aka ?? summary.topModel?.label ?? '—'}
          sub={`${Number(summary.topModel?.total_gens ?? 0).toLocaleString()} generations`}
          color="#BA7517"
        />
      </div>

      {/* ── Filters + Search ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <div
          className="flex items-center gap-2 px-4 py-3 flex-wrap"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-40">
            <Search size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search models…"
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 13,
                color: 'var(--text-primary)',
                width: '100%',
              }}
            />
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all',    label: `All (${rows.length})` },
              { id: 'used',   label: `Used (${rows.filter(r => Number(r.total_gens) > 0).length})` },
              { id: 'unused', label: 'Unused' },
              { id: 'image',  label: 'Image' },
              { id: 'video',  label: 'Video' },
              { id: 'active', label: 'Active' },
            ].map(f => (
              <Pill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </Pill>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <SortHeader col="label"                 label="Model"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader col="type"                  label="Type"        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader col="total_gens"            label="Total gens"  sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader col="gens_last_7d"          label="7d"          sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader col="gens_last_30d"         label="30d"         sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader col="unique_users"          label="Users"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader col="total_credits_consumed"label="Credits used"sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader col="estimated_revenue_usd" label="Est. rev"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortHeader col="avg_generation_time_ms"label="Avg time"    sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="text-left px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  T2I / I2I
                </th>
                <th className="text-left px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Margin
                </th>
                <th className="text-left px-3 py-2 whitespace-nowrap" style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-10" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    No models match your filter.
                  </td>
                </tr>
              ) : filtered.map((row, i) => {
                const gens    = Number(row.total_gens ?? 0)
                const revUSD  = Number(row.estimated_revenue_usd ?? 0)
                const revNGN  = revUSD * NGN_USD
                const hasUsage = gens > 0

                return (
                  <tr
                    key={row.value}
                    style={{
                      borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.025)',
                      opacity: hasUsage ? 1 : 0.55,
                    }}
                  >
                    {/* Model name */}
                    <td className="px-3 py-2" style={{ whiteSpace: 'nowrap' }}>
                      <div className="font-semibold" style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                        {row.label}
                      </div>
                      {row.aka && (
                        <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>{row.aka}</div>
                      )}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-2">
                      <Badge
                        color={row.type === 'image' ? '#185FA5' : '#534AB7'}
                        bg={row.type === 'image' ? '#E6F1FB' : '#EEEDFE'}
                      >
                        {row.type}
                      </Badge>
                    </td>

                    {/* Total gens */}
                    <td className="px-3 py-2 font-mono font-semibold" style={{ color: hasUsage ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {gens.toLocaleString()}
                    </td>

                    {/* 7d */}
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {Number(row.gens_last_7d ?? 0).toLocaleString()}
                    </td>

                    {/* 30d */}
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {Number(row.gens_last_30d ?? 0).toLocaleString()}
                    </td>

                    {/* Unique users */}
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {Number(row.unique_users ?? 0).toLocaleString()}
                    </td>

                    {/* Credits consumed */}
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {Number(row.total_credits_consumed ?? 0).toLocaleString()}
                    </td>

                    {/* Est. revenue */}
                    <td className="px-3 py-2" style={{ whiteSpace: 'nowrap' }}>
                      <div className="font-mono font-semibold" style={{ color: 'var(--text-primary)', fontSize: 12 }}>
                        ${fmt(revUSD, 2)}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                        ₦{Math.round(revNGN).toLocaleString()}
                      </div>
                    </td>

                    {/* Avg generation time */}
                    <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                      {hasUsage ? fmtMs(Number(row.avg_generation_time_ms ?? 0)) : '—'}
                    </td>

                    {/* T2I / I2I inline editor */}
                    <td className="px-3 py-2">
                      <PriceEditor row={row} onSave={load} />
                    </td>

                    {/* Margin badge */}
                    <td className="px-3 py-2">
                      <MarginBadge creditCost={row.credit_cost_t2i} />
                    </td>

                    {/* Active status */}
                    <td className="px-3 py-2">
                      <Badge
                        color={row.is_active ? '#0F6E56' : '#5F5E5A'}
                        bg={row.is_active ? '#E1F5EE' : '#F1EFE8'}
                      >
                        {row.is_active ? 'on' : 'off'}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2 text-xs flex items-center justify-between"
          style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}
        >
          <span>Showing {filtered.length} of {rows.length} models</span>
          <span>Click T2I/I2I pencil icon to edit price inline</span>
        </div>
      </div>

    </div>
  )
}
