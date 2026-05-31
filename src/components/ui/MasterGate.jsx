import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Star } from 'lucide-react'

const WHATSAPP_URL =
  'https://wa.me/2348162465247?text=Hi%2C%20I%20want%20to%20upgrade%20to%20Master%20on%20Meckury%20AI'

/**
 * MasterGate
 *
 * Wraps any page. If the user is not Master, renders a full-screen
 * lock state in place of the page content.
 *
 * Props:
 *   isMaster   — boolean derived from profile.user_tier === 'master'
 *   title      — feature name shown in the lock state  (e.g. "UGC Characters")
 *   description — one-line explanation of what the feature does
 *   accentVar  — CSS var name for the feature accent colour (e.g. '--tool-ugc')
 *   onBack     — optional override for the back button; defaults to navigate(-1)
 *   children   — rendered normally when isMaster is true
 */
export default function MasterGate({
  isMaster,
  title       = 'This feature',
  description = 'Unlock full access by upgrading to Master.',
  accentVar   = '--brand',
  onBack,
  children,
}) {
  const navigate = useNavigate()
  const accent   = `var(${accentVar})`
  const accentSub = `var(${accentVar}-subtle, rgba(249,115,22,0.08))`
  const accentBdr = `var(${accentVar}-border, rgba(249,115,22,0.2))`

  if (isMaster) return children

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Minimal header */}
      <div
        className="flex-shrink-0 flex items-center px-4 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${accent}` }}
      >
        <button
          onClick={onBack ?? (() => navigate(-1))}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
      </div>

      {/* Lock state */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6"
      >
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center"
          style={{ background: accentSub, border: `1px solid ${accentBdr}` }}
        >
          <Star size={36} style={{ color: '#f59e0b' }} fill="#f59e0b" />
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-2">
          <p className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {title} is Master-only
          </p>
          <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        </div>

        {/* What you get card */}
        <div
          className="w-full max-w-xs rounded-2xl px-5 py-4 text-left flex flex-col gap-2"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}
        >
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
            ⭐ Master includes
          </p>
          {[
            'UGC Characters & Voices',
            'Unlimited Copy Motion',
            'Templates library',
            'Feed publishing',
            'All future Master features',
          ].map((item) => (
            <p key={item} className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ✓ {item}
            </p>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: '#f59e0b', color: 'white' }}
          >
            <Star size={15} fill="white" />
            Upgrade to Master · ₦5,000/mo
          </a>
          <button
            onClick={onBack ?? (() => navigate(-1))}
            className="w-full py-3 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            Go back
          </button>
        </div>
      </motion.div>
    </div>
  )
}
