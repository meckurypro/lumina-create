import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import {
  verifyPayment,
  getPendingPayment,
  clearPendingPayment,
} from '@/lib/paystack'
import { useAuth } from '@/context/AuthContext'

export default function PaymentCallbackPage() {
  const [params]    = useSearchParams()
  const navigate    = useNavigate()
  const { refreshProfile } = useAuth()

  const [state,   setState]   = useState('loading') // loading | success | error
  const [message, setMessage] = useState('Confirming your payment…')
  const [reference, setReference] = useState('')

  useEffect(() => {
    const ref = params.get('reference') || params.get('trxref') || ''
    setReference(ref)

    if (!ref) {
      setState('error')
      setMessage('Missing payment reference in URL.')
      return
    }

    const pending = getPendingPayment()

    ;(async () => {
      try {
        const result = await verifyPayment({
          reference:   ref,
          userId:      pending?.userId,
          packageSlug: pending?.packageSlug,
        })

        if (result?.success || result?.already_processed) {
          clearPendingPayment()
          await refreshProfile().catch(() => {})
          setState('success')
          if (result.kind === 'master_subscription') {
            setMessage('Master subscription activated 🎉')
          } else if (result.credits_added) {
            setMessage(`${result.credits_added} credits added to your account 🎉`)
          } else {
            setMessage('Payment confirmed 🎉')
          }
          setTimeout(() => navigate('/feed', { replace: true }), 2000)
        } else {
          setState('error')
          setMessage(result?.error || 'We could not confirm your payment.')
        }
      } catch (err) {
        setState('error')
        setMessage(err?.message || 'Network error while confirming payment.')
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: 'var(--bg-elevated)' }}
      >
        {state === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 mx-auto mb-4 animate-spin" style={{ color: 'var(--accent)' }} />
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Confirming your payment…
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              This usually takes a few seconds. Please don't close this window.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: '#22c55e' }} />
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Payment successful
            </h1>
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>{message}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Redirecting…</p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 mx-auto mb-4" style={{ color: '#ef4444' }} />
            <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              We couldn't confirm your payment
            </h1>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>{message}</p>
            {reference && (
              <p className="text-xs mb-4 font-mono px-3 py-2 rounded"
                 style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
                Reference: {reference}
              </p>
            )}
            <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
              If you were charged, contact support with the reference above and we'll resolve it.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => navigate('/feed', { replace: true })}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                Go to Feed
              </button>
              <button
                onClick={() => navigate('/profile', { replace: true })}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Profile
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}