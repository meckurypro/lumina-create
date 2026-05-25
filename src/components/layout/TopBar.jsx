// src/components/layout/TopBar.jsx
import { useState } from 'react'
import { useNavigate, useLocation, NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Zap, Home, Sparkles, Film, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { CreditBadge } from '@/components/ui/Modal'
import PromptIQPage from '@/pages/PromptIQPage'

const NAV_ITEMS = [
  { path: '/feed',    icon: Home,     label: 'Home'    },
  { path: '/create',  icon: Sparkles, label: 'Create'  },
  { path: '/history', icon: Film,     label: 'History' },
  { path: '/profile', icon: User,     label: 'Profile' },
]

const DesktopNavItem = ({ path, label }) => {
  const location = useLocation()
  const isActive = location.pathname === path

  return (
    <NavLink
      to={path}
      className="relative px-4 py-2 text-sm font-semibold rounded-xl transition-all"
      style={{
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        background: isActive ? 'var(--bg-elevated)' : 'transparent',
      }}
    >
      {label}
    </NavLink>
  )
}

export const TopBar = ({
  title,
  showLogo    = false,
  showCredits = true,
  showBack    = false,
  onBack,
}) => {
  const navigate             = useNavigate()
  const { credits, isStaff } = useAuth()
  const [showPIQ, setShowPIQ] = useState(false)

  const handleBack = () => onBack ? onBack() : navigate(-1)

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-30 px-4 lg:px-8"
        style={{
          background:         'color-mix(in srgb, var(--bg-primary) 88%, transparent)',
          borderBottom:       '1px solid var(--border-color)',
          backdropFilter:     'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          height:             '56px',
        }}
      >
        <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between gap-3">

          {/* ── Left: back button or logo ── */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {showBack ? (
              <button
                onClick={handleBack}
                className="-ml-2 rounded-xl p-2"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Go back"
              >
                <ArrowLeft size={22} />
              </button>
            ) : showLogo ? (
              <button
                onClick={() => navigate('/feed')}
                className="flex items-center gap-2"
                aria-label="Home"
              >
<img
  src="/icon.png"
  alt="Meckury AI"
  className="h-7 w-auto rounded-lg object-contain logo-icon"
/>
<span className="text-lg font-extrabold">Meckury AI</span>
              </button>
            ) : null}
          </div>

          {/* ── Center: page title (mobile) or desktop nav ── */}
          {title && (
            <h1 className="shrink-0 text-base font-extrabold lg:hidden">{title}</h1>
          )}

          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(({ path, label }) => (
              <DesktopNavItem key={path} path={path} label={label} />
            ))}
          </nav>

          {/* ── Right: PromptIQ pill + credits ── */}
          <div className="flex flex-1 items-center justify-end gap-2">
            {isStaff && showLogo && (
              <button
                onClick={() => setShowPIQ(true)}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white brand-gradient"
              >
                <Zap size={12} />
                PromptIQ
              </button>
            )}
            {showCredits && <CreditBadge credits={credits} size="sm" />}
          </div>

        </div>
      </header>

      {/* Spacer so content doesn't hide under fixed bar */}
      <div style={{ height: '56px' }} />

      <AnimatePresence>
        {showPIQ && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }}
            className="fixed inset-0 z-50"
          >
            <PromptIQPage onClose={() => setShowPIQ(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
