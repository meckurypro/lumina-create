import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, Sparkles, Film, User, Zap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import PromptIQPage from '@/pages/PromptIQPage'

const NAV_ITEMS = [
  { path: '/feed', icon: Home, label: 'Home' },
  { path: '/create', icon: Sparkles, label: 'Create' },
  { path: '/history', icon: Film, label: 'History' },
  { path: '/profile', icon: User, label: 'Profile' },
]
const STAFF_NAV_LEFT = NAV_ITEMS.slice(0, 2)
const STAFF_NAV_RIGHT = NAV_ITEMS.slice(2)

const NavItem = ({ path, icon: Icon, label, isActive }) => <NavLink to={path} className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-xs font-semibold" style={{ color: isActive ? 'var(--brand)' : 'var(--text-muted)' }}>{isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-2xl" style={{ background: 'rgba(249,115,22,0.1)' }} />}<Icon size={20} className="relative" /><span className="relative truncate">{label}</span></NavLink>
const PromptIQButton = ({ onPress }) => <button onClick={onPress} className="relative -mt-6 flex h-16 w-16 flex-col items-center justify-center rounded-full brand-gradient text-primary-foreground shadow-brand"><Zap size={24} fill="currentColor" /><span className="text-[10px] font-bold">PromptIQ</span></button>

export const BottomNav = () => {
  const location = useLocation()
  const { isStaff } = useAuth()
  const [showPIQ, setShowPIQ] = useState(false)
  return <><nav className="fixed bottom-0 left-0 right-0 z-40 px-3 pb-3"><div className="mx-auto flex max-w-2xl items-center justify-around gap-1 rounded-[1.7rem] p-2" style={{ background: 'color-mix(in srgb, var(--bg-card) 94%, transparent)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)', backdropFilter: 'blur(14px)' }}>{isStaff ? <>{STAFF_NAV_LEFT.map(({ path, icon, label }) => <NavItem key={path} path={path} icon={icon} label={label} isActive={location.pathname === path} />)}<PromptIQButton onPress={() => setShowPIQ(true)} />{STAFF_NAV_RIGHT.map(({ path, icon, label }) => <NavItem key={path} path={path} icon={icon} label={label} isActive={location.pathname === path} />)}</> : NAV_ITEMS.map(({ path, icon, label }) => <NavItem key={path} path={path} icon={icon} label={label} isActive={location.pathname === path} />)}</div></nav><AnimatePresence>{showPIQ && <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 360 }} className="fixed inset-0 z-50"><PromptIQPage onClose={() => setShowPIQ(false)} /></motion.div>}</AnimatePresence></>
}
