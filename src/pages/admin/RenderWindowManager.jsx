// src/pages/admin/RenderWindowManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Check, Clock, Zap, ZapOff,
  CalendarDays, Users, ChevronDown, ChevronUp,
  AlertTriangle, RefreshCw, Pencil, Trash2,
  History as HistoryIcon, CreditCard, ArrowLeft, Server,
} from 'lucide-react'
import { supabase, renderWindows } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  scheduled: { label: 'Scheduled', color: '#6366f1', bg: 'rgba(99,102,241,0.12)'  },
  active:    { label: 'Live Now',  color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  closed:    { label: 'Closed',    color: '#888',    bg: 'rgba(255,255,255,0.06)' },
  cancelled: { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.10)'   },
}

const fmtDatetimeLocal = (iso) => {
  if (!iso) return ''
  // Convert ISO → datetime-local input value (YYYY-MM-DDTHH:MM)
  return new Date(iso).toISOString().slice(0, 16)
}

const fmtDisplay = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  })
}

const fmtDateOnly = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day:   '2-digit',
    month: 'short',
    year:  'numeric',
  })
}

const fmtTimeOnly = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour:   '2-digit',
    minute: '2-digit',
  })
}

const fmtDuration = (startIso, endIso) => {
  if (!startIso || !endIso) return '—'
  const diffMs = new Date(endIso) - new Date(startIso)
  if (diffMs <= 0) return '—'
  const mins = Math.round(diffMs / 60000)
  const hrs  = Math.floor(mins / 60)
  const rem  = mins % 60
  if (hrs === 0) return `${rem}m`
  if (rem === 0) return `${hrs}h`
  return `${hrs}h ${rem}m`
}

const timeUntil = (iso) => {
  if (!iso) return ''
  const diff = new Date(iso) - new Date()
  if (diff < 0) return 'passed'
  const mins  = Math.floor(diff / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`
  return `in ${Math.floor(hrs / 24)}d`
}

const timeLeft = (iso) => {
  if (!iso) return ''
  const diff = new Date(iso) - new Date()
  if (diff < 0) return 'ended'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m left`
  return `${Math.floor(mins / 60)}h ${mins % 60}m left`
}

// ─── Modal Shell ──────────────────────────────────────────────────────────────

const Modal = ({ title, onClose, children }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    style={{ background: 'rgba(0,0,0,0.55)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.18 }}
      onClick={(e) => e.stopPropagation()}
      className="w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          <X size={14} />
        </button>
      </div>
      {children}
    </motion.div>
  </motion.div>
)

// ─── Tier Pricing Editor ──────────────────────────────────────────────────

const TierRow = ({ tier, onSaved }) => {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)

  const open  = () => { setDraft(String(tier.price_ngn ?? '')); setEditing(true) }
  const close = () => setEditing(false)

  const savePrice = async () => {
    const price = parseInt(draft, 10)
    if (isNaN(price) || price < 100) {
      toast.error('Price must be at least ₦100')
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_update_render_window_tier', {
      p_admin_id:  user.id,
      p_tier_id:   tier.id,
      p_price_ngn: price,
      p_is_active: null,
    })
    setSaving(false)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to save price'); return }
    toast.success(`${tier.display_name} price updated to ₦${price.toLocaleString()}`)
    onSaved({ ...tier, price_ngn: price })
    setEditing(false)
  }

  const toggleActive = async () => {
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_update_render_window_tier', {
      p_admin_id:  user.id,
      p_tier_id:   tier.id,
      p_price_ngn: null,
      p_is_active: !tier.is_active,
    })
    setSaving(false)
    if (error || !data?.success) { toast.error(data?.error || 'Failed to update status'); return }
    toast.success(`${tier.display_name} ${!tier.is_active ? 'enabled' : 'disabled'}`)
    onSaved({ ...tier, is_active: !tier.is_active })
  }

  return (
    <div
      className="rounded-xl p-3.5"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {tier.display_name}
          </p>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {tier.duration_days}d
          </span>
        </div>
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
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>₦</span>
          <input
            autoFocus
            type="number"
            min={100}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') savePrice(); if (e.key === 'Escape') close() }}
            className="input-base flex-1 text-lg font-black"
            style={{ color: 'var(--brand)' }}
          />
          <button
            onClick={savePrice}
            disabled={saving}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            {saving ? '…' : <Check size={15} />}
          </button>
          <button
            onClick={close}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
            ₦{Number(tier.price_ngn).toLocaleString()}
          </p>
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

const TierPricingEditor = ({ tiers, onTiersChange }) => {
  const handleSaved = (updated) => {
    onTiersChange((prev) => prev.map((t) => t.id === updated.id ? updated : t))
  }

  return (
    <div className="flex flex-col gap-2">
      {tiers.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No tiers configured.</p>
      ) : (
        tiers
          .slice()
          .sort((a, b) => a.display_order - b.display_order)
          .map((tier) => (
            <TierRow key={tier.id} tier={tier} onSaved={handleSaved} />
          ))
      )}
    </div>
  )
}

