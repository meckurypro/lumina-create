// src/components/public/FeaturesFooter.jsx
//
// Shared footer rendered at the bottom of every /features/* landing page
// (and the homepage). Cross-links all public feature pages to each other
// so crawlers can discover the full set from any single page, not just
// from the homepage — plus the standard legal links.
//
// Usage: import and render once, right before the closing </div> of any
// public page:
//   import FeaturesFooter from '@/components/public/FeaturesFooter'
//   ...
//   <FeaturesFooter />
import { useNavigate, useLocation } from 'react-router-dom'
import { PUBLIC_FEATURES } from '@/config/publicFeatures'

export default function FeaturesFooter() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <footer
      className="mt-8"
      style={{ borderTop: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
    >
      <div className="max-w-5xl mx-auto px-4 lg:px-8 py-10 flex flex-col gap-8">

        {/* Feature cross-links */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
            Explore Meckury AI
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
            {PUBLIC_FEATURES.map((f) => {
              const path       = `/features/${f.slug}`
              const isCurrent  = location.pathname === path
              return (
                <button
                  key={f.slug}
                  onClick={() => !isCurrent && navigate(path)}
                  className="text-left text-xs font-medium transition-colors"
                  style={{
                    color:      isCurrent ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor:     isCurrent ? 'default' : 'pointer',
                    fontWeight: isCurrent ? 700 : 500,
                  }}
                >
                  {f.label}
                </button>
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

