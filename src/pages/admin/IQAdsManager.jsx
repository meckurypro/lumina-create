// src/pages/admin/IQAdsManager.jsx
//
// Admin config for the IQ Ads feature — scoped to just two things now:
//   - which video models are enabled for the IQ Ads page, and their
//     display order there (is_iqads_model, iqads_sort_order on `models`)
//
// Real provider cost, IQAds' margin, and global currency rates all moved
// to the shared Model Pricing admin page (ModelPricingManager.jsx) and
// lib/pricing.js — editing them here used to mean IQAds' cost data lived
// in a different place than every other tool's, which is what caused the
// pricing bug this page used to have. Enabling a model here without a
// real cost saved on the Model Pricing page means it just won't be
// orderable — no separate warning needed here since that page already
// flags "no cost" models in search results.
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Info } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ModelRow = ({ model, onToggle }) => {
  const hasCost    = !!model.cost_usd_resolution
  const isInactive = !model.is_active

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{model.label}</p>
        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {model.value} · {model.provider}
          {!hasCost && <span style={{ color: '#fbbf24' }}> · no cost saved — won't be orderable</span>}
          {isInactive && <span style={{ color: '#ef4444' }}> · inactive — won't show on the page</span>}
        </p>
      </div>
      <button
        onClick={() => onToggle(model)}
        className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
        style={{
          background: model.is_iqads_model ? 'rgba(16,185,129,0.12)' : 'var(--bg-elevated)',
          color:      model.is_iqads_model ? '#10b981' : 'var(--text-muted)',
        }}
      >
        {model.is_iqads_model ? 'Enabled' : 'Disabled'}
      </button>
    </div>
  )
}

export default function IQAdsManager({ onNavigateToPricing }) {
  const [query,       setQuery]       = useState('')
  const [searching,   setSearching]   = useState(false)
  const [results,     setResults]     = useState([])
  const [enabledIds,  setEnabledIds]  = useState([])
  const [enabledList, setEnabledList] = useState([])
  const [loading,     setLoading]     = useState(true)

  const loadEnabled = useCallback(async () => {
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('is_iqads_model', true)
      .order('iqads_sort_order')
    setEnabledList(data || [])
    setEnabledIds((data || []).map((m) => m.id))
  }, [])

  useEffect(() => {
    loadEnabled().then(() => setLoading(false))
  }, [loadEnabled])

  // ── search (video models only — IQ Ads is video-only) ────────────────────
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const handle = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('models')
        .select('*')
        .eq('type', 'video')
        .or(`label.ilike.%${query}%,value.ilike.%${query}%`)
        .order('sort_order')
        .limit(20)
      setResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  const handleToggle = async (model) => {
    const nextEnabled = !model.is_iqads_model
    const { error } = await supabase
      .from('models')
      .update({ is_iqads_model: nextEnabled, updated_at: new Date().toISOString() })
      .eq('id', model.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(nextEnabled ? 'Added to IQ Ads' : 'Removed from IQ Ads')
    await loadEnabled()
    setResults((prev) => prev.map((m) => (m.id === model.id ? { ...m, is_iqads_model: nextEnabled } : m)))
  }

  // merge: enabled models always show at top even without an active search
  const displayedResults = results.filter((m) => !enabledIds.includes(m.id))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
        <Info size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Cost, margin, and currency rates live on the{' '}
          {onNavigateToPricing ? (
            <button
              onClick={onNavigateToPricing}
              style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Model Pricing
            </button>
          ) : (
            <strong style={{ color: 'var(--text-primary)' }}>Model Pricing</strong>
          )}
          {' '}tab now. This page only controls which models show up in IQ Ads and in what order.
        </p>
      </div>

      {/* ── Enabled models ── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Enabled Models ({enabledList.length})
        </p>
        {loading ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
        ) : enabledList.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            No models enabled yet — search below to add one.
          </p>
        ) : (
          enabledList.map((m) => (
            <ModelRow key={m.id} model={m} onToggle={handleToggle} />
          ))
        )}
      </div>

      {/* ── Search to add ── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Add a Model
        </p>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search video models by name…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {searching && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Searching…</p>}

        {displayedResults.map((m) => (
          <ModelRow key={m.id} model={m} onToggle={handleToggle} />
        ))}

        {!searching && query.trim() && displayedResults.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No matching models found.</p>
        )}
      </div>
    </div>
  )
}
