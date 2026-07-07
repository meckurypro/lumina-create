// src/lib/paystack.js
//
// Paystack REDIRECT flow (no iframe / no PaystackPop).
//
//   1. initializePayment → calls `initialize-payment` edge function
//      which creates the transaction server-side and returns
//      authorization_url. We store a `meckury_pending_payment`
//      localStorage record and redirect the browser.
//   2. Paystack redirects back to /payment/callback?reference=...
//   3. PaymentCallbackPage reads ref + localStorage and calls
//      verifyPayment(). The verify-payment edge function is
//      idempotent so the parallel webhook is safe.
//   4. AuthContext re-runs verifyPayment as a safety net if the
//      user lands anywhere with a pending_payment record (≤1h TTL).

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const PENDING_KEY    = 'meckury_pending_payment'
const PENDING_TTL_MS = 60 * 60 * 1000  // 1 hour

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
// initializePayment — REDIRECT flow
// Server-side creates the transaction, then we navigate to the hosted page.
// ─────────────────────────────────────────────────────────────────────────────

export const initializePayment = async ({ email, userId, packageSlug, tier, teamTierId }) => {
  if (!email || !userId || !packageSlug) throw new Error('email, userId, packageSlug required')

  const callbackUrl = `${window.location.origin}/payment/callback`

  const res = await fetch(`${SUPABASE_URL}/functions/v1/initialize-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email, userId, packageSlug, callbackUrl, tier, teamTierId }),
  })

  let data
  try { data = await res.json() } catch { data = null }
  if (!res.ok || !data?.success || !data?.authorization_url) {
    throw new Error(data?.error || `initialize-payment failed (HTTP ${res.status})`)
  }

  // Persist intent before navigating away — safety net for AuthContext retry.
  storePendingPayment({ reference: data.reference, userId, packageSlug, tier, teamTierId })

  window.location.href = data.authorization_url
  // No return; the browser is leaving.
}
