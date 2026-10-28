// src/pages/LandingPage.jsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import FeaturesFooter from '@/components/public/FeaturesFooter'

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-dvh flex flex-col"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* ── Top bar ─────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 h-14"
        style={{
          background: 'var(--bg-primary)',
          borderBottom: '1px solid var(--border-color)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-2">
          <img
  src="/icon.png"
  alt="Meckury AI"
  className="h-7 w-auto rounded-lg object-contain logo-icon"
/>
          <span className="font-bold text-base tracking-tight">Meckury AI</span>
        </div>

        <button
          onClick={() => navigate('/auth')}
          className="text-sm font-semibold px-4 py-2 rounded-xl transition-all"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        >
          Sign in
        </button>
      </motion.header>

      {/* ── Main ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col pt-14">

        {/* ── Hero ──────────────────────────────────────── */}
        <div className="w-full max-w-screen-xl mx-auto px-8 pt-20 pb-16 flex flex-col">

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="text-xs font-semibold uppercase tracking-widest mb-5"
            style={{ color: 'var(--brand)' }}
          >
            AI Content Studio
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
            className="font-black leading-none tracking-tight mb-6"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', letterSpacing: '-0.04em' }}
          >
            Create.
            <br />
            <span style={{ color: 'var(--text-muted)' }}>Go viral.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-base leading-relaxed mb-10"
            style={{ color: 'var(--text-secondary)', maxWidth: '380px' }}
          >
            Cinematic AI videos and images in seconds.
            No skills required.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-3"
            style={{ maxWidth: '380px' }}
          >
            <button
              onClick={() => navigate('/auth')}
              className="flex-1 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
            >
              Get started free →
            </button>

            <button
              onClick={() => navigate('/auth')}
              className="flex-1 py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              Sign in
            </button>
          </motion.div>
        </div>

        {/* ── Footer (includes the "Explore Meckury AI" feature reel) ── */}
        <div className="mt-auto">
          <FeaturesFooter />
        </div>
      </main>
    </div>
  )
}
