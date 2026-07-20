// src/pages/admin/ModelPricingManager.jsx
//
// The one place real provider cost, per-tool margin, and global currency
// settings get edited. Deliberately does NOT list every model at once —
// search for one, work on it, done. Costs here feed every tool through
// lib/pricing.js; nothing tool-specific lives on this page except the
// "Tool Margins" section, since margin is one number per tool (not per
// model) by design.
import { useState, useEffect, useCallback } from 'react'
import { Search, X, Save, DollarSign, Plus, AlertTriangle, Settings2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  fetchGlobalPricingSettings, saveGlobalPricingSetting,
  fetchAllToolMargins, saveToolMargin,
} from '@/lib/pricing'

const RESOLUTION_PRESETS = ['480p', '720p', '1080p']

// Tools that charge users — add new tool_key entries here as new tools
// ship. This drives which rows appear in "Tool Margins" even before a
// row exists yet in tool_pricing_settings (falls back to no value set).
const KNOWN_TOOLS = [
  { key: 'create_video',  label: 'Create Video' },
  { key: 'create_image',  label: 'Create Image' },
  { key: 'iqads',         label: 'IQ Ads' },
  { key: 'talking_head',  label: 'Talking Head / Lipsync' },
]

// ── inline editable row for one global setting ──────────────────────────
function SettingRow({ label, value, onSave, suffix, hint }) {
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => { setDraft(value ?? '') }, [value])
  const dirty = String(draft) !== String(value ?? '')

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(draft) } catch (err) { toast.error(err.message) }
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
          type="number" step="0.01" value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-28 px-2.5 py-1.5 rounded-lg text-sm text-right"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        />
        {suffix && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{suffix}</span>}
        <button
          onClick={handleSave} disabled={!dirty || saving}
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

// ── global currency settings ──────────────────────────────────────────
function GlobalSettingsSection() {
  const [settings, setSettings] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const s = await fetchGlobalPricingSettings()
    setSettings(s)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (key, draft) => {
    await saveGlobalPricingSetting(key, draft)
    toast.success('Setting saved')
    await load()
  }

  if (loading) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Global Currency Settings
      </p>
      <SettingRow
        label="USD → NGN rate"
        value={settings.usdToNgnRate}
        onSave={(v) => handleSave('global_usd_to_ngn_rate', v)}
        suffix="₦ per $1"
      />
      <SettingRow
        label="NGN per credit"
        value={settings.ngnPerCredit}
        onSave={(v) => handleSave('global_ngn_per_credit', v)}
        suffix="₦ per credit"
        hint="Used everywhere a Naira price gets converted into credits."
      />
    </div>
  )
}

// ── per-tool margin ────────────────────────────────────────────────────
function ToolMarginsSection() {
  const [margins, setMargins] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const rows = await fetchAllToolMargins()
    const map = {}
    for (const r of rows) map[r.tool_key] = r.margin_multiplier
    setMargins(map)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (toolKey, draft) => {
    await saveToolMargin(toolKey, draft)
    toast.success('Margin saved')
    await load()
  }

  if (loading) return null

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        Tool Margins
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        One margin per tool, applied to every model used there. e.g. 2.2 = retail price is cost × 2.2 (~55% margin).
      </p>
      {KNOWN_TOOLS.map((tool) => (
        <SettingRow
          key={tool.key}
          label={tool.label}
          value={margins[tool.key]}
          onSave={(v) => handleSave(tool.key, v)}
          suffix="× cost"
        />
      ))}
    </div>
  )
}

