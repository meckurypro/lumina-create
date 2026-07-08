// src/hooks/useRenderWindowCohort.js
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import {
  getMyCohortAsMember,
  getCohortSeatUsageToday,
  leaveCohort,
} from '@/lib/renderWindowCohort'

export function useRenderWindowCohort() {
  const { user } = useAuth()

  const [memberCohort, setMemberCohort] = useState(null) // { cohort, seat }
  const [usageToday,   setUsageToday]   = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [leaving,      setLeaving]      = useState(false)

  const refresh = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)

    const { data } = await getMyCohortAsMember(user.id)
    setMemberCohort(data)

    if (data) {
      const { data: used } = await getCohortSeatUsageToday(data.cohort.id, data.seat.seat_number)
      setUsageToday(used)
    } else {
      setUsageToday(0)
    }

    setLoading(false)
  }, [user?.id])

  useEffect(() => { refresh() }, [refresh])

  const leave = useCallback(async () => {
    if (!user?.id) return
    setLeaving(true)
    const { data, error } = await leaveCohort(user.id)
    setLeaving(false)
    if (error || !data?.success) {
      toast.error(data?.error || 'Could not leave cohort')
      return
    }
    toast.success('Left cohort')
    refresh()
  }, [user?.id, refresh])

  return {
    memberCohort,
    usageToday,
    loading,
    leaving,
    leave,
    refresh,
  }
}
