// src/lib/subscription.js
//
// Subscription helpers for Master and Render Window plans.
// Both use the same Paystack redirect flow.

import { initializePayment } from '@/lib/paystack'

// ── Master ────────────────────────────────────────────────────────────────
export const MASTER_PRICE_NGN = 5000
export const MASTER_DAYS      = 30
export const MASTER_SLUG      = 'master_subscription'

export const subscribeToMaster = ({ user }) => {
  if (!user?.email || !user?.id) throw new Error('You must be signed in to subscribe.')
  return initializePayment({
    email:       user.email,
    userId:      user.id,
    packageSlug: MASTER_SLUG,
  })
}

// ── Render Window ─────────────────────────────────────────────────────────
// Price is admin-configurable in app_settings — we read it from the DB
// before redirecting so the UI can show the correct price.
export const RW_SLUG = 'render_window_subscription'

export const subscribeToRenderWindow = ({ user }) => {
  if (!user?.email || !user?.id) throw new Error('You must be signed in to subscribe.')
  return initializePayment({
    email:       user.email,
    userId:      user.id,
    packageSlug: RW_SLUG,
  })
}
