// src/pages/PricingPage.jsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const CREDIT_PACKS = [
  { name: 'Sapa',     credits: '2000 + 50 bonus',    price: '₦4,800' },
  { name: 'Starter',  credits: '6000 + 100 bonus',   price: '₦14,400' },
  { name: 'Standard', credits: '12000 + 205 bonus',  price: '₦28,800' },
  { name: 'Pro',      credits: '20000 + 420 bonus',  price: '₦48,000' },
  { name: 'Creator',  credits: '41333 + 840 bonus',  price: '₦99,200' },
]

const RENDER_WINDOW_PASSES = [
  { name: 'Daily Access',   price: '₦1,500', period: '1 day' },
  { name: 'Weekend Access', price: '₦3,000', period: 'weekend' },
  { name: 'Weekly Access',  price: '₦6,000', period: '1 week' },
  { name: 'Monthly Access', price: '₦20,000', period: '1 month' },
]

const SESSION_RATES = [
  { duration: '30 mins',  price: '₦2,000' },
  { duration: '1 hour',   price: '₦3,500' },
  { duration: '2 hours',  price: '₦5,000' },
  { duration: '3 hours',  price: '₦6,500' },
  { duration: '4 hours',  price: '₦8,000' },
  { duration: 'Every additional hour', price: '+₦1,500' },
]

function PriceRow({ left, mid, right }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{left}</p>
        {mid && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{mid}</p>}
      </div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{right}</p>
    </div>
  )
}

export default function PricingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-bold">Pricing</h1>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8 space-y-10" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>

        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Last updated: July 2026</p>
          <p className="mt-3 text-sm">
            All prices are in Nigerian Naira (₦) and are processed securely through Paystack. Meckury AI
            offers four ways to access the platform: a free tier, paid credits, Render Window access, and
            private AI Sessions.
          </p>
        </div>

        <section>
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>User Tiers</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            Every account starts on the Novice tier. Upgrade to Master for full platform access.
          </p>
          <div>
            <PriceRow left="Novice" mid="Free — core generation features" right="₦0" />
            <PriceRow
              left="Master"
              mid="Unlimited UGC characters &amp; brands, voice cloning as TTS, generations kept beyond 7 days, and more"
              right="₦5,000/mo"
            />
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Credits</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            Credits are used to generate images, videos, and voice content. Buy once, use anytime.
          </p>
          <div>
            {CREDIT_PACKS.map((pack) => (
              <PriceRow key={pack.name} left={pack.name} mid={`${pack.credits} credits`} right={pack.price} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Render Window Access</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            Certain premium models are made available for free during scheduled windows announced by
            Meckury AI (for example, "Meckury I2V Max open 12:30pm–1:30pm"). A Render Window pass gives you
            access to use those models at zero credit cost whenever a window is open. Batch generation is
            not available during Render Window sessions — generations are made one at a time as the window
            is open.
          </p>
          <div>
            {RENDER_WINDOW_PASSES.map((pass) => (
              <PriceRow key={pass.name} left={pass.name} mid={pass.period} right={pass.price} />
            ))}
          </div>
          <p className="text-sm mt-3">
            Teams and communities can also get Render Window access together through a Group or Cohort
            code, with a daily content cap per member. Contact us for Group/Cohort pricing.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>AI Sessions</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            Book a private session on a model of your choice for a set duration. Unlike Render Window
            access, AI Sessions are not tied to a scheduled availability window — you get dedicated,
            uninterrupted access to the model for the time you book, with no credit cost and no restriction
            on batch generation. Priced per duration, per model.
          </p>
          <div>
            {SESSION_RATES.map((rate) => (
              <PriceRow key={rate.duration} left={rate.duration} right={rate.price} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Questions</h2>
          <p className="text-sm">
            For pricing questions, contact us at{' '}
            <a href="mailto:meckurypro@gmail.com" className="underline" style={{ color: 'var(--brand)' }}>
              meckurypro@gmail.com
            </a>. See our{' '}
            <a href="/refund-policy" className="underline" style={{ color: 'var(--brand)' }}>
              Refund Policy
            </a>{' '}
            for details on cancellations and refunds.
          </p>
        </section>

      </div>
    </div>
  )
}
