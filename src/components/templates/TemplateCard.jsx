import { motion } from 'framer-motion'
import { ArrowRight, Star, Lock, Zap, Sparkles } from 'lucide-react'

export const TemplateCard = ({ template, onClick, variant = 'default', index = 0, showVisibilityBadge = false }) => {
  const isPromptIQ  = template.visibility === 'promptiq'
  const creditLabel = template.credit_cost_per_image
    ? `${template.credit_cost_per_image} cr/photo`
    : `${template.credit_cost ?? 2} credits`

  // ── Compact variant (unchanged) ──────────────────────────
  if (variant === 'compact') return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl p-4 text-left"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div
        className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
        style={{ background: template.thumbnail_url ? undefined : 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,88,12,0.1))' }}
      >
        {template.thumbnail_url
          ? <img src={template.thumbnail_url} alt={template.name} className="h-full w-full object-cover" />
          : <Zap size={24} style={{ color: 'var(--brand)' }} />
        }
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <h3 className="truncate text-sm font-bold" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{template.name}</h3>
          {showVisibilityBadge && (
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold"
              style={{
                background: isPromptIQ ? 'rgba(249,115,22,0.12)' : 'rgba(16,185,129,0.12)',
                color:      isPromptIQ ? 'var(--brand)' : '#10b981',
              }}
            >
              {isPromptIQ ? 'PromptIQ' : 'Public'}
            </span>
          )}
        </div>
        <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>{template.description}</p>
        <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
          {isPromptIQ ? '⚡ Free for staff' : `⚡ ${creditLabel}`}
        </p>
      </div>
      <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
    </motion.button>
  )

  // ── Default variant — square grid card ──────────────────
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full rounded-2xl overflow-hidden text-left flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Square media area */}
      <div
        className="w-full relative flex items-center justify-center overflow-hidden"
        style={{
          aspectRatio: '1 / 1',
          background: template.thumbnail_url || template.demo_video_url
            ? undefined
            : 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(234,88,12,0.06))',
        }}
      >
        {template.demo_video_url ? (
          <video
            src={template.demo_video_url}
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
            poster={template.thumbnail_url || undefined}
          />
        ) : template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <Sparkles size={28} style={{ color: 'var(--brand)', opacity: 0.35 }} />
        )}

        {template.is_featured && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold text-white brand-gradient z-10">
            <Star size={10} fill="currentColor" /> Featured
          </span>
        )}
      </div>

      {/* Label row */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="min-w-0 flex-1 mr-2">
          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {template.name}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {template.description}
          </p>
        </div>
        <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>
    </motion.button>
  )
}
