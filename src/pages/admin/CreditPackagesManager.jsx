// src/pages/admin/CreditPackagesManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, ChevronRight, Star, EyeOff, GripVertical, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── Helpers ─────────────────────────────────────────────

const emptyPackage = {
  name: '',
  slug: '',
  credits: 0,
  bonus_credits: 0,
  price_ngn: 0,
  price_usd: '',
  discount_percentage: 0,
  is_active: true,
  is_featured: false,
  sort_order: 0,
}

const slugify = (s) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

// ─── Package Editor Sheet ─────────────────────────────────

const PackageEditor = ({ pkg, onClose, onSaved, onDeleted }) => {
  const isNew = !pkg?.id
  const [form, setForm]       = useState(isNew ? emptyPackage : { ...pkg })
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const set = (key) => (e) => {
    const raw = e.target ? e.target.value : e
    setForm((f) => ({ ...f, [key]: raw }))
  }

  const setNum = (key) => (e) => {
    const raw = e.target.value
    setForm((f) => ({ ...f, [key]: raw === '' ? '' : Number(raw) }))
  }

  const handleNameChange = (e) => {
    const name = e.target.value
    setForm((f) => ({
      ...f,
      name,
      slug: isNew && (f.slug === '' || f.slug === slugify(f.name)) ? slugify(name) : f.slug,
    }))
  }

  const isValid =
    form.name.trim().length > 0 &&
    form.slug.trim().length > 0 &&
    Number(form.credits) > 0 &&
    Number(form.price_ngn) >= 0

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)

    const payload = {
      name:                form.name.trim(),
      slug:                form.slug.trim(),
      credits:             Number(form.credits) || 0,
      bonus_credits:       Number(form.bonus_credits) || 0,
      price_ngn:           Number(form.price_ngn) || 0,
      price_usd:           form.price_usd === '' ? null : Number(form.price_usd),
      discount_percentage: Number(form.discount_percentage) || 0,
      is_active:           !!form.is_active,
      is_featured:         !!form.is_featured,
      sort_order:          Number(form.sort_order) || 0,
    }

    const { data, error } = isNew
      ? await supabase.from('credit_packages').insert(payload).select().single()
      : await supabase.from('credit_packages').update(payload).eq('id', form.id).select().single()

    setSaving(false)

    if (error) { toast.error(`Failed to save: ${error.message}`); return }
    toast.success(isNew ? `Created "${data.name}"` : `Updated "${data.name}"`)
    onSaved(data)
    onClose()
  }

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const { error } = await supabase.from('credit_packages').delete().eq('id', form.id)
    setDeleting(false)
    if (error) { toast.error(`Failed to delete: ${error.message}`); return }
    toast.success(`Deleted "${form.name}"`)
    onDeleted(form.id)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        className="rounded-t-3xl p-6 flex flex-col gap-4 max-h-[88vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            {isNew ? 'New Package' : 'Edit Package'}
          </p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Name + slug */}
        <div className="flex flex-col gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Name</p>
            <input value={form.name} onChange={handleNameChange} placeholder="Starter Pack" className="input-base w-full text-sm" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Slug</p>
            <input value={form.slug} onChange={set('slug')} placeholder="starter-pack" className="input-base w-full text-sm font-mono" />
          </div>
        </div>

        {/* Credits + bonus */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Credits</p>
            <input type="number" value={form.credits} onChange={setNum('credits')} className="input-base w-full text-sm" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Bonus credits</p>
            <input type="number" value={form.bonus_credits} onChange={setNum('bonus_credits')} className="input-base w-full text-sm" />
          </div>
        </div>

        {/* Price NGN + USD */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Price (₦)</p>
            <input type="number" value={form.price_ngn} onChange={setNum('price_ngn')} className="input-base w-full text-sm" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Price ($, optional)</p>
            <input type="number" value={form.price_usd} onChange={setNum('price_usd')} placeholder="Auto" className="input-base w-full text-sm" />
          </div>
        </div>

        {/* Discount + sort order */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Discount %</p>
            <input type="number" value={form.discount_percentage} onChange={setNum('discount_percentage')} className="input-base w-full text-sm" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-muted)' }}>Sort order</p>
            <input type="number" value={form.sort_order} onChange={setNum('sort_order')} className="input-base w-full text-sm" />
          </div>
        </div>

        {/* Preview */}
        {Number(form.credits) > 0 && Number(form.price_ngn) >= 0 && (
          <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Effective rate</p>
            <p className="text-sm font-bold" style={{ color: '#10b981' }}>
              ₦{(Number(form.price_ngn) / (Number(form.credits) + Number(form.bonus_credits || 0))).toFixed(2)} / credit
              {' · '}{(Number(form.credits) + Number(form.bonus_credits || 0)).toLocaleString()} total credits
            </p>
          </div>
        )}

        {/* Toggles */}
        <div className="flex gap-2">
          <button
            onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: form.is_active ? 'rgba(16,185,129,0.1)' : 'var(--bg-elevated)',
              color:      form.is_active ? '#10b981' : 'var(--text-muted)',
            }}
          >
            {form.is_active ? <ChevronRight size={13} /> : <EyeOff size={13} />}
            {form.is_active ? 'Active' : 'Hidden'}
          </button>
          <button
            onClick={() => setForm((f) => ({ ...f, is_featured: !f.is_featured }))}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
            style={{
              background: form.is_featured ? 'rgba(245,158,11,0.1)' : 'var(--bg-elevated)',
              color:      form.is_featured ? '#f59e0b' : 'var(--text-muted)',
            }}
          >
            <Star size={13} fill={form.is_featured ? '#f59e0b' : 'none'} />
            {form.is_featured ? 'Featured' : 'Not featured'}
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="w-full py-3.5 rounded-2xl text-sm font-bold transition-all"
          style={{ background: !isValid ? 'var(--bg-elevated)' : 'var(--brand)', color: !isValid ? 'var(--text-muted)' : 'white', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : isNew ? 'Create package' : 'Save changes'}
        </button>

        {!isNew && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{ background: confirmDelete ? '#ef4444' : 'rgba(239,68,68,0.1)', color: confirmDelete ? 'white' : '#ef4444', opacity: deleting ? 0.7 : 1 }}
          >
            <Trash2 size={14} />
            {deleting ? 'Deleting…' : confirmDelete ? 'Tap again to confirm delete' : 'Delete package'}
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Package Row ──────────────────────────────────────────

const PackageRow = ({ pkg, onSelect }) => (
  <motion.div
    layout
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer active:scale-[0.98] transition-transform"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', opacity: pkg.is_active ? 1 : 0.55 }}
    onClick={() => onSelect(pkg)}
  >
    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
      <GripVertical size={14} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{pkg.name}</p>
        {pkg.is_featured && <Star size={12} fill="#f59e0b" style={{ color: '#f59e0b' }} />}
        {!pkg.is_active && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            Hidden
          </span>
        )}
      </div>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {pkg.credits.toLocaleString()}{pkg.bonus_credits > 0 ? ` + ${pkg.bonus_credits} bonus` : ''} credits · ₦{Number(pkg.price_ngn).toLocaleString()}
        {pkg.discount_percentage > 0 ? ` · ${pkg.discount_percentage}% off` : ''}
      </p>
    </div>
    <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
  </motion.div>
)

