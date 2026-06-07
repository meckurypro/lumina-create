// Master subscription helper — kicks off the Paystack redirect flow.
// The browser navigates away to Paystack's hosted page, then comes
// back to /payment/callback for verification.
import { initializePayment } from '@/lib/paystack'

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