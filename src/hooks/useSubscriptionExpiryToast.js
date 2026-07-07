// src/hooks/useSubscriptionExpiryToast.js
//
// Fires a subtle, once-per-day toast when the user's render window access
// (individual OR team) is expiring within 3 days. Mount once, high in the
// tree — FeedPage, since it's the app's landing/login destination.
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { renderWindowSubscriptions } from '@/lib/supabase'
import { getMyTeamAsOwner, getMyTeamAsMember } from '@/lib/renderWindowTeam'

const SEEN_KEY_PREFIX = 'meckury_rw_expiry_toast_seen_'

function daysUntil(iso) {
  if (!iso) return null
  const diffMs = new Date(iso) - new Date()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

export function useSubscriptionExpiryToast() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    const run = async () => {
      const [subRes, ownerRes, memberRes] = await Promise.all([
        renderWindowSubscriptions.getActive(),
        getMyTeamAsOwner(user.id),
        getMyTeamAsMember(user.id),
      ])
      if (cancelled) return

      const candidates = [
        subRes?.data?.expires_at,
        ownerRes?.data?.team?.expires_at,
        memberRes?.data?.team?.expires_at,
      ].filter(Boolean)

      if (candidates.length === 0) return

      const soonest = candidates.reduce((a, b) => (new Date(a) < new Date(b) ? a : b))
      const days = daysUntil(soonest)
      if (days === null || days > 3 || days < 0) return

      const today   = new Date().toISOString().slice(0, 10)
      const seenKey = `${SEEN_KEY_PREFIX}${user.id}_${today}_${days}`
      if (localStorage.getItem(seenKey)) return
      localStorage.setItem(seenKey, '1')

      const label = days === 0 ? 'today' : days === 1 ? 'in 1 day' : `in ${days} days`
      toast(`Render Window access expires ${label}`, { icon: '🪟' })
    }

    run()
    return () => { cancelled = true }
  }, [user?.id])
}
