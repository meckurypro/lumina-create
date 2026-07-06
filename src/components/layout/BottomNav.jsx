// src/components/layout/BottomNav.jsx
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Grip, GalleryHorizontalEnd, User, Zap, MessageCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import PromptIQPage from '@/pages/PromptIQPage'

// Flip to true when Muse is ready to launch — routes, edge function, and
// FeedPage stay wired regardless; this is the single on/off switch for nav.
const MUSE_ENABLED = false

const NAV_ITEMS = [
  { path: '/feed',    icon: Home,                 label: 'Home'    },
  { path: '/create',  icon: Grip,                 label: 'Create'  },
  ...(MUSE_ENABLED ? [{ path: '/muse', icon: MessageCircle, label: 'Muse' }] : []),
  { path: '/media',   icon: GalleryHorizontalEnd, label: 'Media'   },
  { path: '/profile', icon: User,                 label: 'Profile' },
]

const STAFF_NAV_LEFT  = NAV_ITEMS.slice(0, 2)
const STAFF_NAV_RIGHT = NAV_ITEMS.slice(2)

const NavItem = ({ path, icon: Icon, label }) => {
  const location = useLocation()
  const isActive = location.pathname === path || location.pathname.startsWith(path + '/')

  // Avoid /create/ugc highlighting /create as well
  const isCreateBase = path === '/create' && location.pathname.startsWith('/create/ugc')

  const active = isActive && !isCreateBase

  return (
    <NavLink
      to={path}
      aria-label={label}
      className="relative flex items-center justify-center"
      style={{ flex: 1 }}
    >
      {active && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0"
          style={{ background: 'var(--bg-elevated)', borderRadius: '14px' }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        />
      )}
      <span className="relative p-3 flex items-center justify-center">
        <Icon
          size={22}
          strokeWidth={active ? 2 : 1.5}
          style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'color 0.2s ease' }}
        />
      </span>
    </NavLink>
  )
}

const PromptIQButton = ({ onPress }) => (
  <button
    onClick={onPress}
    aria-label="PromptIQ"
    className="relative flex items-center justify-center"
    style={{ flex: 1 }}
  >
    <span
      className="relative p-3 flex items-center justify-center"
      style={{ borderRadius: '14px', background: 'var(--brand-light)' }}
    >
      <Zap size={22} strokeWidth={1.5} style={{ color: 'var(--brand)' }} />
    </span>
  </button>
)

export const BottomNav = () => {
  const { isStaff } = useAuth()
  const [showPIQ, setShowPIQ] = useState(false)

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background:    'var(--bg-card)',
          borderTop:     '1px solid var(--border-color)',
          borderRadius:  '24px 24px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
      >
        <div
          className="mx-auto flex items-center"
          style={{ maxWidth: '480px', padding: '8px 12px', height: '60px' }}
        >
          {isStaff ? (
            <>
              {STAFF_NAV_LEFT.map(({ path, icon, label }) => (
                <NavItem key={path} path={path} icon={icon} label={label} />
              ))}
              <PromptIQButton onPress={() => setShowPIQ(true)} />
              {STAFF_NAV_RIGHT.map(({ path, icon, label }) => (
                <NavItem key={path} path={path} icon={icon} label={label} />
              ))}
            </>
          ) : (
            NAV_ITEMS.map(({ path, icon, label }) => (
              <NavItem key={path} path={path} icon={icon} label={label} />
            ))
          )}
        </div>
      </nav>

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
