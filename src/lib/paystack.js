// src/lib/paystack.js
//
// Paystack payment integration for Meckury AI.
// Handles credit pack purchases and master subscription.
//
// Flow:
//   1. initializePayment → opens Paystack iframe
//   2. On Paystack callback → stores reference in localStorage immediately
//   3. verifyPayment → calls verify-payment edge function
//   4. On app load → AuthContext checks for pending_payment and retries if needed

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
const SUPABASE_URL        = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY

const PENDING_KEY         = 'meckury_pending_payment'
const PENDING_TTL_MS      = 60 * 60 * 1000  // 1 hour

// ─────────────────────────────────────────────────────────────────────────────
// loadPaystackScript
// Loads the Paystack inline JS exactly once.
// ─────────────────────────────────────────────────────────────────────────────

const loadPaystackScript = () =>
  new Promise((resolve, reject) => {
    if (window.PaystackPop) { resolve(); return }

    const existing = document.querySelector('script[src="https://js.paystack.co/v1/inline.js"]')
    if (existing) {
      existing.addEventListener('load',  resolve)
      existing.addEventListener('error', reject)
      return
    }

    const script    = document.createElement('script')
    script.src      = 'https://js.paystack.co/v1/inline.js'
    script.onload   = resolve
    script.onerror  = () => reject(new Error('Could not load Paystack script'))
    document.head.appendChild(script)
  })


// ─────────────────────────────────────────────────────────────────────────────
// verifyPayment
// Calls the verify-payment edge function with retry on network failure.
// ─────────────────────────────────────────────────────────────────────────────

export const verifyPayment = async ({ reference, userId, packageSlug }, retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-payment`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ reference, userId, packageSlug }),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`HTTP ${response.status}: ${text}`)
      }

      const data = await response.json()
      return data

    } catch (err) {
      console.warn(`[verifyPayment] attempt ${attempt} failed:`, err.message)
      if (attempt === retries) {
        return { success: false, error: err.message || 'Network error during verification' }
      }
      // Wait before retry: 1s, 2s, 3s
      await new Promise((r) => setTimeout(r, attempt * 1000))
    }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// storePendingPayment / clearPendingPayment / getPendingPayment
// localStorage safety net — persists the reference before verification
// so AuthContext can retry on next app load if the request was killed mid-flight.
// ─────────────────────────────────────────────────────────────────────────────

export const storePendingPayment = (payload) => {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify({
      ...payload,
      timestamp: Date.now(),
    }))
  } catch (err) {
    console.warn('[storePendingPayment] localStorage write failed:', err.message)
  }
}

export const clearPendingPayment = () => {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {}
}

export const getPendingPayment = () => {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Expire after TTL
    if (Date.now() - parsed.timestamp > PENDING_TTL_MS) {
      clearPendingPayment()
      return null
    }
    return parsed
  } catch {
    return null
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// initializePayment
// Opens the Paystack popup, stores reference immediately on callback,
// then verifies with the edge function.
// ─────────────────────────────────────────────────────────────────────────────

export const initializePayment = async ({
  email,
  amountNgn,
  userId,
  packageSlug,
  credits,
  bonusCredits = 0,
  onSuccess,
  onClose,
}) => {
  if (!PAYSTACK_PUBLIC_KEY) throw new Error('Missing VITE_PAYSTACK_PUBLIC_KEY')

  await loadPaystackScript()

  const amountKobo = Math.round(amountNgn * 100)
  const reference  = `MECKURY_${Date.now()}_${Math.random().toString(36).slice(2, 11).toUpperCase()}`

  // Paystack callback must be a plain synchronous function
  function handleCallback(response) {
    const ref = response.reference

    // ── Store immediately before any async work ──
    // If the verification fetch gets killed mid-flight (mobile browser,
    // navigation, etc.), AuthContext will pick this up on next load.
    storePendingPayment({ reference: ref, userId, packageSlug })

    verifyPayment({ reference: ref, userId, packageSlug })
      .then((result) => {
        if (result?.success || result?.already_processed) {
          clearPendingPayment()
          onSuccess?.({
            reference:    ref,
            creditsAdded: result.credits_added ?? null,
            balanceAfter: result.balance_after  ?? null,
            alreadyProcessed: result.already_processed ?? false,
          })
        } else {
          console.error('[initializePayment] verification failed:', result?.error)
          // Don't clear pending — AuthContext will retry
          onSuccess?.({ error: result?.error || 'Verification failed' })
        }
      })
      .catch((err) => {
        console.error('[initializePayment] verification error:', err)
        // Don't clear pending — AuthContext will retry
      })
  }

  function handleClose() {
    onClose?.()
  }

  const handler = window.PaystackPop.setup({
    key:      PAYSTACK_PUBLIC_KEY,
    email,
    amount:   amountKobo,
    currency: 'NGN',
    ref:      reference,
    metadata: {
      custom_fields: [
        { display_name: 'User ID',       variable_name: 'user_id',       value: userId       },
        { display_name: 'Package',       variable_name: 'package_slug',  value: packageSlug  },
        { display_name: 'Credits',       variable_name: 'credits',       value: credits      },
        { display_name: 'Bonus Credits', variable_name: 'bonus_credits', value: bonusCredits },
      ],
    },
    callback: handleCallback,
    onClose:  handleClose,
  })

  handler.openIframe()
}
