// src/pages/admin/RenderWindowModelManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Check, Pencil, Trash2, RefreshCw,
  Workflow, ChevronDown, ChevronUp,
  AlertTriangle, Eye, EyeOff, Wallet, Server
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { renderWindowBookingDurations } from '@/lib/renderWindowBooking'
import toast from 'react-hot-toast'

// ─── Workflow Editor ──────────────────────────────────────────────────────────

const WorkflowEditor = ({ model, onSaved }) => {
  const [editing, setEditing]   = useState(false)
  const [draft,   setDraft]     = useState('')
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState(null)
  const [preview, setPreview]   = useState(false)

  const open = () => {
    setDraft(model.comfyui_workflow_json
      ? JSON.stringify(model.comfyui_workflow_json, null, 2)
      : ''
    )
    setError(null)
    setEditing(true)
  }

  const validate = (str) => {
    try {
      const parsed = JSON.parse(str)
      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { valid: false, error: 'Workflow must be a JSON object' }
      }
      return { valid: true, parsed }
    } catch {
      return { valid: false, error: 'Invalid JSON — check for syntax errors' }
    }
  }

  const save = async () => {
    const { valid, parsed, error: err } = validate(draft)
    if (!valid) { setError(err); return }
    setSaving(true)
    const { error: dbError } = await supabase
      .from('models')
      .update({ comfyui_workflow_json: parsed })
      .eq('id', model.id)
    setSaving(false)
    if (dbError) { toast.error('Failed to save workflow'); return }
    toast.success(`Workflow saved for ${model.label}`)
    onSaved(parsed)
    setEditing(false)
  }

  const hasWorkflow = !!model.comfyui_workflow_json

  return (
    <div>
      {editing ? (
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>
              Paste ComfyUI API JSON
            </p>
            <button
              onClick={() => setPreview(p => !p)}
              className="text-xs flex items-center gap-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {preview ? <EyeOff size={10} /> : <Eye size={10} />}
              {preview ? 'Edit' : 'Preview'}
            </button>
          </div>

          {preview ? (
            <pre
              className="rounded-xl p-3 text-xs overflow-auto max-h-64"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                fontFamily: 'monospace'
              }}
            >
              {draft || 'Nothing to preview yet'}
            </pre>
          ) : (
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setError(null) }}
              placeholder='{"prompt": {"1": {"class_type": "...'
              rows={8}
              className="input-base w-full text-xs font-mono resize-none"
            />
          )}

          {error && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: '#ef4444' }}>
              <AlertTriangle size={11} /> {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || !draft.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold flex-1 justify-center"
              style={{
                background: draft.trim() ? 'rgba(16,185,129,0.15)' : 'var(--bg-card)',
                color:      draft.trim() ? '#10b981'                : 'var(--text-muted)'
              }}
            >
              {saving ? '…' : <><Check size={12} /> Save Workflow</>}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-xs font-bold px-2 py-1 rounded-lg"
            style={{
              background: hasWorkflow ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.08)',
              color:      hasWorkflow ? '#10b981'                : '#ef4444'
            }}
          >
            {hasWorkflow ? 'Workflow set' : 'No workflow'}
          </span>
          <button
            onClick={open}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <Pencil size={10} /> {hasWorkflow ? 'Edit' : 'Add'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Resolution Editor ────────────────────────────────────────────────────────

const ResolutionEditor = ({ model, onSaved }) => {
  const [editing, setEditing] = useState(false)
  const [form,    setForm]    = useState({
    native_width:    model.native_width    ?? '',
    native_height:   model.native_height   ?? '',
    max_width:       model.max_width       ?? '',
    max_height:      model.max_height      ?? '',
    max_megapixels:  model.max_megapixels  ?? '',
  })
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const save = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('models')
      .update({
        native_width:   form.native_width   ? parseInt(form.native_width)    : null,
        native_height:  form.native_height  ? parseInt(form.native_height)   : null,
        max_width:      form.max_width      ? parseInt(form.max_width)       : null,
        max_height:     form.max_height     ? parseInt(form.max_height)      : null,
        max_megapixels: form.max_megapixels ? parseFloat(form.max_megapixels): null,
      })
      .eq('id', model.id)
    setSaving(false)
    if (error) { toast.error('Failed to save resolution'); return }
    toast.success('Resolution settings saved')
    onSaved(form)
    setEditing(false)
  }

  return (
    <div>
      {editing ? (
        <div className="flex flex-col gap-2 mt-2">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['native_width',   'Native Width'],
              ['native_height',  'Native Height'],
              ['max_width',      'Max Width'],
              ['max_height',     'Max Height'],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
                  {label}
                </label>
                <input
                  type="number"
                  value={form[field]}
                  onChange={(e) => set(field, e.target.value)}
                  placeholder="px"
                  className="input-base w-full text-sm"
                />
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>
              Max Megapixels
            </label>
            <input
              type="number"
              step="0.1"
              value={form.max_megapixels}
              onChange={(e) => set('max_megapixels', e.target.value)}
              placeholder="e.g. 4.0"
              className="input-base w-full text-sm"
            />
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
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {model.native_width && model.native_height
              ? `${model.native_width}×${model.native_height} native`
              : 'No resolution set'}
            {model.max_megapixels ? ` · ${model.max_megapixels}MP max` : ''}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <Pencil size={10} /> Edit
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Booking Durations Manager ───────────────────────────────────────────
// Replaces GlobalBookingRateCard. Admin defines a list of bookable
// durations, each with its own flat per-model price (e.g. "30 minutes" →
// ₦3,000/model, "2 hours" → ₦9,000/model) — not derived from a multiplier.

const EMPTY_DURATION = { label: '', minutes: '', price_ngn: '' }

const DurationRow = ({ duration, onSaved, onRemoved }) => {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(EMPTY_DURATION)
  const [saving,  setSaving]  = useState(false)

  const open = () => {
    setDraft({
      label:     duration.label,
      minutes:   String(duration.minutes),
      price_ngn: String(duration.price_ngn),
    })
    setEditing(true)
  }

  const save = async () => {
    const minutes = parseInt(draft.minutes, 10)
    const price   = parseFloat(draft.price_ngn)
    if (!draft.label.trim()) { toast.error('Enter a label'); return }
    if (isNaN(minutes) || minutes <= 0) { toast.error('Minutes must be greater than zero'); return }
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price'); return }

    setSaving(true)
    const { data, error } = await renderWindowBookingDurations.update(duration.id, {
      label:     draft.label.trim(),
      minutes,
      price_ngn: price,
    })
    setSaving(false)
    if (error) { toast.error('Failed to save duration'); return }
    toast.success(`${data.label} updated`)
    onSaved(data)
    setEditing(false)
  }

  const toggleActive = async () => {
    setSaving(true)
    const { data, error } = await renderWindowBookingDurations.update(duration.id, {
      is_active: !duration.is_active,
    })
    setSaving(false)
    if (error) { toast.error('Failed to update status'); return }
    toast.success(`${duration.label} ${!duration.is_active ? 'enabled' : 'disabled'}`)
    onSaved(data)
  }

  const remove = async () => {
    if (!window.confirm(`Delete "${duration.label}"? This cannot be undone.`)) return
    setSaving(true)
    const { error } = await renderWindowBookingDurations.remove(duration.id)
    setSaving(false)
    if (error) { toast.error('Failed to delete — it may be referenced by an existing booking'); return }
    toast.success(`${duration.label} deleted`)
    onRemoved(duration.id)
  }

  if (editing) {
    return (
      <div
        className="rounded-xl p-3.5 flex flex-col gap-2"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Label</label>
            <input
              value={draft.label}
              onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
              placeholder="e.g. 30 minutes"
              className="input-base w-full text-sm"
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Minutes</label>
            <input
              type="number"
              min={1}
              value={draft.minutes}
              onChange={(e) => setDraft((d) => ({ ...d, minutes: e.target.value }))}
              className="input-base w-full text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Price per model (₦)</label>
          <input
            type="number"
            min={0}
            step="100"
            value={draft.price_ngn}
            onChange={(e) => setDraft((d) => ({ ...d, price_ngn: e.target.value }))}
            className="input-base w-full text-sm"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold flex-1 justify-center"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            {saving ? '…' : <><Check size={12} /> Save</>}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 rounded-xl text-xs font-bold"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-xl p-3.5 flex items-center justify-between gap-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {duration.label}
          </p>
          {!duration.is_active && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}
            >
              Disabled
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          ₦{Number(duration.price_ngn).toLocaleString()} per model · {duration.minutes} min
        </p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={toggleActive}
          disabled={saving}
          className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
          style={{
            background: duration.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.12)',
            color:      duration.is_active ? '#ef4444' : '#10b981',
          }}
        >
          {duration.is_active ? 'Disable' : 'Enable'}
        </button>
        <button
          onClick={open}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={remove}
          disabled={saving}
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

const BookingDurationsManager = ({ durations, onDurationsChange }) => {
  const [adding, setAdding] = useState(false)
  const [draft,  setDraft]  = useState(EMPTY_DURATION)
  const [saving, setSaving] = useState(false)

  const create = async () => {
    const minutes = parseInt(draft.minutes, 10)
    const price   = parseFloat(draft.price_ngn)
    if (!draft.label.trim()) { toast.error('Enter a label'); return }
    if (isNaN(minutes) || minutes <= 0) { toast.error('Minutes must be greater than zero'); return }
    if (isNaN(price) || price < 0) { toast.error('Enter a valid price'); return }

    setSaving(true)
    const { data, error } = await renderWindowBookingDurations.create({
      label:      draft.label.trim(),
      minutes,
      price_ngn:  price,
      sort_order: durations.length,
    })
    setSaving(false)
    if (error) { toast.error('Failed to create duration'); return }
    toast.success(`${data.label} added`)
    onDurationsChange((prev) => [...prev, data])
    setDraft(EMPTY_DURATION)
    setAdding(false)
  }

  const handleSaved = (updated) => {
    onDurationsChange((prev) => prev.map((d) => d.id === updated.id ? updated : d))
  }

  const handleRemoved = (id) => {
    onDurationsChange((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Wallet size={13} style={{ color: '#10b981' }} />
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#10b981' }}>
            Private Booking Durations
          </p>
        </div>
        <button
          onClick={() => { setDraft(EMPTY_DURATION); setAdding((a) => !a) }}
          className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg"
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
        >
          {adding ? <X size={11} /> : <Plus size={11} />}
          {adding ? 'Cancel' : 'Add duration'}
        </button>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Each duration has its own flat price per model — not multiplied automatically. Users pick one
        of these from a dropdown when booking; every active render-window model is bookable at
        whichever duration they choose.
      </p>

      {adding && (
        <div
          className="rounded-xl p-3.5 flex flex-col gap-2 mb-2"
          style={{ background: 'var(--bg-card)', border: '1px dashed var(--border-color)' }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Label</label>
              <input
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. 30 minutes"
                className="input-base w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Minutes</label>
              <input
                type="number"
                min={1}
                value={draft.minutes}
                onChange={(e) => setDraft((d) => ({ ...d, minutes: e.target.value }))}
                className="input-base w-full text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Price per model (₦)</label>
            <input
              type="number"
              min={0}
              step="100"
              value={draft.price_ngn}
              onChange={(e) => setDraft((d) => ({ ...d, price_ngn: e.target.value }))}
              className="input-base w-full text-sm"
            />
          </div>
          <button
            onClick={create}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
          >
            {saving ? 'Adding…' : <><Check size={12} /> Add Duration</>}
          </button>
        </div>
      )}

      {durations.length === 0 ? (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
          No durations yet — add one above to enable private bookings.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {durations
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((d) => (
              <DurationRow key={d.id} duration={d} onSaved={handleSaved} onRemoved={handleRemoved} />
            ))}
        </div>
      )}
    </div>
  )
}

// ─── Model Card ───────────────────────────────────────────────────────────────

const RWModelCard = ({ model, onToggleRW, onUpdate, onRemove }) => {
  const [expanded, setExpanded] = useState(false)
  const [toggling, setToggling] = useState(false)

const handleToggleRW = async () => {
    setToggling(true)
    const newAccessType = model.model_access_type === 'render_window' ? 'normal' : 'render_window'
    const { error } = await supabase
      .from('models')
      .update({ model_access_type: newAccessType })
      .eq('id', model.id)
    setToggling(false)
    if (error) { toast.error('Failed to update model'); return }
    onToggleRW(model.id, newAccessType)
    toast.success(newAccessType === 'render_window'
      ? `${model.label} added to render window`
      : `${model.label} removed from render window (now per-credit)`
    )
  }

  const isRW = model.model_access_type === 'render_window'
  const isBookable = isRW && model.is_active

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: isRW ? 'rgba(99,102,241,0.04)' : 'var(--bg-card)',
        border:     `1px solid ${isRW ? 'rgba(99,102,241,0.25)' : 'var(--border-color)'}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ background: isRW ? '#6366f1' : 'var(--border-color)' }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {model.label}
            </p>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-muted)'
              }}
            >
              {model.feature}
            </span>
            {isRW && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1' }}
              >
                Render Window
              </span>
            )}
            {isBookable && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
              >
                💳 Bookable
              </span>
            )}
            {model.comfyui_workflow_json && (
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.10)', color: '#10b981' }}
              >
                Workflow ✓
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {model.value} · {model.provider}
          </p>
        </div>

        <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </div>

      {/* Expanded */}
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
              className="px-4 pb-4 flex flex-col gap-4"
              style={{ borderTop: '1px solid var(--border-color)' }}
            >
             {/* Render Window status — set in Models Manager, not here */}
              <div className="pt-3">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  This model is currently render-window access. To move it back to credits, use the
                  ⚡ Credits / 🪟 Window toggle in <strong style={{ color: 'var(--text-primary)' }}>Models Manager</strong>.
                </p>
              </div>

              {/* Workflow JSON */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <div className="flex items-center gap-2">
                  <Workflow size={12} style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    ComfyUI Workflow
                  </p>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Export your workflow as API format from ComfyUI and paste it here.
                </p>
                <WorkflowEditor
                  model={model}
                  onSaved={(json) => onUpdate(model.id, { comfyui_workflow_json: json })}
                />
              </div>

            {/* Resolution */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  Resolution Capabilities
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Used by your UI to constrain generation options for this model.
                </p>
                <ResolutionEditor
                  model={model}
                  onSaved={(res) => onUpdate(model.id, res)}
                />
              </div>

              {/* Private booking — now informational only; pricing lives in
                  the Private Booking Durations manager, not per model. */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  Private Booking
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  {isBookable
                    ? 'Bookable now, at whichever duration the user picks — no per-model setup needed.'
                    : isRW
                      ? 'Will become bookable automatically once this model is Active.'
                      : 'Add this model to the render window to make it bookable.'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RenderWindowModelManager() {
  const [models,        setModels]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all')
  const [search,        setSearch]        = useState('')
  const [durations,      setDurations]      = useState([])
  const [durationsLoading, setDurationsLoading] = useState(true)

const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('model_access_type', 'render_window')
      .order('label')
    setModels(data || [])
    setLoading(false)
  }, [])

  const loadDurations = useCallback(async () => {
    setDurationsLoading(true)
    const { data } = await renderWindowBookingDurations.getAll()
    setDurations(data || [])
    setDurationsLoading(false)
  }, [])

  useEffect(() => { load(); loadDurations() }, [load, loadDurations])

 const handleToggleRW = (id, newAccessType) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, model_access_type: newAccessType } : m))
  }

  const handleUpdate = (id, updates) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }

  // Filter and search
const filtered = models.filter(m => {
    const matchesFilter =
      filter === 'all'          ? true :
      filter === 'with_workflow'? !!m.comfyui_workflow_json :
      filter === 'missing'      ? !m.comfyui_workflow_json :
      filter === 'bookable'     ? m.is_active :
      true

    const matchesSearch = search.trim() === '' ||
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.value.toLowerCase().includes(search.toLowerCase()) ||
      m.feature.toLowerCase().includes(search.toLowerCase())

    return matchesFilter && matchesSearch
  })

const workflowCount = models.filter(m => m.comfyui_workflow_json).length
  const missingCount  = models.filter(m => !m.comfyui_workflow_json).length
  const bookableCount = models.filter(m => m.is_active).length

  const filters = [
    { key: 'all',           label: 'All',            count: models.length },
    { key: 'with_workflow', label: 'Has Workflow',   count: workflowCount },
    { key: 'missing',       label: 'Missing Workflow',count: missingCount },
    { key: 'bookable',      label: 'Bookable',       count: bookableCount },
  ]

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Render Window Models
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Configure which models run during GPU sessions. Set workflows and resolution limits.
          </p>
        </div>
        <button
          onClick={() => { load(); loadDurations() }}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Booking durations — replaces the old single global rate */}
      {!durationsLoading && (
        <BookingDurationsManager durations={durations} onDurationsChange={setDurations} />
      )}

    {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'RW Models',        value: rwCount,       color: '#6366f1' },
          { label: 'With Workflow',    value: workflowCount, color: '#10b981' },
          { label: 'Missing Workflow', value: missingCount,  color: missingCount > 0 ? '#ef4444' : '#888' },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-xl px-3 py-2.5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-lg font-black" style={{ color: stat.color }}>{stat.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search models…"
        className="input-base w-full text-sm"
      />

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
            style={{
              background: filter === f.key ? 'var(--bg-elevated)' : 'var(--bg-card)',
              color:      filter === f.key ? 'var(--text-primary)' : 'var(--text-muted)',
              border:     `1px solid ${filter === f.key ? 'var(--border-color)' : 'var(--border-color)'}`,
            }}
          >
            {f.label} {f.count > 0 && `· ${f.count}`}
          </button>
        ))}
      </div>

      {/* Model list */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-2xl animate-pulse"
              style={{ background: 'var(--bg-card)', opacity: 0.5 - i * 0.1 }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Server size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {search ? 'No models match your search' : 'No models found'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {search ? 'Try a different search term.' : 'Add models to your database first.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {filtered.map(model => (
              <RWModelCard
                key={model.id}
                model={model}
                onToggleRW={handleToggleRW}
                onUpdate={handleUpdate}
                onRemove={(id) => setModels(prev => prev.filter(m => m.id !== id))}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
