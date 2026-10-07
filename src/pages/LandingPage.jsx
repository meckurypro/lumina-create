// src/pages/LandingPage.jsx
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Image as ImageIcon, Film, Mic2, Clapperboard, Play } from 'lucide-react'
import FeaturesFooter from '@/components/public/FeaturesFooter'

const CHIPS = [
  { icon: ImageIcon,    label: 'Images',   x: '-4%',  y: '10%', d: 0.6 },
  { icon: Film,         label: 'Video',    x: '78%',  y: '6%',  d: 0.75 },
  { icon: Mic2,         label: 'Lipsync',  x: '82%',  y: '72%', d: 0.9 },
  { icon: Clapperboard, label: 'Filma',    x: '-2%',  y: '78%', d: 1.05 },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const start = () => navigate('/auth')

  return (
    <div className="min-h-dvh flex flex-col relative overflow-hidden" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Ambient light */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[720px] pointer-events-none"
        style={{ background: 'radial-gradient(60% 60% at 75% 10%, var(--brand-light), transparent 70%), radial-gradient(40% 50% at 10% 0%, color-mix(in srgb, var(--gold) 10%, transparent), transparent 70%)' }} />

      <motion.header
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-5 lg:px-10 h-16 glass"
        style={{ borderTop: 0, borderLeft: 0, borderRight: 0 }}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center rounded-xl font-black text-white"
            style={{ width: 32, height: 32, background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-brand)' }}>M</span>
          <span className="font-extrabold text-base" style={{ fontFamily: 'Sora, Inter, sans-serif', letterSpacing: '-0.03em' }}>Meckury AI</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={start} className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>Sign in</button>
          <button onClick={start} className="hidden sm:inline-flex text-sm font-bold px-4 py-2 rounded-xl text-white"
            style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-brand)' }}>Get started</button>
        </div>
      </motion.header>

      <main className="flex-1 flex flex-col pt-16 relative">
        <section className="w-full max-w-screen-xl mx-auto px-5 lg:px-10 pt-14 lg:pt-24 pb-16 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-6 px-3 py-1.5 rounded-full"
              style={{ background: 'var(--brand-light)', color: 'var(--brand)' }}>
              Cinematic AI studio · Built for African creators
            </motion.p>

            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5, ease: 'easeOut' }}
              className="font-black leading-[0.98] mb-6" style={{ fontSize: 'clamp(2.6rem, 6.4vw, 5.2rem)', letterSpacing: '-0.045em' }}>
              Direct your<br /><span className="brand-gradient-text">next scene.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="text-base lg:text-lg leading-relaxed mb-9 max-w-md" style={{ color: 'var(--text-secondary)' }}>
              Images, video, talking characters and full films from one studio. Describe it, cast it, shoot it.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 max-w-md">
              <button onClick={start}
                className="flex-1 inline-flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold text-white active:scale-[0.98] transition-transform"
                style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-brand-lg)' }}>
                Start creating free <ArrowRight size={16} />
              </button>
              <button onClick={start}
                className="flex-1 py-4 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
                style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                Sign in
              </button>
            </motion.div>
          </div>

          {/* Film-frame hero visual */}
          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }}
            className="relative mx-auto w-full max-w-xl" aria-hidden>
            <div className="relative rounded-3xl overflow-hidden"
              style={{ aspectRatio: '16 / 10', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-brand-lg)',
                background: 'radial-gradient(80% 90% at 70% 20%, color-mix(in srgb, var(--brand) 55%, transparent), transparent 60%), radial-gradient(70% 80% at 15% 90%, color-mix(in srgb, var(--gold) 45%, transparent), transparent 60%), var(--bg-card)' }}>
              <div className="absolute inset-x-0 top-0 h-[11%]" style={{ background: '#000' }} />
              <div className="absolute inset-x-0 bottom-0 h-[11%]" style={{ background: '#000' }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center justify-center rounded-full glass" style={{ width: 72, height: 72 }}>
                  <Play size={28} fill="currentColor" style={{ color: 'var(--text-primary)', marginLeft: 3 }} />
                </span>
              </div>
              <span className="absolute left-4 bottom-[14%] text-[11px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.85)' }}>SCENE 01 · TAKE 03</span>
            </div>
            {CHIPS.map(({ icon: Icon, label, x, y, d }) => (
              <motion.span key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: d }}
                className="absolute hidden sm:inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-full glass"
                style={{ left: x, top: y }}>
                <Icon size={14} style={{ color: 'var(--brand)' }} /> {label}
              </motion.span>
            ))}
          </motion.div>
        </section>

        <div className="mt-auto"><FeaturesFooter /></div>
      </main>
    </div>
  )
}
