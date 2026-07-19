// src/pages/admin/IQAdsManager.jsx
//
// Admin config for the IQ Ads feature:
//   - search + select which models are available on the IQ Ads page
//   - enter real provider cost (USD) per second, per resolution, per model
//     — models.cost_usd_per_second_resolution jsonb, e.g. {"480p": 0.031, "720p": 0.052}
//     This is GENERAL model data (what WaveSpeed/fal actually charge), not
//     an IQ-Ads-specific concept. Other features can and will read the same
//     column for their own cost/margin math. This page is just the first
//     place we surfaced it for editing, since it's most visible here.
//     For is_flat_rate models the value is a flat per-video cost instead of
//     per-second.
//   - global USD→NGN rate, margin multiplier, and NGN-per-credit (app_settings,
//     these ARE IQ-Ads-specific — they only affect this feature's retail price)
//
// Pricing math (calculateIqadsPrice / iqadsSupportsResolutionChoice, both
// in lib/iqads.js) reads this same cost_usd_per_second_resolution column —
// they used to point at columns that never existed, which silently broke
// checkout. RESOLUTIONS below now comes from the shared constant so this
// panel and the calculator can't drift apart again.
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Save, DollarSign, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { IQADS_RESOLUTIONS as RESOLUTIONS } from '@/lib/iqadsConstants'

