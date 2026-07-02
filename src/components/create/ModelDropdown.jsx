// src/components/create/ModelDropdown.jsx
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

/**
 * Shared model picker used across every Create page.
 *
 * @param {Array}  models        list of model rows from `models` table
 * @param {string} value         selected model's `value`
 * @param {Function} onChange    (value) => void
 * @param {string} accent        e.g. 'var(--tool-image)'
 * @param {string} accentSub     e.g. 'var(--tool-image-subtle)'
 * @param {string} accentBdr     e.g. 'var(--tool-image-border)'
 * @param {number} width         dropdown width in px (default 224 / w-56)
 * @param {Function} [getBadges] optional (model) => string[] — small tags
 *                                shown under a model's label, e.g. ['Multi-ref']
 */
export function ModelDropdown({
  models, value, onChange,
  accent, accentSub, accentBdr,
  width = 224,
  getBadges,
}) {
  const [open, setOpen] = useState(false)
  const unlocked = models.filter((m) => !m.is_locked)
  const locked = models.filter((m) => m.is_locked)
  const selected = models.find((m) => m.value === value) || unlocked[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: accentSub, color: accent, border: `1px solid ${accentBdr}` }}
      >
        <span>{selected?.label || 'Model'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d={open ? 'M2 7l3-4 3 4' : 'M2 3l3 4 3-4'}
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute right-0 top-9 z-50 rounded-2xl overflow-hidden max-h-[60vh] overflow-y-auto"
              style={{
                width,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
              }}
            >
              <div className="py-1">
                {unlocked.map((m) => {
                  const badges = getBadges?.(m) ?? []
                  return (
                    <button
                      key={m.value}
                      onClick={() => { onChange(m.value); setOpen(false) }}
                      className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                      style={{ background: m.value === value ? accentSub : 'transparent' }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                        {m.description && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.description}</p>
                        )}
                        {!m.supports_image && m.type === 'image' && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>Text only</p>
                        )}
                        {badges.length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {badges.map((b) => (
                              <span key={b} className="px-1.5 py-0.5 rounded-md font-semibold"
                                style={{ background: accentSub, color: accent, fontSize: 10 }}>
                                {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {m.value === value && (
                        <span style={{ color: accent, fontSize: 14, flexShrink: 0, marginLeft: 8 }}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
              {locked.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 12px' }} />
                  <div className="py-1">
                    {locked.map((m) => (
                      <div key={m.value} className="flex items-center justify-between px-4 py-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{m.label}</p>
                        <span style={{ fontSize: 11, opacity: 0.4 }}>🔒</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
