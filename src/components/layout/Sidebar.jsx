// src/components/layout/Sidebar.jsx — desktop navigation (lg: rail, xl: full)
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Home, Grip, Clapperboard, GalleryHorizontalEnd, Cpu, CreditCard,
  User, Settings, Shield, Zap, Sun, Moon, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import PromptIQPage from '@/pages/PromptIQPage'
import { MUSE_ENABLED } from '@/components/layout/BottomNav'

const MAIN = [
  { path: '/feed',          icon: Home,                 label: 'Home' },
  { path: '/create',        icon: Grip,                 label: 'Create' },
  ...(MUSE_ENABLED ? [{ path: '/muse', icon: Sparkles, label: 'Muse' }] : []),
  { path: '/filma',         icon: Clapperboard,         label: 'Filma' },
  { path: '/media',         icon: GalleryHorizontalEnd, label: 'Media' },
  { path: '/render-window', icon: Cpu,                  label: 'Render Window' },
]
const ACCOUNT = [
  { path: '/credits',  icon: CreditCard, label: 'Credits' },
  { path: '/profile',  icon: User,       label: 'Profile' },
  { path: '/settings', icon: Settings,   label: 'Settings' },
]

const Item = ({ path, icon: Icon, label }) => {
  const { pathname } = useLocation()
  const active = pathname === path || pathname.startsWith(path + '/')
  return (
    <NavLink
      to={path}
      title={label}
      aria-label={label}
      className="relative flex items-center gap-3 rounded-xl h-11 px-3 justify-center xl:justify-start"
    >
      {active && (
        <motion.span
          layoutId="sidebar-pill"
          className="absolute inset-0 rounded-xl"
          style={{ background: 'var(--brand-light)', border: '1px solid var(--border-color)' }}
          transition={{ type: 'spring', damping: 30, stiffness: 400 }}
        />
      )}
      <Icon size={20} strokeWidth={active ? 2 : 1.6} className="relative flex-shrink-0"
        style={{ color: active ? 'var(--brand)' : 'var(--text-muted)' }} />
      <span className="relative hidden xl:inline text-sm font-semibold"
        style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
        {label}
      </span>
    </NavLink>
  )
}

export const Sidebar = () => {
  const { isAdmin, isStaff } = useAuth()
  const { theme, setTheme } = useTheme()
  const [showPIQ, setShowPIQ] = useState(false)
  const isDark = theme === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark'

  return (
    <>
      <aside
        className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 px-3 py-4 gap-1"
        style={{ width: 'var(--sidebar-w)', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}
      >
        <NavLink to="/feed" className="flex items-center gap-3 h-11 px-2 mb-4 justify-center xl:justify-start" aria-label="Meckury AI">
          <img src="/icon.png" alt="Meckury AI" className="h-8 w-auto rounded-lg object-contain logo-icon flex-shrink-0" />
          <span className="hidden xl:inline text-base font-extrabold">Meckury AI</span>
        </NavLink>

        {MAIN.map((i) => <Item key={i.path} {...i} />)}

        {isStaff && (
          <button onClick={() => setShowPIQ(true)} aria-label="PromptIQ" title="PromptIQ"
            className="flex items-center gap-3 rounded-xl h-11 px-3 justify-center xl:justify-start">
            <Zap size={20} strokeWidth={1.6} style={{ color: 'var(--gold)' }} />
            <span className="hidden xl:inline text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>PromptIQ</span>
          </button>
        )}

        <div className="flex-1" />

        {isAdmin && <Item path="/admin" icon={Shield} label="Admin" />}
        {ACCOUNT.map((i) => <Item key={i.path} {...i} />)}

        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label="Toggle theme" title={`Theme: ${theme}`}
          className="flex items-center gap-3 rounded-xl h-11 px-3 justify-center xl:justify-start mt-1"
        >
          {isDark ? <Sun size={20} strokeWidth={1.6} style={{ color: 'var(--text-muted)' }} />
                  : <Moon size={20} strokeWidth={1.6} style={{ color: 'var(--text-muted)' }} />}
          <span className="hidden xl:inline text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {isDark ? 'Light mode' : 'Dark mode'}
          </span>
        </button>
      </aside>

      <AnimatePresence>
        {showPIQ && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 360 }} className="fixed inset-0 z-50">
            <PromptIQPage onClose={() => setShowPIQ(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
