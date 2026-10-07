import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

export const Button = ({ children, onClick, variant = 'primary', size = 'md', loading = false, disabled = false, fullWidth = false, icon: Icon, className = '', type = 'button' }) => {
  const base = `inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${fullWidth ? 'w-full' : ''}`
  const sizes = { sm: 'px-4 py-2.5 text-sm', md: 'px-6 py-3.5 text-base', lg: 'px-8 py-4 text-lg' }
  const variants = {
    primary: 'brand-gradient text-primary-foreground shadow-brand hover:shadow-brand-lg hover:-translate-y-0.5 active:translate-y-0',
    secondary: 'border bg-secondary text-secondary-foreground hover:border-primary hover:text-primary',
    ghost: 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
    danger: 'bg-destructive text-destructive-foreground',
    outline: 'border border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground',
  }
  return <motion.button type={type} onClick={onClick} disabled={disabled || loading} whileTap={{ scale: disabled || loading ? 1 : 0.97 }} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{loading ? <Loader2 size={size === 'sm' ? 14 : 18} className="animate-spin" /> : Icon ? <Icon size={size === 'sm' ? 14 : 18} /> : null}{children}</motion.button>
}
