// src/components/public/FeaturesFooter.jsx
//
// Shared footer rendered at the bottom of every /features/* landing page
// (and the homepage). Cross-links all public feature pages to each other
// so crawlers can discover the full set from any single page, not just
// from the homepage — plus the standard legal links.
//
// Each reel card uses a static PNG representing the finished output of
// that feature (no app UI, no gradients) — images live in
// /public/images/features/<slug>.png
//
// Usage: import and render once, right before the closing </div> of any
// public page:
//   import FeaturesFooter from '@/components/public/FeaturesFooter'
//   ...
//   <FeaturesFooter />
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PUBLIC_FEATURES } from '@/config/publicFeatures'

const FeatureReelCard = ({ feature, index, isCurrent, onClick }) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      onClick={onClick}
      disabled={isCurrent}
      className="relative flex-shrink-0 rounded-2xl overflow-hidden text-left transition-all active:scale-[0.98]"
      style={{
        width: '160px',
        height: '220px',
        backgroundImage: `url(/images/features/${feature.slug}.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        cursor: isCurrent ? 'default' : 'pointer',
        opacity: isCurrent ? 0.55 : 1,
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.75) 100%)' }}
      />

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="text-white text-xs font-semibold leading-tight" style={{ opacity: 0.9 }}>
          {feature.label}
        </p>
        {isCurrent && (
          <p className="text-white text-[10px] mt-1" style={{ opacity: 0.6 }}>
            You're here
          </p>
        )}
      </div>
    </motion.button>
  )
}

export default function FeaturesFooter() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <footer
      className="mt-8"
      style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
    >
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-10 flex flex-col gap-8">

        {/* Feature reel cards */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
            Explore Meckury AI
          </p>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {PUBLIC_FEATURES.map((feature, i) => {
              const path      = `/features/${feature.slug}`
              const isCurrent = location.pathname === path
              return (
                <FeatureReelCard
                  key={feature.slug}
                  feature={feature}
                  index={i}
                  isCurrent={isCurrent}
                  onClick={() => !isCurrent && navigate(path)}
                />
              )
            })}
          </div>
        </div>

        {/* Bottom row */}
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-6"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} Meckury AI. By LinkAI.
          </p>
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/pricing')}
              className="text-xs font-semibold"
              style={{ color: 'var(--text-muted)' }}
            >
              Pricing
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="text-xs font-semibold"
              style={{ color: 'var(--text-muted)' }}
            >
              Terms
            </button>
            <button
              onClick={() => navigate('/privacy')}
              className="text-xs font-semibold"
              style={{ color: 'var(--text-muted)' }}
            >
              Privacy
            </button>
          </div>
        </div>

      </div>
    </footer>
  )
}
