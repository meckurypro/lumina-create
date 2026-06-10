// src/pages/admin/PromptIQAccessManager.jsx
//
// Shown inside UserDetailSheet when the selected user is staff or admin.
// Admin can toggle has_access and is_free per tool.

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, ShieldCheck, Lock, Unlock, BadgeDollarSign, Gift, Loader2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { promptiqAccess } from '@/lib/promptiq'
import toast from 'react-hot-toast'

// ── Tool type badge ───────────────────────────────────────

const TypeBadge = ({ type }) => (
  <span
    className="text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wide"
    style={{
      background: type === 'tool'     ? 'rgba(99,102,241,0.12)' : 'rgba(16,185,129,0.1)',
      color:      type === 'tool'     ? '#6366f1'               : '#10b981',
    }}
  >
    {type === 'tool' ? 'Tool' : 'Template'}
  </span>
)

// ── Single tool row ───────────────────────────────────────

const ToolAccessRow = ({ tool, grant, onToggleAccess, onToggleFree, saving }) => {
  const hasAccess = grant?.has_access ?? false
  const isFree    = grant?.is_free    ?? false

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: hasAccess ? 'var(--bg-elevated)' : 'var(--bg-primary)',
        border:     `1px solid ${hasAccess ? 'var(--border-color)' : 'var(--border-color)'}`,
        opacity:    saving ? 0.6 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Access indicator */}
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: hasAccess ? '#10b981' : 'var(--border-color)' }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {tool.display_name}
          </p>
          <TypeBadge type={tool.tool_type} />
        </div>
        {tool.description && (
          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
            {tool.description}
          </p>
        )}
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Free toggle — only meaningful if has_access */}
        <button
          onClick={() => hasAccess && onToggleFree(tool.identifier, hasAccess, !isFree)}
          disabled={!hasAccess || saving}
          title={isFree ? 'Free — click to make paid' : 'Paid — click to make free'}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-all"
          style={{
            background: !hasAccess         ? 'transparent'
                      : isFree             ? 'rgba(16,185,129,0.12)'
                      : 'rgba(249,115,22,0.1)',
            color:      !hasAccess         ? 'var(--border-color)'
                      : isFree             ? '#10b981'
                      : 'var(--brand)',
            cursor:     !hasAccess || saving ? 'default' : 'pointer',
          }}
        >
          {isFree && hasAccess
            ? <><Gift size={11} /> Free</>
            : <><BadgeDollarSign size={11} /> {hasAccess ? 'Paid' : '—'}</>
          }
        </button>

        {/* Access toggle */}
        <button
          onClick={() => !saving && onToggleAccess(tool.identifier, !hasAccess, hasAccess ? isFree : false)}
          disabled={saving}
          title={hasAccess ? 'Revoke access' : 'Grant access'}
          className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
          style={{
            background: hasAccess ? 'rgba(16,185,129,0.12)' : 'var(--bg-elevated)',
            color:      hasAccess ? '#10b981'               : 'var(--text-muted)',
          }}
        >
          {saving
            ? <Loader2 size={13} className="animate-spin" />
            : hasAccess
              ? <Unlock size={13} />
              : <Lock    size={13} />
          }
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────

export default function PromptIQAccessManager({ staffUser }) {
  const { user: admin } = useAuth()

  const [expanded,   setExpanded]   = useState(false)
  const [tools,      setTools]      = useState([])   // promptiq_tools rows with joined grant
  const [loading,    setLoading]    = useState(false)
  const [savingKey,  setSavingKey]  = useState(null) // identifier of row being saved

  // ── Load tools + grants for this staff user ──
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await promptiqAccess.getForStaff(staffUser.id)
    setLoading(false)
    if (error) { toast.error('Failed to load PromptIQ tools'); return }
    setTools(data || [])
  }, [staffUser.id])

  useEffect(() => {
    if (expanded) load()
  }, [expanded, load])

  // ── Toggle handler ──
  const handleToggle = async (identifier, hasAccess, isFree) => {
    setSavingKey(identifier)

    // Optimistic update
    setTools(prev => prev.map(t => {
      if (t.identifier !== identifier) return t
      const existing = t.promptiq_staff_access?.[0] || {}
      return {
        ...t,
        promptiq_staff_access: [{
          ...existing,
          has_access: hasAccess,
          is_free:    isFree,
        }],
      }
    }))

    const { data, error } = await promptiqAccess.adminSetAccess(
      admin.id, staffUser.id, identifier, hasAccess, isFree
    )

    setSavingKey(null)

    if (error || !data?.success) {
      toast.error(`Failed: ${data?.error || error?.message || 'Unknown error'}`)
      load() // revert optimistic
      return
    }
  }

  // ── Summary counts ──
  const accessCount = tools.filter(t => t.promptiq_staff_access?.[0]?.has_access).length
  const freeCount   = tools.filter(t => t.promptiq_staff_access?.[0]?.has_access && t.promptiq_staff_access?.[0]?.is_free).length

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: '1px solid var(--border-color)' }}
    >
      {/* Header — always visible, click to expand */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)' }}
          >
            <Zap size={13} style={{ color: 'var(--brand)' }} />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              PromptIQ Access
            </p>
            {!expanded && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {accessCount} tool{accessCount !== 1 ? 's' : ''} granted
                {freeCount > 0 && ` · ${freeCount} free`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); load() }}
              className="w-6 h-6 flex items-center justify-center rounded-lg"
              style={{ color: 'var(--text-muted)' }}
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
          )}
          {expanded
            ? <ChevronUp   size={15} style={{ color: 'var(--text-muted)' }} />
            : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />
          }
        </div>
      </button>

      {/* Tool list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{    height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex flex-col gap-2 p-3" style={{ background: 'var(--bg-primary)' }}>

              {loading ? (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading tools…</p>
                </div>
              ) : tools.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No tools registered yet
                </p>
              ) : (
                tools.map((tool) => (
                  <ToolAccessRow
                    key={tool.id}
                    tool={tool}
                    grant={tool.promptiq_staff_access?.[0] || null}
                    onToggleAccess={(id, ha, ifree) => handleToggle(id, ha, ifree)}
                    onToggleFree={(id, ha, ifree)   => handleToggle(id, ha, ifree)}
                    saving={savingKey === tool.identifier}
                  />
                ))
              )}

              {/* Legend */}
              {tools.length > 0 && !loading && (
                <div className="flex items-center gap-3 px-2 pt-1">
                  <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    🔓 = access granted · 🔒 = no access · Free = no credits charged
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
