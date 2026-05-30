// src/pages/admin/ModelsAnalytics.jsx
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  Cpu, Film, Image, CheckCircle2, ShieldCheck,
  Layers, RotateCcw, ChevronUp, ChevronDown,
} from 'lucide-react'

// ─── Palette ──────────────────────────────────────────────
const C = {
  image:    '#378ADD',
  video:    '#7F77DD',
  active:   '#1D9E75',
  inactive: '#888780',
  verified: '#0F6E56',
  flat:     '#BA7517',
  brand:    'var(--brand)',
}

// ─── Stat Card ────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, sub, color = C.brand }) => (
  <div
    className="rounded-2xl p-4 flex flex-col gap-2"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div className="flex items-center gap-2">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: `${color}20` }}
      >
        <Icon size={15} style={{ color }} />
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</p>
    {sub && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
  </div>
)

// ─── Badge ────────────────────────────────────────────────
const Badge = ({ children, color, bg }) => (
  <span
    className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
    style={{ background: bg, color }}
  >
    {children}
  </span>
)

// ─── Filter Pill ──────────────────────────────────────────
const Pill = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all"
    style={{
      background: active ? 'var(--brand)' : 'var(--bg-elevated)',
      color:      active ? 'white' : 'var(--text-muted)',
    }}
  >
    {children}
  </button>
)

