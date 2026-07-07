// src/pages/admin/RenderWindowTeamTierManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { Plus, Check, X, Pencil, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const EMPTY_FORM = {
  tier_name:        '',
  display_name:     '',
  duration_days:    '7',
  seat_count:       '5',
  daily_unit_quota: '15',
  price_ngn:        '',
}

const TierEditor = ({ tier, onSaved }) => {
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState(null)
  const [saving,  setSaving]  = useState(false)

  const open = () => {
    setForm({
      display_name:     tier.display_name,
      duration_days:    String(tier.duration_days),
      seat_count:       String(tier.seat_count),
      daily_unit_quota: String(tier.daily_unit_quota),
      price_ngn:        String(tier.price_ngn),
    })
    setEditing(true)
  }

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('render_window_team_tiers')
      .update({
        display_name:     form.display_name.trim(),
        duration_days:    parseInt(form.duration_days, 10),
        seat_count:       parseInt(form.seat_count, 10),
        daily_unit_quota: parseInt(form.daily_unit_quota, 10),
        price_ngn:        parseInt(form.price_ngn, 10),
        updated_at:       new Date().toISOString(),
      })
      .eq('id', tier.id)
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    toast.success(`${form.display_name} saved`)
    onSaved({
      ...tier,
      display_name:     form.display_name.trim(),
      duration_days:    parseInt(form.duration_days, 10),
      seat_count:       parseInt(form.seat_count, 10),
      daily_unit_quota: parseInt(form.daily_unit_quota, 10),
      price_ngn:        parseInt(form.price_ngn, 10),
    })
    setEditing(false)
  }

  const toggleActive = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('render_window_team_tiers')
      .update({ is_active: !tier.is_active, updated_at: new Date().toISOString() })
      .eq('id', tier.id)
    setSaving(false)
    if (error) { toast.error('Failed to update status'); return }
    onSaved({ ...tier, is_active: !tier.is_active })
  }

  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {tier.display_name}
        </p>
        <button
          onClick={toggleActive}
          disabled={saving}
          className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{
            background: tier.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
            color:      tier.is_active ? '#10b981' : '#ef4444',
          }}
        >
          {tier.is_active ? 'Enabled' : 'Disabled'}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            value={form.display_name}
            onChange={(e) => set('display_name', e.target.value)}
            placeholder="Display name"
            className="input-base w-full text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Days</label>
              <input type="number" min={1} value={form.duration_days} onChange={(e) => set('duration_days', e.target.value)} className="input-base w-full text-sm" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Seats</label>
              <input type="number" min={1} value={form.seat_count} onChange={(e) => set('seat_count', e.target.value)} className="input-base w-full text-sm" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Units/day</label>
              <input type="number" min={1} value={form.daily_unit_quota} onChange={(e) => set('daily_unit_quota', e.target.value)} className="input-base w-full text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Price (₦)</label>
            <input type="number" min={0} value={form.price_ngn} onChange={(e) => set('price_ngn', e.target.value)} className="input-base w-full text-sm" />
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold flex-1 justify-center"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
            >
              {saving ? '…' : <><Check size={12} /> Save</>}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
              ₦{Number(tier.price_ngn).toLocaleString()}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {tier.seat_count} seats · {tier.daily_unit_quota} units/day · {tier.duration_days}d
            </p>
          </div>
          <button
            onClick={open}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
          >
            <Pencil size={11} /> Edit
          </button>
        </div>
      )}
    </div>
  )
}

export default function RenderWindowTeamTierManager() {
  const [tiers,    setTiers]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('render_window_team_tiers')
      .select('*')
      .order('display_order')
    setTiers(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const isValid =
    form.tier_name.trim().length > 0 &&
    form.display_name.trim().length > 0 &&
    Number(form.duration_days) > 0 &&
    Number(form.seat_count) > 0 &&
    Number(form.daily_unit_quota) > 0 &&
    Number(form.price_ngn) >= 0

  const handleCreate = async () => {
    if (!isValid) return
    setCreating(true)
    const { data, error } = await supabase
      .from('render_window_team_tiers')
      .insert({
        tier_name:        form.tier_name.trim(),
        display_name:     form.display_name.trim(),
        duration_days:    parseInt(form.duration_days, 10),
        seat_count:       parseInt(form.seat_count, 10),
        daily_unit_quota: parseInt(form.daily_unit_quota, 10),
        price_ngn:        parseInt(form.price_ngn, 10),
        display_order:    tiers.length,
      })
      .select()
      .single()
    setCreating(false)
    if (error) { toast.error(error.message || 'Failed to create tier'); return }
    toast.success(`${data.display_name} created`)
    setTiers((prev) => [...prev, data])
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Render Window Team Tiers
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Configure Team subscription plans — seats, price, quota, duration.
          </p>
        </div>
        <button onClick={load} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <button
        onClick={() => setShowForm((s) => !s)}
        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
        style={{ background: showForm ? 'var(--bg-elevated)' : 'var(--brand)', color: showForm ? 'var(--text-muted)' : 'white' }}
      >
        {showForm ? <X size={13} /> : <Plus size={13} />}
        {showForm ? 'Cancel' : 'New Team Tier'}
      </button>

      {showForm && (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Internal tier name (unique) *
            </label>
            <input value={form.tier_name} onChange={(e) => set('tier_name', e.target.value)} placeholder="e.g. team_weekly" className="input-base w-full text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Display name *
            </label>
            <input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="e.g. Team Weekly" className="input-base w-full text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>Days</label>
              <input type="number" min={1} value={form.duration_days} onChange={(e) => set('duration_days', e.target.value)} className="input-base w-full text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>Seats</label>
              <input type="number" min={1} value={form.seat_count} onChange={(e) => set('seat_count', e.target.value)} className="input-base w-full text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>Units/day</label>
              <input type="number" min={1} value={form.daily_unit_quota} onChange={(e) => set('daily_unit_quota', e.target.value)} className="input-base w-full text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>Price (₦) *</label>
            <input type="number" min={0} value={form.price_ngn} onChange={(e) => set('price_ngn', e.target.value)} className="input-base w-full text-sm" />
          </div>
          <button
            onClick={handleCreate}
            disabled={!isValid || creating}
            className="w-full py-3 rounded-2xl text-sm font-bold transition-all"
            style={{ background: isValid ? 'var(--brand)' : 'var(--bg-card)', color: isValid ? 'white' : 'var(--text-muted)', opacity: creating ? 0.7 : 1 }}
          >
            {creating ? 'Creating…' : 'Create Team Tier'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)', opacity: 0.6 - i * 0.1 }} />)}
        </div>
      ) : tiers.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No team tiers configured yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {tiers.map((tier) => (
            <TierEditor
              key={tier.id}
              tier={tier}
              onSaved={(updated) => setTiers((prev) => prev.map((t) => t.id === updated.id ? updated : t))}
            />
          ))}
        </div>
      )}
    </div>
  )
}
