import { motion, AnimatePresence } from 'framer-motion'
import { X, Zap } from 'lucide-react'

export const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl', full: 'max-w-full mx-4' }
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.95 }} transition={{ type: 'spring', damping: 30, stiffness: 400 }} onClick={(e) => e.stopPropagation()} className={`w-full ${sizes[size]} max-h-[90vh] overflow-auto rounded-t-3xl sm:rounded-3xl`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            {title && (
              <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <h2 className="text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{title}</h2>
                <button onClick={onClose} className="rounded-xl p-2 transition-opacity hover:opacity-70" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }} aria-label="Close"><X size={18} /></button>
              </div>
            )}
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export const Loader = ({ size = 'md', text, status }) => {
  const sizes = { sm: 'h-8 w-8', md: 'h-12 w-12', lg: 'h-16 w-16' }
  const statusMessages = { uploading: 'Uploading your images...', enhancing: 'Enhancing your prompt with AI...', generating: 'Creating your masterpiece...', processing: 'Processing...' }
  const displayText = text || statusMessages[status] || 'Loading...'
  return <div className="flex flex-col items-center justify-center gap-4 py-8"><div className="relative"><div className={`${sizes[size]} rounded-full border-2 opacity-20`} style={{ borderColor: 'var(--brand)' }} /><div className={`${sizes[size]} absolute inset-0 animate-spin rounded-full border-2 border-transparent`} style={{ borderTopColor: 'var(--brand)' }} /><div className="absolute inset-0 flex items-center justify-center"><div className="h-2 w-2 animate-pulse rounded-full" style={{ background: 'var(--brand)' }} /></div></div>{displayText && <p className="text-center text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>{displayText}</p>}</div>
}

export const Skeleton = ({ className = '', rounded = 'rounded-xl' }) => <div className={`shimmer ${rounded} ${className}`} />

export const CreditBadge = ({ credits, size = 'md', showIcon = true }) => {
  const sizes = { sm: 'text-xs px-2 py-1 gap-1', md: 'text-sm px-3 py-1.5 gap-1.5', lg: 'text-base px-4 py-2 gap-2' }
  const iconSizes = { sm: 12, md: 14, lg: 16 }
  return <div title={`${credits} credits available`} className={`inline-flex items-center rounded-full font-bold ${sizes[size]}`} style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.1))', border: '1px solid rgba(249,115,22,0.3)', color: 'var(--brand)', fontFamily: 'Syne, sans-serif' }}>{showIcon && <Zap size={iconSizes[size]} fill="currentColor" />}{typeof credits === 'number' ? credits.toFixed(0) : credits}</div>
}

export const EmptyState = ({ icon: Icon, title, description, action }) => <div className="flex flex-col items-center justify-center px-6 py-16 text-center">{Icon && <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-elevated)' }}><Icon size={28} style={{ color: 'var(--text-muted)' }} /></div>}<h3 className="mb-2 text-lg font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>{title}</h3>{description && <p className="mb-6 max-w-xs text-sm" style={{ color: 'var(--text-muted)' }}>{description}</p>}{action}</div>

export const Divider = ({ text }) => <div className="my-2 flex items-center gap-3"><div className="h-px flex-1" style={{ background: 'var(--border-color)' }} />{text && <span className="px-2 text-xs" style={{ color: 'var(--text-muted)' }}>{text}</span>}<div className="h-px flex-1" style={{ background: 'var(--border-color)' }} /></div>
