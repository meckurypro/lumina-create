// src/pages/PricingPage.jsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Zap, Crown, Check, Clock, Cpu } from 'lucide-react'

const CREDIT_PACKS = [
  { name: 'Sapa',     credits: 2050,  bonus: 50,  price: '₦4,800' },
  { name: 'Starter',  credits: 6100,  bonus: 100, price: '₦14,400' },
  { name: 'Standard', credits: 12205, bonus: 205, price: '₦28,800' },
  { name: 'Pro',      credits: 20420, bonus: 420, price: '₦48,000', best: false },
  { name: 'Creator',  credits: 42173, bonus: 840, price: '₦99,200', best: true },
]
const RENDER_WINDOW_PASSES = [
  { name: 'Daily',   price: '₦1,500',  period: '1 day' },
  { name: 'Weekend', price: '₦3,000',  period: 'weekend' },
  { name: 'Weekly',  price: '₦6,000',  period: '1 week' },
  { name: 'Monthly', price: '₦20,000', period: '1 month' },
]
const SESSION_RATES = [
  { duration: '30 mins', price: '₦2,000' }, { duration: '1 hour', price: '₦3,500' }, { duration: '2 hours', price: '₦5,000' },
  { duration: '3 hours',  price: '₦6,500' }, { duration: '4 hours', price: '₦8,000' }, { duration: 'Each extra hour', price: '+₦1,500' },
]
const MASTER_PERKS = ['Unlimited UGC characters & brands', 'Voice cloning as TTS', 'Generations kept beyond 7 days', 'Premium models']

const SectionTitle = ({ icon: Icon, title, children }) => (
  <div className="mb-5">
    <div className="flex items-center gap-2 mb-1.5">
      {Icon && <Icon size={16} style={{ color: 'var(--brand)' }} />}
      <h2 className="text-xl font-black">{title}</h2>
    </div>
    <p className="text-sm max-w-2xl" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>{children}</p>
  </div>
)

export default function PricingPage() {
  const navigate = useNavigate()
  const go = (p) => () => navigate(p)

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-8 h-14 glass" style={{ borderTop: 0, borderLeft: 0, borderRight: 0 }}>
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }} aria-label="Go back"><ArrowLeft size={20} /></button>
        <h1 className="text-sm lg:text-base font-bold">Pricing</h1>
      </header>

      <main className="mx-auto max-w-5xl px-5 lg:px-8 py-10 space-y-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-black leading-[1.02] mb-4" style={{ fontSize: 'clamp(2.2rem, 5vw, 3.6rem)', letterSpacing: '-0.04em' }}>
            Simple pricing,<br /><span className="brand-gradient-text">built for creators.</span>
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
            All prices are in Nigerian Naira (₦) and processed securely through Paystack. Four ways to create: a free tier, paid credits, Render Window access, and private AI Sessions. Last updated July 2026.
          </p>
        </div>

        {/* Tiers */}
        <section>
          <SectionTitle title="User tiers">Every account starts on Novice. Upgrade to Master for full platform access.</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-3xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <p className="text-sm font-bold mb-1">Novice</p>
              <p className="text-4xl font-black mb-1" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>₦0</p>
              <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Core generation features, pay as you go with credits.</p>
              <button onClick={go('/auth')} className="w-full py-3 rounded-2xl text-sm font-semibold" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>Start free</button>
            </div>
            <div className="rounded-3xl p-6" style={{ background: 'radial-gradient(100% 120% at 100% 0%, rgba(245,184,61,0.14), transparent 60%), var(--bg-card)', border: '1px solid rgba(245,184,61,0.35)' }}>
              <div className="flex items-center gap-2 mb-1"><Crown size={15} style={{ color: 'var(--gold)' }} /><p className="text-sm font-bold" style={{ color: 'var(--gold)' }}>Master</p></div>
              <p className="text-4xl font-black mb-1" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>₦5,000<span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>/mo</span></p>
              <ul className="flex flex-col gap-2 my-4">
                {MASTER_PERKS.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}><Check size={14} strokeWidth={3} style={{ color: 'var(--gold)' }} />{t}</li>
                ))}
              </ul>
              <button onClick={go('/billing')} className="w-full py-3 rounded-2xl text-sm font-bold" style={{ background: 'linear-gradient(135deg, #F5B83D, #E8903A)', color: '#1a1200' }}>Upgrade to Master</button>
            </div>
          </div>
        </section>

        {/* Credits */}
        <section>
          <SectionTitle icon={Zap} title="Credits">Credits are used to generate images, videos and voice content. Buy once, use anytime.</SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
            {CREDIT_PACKS.map((p) => (
              <button key={p.name} onClick={go('/billing')} className="relative text-left rounded-2xl p-4 transition-all hover:-translate-y-0.5"
                style={{ background: p.best ? 'radial-gradient(120% 90% at 100% 0%, var(--brand-light), transparent 65%), var(--bg-card)' : 'var(--bg-card)', border: `1px solid ${p.best ? 'var(--brand)' : 'var(--border-color)'}`, boxShadow: p.best ? 'var(--shadow-brand)' : 'none' }}>
                {p.best && <span className="absolute -top-2.5 left-3 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white" style={{ background: 'var(--gradient-brand)' }}>Best value</span>}
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{p.name}</p>
                <p className="text-2xl font-black" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{p.credits.toLocaleString()}</p>
                <p className="text-xs mb-3" style={{ color: 'var(--tool-motion)' }}>incl. {p.bonus} bonus</p>
                <p className="text-base font-bold">{p.price}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Render Window */}
        <section>
          <SectionTitle icon={Cpu} title="Render Window access">
            Certain premium models are made available during scheduled windows announced by Meckury AI (for example, “Meckury I2V Max open 12:30pm–1:30pm”). A pass lets you use those models at zero credit cost whenever a window is open. Batch generation isn&apos;t available during Render Window sessions: generations are made one at a time while the window is open.
          </SectionTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {RENDER_WINDOW_PASSES.map((p) => (
              <button key={p.name} onClick={go('/render-window')} className="text-left rounded-2xl p-4 transition-all hover:-translate-y-0.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{p.name}</p>
                <p className="text-xl font-black" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{p.price}</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{p.period}</p>
              </button>
            ))}
          </div>
          <p className="text-sm mt-4" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>Teams and communities can also get access together through a Group or Cohort code, with a daily content cap per member. Contact us for Group/Cohort pricing.</p>
        </section>

        {/* Sessions */}
        <section>
          <SectionTitle icon={Clock} title="AI Sessions">
            Book a private session on a model of your choice for a set duration. Unlike Render Window access, sessions aren&apos;t tied to a scheduled window: you get dedicated, uninterrupted access for the time you book, with no credit cost and no restriction on batch generation. Priced per duration, per model.
          </SectionTitle>
          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            {SESSION_RATES.map((r, i) => (
              <div key={r.duration} className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: i ? '1px solid var(--border-color)' : 'none' }}>
                <span className="text-sm font-semibold">{r.duration}</span>
                <span className="text-sm font-black">{r.price}</span>
              </div>
            ))}
          </div>
          <button onClick={go('/render-window/book')} className="mt-4 px-6 py-3 rounded-2xl text-sm font-bold text-white" style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-brand)' }}>Book a session</button>
        </section>

        <section className="text-center pb-10">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Pricing questions? <a href="mailto:meckurypro@gmail.com" className="underline" style={{ color: 'var(--brand)' }}>meckurypro@gmail.com</a> · See our <a href="/refund-policy" className="underline" style={{ color: 'var(--brand)' }}>Refund Policy</a> for details on refunds.
          </p>
        </section>
      </main>
    </div>
  )
}
