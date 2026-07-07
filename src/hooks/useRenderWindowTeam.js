// src/hooks/useRenderWindowTeam.js
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import {
  teamTiers,
  getMyTeamAsOwner,
  getMyTeamAsMember,
  getSeatUsageToday,
  getTeamUsageToday,
  joinTeamByCode,
  removeTeamMember,
  resetTeamCode,
} from '@/lib/renderWindowTeam'
import { initializePayment } from '@/lib/paystack'

export function useRenderWindowTeam() {
  const { user, profile } = useAuth()
  const isRwSeller = !!profile?.is_rw_seller

  const [tiers,        setTiers]        = useState([])
  const [ownerTeam,    setOwnerTeam]    = useState(null)   // { team, seats }
  const [memberTeam,   setMemberTeam]   = useState(null)   // { team, seat }
  const [usageToday,   setUsageToday]   = useState(0)
  const [seatUsageMap, setSeatUsageMap] = useState({})
  const [loading,      setLoading]      = useState(true)
  const [joining,      setJoining]      = useState(false)
  const [purchasing,   setPurchasing]   = useState(false)
  const [busySeat,     setBusySeat]     = useState(null)
  const [resetting,    setResetting]    = useState(false)

  const refresh = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)

    const [ownerRes, memberRes] = await Promise.all([
      getMyTeamAsOwner(user.id),
      getMyTeamAsMember(user.id),
    ])

    setOwnerTeam(ownerRes.data)
    setMemberTeam(memberRes.data)

    if (ownerRes.data) {
      const { data: usageMap } = await getTeamUsageToday(ownerRes.data.team.id)
      setSeatUsageMap(usageMap || {})
    } else {
      setSeatUsageMap({})
    }

    if (memberRes.data) {
      const { data: used } = await getSeatUsageToday(
        memberRes.data.team.id,
        memberRes.data.seat.seat_number,
      )
      setUsageToday(used)
    } else {
      setUsageToday(0)
    }

    if (isRwSeller) {
      const { data } = await teamTiers.getAll()
      setTiers((data || []).filter((t) => t.is_active).sort((a, b) => a.display_order - b.display_order))
    }

    setLoading(false)
  }, [user?.id, isRwSeller])

  useEffect(() => { refresh() }, [refresh])

  const purchase = useCallback(async (teamTierId) => {
    if (!user?.email) { toast.error('Sign in to subscribe.'); return }
    setPurchasing(true)
    try {
      await initializePayment({
        email:       user.email,
        userId:      user.id,
        packageSlug: 'render_window_team_subscription',
        teamTierId,
      })
      // Browser navigates away to Paystack — no further state to set.
    } catch (e) {
      toast.error(e.message || 'Could not start payment')
      setPurchasing(false)
    }
  }, [user])

  const joinByCode = useCallback(async (code) => {
    if (!user?.id) return
    if (!code?.trim()) { toast.error('Enter a team code'); return }
    setJoining(true)
    const { data, error } = await joinTeamByCode(user.id, code.trim())
    setJoining(false)
    if (error || !data?.success) {
      toast.error(data?.error || 'Could not join team')
      return
    }
    toast.success(`Joined team — seat #${data.seat_number}`)
    refresh()
  }, [user?.id, refresh])

  const removeMember = useCallback(async (seatNumber) => {
    if (!user?.id || !ownerTeam?.team?.id) return
    setBusySeat(seatNumber)
    const { data, error } = await removeTeamMember(user.id, ownerTeam.team.id, seatNumber)
    setBusySeat(null)
    if (error || !data?.success) {
      toast.error(data?.error || 'Could not remove member')
      return
    }
    toast.success(`Seat #${seatNumber} freed`)
    refresh()
  }, [user?.id, ownerTeam?.team?.id, refresh])

  const resetCode = useCallback(async () => {
    if (!user?.id || !ownerTeam?.team?.id) return
    setResetting(true)
    const { data, error } = await resetTeamCode(user.id, ownerTeam.team.id)
    setResetting(false)
    if (error || !data?.success) {
      toast.error(data?.error || 'Could not reset code')
      return
    }
    toast.success('Team code reset')
    refresh()
  }, [user?.id, ownerTeam?.team?.id, refresh])

  return {
    isRwSeller,
    tiers,
    ownerTeam,
    memberTeam,
    usageToday,
    seatUsageMap,
    loading,
    purchasing,
    joining,
    busySeat,
    resetting,
    purchase,
    joinByCode,
    removeMember,
    resetCode,
    refresh,
  }
}