// ─── Skeleton ─────────────────────────────────────────────

const SkeletonRows = ({ count = 5 }) => (
  <div className="flex flex-col gap-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-[64px] rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', opacity: 0.5 }} />
    ))}
  </div>
)

// ─── Credit Packages Manager ──────────────────────────────

export default function CreditPackagesManager() {
  const [packages, setPackages] = useState([])
  const [loading, setLoading]   = useState(true)
  const [editingPkg, setEditingPkg] = useState(null)

  const loadPackages = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('credit_packages')
      .select('*')
      .order('sort_order', { ascending: true })
    setLoading(false)
    if (error) { toast.error('Failed to load packages'); return }
    setPackages(data || [])
  }, [])

  useEffect(() => { loadPackages() }, [loadPackages])

  const handleSaved = (saved) => {
    setPackages((prev) => {
      const exists = prev.some((p) => p.id === saved.id)
      const next = exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [...prev, saved]
      return next.sort((a, b) => a.sort_order - b.sort_order)
    })
  }

  const handleDeleted = (id) => {
    setPackages((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {packages.length} package{packages.length !== 1 ? 's' : ''}. Tap a package to edit price and credits.
        </p>
        <button
          onClick={() => setEditingPkg({ ...emptyPackage })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0"
          style={{ background: 'var(--brand)', color: 'white' }}
        >
          <Plus size={14} /> New
        </button>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : packages.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No packages yet</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Create your first credit package to get started.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {packages.map((pkg) => (
            <PackageRow key={pkg.id} pkg={pkg} onSelect={setEditingPkg} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {editingPkg && (
          <PackageEditor
            pkg={editingPkg}
            onClose={() => setEditingPkg(null)}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

