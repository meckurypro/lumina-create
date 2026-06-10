// src/pages/PromptIQPage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, Search, ChevronRight, Lock, Sparkles, Clapperboard, Film, X } from 'lucide-react'
import { templates as templatesDb } from '@/lib/supabase'
import { promptiqAccess } from '@/lib/promptiq'
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

// ── Tool entry card (generic, for Filma / Cinematic / future tools) ──
const ToolEntryCard = ({ icon: Icon, title, description, accentVar, borderVar, onClick }) => (
  <motion.button
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-all mb-3"
    style={{
      background: `linear-gradient(135deg, var(${accentVar}) 0%, var(--bg-elevated) 100%)`,
      border:     `1px solid var(${borderVar})`,
    }}
  >
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
      style={{ background: `var(${accentVar})`, border: `1px solid var(${borderVar})` }}
    >
      <Icon size={22} style={{ color: `var(${accentVar === '--tool-filma-subtle' ? '--tool-filma' : '--brand'})` }} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
        {title}
      </p>
      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
    </div>
    <ChevronRight size={16} style={{ color: `var(${accentVar === '--tool-filma-subtle' ? '--tool-filma' : '--brand'})`, flexShrink: 0 }} />
  </motion.button>
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
      <div className="h-3 w-full rounded-lg"  style={{ background: 'var(--bg-elevated)' }} />
    </div>
  </motion.div>
)

// ── Tool identifier constants (must match promptiq_tools.identifier seeds) ──
const TOOL_FILMA       = 'filma'
const TOOL_CINEMATIC   = 'cinematic_transition'

export default function PromptIQPage({ onClose }) {
  const navigate             = useNavigate()
  const { isStaff, isAdmin, credits, user } = useAuth()

  const [templates,      setTemplates]      = useState([])
  const [accessMap,      setAccessMap]      = useState({})  // { [identifier]: { has_access, is_free } }
  const [loading,        setLoading]        = useState(true)
  const [search,         setSearch]         = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const searchRef = useRef(null)

  const hasStaffAccess = isStaff || isAdmin

  // ── Load templates + access map in parallel ──
  useEffect(() => {
    if (!hasStaffAccess || !user) return
    const load = async () => {
      setLoading(true)
      const [{ data: tmplData }, { data: access }] = await Promise.all([
        templatesDb.getAll(),
        promptiqAccess.getMyAccess(user.id),
      ])
      setTemplates((tmplData || []).filter((t) => t.visibility === 'promptiq' && t.is_active))
      setAccessMap(access || {})
      setLoading(false)
    }
    load()
  }, [hasStaffAccess, user])

  const categories = ['All', ...new Set(templates.map((t) => t.category).filter(Boolean))]

  const filtered = templates.filter((t) => {
    // Only show templates this staff member has access to
    const grant = accessMap[t.slug]
    if (!grant?.has_access) return false

    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || '').toLowerCase().includes(search.toLowerCase())
    const matchesCat = activeCategory === 'All' || t.category === activeCategory
    return matchesSearch && matchesCat
  })

  const handleSelectTemplate = (template) => {
    const grant  = accessMap[template.slug]
    const isFree = grant?.is_free ?? false
    onClose?.()
    navigate(`/create/${template.slug}`, {
      state: { isPromptIQ: true, skipCreditCharge: isFree },
    })
  }

  const handleFilma = () => {
    const grant = accessMap[TOOL_FILMA]
    if (!grant?.has_access) return
    onClose?.()
    navigate('/filma', {
      state: { isPromptIQ: true, skipCreditCharge: grant.is_free },
    })
  }

  const handleCinematic = () => {
    const grant = accessMap[TOOL_CINEMATIC]
    if (!grant?.has_access) return
    onClose?.()
    navigate('/create/cinematic-transition', {
      state: { isPromptIQ: true, skipCreditCharge: grant.is_free },
    })
  }

  const filmaGrant     = accessMap[TOOL_FILMA]
  const cinematicGrant = accessMap[TOOL_CINEMATIC]

  // ── Locked view ────────────────────────────────────────
  if (!hasStaffAccess) {
    return (
      <div className="flex h-full w-full flex-col" style={{ background: 'var(--bg-primary)' }}>
        <div
          className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <button onClick={onClose} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }} aria-label="Close">
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient">
              <Zap size={14} className="text-white" />
            </div>
            <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>PromptIQ</span>
          </div>
          <div style={{ width: 36 }} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: 'var(--bg-elevated)' }}>
            <Lock size={28} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>Staff Access Only</p>
          <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
            PromptIQ is available to Meckury staff
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{
          background:           'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
          borderBottom:         '1px solid var(--border-color)',
          backdropFilter:       'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <button onClick={onClose} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }} aria-label="Close PromptIQ">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg brand-gradient">
            <Zap size={14} className="text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>PromptIQ</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Staff workspace</span>
          </div>
        </div>
        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
          {Math.floor(credits ?? 0)}
        </div>
      </div>

      {/* Search + categories */}
      <div className="flex-shrink-0 px-4 lg:px-8 pt-3 pb-1">
        <div
          className="flex items-center gap-2 rounded-2xl px-3 py-2.5 mb-3"
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
        {categories.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 lg:px-8 py-4">

          {/* ── Built-in tools — only shown if access granted ── */}
          {loading ? null : (
            <>
              {filmaGrant?.has_access && (
                <ToolEntryCard
                  icon={Clapperboard}
                  title="Filma"
                  description={`Africa's AI filmmaking machine — scripts, shots & generation${filmaGrant.is_free ? ' · Free' : ''}`}
                  accentVar="--tool-filma-subtle"
                  borderVar="--tool-filma-border"
                  onClick={handleFilma}
                />
              )}
              {cinematicGrant?.has_access && (
                <ToolEntryCard
                  icon={Film}
                  title="Cinematic Transition"
                  description={`Frame-to-frame cinematic transition videos${cinematicGrant.is_free ? ' · Free' : ''}`}
                  accentVar="--bg-elevated"
                  borderVar="--border-color"
                  onClick={handleCinematic}
                />
              )}
            </>
          )}

          {/* ── Templates ── */}
          {loading ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} i={i} />)}
            </div>
          ) : filtered.length === 0 && !filmaGrant?.has_access && !cinematicGrant?.has_access ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-elevated)' }}>
                <Lock size={24} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>No tools assigned yet</p>
              <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                Ask your admin to grant you access to PromptIQ tools
              </p>
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
                    onClick={() => handleSelectTemplate(template)}
                    showVisibilityBadge={false}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 text-center">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ⚡ Credit usage per tool is controlled by your admin
          </p>
        </div>
      </div>
    </div>
  )
}