// ── cost editor for one selected model ────────────────────────────────
function ModelCostEditor({ model, onSaved }) {
  const existing = model.cost_usd_resolution || {}
  const hasResolutionKeys = Object.keys(existing).some((k) => k !== 'standard')

  const [splitByResolution, setSplitByResolution] = useState(hasResolutionKeys)
  const [flatValue, setFlatValue] = useState(existing.standard ?? '')
  const [resValues, setResValues] = useState(
    Object.fromEntries(RESOLUTION_PRESETS.map((r) => [r, existing[r] ?? '']))
  )
  const [customKey, setCustomKey] = useState('')
  const [customValue, setCustomValue] = useState('')
  const [isFlatRate, setIsFlatRate] = useState(!!model.is_flat_rate)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const c = model.cost_usd_resolution || {}
    const hasRes = Object.keys(c).some((k) => k !== 'standard')
    setSplitByResolution(hasRes)
    setFlatValue(c.standard ?? '')
    setResValues(Object.fromEntries(RESOLUTION_PRESETS.map((r) => [r, c[r] ?? ''])))
    setIsFlatRate(!!model.is_flat_rate)
    setCustomKey('')
    setCustomValue('')
  }, [model.id]) // eslint-disable-line

  const handleSave = async () => {
    setSaving(true)
    let costMap = {}

    if (splitByResolution) {
      for (const r of RESOLUTION_PRESETS) {
        if (resValues[r] !== '' && resValues[r] != null) costMap[r] = Number(resValues[r])
      }
      if (customKey.trim() && customValue !== '') costMap[customKey.trim()] = Number(customValue)
    } else if (flatValue !== '' && flatValue != null) {
      costMap.standard = Number(flatValue)
    }

    const { error } = await supabase
      .from('models')
      .update({
        cost_usd_resolution: Object.keys(costMap).length ? costMap : null,
        is_flat_rate: isFlatRate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', model.id)

    setSaving(false)
    if (error) { toast.error('Failed to save cost'); return }
    toast.success('Cost saved')
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <div>
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{model.label}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {model.value} · {model.provider} · {model.type}
        </p>
      </div>

      {/* Flat vs per-second */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsFlatRate(true)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold"
          style={{
            background: isFlatRate ? 'var(--brand)' : 'var(--bg-elevated)',
            color: isFlatRate ? '#fff' : 'var(--text-muted)',
          }}
        >
          Flat per generation
        </button>
        <button
          onClick={() => setIsFlatRate(false)}
          className="px-3 py-1.5 rounded-xl text-xs font-bold"
          style={{
            background: !isFlatRate ? 'var(--brand)' : 'var(--bg-elevated)',
            color: !isFlatRate ? '#fff' : 'var(--text-muted)',
          }}
        >
          Per second
        </button>
      </div>

      {/* Split by resolution toggle */}
      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={splitByResolution} onChange={(e) => setSplitByResolution(e.target.checked)} />
        Cost varies by resolution
      </label>

      {!splitByResolution ? (
        <div className="flex items-center gap-1.5">
          <DollarSign size={13} style={{ color: 'var(--text-muted)' }} />
          <input
            type="number" step="0.001"
            placeholder={isFlatRate ? 'cost per generation ($)' : 'cost per second ($)'}
            value={flatValue}
            onChange={(e) => setFlatValue(e.target.value)}
            className="flex-1 px-2.5 py-2 rounded-lg text-sm"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {RESOLUTION_PRESETS.map((res) => (
            <div key={res} className="flex items-center gap-1.5">
              <span className="text-xs w-14 flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{res}</span>
              <DollarSign size={13} style={{ color: 'var(--text-muted)' }} />
              <input
                type="number" step="0.001"
                placeholder={isFlatRate ? '$ per generation' : '$ per second'}
                value={resValues[res]}
                onChange={(e) => setResValues((prev) => ({ ...prev, [res]: e.target.value }))}
                className="flex-1 px-2.5 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
              />
            </div>
          ))}
          <div className="flex items-center gap-1.5 pt-1" style={{ borderTop: '1px solid var(--border-color)' }}>
            <input
              type="text" placeholder="custom key (e.g. 4k)"
              value={customKey} onChange={(e) => setCustomKey(e.target.value)}
              className="w-32 px-2.5 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            />
            <DollarSign size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              type="number" step="0.001" placeholder="$"
              value={customValue} onChange={(e) => setCustomValue(e.target.value)}
              className="flex-1 px-2.5 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
      )}

      {!model.cost_usd_resolution && (
        <p className="text-xs flex items-center gap-1" style={{ color: '#fbbf24' }}>
          <AlertTriangle size={11} /> No real cost saved yet — this model can't be priced or checked out anywhere until you save one.
        </p>
      )}

      <button
        onClick={handleSave} disabled={saving}
        className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: 'var(--brand)', color: '#fff', opacity: saving ? 0.6 : 1 }}
      >
        <Save size={14} /> {saving ? 'Saving…' : 'Save Cost'}
      </button>
    </div>
  )
}

// ── model search + select ─────────────────────────────────────────────
function ModelSearch({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const handle = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('models')
        .select('*')
        .or(`label.ilike.%${query}%,value.ilike.%${query}%`)
        .order('sort_order')
        .limit(20)
      setResults(data || [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(handle)
  }, [query])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any model by name…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {searching && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Searching…</p>}

      {results.map((m) => {
        const hasCost = !!m.cost_usd_resolution
        return (
          <button
            key={m.id}
            onClick={() => { onSelect(m); setQuery(''); setResults([]) }}
            className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.value} · {m.type}</p>
            </div>
            {!hasCost && (
              <span className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                no cost
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function ModelPricingManager() {
  const [selectedModel, setSelectedModel] = useState(null)

  const refreshSelected = useCallback(async () => {
    if (!selectedModel) return
    const { data } = await supabase.from('models').select('*').eq('id', selectedModel.id).single()
    if (data) setSelectedModel(data)
  }, [selectedModel])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <Settings2 size={16} style={{ color: 'var(--text-muted)' }} />
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Real provider cost per model, tool margins, and currency rates — the numbers every tool's checkout price is computed from.
        </p>
      </div>

      <GlobalSettingsSection />
      <ToolMarginsSection />

      <div className="flex flex-col gap-3">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          Model Cost
        </p>
        <ModelSearch onSelect={setSelectedModel} />
        {selectedModel && (
          <ModelCostEditor model={selectedModel} onSaved={refreshSelected} />
        )}
      </div>
    </div>
  )
}

