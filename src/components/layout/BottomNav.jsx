// src/components/layout/BottomNav.jsx
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Sparkles, Film, User, Zap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import PromptIQPage from '@/pages/PromptIQPage'

const NAV_ITEMS = [
  { path: '/feed',    icon: Home,     label: 'Home'    },
  { path: '/create',  icon: Sparkles, label: 'Create'  },
  { path: '/history', icon: Film,     label: 'History' },
  { path: '/profile', icon: User,     label: 'Profile' },
]

const STAFF_NAV_LEFT  = NAV_ITEMS.slice(0, 2)
const STAFF_NAV_RIGHT = NAV_ITEMS.slice(2)

const NavItem = ({ path, icon: Icon, label }) => {
  const location = useLocation()
  const isActive = location.pathname === path

  return (
    <NavLink
      to={path}
      aria-label={label}
      className="relative flex items-center justify-center"
      style={{ flex: 1 }}
    >
      {isActive && (
        <motion.span
          layoutId="nav-pill"
          className="absolute inset-0"
          style={{
            background:   'rgba(255,255,255,0.1)',
            borderRadius: '14px',
          }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        />
      )}
      <span className="relative p-3 flex items-center justify-center">
        <Icon
          size={22}
          strokeWidth={isActive ? 2 : 1.5}
          style={{
            color:      isActive ? '#ffffff' : 'rgba(255,255,255,0.32)',
            transition: 'color 0.2s ease',
          }}
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
      style={{ borderRadius: '14px', background: 'rgba(249,115,22,0.12)' }}
    >
      <Zap size={22} strokeWidth={1.5} style={{ color: '#f97316' }} />
    </span>
  </button>
)

export const BottomNav = () => {
  const { isStaff } = useAuth()
  const [showPIQ, setShowPIQ] = useState(false)

  return (
    <>
      {/* ── Nav bar ── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          background:    '#0a0a0a',
          borderTop:     '1px solid rgba(255,255,255,0.07)',
          borderRadius:  '24px 24px 0 0',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        }}
      >
        <div
          className="mx-auto flex items-center"
          style={{
            maxWidth: '480px',
            padding:  '8px 12px',
            height:   '60px',
          }}
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

      {/* ── Spacer — prevents content scrolling under nav ── */}
      <div
        className="lg:hidden"
        style={{ height: 'calc(60px + env(safe-area-inset-bottom, 8px))' }}
      />

      {/* ── PromptIQ sheet ── */}
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
