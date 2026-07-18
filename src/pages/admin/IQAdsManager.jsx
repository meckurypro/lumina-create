// src/pages/admin/IQAdsManager.jsx
//
// Admin config for the IQ Ads feature:
//   - search + select which models are available on the IQ Ads page
//   - set cost-per-second (480p, sound included) per model
//   - set the 720p cost multiplier (leave blank if the model has no
//     real resolution tier — e.g. Kling, which prices per-second flat)
//   - global USD→NGN rate and margin multiplier (app_settings)
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Zap, Save, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

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

const ModelRow = ({ model, onToggle, onSavePricing }) => {
  const [cost480, setCost480]         = useState(model.iqads_cost_per_second_480p_usd ?? '')
  const [mult720, setMult720]         = useState(model.iqads_720p_cost_multiplier ?? '')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    setCost480(model.iqads_cost_per_second_480p_usd ?? '')
    setMult720(model.iqads_720p_cost_multiplier ?? '')
  }, [model.iqads_cost_per_second_480p_usd, model.iqads_720p_cost_multiplier])

  const dirty =
    String(cost480) !== String(model.iqads_cost_per_second_480p_usd ?? '') ||
    String(mult720) !== String(model.iqads_720p_cost_multiplier ?? '')

  const handleSave = async () => {
    setSaving(true)
    await onSavePricing(model.id, {
      iqads_cost_per_second_480p_usd: cost480 === '' ? null : Number(cost480),
      iqads_720p_cost_multiplier:     mult720 === '' ? null : Number(mult720),
    })
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
            {model.value} · {model.provider}
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
        <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="flex-1 flex items-center gap-1.5">
            <DollarSign size={11} style={{ color: 'var(--text-muted)' }} />
            <input
              type="number" step="0.001" placeholder="$/sec @480p"
              value={cost480} onChange={(e) => setCost480(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex-1 flex items-center gap-1.5">
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>×720p</span>
            <input
              type="number" step="0.1" placeholder="blank = no 720p"
              value={mult720} onChange={(e) => setMult720(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg text-xs"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
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
      .in('key', ['iqads_usd_to_ngn_rate', 'iqads_margin_multiplier'])
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
    if (error) { toast.error('Failed to save pricing'); return }
    toast.success('Pricing saved')
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
        Search and enable video models for the IQ Ads flyer-to-video tool. Only enabled models
        appear on the IQ Ads page. Set cost-per-second at 480p (sound included — every IQ Ads
        video generates sound) and, if the model has a real 720p tier, its cost multiplier.
        Leave the 720p field blank for models like Kling that price per-second flat with no
        resolution parameter.
      </p>

      {/* ── Global pricing settings ── */}
      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Global Pricing
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
          hint="Retail price = cost × this. e.g. 2.2 means ~55% margin."
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
            <ModelRow key={m.id} model={m} onToggle={handleToggle} onSavePricing={handleSavePricing} />
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
          <ModelRow key={m.id} model={m} onToggle={handleToggle} onSavePricing={handleSavePricing} />
        ))}

        {!searching && query.trim() && displayedResults.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No matching models found.</p>
        )}
      </div>
    </div>
  )
}
