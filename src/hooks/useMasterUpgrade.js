import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { subscribeToMaster, MASTER_PRICE_NGN } from '@/lib/subscription'

/**
 * useMasterUpgrade — kicks off the redirect flow to Paystack.
 * `loading` stays true until the browser navigates away.
 */
export const useMasterUpgrade = () => {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)

  const upgrade = useCallback(async () => {
    if (!user?.email) { toast.error('Sign in to upgrade.'); return }
    setLoading(true)
    try {
      await subscribeToMaster({ user })
      // Browser is leaving — no further state to set.
    } catch (e) {
      toast.error(e.message || 'Could not start payment')
      setLoading(false)
    }
  }, [user])

  return { upgrade, loading, price: MASTER_PRICE_NGN }
}