// ─── Window Form ──────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  label:     '',
  starts_at: '',
  ends_at:   '',
  capacity:  '',
  notes:     '',
}

const WindowForm = ({ initial, renderWindowModels, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(initial ?? EMPTY_FORM)
  const [stagedModels,   setStagedModels]   = useState([])
  const [stagedModelId,  setStagedModelId]  = useState('')
  const [stagedEndpoint, setStagedEndpoint] = useState('')

  const isCreating = !initial

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }))

  const isValid =
    form.label.trim().length > 0 &&
    form.starts_at &&
    form.ends_at &&
    new Date(form.ends_at) > new Date(form.starts_at)

  const availableToStage = (renderWindowModels ?? []).filter(
    (m) => !stagedModels.some((s) => s.model_id === m.id)
  )

  const addStagedModel = () => {
    if (!stagedModelId || !stagedEndpoint.trim()) {
      toast.error('Select a model and paste its endpoint')
      return
    }
    if (!stagedEndpoint.startsWith('http')) {
      toast.error('Endpoint must be a valid URL')
      return
    }
    const model = renderWindowModels.find((m) => m.id === stagedModelId)
    setStagedModels((prev) => [...prev, {
      model_id: stagedModelId,
      label:    model?.label ?? stagedModelId,
      endpoint: stagedEndpoint.trim(),
    }])
    setStagedModelId('')
    setStagedEndpoint('')
  }

  const removeStagedModel = (modelId) => {
    setStagedModels((prev) => prev.filter((m) => m.model_id !== modelId))
  }

  const handleSubmit = () => {
    if (!isValid) return
    onSave({
      label:     form.label.trim(),
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at:   new Date(form.ends_at).toISOString(),
      capacity:  form.capacity ? parseInt(form.capacity, 10) : null,
      notes:     form.notes.trim() || null,
      models:    isCreating ? stagedModels : undefined,
    })
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      {/* Label */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Window Label *
        </label>
        <input
          value={form.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder="e.g. Tuesday Evening Window"
          className="input-base w-full text-sm"
        />
      </div>

      {/* Start / End */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Opens *
          </label>
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => set('starts_at', e.target.value)}
            className="input-base w-full text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Closes *
          </label>
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={(e) => set('ends_at', e.target.value)}
            className="input-base w-full text-sm"
          />
        </div>
      </div>

      {/* Validation hint */}
      {form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at) && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: '#ef4444' }}>
          <AlertTriangle size={11} /> End time must be after start time
        </p>
      )}

      {/* Capacity */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Capacity (optional)
        </label>
        <input
          type="number"
          min={1}
          value={form.capacity}
          onChange={(e) => set('capacity', e.target.value)}
          placeholder="Leave blank for unlimited"
          className="input-base w-full text-sm"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Notes (optional)
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Internal admin notes…"
          rows={2}
          className="input-base w-full text-sm resize-none"
        />
      </div>

      {/* Models & Endpoints — creation only; existing windows use the live editor on the card */}
      {isCreating && (
        <div>
          <label className="text-xs font-bold uppercase tracking-wide block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Models & Endpoints (optional — can add later)
          </label>

          {stagedModels.length > 0 && (
            <div className="flex flex-col gap-2 mb-2">
              {stagedModels.map((m) => (
                <div
                  key={m.model_id}
                  className="rounded-xl px-3 py-2 flex items-center gap-2"
                  style={{ background: 'var(--bg-card)' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>{m.endpoint}</p>
                  </div>
                  <button
                    onClick={() => removeStagedModel(m.model_id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {availableToStage.length > 0 ? (
            <div className="flex flex-col gap-2">
              <select
                value={stagedModelId}
                onChange={(e) => setStagedModelId(e.target.value)}
                className="input-base w-full text-sm"
              >
                <option value="">Select a model…</option>
                {availableToStage.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={stagedEndpoint}
                  onChange={(e) => setStagedEndpoint(e.target.value)}
                  placeholder="https://abc123-8188.proxy.runpod.net"
                  className="input-base flex-1 text-sm font-mono"
                />
                <button
                  onClick={addStagedModel}
                  className="px-4 rounded-xl text-xs font-bold flex-shrink-0"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                >
                  Add
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No more render-window models available to add.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSubmit}
          disabled={!isValid || saving}
          className="flex-1 py-3 rounded-2xl text-sm font-bold transition-all"
          style={{
            background: isValid ? 'var(--brand)' : 'var(--bg-card)',
            color:      isValid ? 'white'        : 'var(--text-muted)',
            opacity:    saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : initial ? 'Save Changes' : 'Create Window'}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-3 rounded-2xl text-sm font-bold"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Window Models Editor (live — for existing scheduled/active windows) ─────

const WindowModelsEditor = ({ windowId, isLive }) => {
  const [attachments,      setAttachments]      = useState([])
  const [availableModels,  setAvailableModels]  = useState([])
  const [loading,          setLoading]          = useState(true)
  const [selectedModelId,  setSelectedModelId]  = useState('')
  const [endpointDraft,    setEndpointDraft]    = useState('')
  const [adding,           setAdding]           = useState(false)
  const [editingId,        setEditingId]        = useState(null)
  const [editDraft,        setEditDraft]        = useState('')
  const [busyId,           setBusyId]           = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [attachRes, modelsRes] = await Promise.all([
      supabase
        .from('render_window_models')
        .select('id, model_id, comfyui_endpoint, sort_order, model:models(id, label, value)')
        .eq('render_window_id', windowId)
        .order('sort_order'),
      supabase
        .from('models')
        .select('id, label, value')
        .eq('model_access_type', 'render_window')
        .order('label'),
    ])
    setAttachments(attachRes.data || [])
    setAvailableModels(modelsRes.data || [])
    setLoading(false)
  }, [windowId])

  useEffect(() => { load() }, [load])

  // NOTE: models can now be attached to the SAME window more than once
  // (multiple pods for the same model, round-robin dispatched). So we no
  // longer exclude already-attached models from the picker — we just label
  // them so admin knows they're adding an additional pod, not a first one.
  const attachedCounts = attachments.reduce((acc, a) => {
    acc[a.model_id] = (acc[a.model_id] || 0) + 1
    return acc
  }, {})
  const selectableModels = availableModels.map((m) => ({
    ...m,
    _alreadyAttachedCount: attachedCounts[m.id] || 0,
  }))

  const handleAdd = async () => {
    if (!selectedModelId || !endpointDraft.trim()) {
      toast.error('Select a model and paste its endpoint')
      return
    }
    if (!endpointDraft.startsWith('http')) {
      toast.error('Endpoint must be a valid URL')
      return
    }
    setAdding(true)
    const { data, error } = await supabase
      .from('render_window_models')
      .insert({
        render_window_id: windowId,
        model_id:          selectedModelId,
        comfyui_endpoint:  endpointDraft.trim(),
        sort_order:        attachments.length,
      })
      .select('id, model_id, comfyui_endpoint, sort_order, model:models(id, label, value)')
      .single()
    setAdding(false)
    if (error) { toast.error('Failed to add model — it may already be attached'); return }
    toast.success(`${data.model.label} added`)
    setAttachments((prev) => [...prev, data])
    setSelectedModelId('')
    setEndpointDraft('')
  }

  const handleRemove = async (id, label) => {
    setBusyId(id)
    const { error } = await supabase.from('render_window_models').delete().eq('id', id)
    setBusyId(null)
    if (error) { toast.error('Failed to remove model'); return }
    toast.success(`${label} removed${isLive ? ' — blocked immediately' : ''}`)
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const startEdit = (att) => { setEditingId(att.id); setEditDraft(att.comfyui_endpoint) }

  const saveEdit = async (id) => {
    if (!editDraft.trim() || !editDraft.startsWith('http')) {
      toast.error('Endpoint must be a valid URL')
      return
    }
    setBusyId(id)
    const { error } = await supabase
      .from('render_window_models')
      .update({ comfyui_endpoint: editDraft.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
    setBusyId(null)
    if (error) { toast.error('Failed to update endpoint'); return }
    toast.success('Endpoint updated')
    setAttachments((prev) => prev.map((a) => a.id === id ? { ...a, comfyui_endpoint: editDraft.trim() } : a))
    setEditingId(null)
  }

  return (
    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
      <div className="flex items-center gap-2 mb-2">
        <Server size={12} style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
          Models & Endpoints
        </p>
      </div>

      {loading ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {attachments.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No models attached — generations against this window will be blocked until you add at least one.
            </p>
          )}

          {attachments.map((att) => (
            <div key={att.id} className="rounded-xl p-3" style={{ background: 'var(--bg-elevated)' }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  {att.model?.label ?? att.model_id}
                </p>
                <button
                  onClick={() => handleRemove(att.id, att.model?.label)}
                  disabled={busyId === att.id}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                >
                  <Trash2 size={10} />
                </button>
              </div>

              {editingId === att.id ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(att.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="input-base flex-1 text-xs font-mono"
                  />
                  <button
                    onClick={() => saveEdit(att.id)}
                    disabled={busyId === att.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
                  >
                    <Check size={12} />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                    {att.comfyui_endpoint}
                  </p>
                  <button
                    onClick={() => startEdit(att)}
                    className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                    style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
                  >
                    <Pencil size={10} /> Edit
                  </button>
                </div>
              )}
            </div>
          ))}

          {selectableModels.length > 0 && (
            <div
              className="rounded-xl p-3 flex flex-col gap-2"
              style={{ background: 'var(--bg-card)', border: '1px dashed var(--border-color)' }}
            >
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="input-base w-full text-xs"
              >
                <option value="">Select a model to add…</option>
                {selectableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}{m._alreadyAttachedCount > 0 ? ` (+${m._alreadyAttachedCount} pod${m._alreadyAttachedCount > 1 ? 's' : ''} already attached)` : ''}
                  </option>
                ))}
              </select>
              <input
                value={endpointDraft}
                onChange={(e) => setEndpointDraft(e.target.value)}
                placeholder="https://abc123-8188.proxy.runpod.net"
                className="input-base w-full text-xs font-mono"
              />
              <button
                onClick={handleAdd}
                disabled={adding || !selectedModelId || !endpointDraft.trim()}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold"
                style={{
                  background: selectedModelId && endpointDraft.trim() ? 'rgba(16,185,129,0.15)' : 'var(--bg-elevated)',
                  color:      selectedModelId && endpointDraft.trim() ? '#10b981' : 'var(--text-muted)',
                }}
              >
                <Plus size={12} /> {adding ? 'Adding…' : 'Add Model'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Window Card (active / scheduled / cancelled — full actions) ─────────────

const WindowCard = ({ win, onOpen, onClose, onEdit, onDelete, actionLoading }) => {
  const [expanded, setExpanded] = useState(false)
  const meta    = STATUS_META[win.status] ?? STATUS_META.closed
  const isLive  = win.status === 'active'
  const loading = actionLoading === win.id

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: isLive ? 'rgba(16,185,129,0.04)' : 'var(--bg-card)',
        border:     `1px solid ${isLive ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
      }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Status dot */}
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            background: meta.color,
            boxShadow:  isLive ? `0 0 8px ${meta.color}` : 'none',
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {win.label}
            </p>
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: meta.bg, color: meta.color }}
            >
              {meta.label}
            </span>
            {isLive && (
              <span className="text-xs font-bold" style={{ color: '#10b981' }}>
                · {timeLeft(win.ends_at)}
              </span>
            )}
            {win.status === 'scheduled' && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                · {timeUntil(win.starts_at)}
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {fmtDisplay(win.starts_at)} → {fmtDisplay(win.ends_at)}
          </p>
        </div>

        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div
              className="px-4 pb-4 flex flex-col gap-3"
              style={{ borderTop: '1px solid var(--border-color)' }}
            >
              {/* Details */}
              <div className="grid grid-cols-2 gap-2 pt-3">
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Opens</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {fmtDisplay(win.starts_at)}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Closes</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {fmtDisplay(win.ends_at)}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Capacity</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {win.capacity ?? 'Unlimited'}
                  </p>
                </div>
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Created</p>
                  <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                    {fmtDisplay(win.created_at)}
                  </p>
                </div>
              </div>

              {win.notes && (
                <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Notes</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{win.notes}</p>
                </div>
              )}

              {/* Models & Endpoints — live editing, changes apply immediately */}
              {win.status !== 'cancelled' && (
                <WindowModelsEditor windowId={win.id} isLive={isLive} />
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap">
                {/* Open / Close toggle */}
                {win.status !== 'cancelled' && (
                  isLive ? (
                    <button
                      onClick={() => onClose(win.id)}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                    >
                      <ZapOff size={12} />
                      {loading ? 'Closing…' : 'Close Window'}
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpen(win.id)}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
                    >
                      <Zap size={12} />
                      {loading ? 'Opening…' : 'Open Now'}
                    </button>
                  )
                )}

               {/* Edit — scheduled or currently active (lets admin extend/change end time live) */}
                {(win.status === 'scheduled' || win.status === 'active') && (
                  <button
                    onClick={() => onEdit(win)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                  >
                    <Pencil size={11} /> {win.status === 'active' ? 'Edit / Extend' : 'Edit'}
                  </button>
                )}

                {/* Delete — only for scheduled or cancelled */}
                {(win.status === 'scheduled' || win.status === 'cancelled') && (
                  <button
                    onClick={() => onDelete(win.id)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── History Row (closed windows — read only, no expand, no actions) ────────

const HistoryRow = ({ win }) => (
  <div
    className="flex items-center gap-3 rounded-2xl p-4"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div
      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ background: STATUS_META.closed.color }}
    />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
        {win.label}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {fmtDateOnly(win.starts_at)} · {fmtTimeOnly(win.starts_at)}–{fmtTimeOnly(win.ends_at)}
      </p>
    </div>
    <div className="text-right flex-shrink-0">
      <p className="text-xs font-bold" style={{ color: 'var(--text-secondary)' }}>
        {fmtDuration(win.starts_at, win.ends_at)}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>duration</p>
    </div>
  </div>
)

// ─── Summary Bar ──────────────────────────────────────────────────────────────

const SummaryBar = ({ summary, loading }) => {
  if (loading || !summary) return null

  const isOpen    = summary.window_open
  const subCount  = summary.active_sub_count ?? 0
  const nextWin   = summary.next_window

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{
        background: isOpen ? 'rgba(16,185,129,0.06)' : 'var(--bg-card)',
        border:     `1px solid ${isOpen ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`,
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            background: isOpen ? '#10b981' : '#888',
            boxShadow:  isOpen ? '0 0 8px #10b981' : 'none',
          }}
        />
        <p className="text-sm font-black" style={{ color: isOpen ? '#10b981' : 'var(--text-primary)' }}>
          {isOpen ? 'Window is OPEN' : 'Window is CLOSED'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <Users size={11} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Active subs</p>
          </div>
          <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>{subCount}</p>
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarDays size={11} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Next window</p>
          </div>
          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            {nextWin?.label
              ? `${nextWin.label} · ${timeUntil(nextWin.starts_at)}`
              : 'None scheduled'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RenderWindowManager() {
  const { user }                              = useAuth()
  const [windows,       setWindows]           = useState([])
  const [summary,       setSummary]           = useState(null)
  const [tiers,         setTiers]             = useState([])
  const [loading,       setLoading]           = useState(true)
  const [summaryLoad,   setSummaryLoad]       = useState(true)
  const [actionLoading, setActionLoading]     = useState(null)
  const [showForm,      setShowForm]          = useState(false)
  const [editingWindow, setEditingWindow]     = useState(null)
  const [formSaving,    setFormSaving]        = useState(false)
  const [filter,        setFilter]            = useState('all')
  const [view,          setView]              = useState('manage') // 'manage' | 'history'
  const [showSubs,      setShowSubs]          = useState(false)
  const [renderWindowModels, setRenderWindowModels] = useState([])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setSummaryLoad(true)

    const [windowsRes, summaryRes, tiersRes, rwModelsRes] = await Promise.all([
      renderWindows.getUpcoming(),
      renderWindows.getAdminSummary(),
      supabase.from('render_window_tiers').select('*').order('display_order'),
      supabase.from('models').select('id, label, value').eq('model_access_type', 'render_window').order('label'),
    ])

    setWindows(windowsRes.data || [])
    setSummary(summaryRes.data ?? null)
    setTiers(tiersRes.data     || [])
    setRenderWindowModels(rwModelsRes.data || [])
    setLoading(false)
    setSummaryLoad(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Create window ────────────────────────────────────────────────────────
  const handleCreate = async (payload) => {
    setFormSaving(true)
    const { models, ...windowPayload } = payload
    const { data, error } = await renderWindows.create({
      ...windowPayload,
      created_by: user.id,
      status:     'scheduled',
    })

    if (error) {
      setFormSaving(false)
      toast.error(`Failed to create window: ${error.message}`)
      return
    }

    if (models?.length) {
      const rows = models.map((m, idx) => ({
        render_window_id: data.id,
        model_id:          m.model_id,
        comfyui_endpoint:  m.endpoint,
        sort_order:        idx,
      }))
      const { error: modelsError } = await supabase.from('render_window_models').insert(rows)
      if (modelsError) {
        toast.error('Window created, but models failed to attach — add them from the window card.')
      }
    }

    setFormSaving(false)
    toast.success('Window created')
    setShowForm(false)
    setWindows((prev) => [data, ...prev].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)))
    loadAll()
  }

  // ── Edit window ──────────────────────────────────────────────────────────
  const handleEdit = async (payload) => {
    if (!editingWindow) return
    setFormSaving(true)
    const { data, error } = await renderWindows.update(editingWindow.id, payload)
    setFormSaving(false)
    if (error) { toast.error(`Failed to update window: ${error.message}`); return }
    toast.success('Window updated')
    setEditingWindow(null)
    setWindows((prev) => prev.map((w) => w.id === data.id ? data : w))
  }

  // ── Open window manually ─────────────────────────────────────────────────
  const handleOpen = async (windowId) => {
    setActionLoading(windowId)
    const { data, error } = await renderWindows.adminOpen(user.id, windowId)
    setActionLoading(null)
    if (error || !data?.success) {
      toast.error(data?.error || 'Failed to open window')
      return
    }
    toast.success('Window is now LIVE')
    // Optimistic update
    setWindows((prev) => prev.map((w) => ({
      ...w,
      status: w.id === windowId ? 'active' : (w.status === 'active' ? 'closed' : w.status),
    })))
    loadAll()
  }

  // ── Close window manually ────────────────────────────────────────────────
  const handleClose = async (windowId) => {
    setActionLoading(windowId)
    const { data, error } = await renderWindows.adminClose(user.id, windowId)
    setActionLoading(null)
    if (error || !data?.success) {
      toast.error(data?.error || 'Failed to close window')
      return
    }
    toast.success('Window closed')
    setWindows((prev) => prev.map((w) => w.id === windowId ? { ...w, status: 'closed' } : w))
    loadAll()
  }

  // ── Delete window ─────────────────────────────────────────────────────────
  const handleDelete = async (windowId) => {
    if (!window.confirm('Delete this window? This cannot be undone.')) return
    setActionLoading(windowId)
    const { error } = await renderWindows.delete(windowId)
    setActionLoading(null)
    if (error) { toast.error('Failed to delete window'); return }
    toast.success('Window deleted')
    setWindows((prev) => prev.filter((w) => w.id !== windowId))
    loadAll()
  }

  // ── Split windows: manage (non-closed) vs history (closed) ─────────────────
  const manageWindows = windows.filter((w) => w.status !== 'closed')
  const historyWindows = windows
    .filter((w) => w.status === 'closed')
    .sort((a, b) => new Date(b.ends_at) - new Date(a.ends_at))

  const filtered = manageWindows.filter((w) => {
    if (filter === 'all')       return true
    if (filter === 'active')    return w.status === 'active'
    if (filter === 'scheduled') return w.status === 'scheduled'
    if (filter === 'cancelled') return w.status === 'cancelled'
    return true
  })

  const filters = ['all', 'active', 'scheduled', 'cancelled']

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Render Windows
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Schedule and manage GPU render windows. Only one can be active at a time.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSubs(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          >
            <CreditCard size={13} /> Subscriptions
          </button>
          <button
            onClick={loadAll}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Tab switcher: Manage / History */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('manage')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
          style={{
            background: view === 'manage' ? 'var(--brand)' : 'var(--bg-card)',
            color:      view === 'manage' ? 'white'        : 'var(--text-muted)',
            border:     `1px solid ${view === 'manage' ? 'var(--brand)' : 'var(--border-color)'}`,
          }}
        >
          <CalendarDays size={13} /> Windows {manageWindows.length > 0 && `· ${manageWindows.length}`}
        </button>
        <button
          onClick={() => setView('history')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
          style={{
            background: view === 'history' ? 'var(--brand)' : 'var(--bg-card)',
            color:      view === 'history' ? 'white'        : 'var(--text-muted)',
            border:     `1px solid ${view === 'history' ? 'var(--brand)' : 'var(--border-color)'}`,
          }}
        >
          <HistoryIcon size={13} /> History {historyWindows.length > 0 && `· ${historyWindows.length}`}
        </button>
      </div>

      {view === 'manage' ? (
        <>
          {/* Summary bar */}
          <SummaryBar summary={summary} loading={summaryLoad} />

          {/* New window trigger */}
          <button
            onClick={() => { setEditingWindow(null); setShowForm((s) => !s) }}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: showForm ? 'var(--bg-elevated)' : 'var(--brand)',
              color:      showForm ? 'var(--text-muted)'  : 'white',
            }}
          >
            {showForm ? <X size={13} /> : <Plus size={13} />}
            {showForm ? 'Cancel' : 'New Window'}
          </button>

          {/* Create form */}
          <AnimatePresence>
            {showForm && !editingWindow && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <WindowForm
                  renderWindowModels={renderWindowModels}
                  onSave={handleCreate}
                  onCancel={() => setShowForm(false)}
                  saving={formSaving}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Edit form */}
          <AnimatePresence>
            {editingWindow && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    Editing: {editingWindow.label}
                  </p>
                  <button
                    onClick={() => setEditingWindow(null)}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <WindowForm
                  initial={{
                    label:     editingWindow.label,
                    starts_at: fmtDatetimeLocal(editingWindow.starts_at),
                    ends_at:   fmtDatetimeLocal(editingWindow.ends_at),
                    capacity:  editingWindow.capacity ?? '',
                    notes:     editingWindow.notes ?? '',
                  }}
                  onSave={handleEdit}
                  onCancel={() => setEditingWindow(null)}
                  saving={formSaving}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {filters.map((f) => {
              const meta  = f === 'all' ? null : STATUS_META[f]
              const count = f === 'all'
                ? manageWindows.length
                : manageWindows.filter((w) => w.status === f).length
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
                  style={{
                    background: filter === f
                      ? (meta?.bg ?? 'var(--bg-elevated)')
                      : 'var(--bg-card)',
                    color: filter === f
                      ? (meta?.color ?? 'var(--text-primary)')
                      : 'var(--text-muted)',
                    border: `1px solid ${filter === f
                      ? (meta?.color ?? 'var(--border-color)') + '44'
                      : 'var(--border-color)'}`,
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)} {count > 0 && `· ${count}`}
                </button>
              )
            })}
          </div>

          {/* Window list */}
          {loading ? (
            <div className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-2xl animate-pulse"
                  style={{ background: 'var(--bg-card)', opacity: 0.5 - i * 0.1 }}
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <CalendarDays size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {filter === 'all' ? 'No windows yet' : `No ${filter} windows`}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {filter === 'all' ? 'Create your first render window above.' : 'Try a different filter.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {filtered.map((win) => (
                  <WindowCard
                    key={win.id}
                    win={win}
                    onOpen={handleOpen}
                    onClose={handleClose}
                    onEdit={(w) => { setShowForm(false); setEditingWindow(w) }}
                    onDelete={handleDelete}
                    actionLoading={actionLoading}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </>
      ) : (
        <>
          {/* History list — read-only, no actions */}
          {loading ? (
            <div className="flex flex-col gap-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-2xl animate-pulse"
                  style={{ background: 'var(--bg-card)', opacity: 0.5 - i * 0.1 }}
                />
              ))}
            </div>
          ) : historyWindows.length === 0 ? (
            <div className="text-center py-12">
              <HistoryIcon size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                No closed windows yet
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Closed windows will appear here once they end.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {historyWindows.map((win) => (
                <HistoryRow key={win.id} win={win} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Subscriptions modal */}
      <AnimatePresence>
        {showSubs && (
          <Modal title="Subscription Tiers" onClose={() => setShowSubs(false)}>
            <TierPricingEditor tiers={tiers} onTiersChange={setTiers} />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  )
}
