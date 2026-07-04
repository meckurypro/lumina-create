// src/pages/admin/RenderWindowModelManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Check, Pencil, Trash2, RefreshCw,
  Server, Workflow, ChevronDown, ChevronUp,
  AlertTriangle, Copy, Eye, EyeOff
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

// ─── Endpoint Manager ─────────────────────────────────────────────────────────

const EndpointManager = ({ endpoint, onSaved }) => {
  const { user } = useAuth()
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [visible, setVisible] = useState(false)

  const open  = () => { setDraft(endpoint ?? ''); setEditing(true) }
  const close = () => setEditing(false)

  const save = async () => {
    if (!draft.trim()) {
      toast.error('Endpoint URL cannot be empty')
      return
    }
    if (!draft.startsWith('http')) {
      toast.error('Endpoint must be a valid URL')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('app_settings')
      .update({
        value:      draft.trim(),
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('key', 'comfyui_endpoint')
    setSaving(false)
    if (error) { toast.error('Failed to save endpoint'); return }
    toast.success('ComfyUI endpoint updated')
    onSaved(draft.trim())
    setEditing(false)
  }

  const copy = () => {
    if (!endpoint) return
    navigator.clipboard.writeText(endpoint)
    toast.success('Copied to clipboard')
  }

  const masked = endpoint
    ? endpoint.slice(0, 28) + '••••••••' + endpoint.slice(-6)
    : null

  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Server size={13} style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
          ComfyUI Endpoint
        </p>
        {endpoint && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
          >
            Active
          </span>
        )}
        {!endpoint && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full ml-auto"
            style={{ background: 'rgba(239,68,68,0.10)', color: '#ef4444' }}
          >
            Not Set
          </span>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <input
            autoFocus
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') close() }}
            placeholder="https://abc123-8188.proxy.runpod.net"
            className="input-base w-full text-sm font-mono"
          />
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold flex-1 justify-center"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}
            >
              {saving ? '…' : <><Check size={12} /> Save Endpoint</>}
            </button>
            <button
              onClick={close}
              className="px-4 py-2.5 rounded-xl text-xs font-bold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {endpoint ? (
            <div
              className="rounded-xl px-3 py-2.5 font-mono text-xs flex items-center gap-2"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              <span className="flex-1 truncate">
                {visible ? endpoint : masked}
              </span>
              <button onClick={() => setVisible(v => !v)} style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                {visible ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
              <button onClick={copy} style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                <Copy size={12} />
              </button>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No endpoint set. Start your RunPod instance and paste the URL here.
            </p>
          )}
          <button
            onClick={open}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold self-start"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <Pencil size={11} /> {endpoint ? 'Update Endpoint' : 'Set Endpoint'}
          </button>
        </div>
      )}

      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        Update this each time you start a new RunPod session. All render window models share this endpoint.
      </p>
    </div>
  )
}

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
              {/* Render Window Toggle */}
              <div className="pt-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                    Render Window Model
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Make this model available during render window sessions
                  </p>
                </div>
                <button
                  onClick={handleToggleRW}
                  disabled={toggling}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: isRW ? 'rgba(239,68,68,0.10)' : 'rgba(99,102,241,0.12)',
                    color:      isRW ? '#ef4444'               : '#6366f1',
                  }}
                >
                  {toggling ? '…' : isRW ? 'Remove' : 'Add'}
                </button>
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
  const [endpoint,      setEndpoint]      = useState('')
  const [loading,       setLoading]       = useState(true)
  const [filter,        setFilter]        = useState('all')
  const [search,        setSearch]        = useState('')

const load = useCallback(async () => {
    setLoading(true)
    const [modelsRes, endpointRes] = await Promise.all([
      supabase
        .from('models')
        .select('*')
        .order('label'),
      supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'comfyui_endpoint')
        .single()
    ])
    setModels(modelsRes.data  || [])
    setEndpoint(endpointRes.data?.value || '')
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

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
      filter === 'render_window'? m.model_access_type === 'render_window' :
      filter === 'with_workflow'? !!m.comfyui_workflow_json :
      filter === 'missing'      ? (m.model_access_type === 'render_window' && !m.comfyui_workflow_json) :
      true

    const matchesSearch = search.trim() === '' ||
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.value.toLowerCase().includes(search.toLowerCase()) ||
      m.feature.toLowerCase().includes(search.toLowerCase())

    return matchesFilter && matchesSearch
  })

  const rwCount      = models.filter(m => m.model_access_type === 'render_window').length
  const workflowCount= models.filter(m => m.comfyui_workflow_json).length
  const missingCount = models.filter(m => m.model_access_type === 'render_window' && !m.comfyui_workflow_json).length

  const filters = [
    { key: 'all',           label: 'All',            count: models.length },
    { key: 'render_window', label: 'Render Window',  count: rwCount },
    { key: 'with_workflow', label: 'Has Workflow',   count: workflowCount },
    { key: 'missing',       label: 'Missing Workflow',count: missingCount },
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
          onClick={load}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Endpoint Manager */}
      <EndpointManager endpoint={endpoint} onSaved={setEndpoint} />

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