// ─── Custom Tooltip ───────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs font-semibold shadow-lg"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
    >
      <p style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p>{payload[0].value} model{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────
export default function ModelsAnalytics() {
  const [models,  setModels]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [sortKey, setSortKey] = useState('label')
  const [sortDir, setSortDir] = useState(1)

  // ── Fetch ──
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .order('sort_order')
      if (!error) setModels(data || [])
      setLoading(false)
    }
    load()
  }, [])

  // ── Stats ──
  const stats = useMemo(() => {
    const total    = models.length
    const active   = models.filter(m => m.is_active).length
    const image    = models.filter(m => m.type === 'image').length
    const video    = models.filter(m => m.type === 'video').length
    const verified = models.filter(m => m.is_verified).length
    const s2e      = models.filter(m => m.supports_start_frame && m.supports_end_frame).length
    const avgCost  = total ? Math.round(models.reduce((s, m) => s + m.credit_cost_t2i, 0) / total) : 0
    return { total, active, image, video, verified, s2e, avgCost }
  }, [models])

  // ── Chart: type split ──
  const typeData = useMemo(() => [
    { name: 'Image', value: stats.image, color: C.image },
    { name: 'Video', value: stats.video, color: C.video },
  ], [stats])

  // ── Chart: credit cost buckets (ALL models) ──
  const costBuckets = useMemo(() => {
    const b = { '1–5': 0, '6–10': 0, '11–20': 0, '21–50': 0, '51+': 0 }
    models.forEach(m => {
      const c = m.credit_cost_t2i
      if      (c <= 5)  b['1–5']++
      else if (c <= 10) b['6–10']++
      else if (c <= 20) b['11–20']++
      else if (c <= 50) b['21–50']++
      else              b['51+']++
    })
    return Object.entries(b).map(([name, count]) => ({ name, count }))
  }, [models])

  // ── Chart: feature breakdown ──
  const featureData = useMemo(() => {
    const map = {}
    models.forEach(m => {
      const key = m.feature.replace(/_/g, ' ')
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [models])

  // ── Filtered & sorted table rows ──
  const filtered = useMemo(() => {
    let rows = models.filter(m => {
      if (filter === 'image')    return m.type === 'image'
      if (filter === 'video')    return m.type === 'video'
      if (filter === 'active')   return m.is_active
      if (filter === 'inactive') return !m.is_active
      if (filter === 'verified') return m.is_verified
      if (filter === 's2e')      return m.supports_start_frame && m.supports_end_frame
      return true
    })
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey] ?? ''
      const bv = b[sortKey] ?? ''
      if (typeof av === 'boolean') return (av === bv ? 0 : av ? -1 : 1) * sortDir
      if (typeof av === 'number')  return (av - bv) * sortDir
      return String(av).localeCompare(String(bv)) * sortDir
    })
    return rows
  }, [models, filter, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d * -1)
    else { setSortKey(key); setSortDir(1) }
  }

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronUp size={12} style={{ opacity: 0.3 }} />
    return sortDir === 1
      ? <ChevronUp size={12} style={{ color: 'var(--brand)' }} />
      : <ChevronDown size={12} style={{ color: 'var(--brand)' }} />
  }

  // ── Loading skeleton ──
  if (loading) return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
      ))}
    </div>
  )

  return (
    <div className="space-y-5">

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Cpu}          label="Total models"      value={stats.total}    sub={`${stats.image} image · ${stats.video} video`}  color={C.brand}    />
        <StatCard icon={CheckCircle2} label="Active"            value={stats.active}   sub={`${stats.total - stats.active} inactive`}         color={C.active}   />
        <StatCard icon={ShieldCheck}  label="Verified"          value={stats.verified} sub="production-confirmed"                             color={C.verified} />
        <StatCard icon={Layers}       label="Start/End frame"   value={stats.s2e}      sub={`avg ${stats.avgCost} credits/gen`}               color={C.video}    />
      </div>

      {/* ── Charts row ── */}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: '1fr 1fr' }}
      >
        {/* Type split donut */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            By type
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={typeData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
              >
                {typeData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend
                iconType="square"
                iconSize={8}
                formatter={(value, entry) => (
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                    {value} ({entry.payload.value})
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Credit cost bar */}
        <div
          className="rounded-2xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
            Credit cost range
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={costBuckets} barSize={18}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
              <Bar dataKey="count" fill={C.active} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Feature breakdown ── */}
      <div
        className="rounded-2xl p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          By feature
        </p>
        <ResponsiveContainer width="100%" height={featureData.length * 32 + 20}>
          <BarChart data={featureData} layout="vertical" barSize={14}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(128,128,128,0.08)' }} />
            <Bar dataKey="count" fill={C.image} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Filter + Table ── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        {/* Filters */}
        <div
          className="flex gap-2 flex-wrap px-4 py-3"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          {[
            { id: 'all',      label: `All (${models.length})` },
            { id: 'active',   label: `Active (${stats.active})` },
            { id: 'inactive', label: `Inactive (${stats.total - stats.active})` },
            { id: 'image',    label: `Image (${stats.image})` },
            { id: 'video',    label: `Video (${stats.video})` },
            { id: 'verified', label: `Verified (${stats.verified})` },
            { id: 's2e',      label: `S2E (${stats.s2e})` },
          ].map(f => (
            <Pill key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Pill>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                {[
                  { key: 'label',          label: 'Model'   },
                  { key: 'aka',            label: 'AKA'     },
                  { key: 'type',           label: 'Type'    },
                  { key: 'credit_cost_t2i',label: 'T2I'     },
                  { key: 'credit_cost_i2i',label: 'I2I'     },
                  { key: 'feature',        label: 'Feature' },
                  { key: 'is_active',      label: 'Active'  },
                  { key: 'is_verified',    label: 'Verified'},
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="text-left px-3 py-2 cursor-pointer select-none"
                    style={{ color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr
                  key={m.id}
                  style={{
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border-color)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(128,128,128,0.03)',
                  }}
                >
                  <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {m.label}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {m.aka ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      color={m.type === 'image' ? '#185FA5' : '#534AB7'}
                      bg={m.type === 'image' ? '#E6F1FB' : '#EEEDFE'}
                    >
                      {m.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>
                    {m.credit_cost_t2i}
                    {m.is_flat_rate && (
                      <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>flat</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: 'var(--text-primary)' }}>
                    {m.credit_cost_i2i}
                  </td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {m.feature.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      color={m.is_active ? '#0F6E56' : '#5F5E5A'}
                      bg={m.is_active ? '#E1F5EE' : '#F1EFE8'}
                    >
                      {m.is_active ? 'on' : 'off'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {m.is_verified
                      ? <Badge color="#0F6E56" bg="#E1F5EE">✓ yes</Badge>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div
          className="px-4 py-2 text-xs"
          style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}
        >
          Showing {filtered.length} of {models.length} models
        </div>
      </div>

    </div>
  )
}
