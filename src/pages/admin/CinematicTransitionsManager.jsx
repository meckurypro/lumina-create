// src/pages/admin/CinematicTransitionsManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence }          from 'framer-motion'
import {
  Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  CheckCircle, XCircle, Loader2, GripVertical, Sparkles,
} from 'lucide-react'
import { cinematicTransitions } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ── Helpers ───────────────────────────────────────────────

const EMPTY_FORM = { name: '', prompt_text: '', is_active: true, sort_order: 0 }

// ── Transition Form Modal ─────────────────────────────────

const TransitionModal = ({ initial, onSave, onClose, saving }) => {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(
    initial
      ? { name: initial.name, prompt_text: initial.prompt_text, is_active: initial.is_active, sort_order: initial.sort_order }
      : EMPTY_FORM
  )

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }))
  const valid = form.name.trim().length > 0 && form.prompt_text.trim().length > 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{    opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{    y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
        style={{
          background: 'var(--bg-card)',
          maxWidth:   520,
          border:     '1px solid var(--border-color)',
          maxHeight:  '90dvh',
          overflowY:  'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center -mt-1 mb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>

        {/* Title */}
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)' }}
          >
            <Sparkles size={15} style={{ color: 'var(--brand)' }} />
          </div>
          <p className="text-base font-black" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Transition' : 'New Transition'}
          </p>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Name
          </label>
          <input
            autoFocus
            value={form.name}
            onChange={e => set('name', e.target.value)}
            placeholder="e.g. Cinematic Zoom Morph"
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none"
            style={{
              background: 'var(--bg-elevated)',
              color:      'var(--text-primary)',
              border:     '1px solid var(--border-color)',
            }}
          />
        </div>

        {/* Prompt text */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Prompt
          </label>
          <textarea
            value={form.prompt_text}
            onChange={e => set('prompt_text', e.target.value)}
            placeholder="Describe the transition style sent to the model…"
            rows={6}
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none resize-none leading-relaxed"
            style={{
              background: 'var(--bg-elevated)',
              color:      'var(--text-primary)',
              border:     '1px solid var(--border-color)',
            }}
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {form.prompt_text.trim().length} chars
          </p>
        </div>

        {/* Sort order */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Sort order
          </label>
          <input
            type="number"
            min={0}
            value={form.sort_order}
            onChange={e => set('sort_order', parseInt(e.target.value) || 0)}
            className="w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none"
            style={{
              background: 'var(--bg-elevated)',
              color:      'var(--text-primary)',
              border:     '1px solid var(--border-color)',
            }}
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Lower number = shown first in the picker
          </p>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Active</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Inactive transitions are hidden from users
            </p>
          </div>
          <button
            onClick={() => set('is_active', !form.is_active)}
            className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
            style={{ background: form.is_active ? 'var(--brand)' : 'var(--bg-card)' }}
          >
            <motion.div
              animate={{ x: form.is_active ? 22 : 2 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="absolute top-1 w-4 h-4 rounded-full"
              style={{ background: '#fff' }}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!valid || saving}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white brand-gradient flex items-center justify-center gap-2"
            style={{ opacity: !valid || saving ? 0.5 : 1 }}
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
              : isEdit ? 'Save changes' : 'Create transition'
            }
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Delete Confirm Modal ──────────────────────────────────

const DeleteModal = ({ transition, onConfirm, onClose, deleting }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{    opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end justify-center"
    style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0,  opacity: 1 }}
      exit={{    y: 60, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 340 }}
      className="w-full rounded-t-3xl p-6 pb-10 flex flex-col gap-4"
      style={{ background: 'var(--bg-card)', maxWidth: 520, border: '1px solid var(--border-color)' }}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex justify-center -mt-1 mb-1">
        <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <Trash2 size={18} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <p className="text-base font-black" style={{ color: 'var(--text-primary)' }}>Delete transition?</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>This cannot be undone</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)' }}>
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{transition.name}</p>
        <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{transition.prompt_text}</p>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Existing projects that used this transition will retain their clip references, but the transition name and prompt will no longer be available for new clips.
      </p>

      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 py-3.5 rounded-2xl text-sm font-bold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={deleting}
          className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2"
          style={{ background: '#ef4444', opacity: deleting ? 0.5 : 1 }}
        >
          {deleting ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : 'Delete'}
        </button>
      </div>
    </motion.div>
  </motion.div>
)

// ── Transition Row ────────────────────────────────────────

const TransitionRow = ({ transition, index, total, onEdit, onDelete, onMoveUp, onMoveDown }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{    opacity: 0, y: 8 }}
    transition={{ delay: index * 0.03 }}
    className="flex items-start gap-3 p-4 rounded-2xl"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    {/* Sort handle / order controls */}
    <div className="flex flex-col items-center gap-0.5 pt-0.5 flex-shrink-0">
      <button
        onClick={onMoveUp}
        disabled={index === 0}
        className="w-6 h-6 flex items-center justify-center rounded-lg transition-opacity"
        style={{ color: 'var(--text-muted)', opacity: index === 0 ? 0.2 : 1 }}
      >
        <ChevronUp size={13} />
      </button>
      <GripVertical size={14} style={{ color: 'var(--border-color)' }} />
      <button
        onClick={onMoveDown}
        disabled={index === total - 1}
        className="w-6 h-6 flex items-center justify-center rounded-lg transition-opacity"
        style={{ color: 'var(--text-muted)', opacity: index === total - 1 ? 0.2 : 1 }}
      >
        <ChevronDown size={13} />
      </button>
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {transition.name}
        </p>
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
          style={{
            background: transition.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.08)',
            color:      transition.is_active ? '#10b981'               : '#ef4444',
          }}
        >
          {transition.is_active
            ? <><CheckCircle size={10} /> Active</>
            : <><XCircle     size={10} /> Inactive</>
          }
        </span>
      </div>
      <p
        className="text-xs leading-relaxed line-clamp-2"
        style={{ color: 'var(--text-muted)' }}
      >
        {transition.prompt_text}
      </p>
      <p className="text-xs mt-1.5 font-semibold tabular-nums" style={{ color: 'var(--text-muted)' }}>
        Sort: {transition.sort_order}
      </p>
    </div>

    {/* Action buttons */}
    <div className="flex flex-col gap-1.5 flex-shrink-0">
      <button
        onClick={onEdit}
        className="w-8 h-8 flex items-center justify-center rounded-xl"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
      >
        <Pencil size={13} />
      </button>
      <button
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center rounded-xl"
        style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  </motion.div>
)

// ── Main Component ────────────────────────────────────────

export default function CinematicTransitionsManager() {
  const [transitions,  setTransitions]  = useState([])
  const [loading,      setLoading]      = useState(true)
  const [editTarget,   setEditTarget]   = useState(null)   // transition obj | 'new'
  const [deleteTarget, setDeleteTarget] = useState(null)   // transition obj
  const [saving,       setSaving]       = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  // ── Load ───────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await cinematicTransitions.getAll()
    if (error) toast.error('Failed to load transitions')
    setTransitions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Create / update ────────────────────────────────────
  const handleSave = async (form) => {
    setSaving(true)
    try {
      if (editTarget?.id) {
        // Update
        const { error } = await cinematicTransitions.update(editTarget.id, {
          name:        form.name.trim(),
          prompt_text: form.prompt_text.trim(),
          is_active:   form.is_active,
          sort_order:  form.sort_order,
        })
        if (error) throw new Error(error.message)
        toast.success('Transition updated')
      } else {
        // Create
        const { error } = await cinematicTransitions.create({
          name:        form.name.trim(),
          prompt_text: form.prompt_text.trim(),
          is_active:   form.is_active,
          sort_order:  form.sort_order,
        })
        if (error) throw new Error(error.message)
        toast.success('Transition created')
      }
      setEditTarget(null)
      await load()
    } catch (err) {
      toast.error(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await cinematicTransitions.delete(deleteTarget.id)
      if (error) throw new Error(error.message)
      toast.success('Transition deleted')
      setDeleteTarget(null)
      await load()
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  // ── Reorder (swap sort_order of adjacent rows) ─────────
  const handleMove = async (index, direction) => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= transitions.length) return

    const a = transitions[index]
    const b = transitions[swapIndex]

    // Optimistic UI update
    const next = [...transitions]
    next[index]     = { ...a, sort_order: b.sort_order }
    next[swapIndex] = { ...b, sort_order: a.sort_order }
    next.sort((x, y) => x.sort_order - y.sort_order)
    setTransitions(next)

    // Persist both
    try {
      await Promise.all([
        cinematicTransitions.update(a.id, { sort_order: b.sort_order }),
        cinematicTransitions.update(b.id, { sort_order: a.sort_order }),
      ])
    } catch {
      toast.error('Reorder failed — reloading')
      await load()
    }
  }

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            Cinematic Transitions
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {transitions.filter(t => t.is_active).length} active · {transitions.length} total
          </p>
        </div>
        <button
          onClick={() => setEditTarget('new')}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold text-white brand-gradient"
        >
          <Plus size={14} />
          New
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--bg-card)' }} />
          ))}
        </div>
      ) : transitions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <Sparkles size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No transitions yet</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Tap New to create the first one</p>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="flex flex-col gap-3">
            {transitions.map((t, i) => (
              <TransitionRow
                key={t.id}
                transition={t}
                index={i}
                total={transitions.length}
                onEdit={() => setEditTarget(t)}
                onDelete={() => setDeleteTarget(t)}
                onMoveUp={() => handleMove(i, 'up')}
                onMoveDown={() => handleMove(i, 'down')}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Modals */}
      <AnimatePresence>
        {editTarget && (
          <TransitionModal
            initial={editTarget === 'new' ? null : editTarget}
            onSave={handleSave}
            onClose={() => setEditTarget(null)}
            saving={saving}
          />
        )}
        {deleteTarget && (
          <DeleteModal
            transition={deleteTarget}
            onConfirm={handleDelete}
            onClose={() => setDeleteTarget(null)}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