const GlobalSettingRow = ({ label, settingKey, value, onSave, suffix, hint }) => {
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(value ?? '') }, [value])

  const dirty = String(draft) !== String(value ?? '')

  const handleSave = async () => {
    setSaving(true)
    await onSave(settingKey, draft)
    setSaving(false)
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <input
          type="number"
          step="0.01"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-28 px-2.5 py-1.5 rounded-lg text-sm text-right"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        />
        {suffix && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="p-1.5 rounded-lg"
          style={{
            background: dirty ? 'var(--brand)' : 'var(--bg-card)',
            color: dirty ? '#fff' : 'var(--text-muted)',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Save size={13} />
        </button>
      </div>
    </div>
  )
}

// Preview: cost/price/margin for a representative 15s clip at each resolution
// the model has real cost entered for. Purely informational — actual order
// pricing stays in lib/iqads.js.
function PricePreview({ model, costDraft, globalSettings }) {
  const { usd_to_ngn_rate, margin_multiplier, ngn_per_credit } = globalSettings
  if (!usd_to_ngn_rate || !margin_multiplier || !ngn_per_credit) {
    return (
      <p className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
        <AlertTriangle size={11} /> Set global pricing settings above to see a preview.
      </p>
    )
  }

  const PREVIEW_SECONDS = 15

  return (
    <div className="flex flex-col gap-1">
      {RESOLUTIONS.map((res) => {
        const raw = costDraft[res]
        const costPerUnit = raw === '' || raw == null ? null : Number(raw)
        if (costPerUnit == null || Number.isNaN(costPerUnit)) {
          return (
            <p key={res} className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {res}: no real cost entered — this resolution won't be offered
            </p>
          )
        }
        const costUsd = model.is_flat_rate ? costPerUnit : costPerUnit * PREVIEW_SECONDS
        const priceNgn = costUsd * Number(usd_to_ngn_rate) * Number(margin_multiplier)
        const credits = priceNgn / Number(ngn_per_credit)
        const marginPct = ((Number(margin_multiplier) - 1) * 100).toFixed(0)
        return (
          <p key={res} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {res}{!model.is_flat_rate && ` · ${PREVIEW_SECONDS}s`}: cost ${costUsd.toFixed(3)} → IQ Ads sell ₦{Math.round(priceNgn).toLocaleString()}
            {' '}({credits.toFixed(1)} credits, {marginPct}% margin)
          </p>
        )
      })}
    </div>
  )
}

const ModelRow = ({ model, onToggle, onSavePricing, globalSettings }) => {
  const initialCost = model.cost_usd_per_second_resolution || {}
  const [costDraft, setCostDraft] = useState({
    '480p': initialCost['480p'] ?? '',
    '720p': initialCost['720p'] ?? '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const c = model.cost_usd_per_second_resolution || {}
    setCostDraft({ '480p': c['480p'] ?? '', '720p': c['720p'] ?? '' })
  }, [model.cost_usd_per_second_resolution])

  const dirty = RESOLUTIONS.some(
    (res) => String(costDraft[res]) !== String((model.cost_usd_per_second_resolution || {})[res] ?? '')
  )

  const handleSave = async () => {
    setSaving(true)
    const cleaned = {}
    for (const res of RESOLUTIONS) {
      if (costDraft[res] !== '' && costDraft[res] != null) cleaned[res] = Number(costDraft[res])
    }
    await onSavePricing(model.id, { cost_usd_per_second_resolution: Object.keys(cleaned).length ? cleaned : null })
    setSaving(false)
  }

  return (
    <div
      className="flex flex-col gap-3 p-3 rounded-2xl"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{model.label}</p>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {model.value} · {model.provider}{model.is_flat_rate ? ' · flat rate' : ' · per-second'}
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

      {model.is_iqads_model && (
        <div className="flex flex-col gap-2 pt-1" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2">
            {RESOLUTIONS.map((res) => (
              <div key={res} className="flex-1 flex items-center gap-1.5">
                <DollarSign size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                  type="number" step="0.001"
                  placeholder={`${res}${model.is_flat_rate ? ' flat $' : ' $/sec'}`}
                  value={costDraft[res]}
                  onChange={(e) => setCostDraft((prev) => ({ ...prev, [res]: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-lg text-xs"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}
            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="flex-shrink-0 p-1.5 rounded-lg"
              style={{
                background: dirty ? 'var(--brand)' : 'var(--bg-elevated)',
                color:      dirty ? '#fff' : 'var(--text-muted)',
                opacity:    saving ? 0.6 : 1,
              }}
            >
              <Save size={13} />
            </button>
          </div>

          <PricePreview model={model} costDraft={costDraft} globalSettings={globalSettings} />
        </div>
      )}
    </div>
  )
}

export default function IQAdsManager() {
  const [query,       setQuery]       = useState('')
  const [searching,   setSearching]   = useState(false)
  const [results,     setResults]     = useState([])
  const [enabledIds,  setEnabledIds]  = useState([])
  const [enabledList, setEnabledList] = useState([])
  const [settings,    setSettings]    = useState({})
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

  const loadSettings = useCallback(async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
     .in('key', ['iqads_usd_to_ngn_rate', 'iqads_margin_multiplier', 'iqads_ngn_per_credit'])
    const map = {}
    for (const row of data || []) map[row.key] = row.value
    setSettings(map)
  }, [])

  useEffect(() => {
    Promise.all([loadEnabled(), loadSettings()]).then(() => setLoading(false))
  }, [loadEnabled, loadSettings])

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

  const handleSavePricing = async (modelId, pricing) => {
    const { error } = await supabase
      .from('models')
      .update({ ...pricing, updated_at: new Date().toISOString() })
      .eq('id', modelId)
    if (error) { toast.error('Failed to save cost data'); return }
    toast.success('Cost data saved')
    await loadEnabled()
  }

  const handleSaveSetting = async (key, value) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) { toast.error('Failed to save setting'); return }
    toast.success('Setting saved')
    setSettings((prev) => ({ ...prev, [key]: String(value) }))
  }

  // merge: enabled models always show at top even without an active search
  const displayedResults = results.filter((m) => !enabledIds.includes(m.id))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Search and enable video models for the IQ Ads flyer-to-video tool. The cost fields below
        (real WaveSpeed/fal cost in USD per second, or flat cost for flat-rate models) live on the
        model itself — not on IQ Ads — so other features reading the same model row get the same
        real numbers. Leave a resolution blank until you have real cost data for it; it just won't
        be offered on that model until then.
      </p>

      {/* ── IQ Ads global pricing settings ── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          IQ Ads Pricing (this feature only)
        </p>
        <GlobalSettingRow
          label="USD → NGN rate"
          settingKey="iqads_usd_to_ngn_rate"
          value={settings.iqads_usd_to_ngn_rate}
          onSave={handleSaveSetting}
          suffix="₦ per $1"
        />
        <GlobalSettingRow
          label="Margin multiplier"
          settingKey="iqads_margin_multiplier"
          value={settings.iqads_margin_multiplier}
          onSave={handleSaveSetting}
          suffix="× cost"
          hint="Retail price = cost × this. e.g. 2.2 means ~55% margin (not 2.2%)."
        />
        <GlobalSettingRow
          label="NGN per credit"
          settingKey="iqads_ngn_per_credit"
          value={settings.iqads_ngn_per_credit}
          onSave={handleSaveSetting}
          suffix="₦ per credit"
          hint="Used to convert an order's Naira price into credits for the credit-payment path."
        />
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
            <ModelRow key={m.id} model={m} onToggle={handleToggle} onSavePricing={handleSavePricing} globalSettings={settings} />
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
          <ModelRow key={m.id} model={m} onToggle={handleToggle} onSavePricing={handleSavePricing} globalSettings={settings} />
        ))}

        {!searching && query.trim() && displayedResults.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No matching models found.</p>
        )}
      </div>
    </div>
  )
}
