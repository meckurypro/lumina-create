// src/pages/PromptIQPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap, Search, ChevronRight, Lock, Sparkles } from 'lucide-react'
import { templates as templatesDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TemplateCard } from '@/components/templates/TemplateCard'

// ── Category pill ─────────────────────────────────────────
const CategoryPill = ({ label, active, onClick }) => (
  <button
    onClick={onClick}
    className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition-all duration-200"
    style={{
      background: active ? 'var(--brand)' : 'var(--bg-elevated)',
      color:      active ? '#fff'          : 'var(--text-muted)',
      border:     active ? 'none'          : '1px solid var(--border-color)',
    }}
  >
    {label}
  </button>
)

// ── Empty state ────────────────────────────────────────────
const EmptyState = ({ query }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div
      className="flex h-14 w-14 items-center justify-center rounded-2xl"
      style={{ background: 'var(--bg-elevated)' }}
    >
      <Sparkles size={24} style={{ color: 'var(--text-muted)' }} />
    </div>
    <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
      {query ? `No templates matching "${query}"` : 'No PromptIQ templates yet'}
    </p>
    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
      Add templates via the Admin panel
    </p>
  </div>
)

// ── Skeleton loader ────────────────────────────────────────
const SkeletonCard = ({ i }) => (
  <motion.div
    key={i}
    initial={{ opacity: 0 }}
    animate={{ opacity: [0.4, 0.7, 0.4] }}
    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }}
    className="w-full rounded-3xl overflow-hidden"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }} />
    <div className="p-4 flex flex-col gap-2">
      <div className="h-4 w-3/4 rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-3 w-full rounded-lg" style={{ background: 'var(--bg-elevated)' }} />
    </div>
  </motion.div>
)

export default function PromptIQPage({ onClose }) {
  const navigate              = useNavigate()
  const { isStaff, isAdmin }  = useAuth()
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const searchRef = useRef(null)

  // ── Guard: non-staff sees a locked screen ──────────────
  const hasAccess = isStaff || isAdmin

  // ── Fetch only promptiq-visibility templates ───────────
  useEffect(() => {
    if (!hasAccess) return
    const load = async () => {
      setLoading(true)
      // getAll() returns all templates (admin/staff route)
      const { data } = await templatesDb.getAll()
      const piq = (data || []).filter((t) => t.visibility === 'promptiq' && t.is_active)
      setTemplates(piq)
      setLoading(false)
    }
    load()
  }, [hasAccess])

  // ── Derive unique categories from loaded templates ─────
  const categories = ['All', ...new Set(templates.map((t) => t.category).filter(Boolean))]

  // ── Filter by search + category ───────────────────────
  const filtered = templates.filter((t) => {
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
    const matchesCat = activeCategory === 'All' || t.category === activeCategory
    return matchesSearch && matchesCat
  })

  // ── Navigate to template runner, passing promptiq flag ─
  const handleSelect = (template) => {
    onClose?.()
    navigate(`/create/${template.slug}`, {
      state: { isPromptIQ: true, skipCreditCharge: true },
    })
  }

  // ── Locked view for non-staff ──────────────────────────
  if (!hasAccess) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div
          className="flex h-16 w-16 items-center justify-center rounded-3xl"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <Lock size={28} style={{ color: 'var(--text-muted)' }} />
        </div>
        <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
          Staff Access Only
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          PromptIQ is available to Meckury staff
        </p>
        <button
          onClick={onClose}
          className="mt-2 rounded-2xl px-5 py-2.5 text-sm font-bold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          Close
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex h-full w-full flex-col"
      style={{ background: 'var(--bg-primary)', overflowY: 'auto' }}
    >
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 flex-shrink-0"
        style={{
          background:         'color-mix(in srgb, var(--bg-primary) 90%, transparent)',
          backdropFilter:     'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom:       '1px solid var(--border-color)',
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient"
            >
              <Zap size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black leading-none" style={{ color: 'var(--text-primary)' }}>
                PromptIQ
              </h2>
              <p className="text-xs leading-none mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Staff templates · Free
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: 'var(--bg-elevated)' }}
            aria-label="Close"
          >
            <X size={16} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-2 rounded-2xl px-3 py-2.5"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            {search && (
              <button onClick={() => setSearch('')}>
                <X size={12} style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>
        </div>

        {/* Category pills */}
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 no-scrollbar">
            {categories.map((cat) => (
              <CategoryPill
                key={cat}
                label={cat}
                active={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Template grid ── */}
      <div className="flex-1 px-4 py-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} i={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState query={search} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map((template, i) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  index={i}
                  onClick={() => handleSelect(template)}
                  showVisibilityBadge={false}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Footer note ── */}
      <div className="flex-shrink-0 px-4 py-4 text-center">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          ⚡ PromptIQ templates do not consume credits
        </p>
      </div>
    </div>
  )
}
