import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Loader2, Pencil, Trash2, Package } from 'lucide-react'
import { ugcBrandProducts } from '@/lib/ugcBrands'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

// ── Add / Edit sheet ─────────────────────────────────────────
function ProductSheet({ brandId, userId, product, onClose, onSaved, onDeleted }) {
  const isEdit = !!product
  const [name, setName] = useState(product?.name || '')
  const [category, setCategory] = useState(product?.category || '')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(product?.image_url || null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleFile = (f) => {
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleSave = async () => {
    if (!name.trim()) return toast.error('Give this product or service a name')
    setSaving(true)
    try {
      const productId = product?.id || crypto.randomUUID()
      let imageUrl = product?.image_url || null

      if (file) {
        imageUrl = await ugcBrandProducts.uploadPhoto(userId, brandId, productId, file)
      }

      if (isEdit) {
        const { data, error } = await ugcBrandProducts.update(product.id, {
          name: name.trim(),
          category: category.trim() || null,
          image_url: imageUrl,
        })
        if (error) throw error
        onSaved(data)
      } else {
        const { data, error } = await ugcBrandProducts.create({
          id: productId,
          brand_id: brandId,
          user_id: userId,
          name: name.trim(),
          category: category.trim() || null,
          image_url: imageUrl,
        })
        if (error) throw error
        onSaved(data)
      }
      onClose()
    } catch (err) {
      toast.error(err.message || 'Could not save this product')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!product) return
    setDeleting(true)
    try {
      await ugcBrandProducts.remove(product.id)
      if (product.image_url) {
        await ugcBrandProducts.deletePhoto(userId, brandId, product.id)
      }
      onDeleted(product.id)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Could not delete this product')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full rounded-t-3xl px-4 pt-4 pb-8"
        style={{ background: 'var(--bg-card)', maxHeight: '85dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--border-color)' }} />
        <p className="text-lg font-black mb-4" style={{ color: 'var(--text-primary)' }}>
          {isEdit ? 'Edit Product / Service' : 'Add Product / Service'}
        </p>

        <div className="flex justify-center mb-2">
          {preview ? (
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl overflow-hidden" style={{ border: `2px solid ${ACCENT_BDR}` }}>
                <img src={preview} alt={name} className="w-full h-full object-cover" />
              </div>
              <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                style={{ background: ACCENT, color: '#fff' }}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
                <Pencil size={13} />
              </label>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-28 h-28 rounded-2xl cursor-pointer"
              style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <Plus size={20} style={{ color: ACCENT }} />
              <span className="text-xs font-medium mt-1" style={{ color: ACCENT }}>Add Photo</span>
            </label>
          )}
        </div>
        <p className="text-xs text-center mb-5" style={{ color: 'var(--text-muted)' }}>
          Photo optional — you can add it later
        </p>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Moisturising Face Cream"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-3"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (optional) — e.g. Skincare"
          className="w-full px-4 py-3 rounded-xl text-sm outline-none mb-5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
        />

        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold mb-2"
          style={{ background: ACCENT, color: '#fff', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : isEdit ? 'Save Changes' : 'Add Product'}
        </button>

        {isEdit && (
          <button
            onClick={handleDelete}
            disabled={saving || deleting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold"
            style={{ color: '#ef4444' }}
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── Main grid ────────────────────────────────────────────────
export default function BrandProductManager({ brandId, userId, products, onProductsChange, maxProducts = 15 }) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const atLimit = products.length >= maxProducts

  const openAdd  = () => { if (atLimit) return; setEditing(null); setSheetOpen(true) }
  const openEdit = (p) => { setEditing(p); setSheetOpen(true) }

  const handleSaved = (product) => {
    const exists = products.some((p) => p.id === product.id)
    onProductsChange(exists ? products.map((p) => (p.id === product.id ? product : p)) : [...products, product])
  }
  const handleDeleted = (id) => onProductsChange(products.filter((p) => p.id !== id))

  return (
    <div>
      <div
        className="flex items-start gap-3 p-3 rounded-xl mb-4"
        style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
      >
        <Package size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Add your products or services here. Type <strong>/</strong> in the Content Direction
          box on Image or Video to pull any of these into a generation.
        </p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
          {products.length} / {maxProducts}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {products.map((p) => (
          <button key={p.id} onClick={() => openEdit(p)} className="flex flex-col gap-1.5 text-left">
            <div
              className="relative aspect-square rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ border: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}
            >
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <Package size={20} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
              )}
            </div>
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</p>
          </button>
        ))}

        {!atLimit && (
          <button onClick={openAdd} className="flex flex-col gap-1.5 text-left">
            <div
              className="aspect-square rounded-2xl flex flex-col items-center justify-center"
              style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
            >
              <Plus size={18} style={{ color: ACCENT }} />
              <span className="text-xs font-medium mt-1" style={{ color: ACCENT }}>Add</span>
            </div>
          </button>
        )}
      </div>

      {atLimit && (
        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          You've reached the {maxProducts}-item limit. Delete one to add another.
        </p>
      )}

      <AnimatePresence>
        {sheetOpen && (
          <ProductSheet
            brandId={brandId}
            userId={userId}
            product={editing}
            onClose={() => setSheetOpen(false)}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
