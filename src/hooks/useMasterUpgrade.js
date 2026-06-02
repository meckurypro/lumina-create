import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { subscribeToMaster, MASTER_PRICE_NGN } from '@/lib/subscription'

/**
 * useMasterUpgrade — single source of truth for the "Upgrade to Master" flow.
 * Returns { upgrade, loading, price }.
 */
export const useMasterUpgrade = () => {
  const { user, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)

  const upgrade = useCallback(async () => {
    if (!user?.email) { toast.error('Sign in to upgrade.'); return }
    setLoading(true)
    try {
      await subscribeToMaster({
        user,
        onSuccess: async (res) => {
          if (res?.error) toast.error(res.error)
          else {
            toast.success('Welcome to Master ⭐')
            await refreshProfile()
          }
          setLoading(false)
        },
        onClose: () => setLoading(false),
      })
    } catch (e) {
      toast.error(e.message || 'Could not start payment')
      setLoading(false)
    }
  }, [user, refreshProfile])

  return { upgrade, loading, price: MASTER_PRICE_NGN }
}