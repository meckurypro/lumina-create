// src/pages/RefundPolicyPage.jsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function RefundPolicyPage() {
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
        <h1 className="text-sm font-bold">Refund Policy</h1>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8 space-y-8" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>

        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Last updated: July 2026</p>
          <p className="mt-3 text-sm">
            This Refund Policy explains when Meckury AI ("we", "us", or "our") issues refunds for credit
            purchases, AI Sessions, and Studio Access subscriptions on the Platform.
          </p>
        </div>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>1. Credit Purchases</h2>
          <p className="text-sm">
            Credits purchased via Paystack are generally non-refundable once used. However, we do refund
            credits in the following cases:
          </p>
          <ul className="mt-2 text-sm space-y-1 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
            <li>A generation fails due to an error on our website or platform architecture</li>
            <li>A generation fails because a third-party provider (such as fal.ai or WaveSpeed) rejects or fails to process the request</li>
          </ul>
          <p className="mt-2 text-sm">
            We do not refund credits for content that was successfully generated but later found by the
            user to violate a policy, or that the user is otherwise dissatisfied with for reasons unrelated
            to a technical failure.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>2. Credits Not Received</h2>
          <p className="text-sm">
            If you complete a payment through Paystack but do not receive the corresponding credits, contact
            us and we will investigate and resolve the issue. This is rare, as credit delivery is automated
            and processed directly by Paystack.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>3. AI Sessions (Private Bookings)</h2>
          <ul className="mt-2 text-sm space-y-1 list-disc list-inside" style={{ color: 'var(--text-muted)' }}>
            <li>If a technical issue on our end causes a booked session to be denied, we will reschedule the session or issue a refund if requested</li>
            <li>Cancellations made at least 24 hours before the scheduled session are fully refunded</li>
            <li>Sessions cannot be cancelled or refunded less than 24 hours before the scheduled start time</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>4. Studio Access Subscriptions</h2>
          <p className="text-sm">
            Subscription fees are billed per billing cycle and are non-refundable for time already elapsed
            in the current cycle. You may cancel your subscription at any time; cancellation takes effect at
            the end of the current billing period, and you will retain access until then. No partial refunds
            are issued for unused portions of a billing cycle.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>5. How to Request a Refund</h2>
          <p className="text-sm">
            To request a refund under the terms above, contact us at{' '}
            <a href="mailto:hey@meckury.ai" className="underline" style={{ color: 'var(--brand)' }}>
              hey@meckury.ai
            </a>{' '}
            with your account email and a description of the issue. We aim to review and resolve refund
            requests promptly; approved refunds are processed back to your original payment method via
            Paystack.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>6. Changes to This Policy</h2>
          <p className="text-sm">
            We may update this Refund Policy from time to time. Continued use of the Platform after changes
            are posted constitutes your acceptance of the updated policy.
          </p>
        </section>

      </div>
    </div>
  )
}

