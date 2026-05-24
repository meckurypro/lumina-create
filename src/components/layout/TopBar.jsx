import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Zap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { CreditBadge } from '@/components/ui/Modal'
import PromptIQPage from '@/pages/PromptIQPage'

export const TopBar = ({ title, showLogo = false, showCredits = true, showBack = false, onBack }) => {
  const navigate = useNavigate()
  const { credits, isStaff } = useAuth()
  const [showPIQ, setShowPIQ] = useState(false)
  const handleBack = () => onBack ? onBack() : navigate(-1)
  return <><header className="sticky top-0 z-30 px-4 py-3 backdrop-blur-xl" style={{ background: 'color-mix(in srgb, var(--bg) 88%, transparent)', borderBottom: '1px solid var(--border-color)' }}><div className="mx-auto flex max-w-2xl items-center justify-between gap-3"><div className="flex min-w-0 flex-1 items-center">{showBack ? <button onClick={handleBack} className="-ml-2 rounded-xl p-2" style={{ color: 'var(--text-secondary)' }} aria-label="Go back"><ArrowLeft size={22} /></button> : showLogo ? <button onClick={() => navigate('/create')} className="flex items-center gap-2" aria-label="Home"><span className="grid h-9 w-9 place-items-center rounded-2xl brand-gradient text-primary-foreground"><Zap size={18} fill="currentColor" /></span><span className="text-lg font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>Meckury</span></button> : null}</div>{title && <h1 className="shrink-0 text-base font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>{title}</h1>}<div className="flex flex-1 items-center justify-end gap-2">{isStaff && showLogo && <button onClick={() => setShowPIQ(true)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-primary-foreground brand-gradient" style={{ fontFamily: 'Syne, sans-serif' }}><Zap size={12} />PromptIQ</button>}{showCredits && <CreditBadge credits={credits} size="sm" />}</div></div></header><AnimatePresence>{showPIQ && <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 360 }} className="fixed inset-0 z-50"><PromptIQPage onClose={() => setShowPIQ(false)} /></motion.div>}</AnimatePresence></>
}
