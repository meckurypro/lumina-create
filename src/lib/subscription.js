// Master subscription helper — opens Paystack and verifies via edge function.
import { initializePayment } from '@/lib/paystack'

export const MASTER_PRICE_NGN = 5000
export const MASTER_DAYS      = 30
export const MASTER_SLUG      = 'master_subscription'

/**
 * Launch Paystack to subscribe (or renew) the Master plan.
 * @param {{ user: { id: string, email: string }, onSuccess?: Function, onClose?: Function }} args
 */
export const subscribeToMaster = ({ user, onSuccess, onClose }) => {
  if (!user?.email || !user?.id) throw new Error('You must be signed in to subscribe.')
  return initializePayment({
    email:        user.email,
    amountNgn:    MASTER_PRICE_NGN,
    userId:       user.id,
    packageSlug:  MASTER_SLUG,
    credits:      0,
    bonusCredits: 0,
    onSuccess,
    onClose,
  })
}