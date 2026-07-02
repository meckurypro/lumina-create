// src/components/create/MentionPicker.jsx
import { motion } from 'framer-motion'
import { ArrowLeft, User, Building2 } from 'lucide-react'

/**
 * Inline dropdown shown above the prompt textarea while the user is
 * mid-way through typing an "@" (uploaded reference images) or "/"
 * (saved UGC characters/brands, with drill-down into logo/products)
 * mention. Presentation only — trigger detection and insertion live in
 * usePromptTagging.
 */
export function MentionPicker({
  mention,
  accent, accentSub, accentBdr,
  images = [],
  onSelectImage,
  characters = [], brands = [],
  brandProducts = [], brandProductsLoading = false,
  onSelectCharacter, onSelectBrand, onSelectLogo, onSelectProduct,
  onBack,
}) {
  if (!mention) return null
  const { trigger, query, view, activeBrand } = mention

  const filteredImages = trigger === '@'
    ? images.map((img, i) => ({ img, i })).filter(({ img, i }) => img && `img${i + 1}`.includes(query))
    : []

  const filteredCharacters = trigger === '/'
    ? characters.filter((c) => c.name.toLowerCase().includes(query))
    : []
  const filteredBrands = trigger === '/'
    ? brands.filter((b) => b.brand_name.toLowerCase().includes(query))
    : []
  const filteredProducts = trigger === '/' && view === 'brand'
    ? brandProducts.filter((p) => p.name.toLowerCase().includes(query))
    : []
  const logoMatches = trigger === '/' && view === 'brand' && activeBrand?.logo_url && 'logo'.includes(query)

  const isEmpty =
    (trigger === '@' && filteredImages.length === 0) ||
    (trigger === '/' && view === 'root' && filteredCharacters.length === 0 && filteredBrands.length === 0) ||
    (trigger === '/' && view === 'brand' && !brandProductsLoading && filteredProducts.length === 0 && !logoMatches)

  if (isEmpty) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.15 }}
      className="mb-2 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${accentBdr}`, background: 'var(--bg-card)', maxHeight: 280, overflowY: 'auto' }}
    >
      {trigger === '/' && view === 'brand' && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onBack}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-semibold"
          style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={12} /> {activeBrand?.brand_name}
        </button>
      )}

      {trigger === '@' && filteredImages.map(({ img, i }) => (
        <button
          key={i}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelectImage(i)}
          className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
        >
          <img src={img.url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
          <span className="text-sm font-mono font-semibold" style={{ color: accent }}>img{i + 1}</span>
        </button>
      ))}

      {trigger === '/' && view === 'root' && (
        <>
          {filteredCharacters.map((c) => (
            <button
              key={c.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectCharacter(c)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
            >
              {c.thumbnail_url || c.photo_face_front ? (
                <img src={c.thumbnail_url || c.photo_face_front} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accentSub }}>
                  <User size={14} style={{ color: accent }} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Character</p>
              </div>
            </button>
          ))}
          {filteredBrands.map((b) => (
            <button
              key={b.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectBrand(b)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
            >
              {b.logo_url ? (
                <img src={b.logo_url} alt={b.brand_name} className="w-8 h-8 rounded-full object-contain flex-shrink-0" style={{ background: 'var(--bg-elevated)', padding: 2 }} />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accentSub }}>
                  <Building2 size={14} style={{ color: accent }} />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.brand_name}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Brand — tap to choose logo or a product</p>
              </div>
            </button>
          ))}
        </>
      )}

      {trigger === '/' && view === 'brand' && (
        <>
          {logoMatches && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectLogo(activeBrand)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
            >
              <img src={activeBrand.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" style={{ background: 'var(--bg-elevated)', padding: 2 }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Logo</span>
            </button>
          )}
          {brandProductsLoading ? (
            <p className="text-xs text-center py-3" style={{ color: 'var(--text-muted)' }}>Loading products…</p>
          ) : filteredProducts.map((p) => (
            <button
              key={p.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelectProduct(activeBrand, p)}
              className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
            >
              <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
              <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
            </button>
          ))}
        </>
      )}
    </motion.div>
  )
}
