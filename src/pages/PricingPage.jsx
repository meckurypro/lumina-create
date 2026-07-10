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

const STUDIO_PASSES = [
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
            offers three ways to pay: one-time credit purchases, Studio Access passes, and hourly AI Session
            bookings.
          </p>
        </div>

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
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Studio Access</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            Get unlimited access to premium models for a set period — zero credits charged while your pass
            is active.
          </p>
          <div>
            {STUDIO_PASSES.map((pass) => (
              <PriceRow key={pass.name} left={pass.name} mid={pass.period} right={pass.price} />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>AI Sessions (Tender Window)</h2>
          <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
            Book a private, model-specific session and use it as much as you like for the duration booked —
            no credit costs during the session. Priced per duration block, per model.
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
