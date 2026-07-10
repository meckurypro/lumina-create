import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

// General "can this user use render-window models for free right now" check —
// covers individual sub, team seat, AND cohort seat (matches
// check_render_window_access RPC, unlike canUseRWModels which is sub-only).
export function useRenderWindowEligibility() {
  const { user } = useAuth()
  const [eligible, setEligible] = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    supabase.rpc('check_render_window_access', { p_user_id: user.id })
      .then(({ data }) => setEligible(!!data?.allowed))
      .finally(() => setLoading(false))
  }, [user?.id])

  return { eligible, loading }
}
