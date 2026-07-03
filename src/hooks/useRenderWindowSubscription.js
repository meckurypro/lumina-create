// src/hooks/useRenderWindowSubscription.js
//
// Provides render window subscription state (across all tiers) and the
// subscribe action. Polls the active window every 60s so the UI stays in
// sync without requiring a page reload when a window opens or closes.

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { renderWindows, renderWindowSubscriptions, renderWindowTiers } from '@/lib/supabase'
import { subscribeToRenderWindow } from '@/lib/subscription'

const POLL_INTERVAL_MS = 60_000  // 60 seconds

export const useRenderWindowSubscription = () => {
  const { user } = useAuth()

  const [activeSub,      setActiveSub]      = useState(null)   // rw_subscription row | null
  const [activeWindow,   setActiveWindow]   = useState(null)   // render_windows row | null
  const [tiers,          setTiers]          = useState([])     // render_window_tiers rows
  const [loading,        setLoading]        = useState(true)
  const [subscribing,    setSubscribing]    = useState(false)

  const pollRef = useRef(null)

  // ── Fetch all tiers (active + inactive) for display ─────────────────────
  const fetchTiers = useCallback(async () => {
    try {
      const { data } = await renderWindowTiers.getAll()
      setTiers(data || [])
    } catch {
      // Non-fatal — tier list falls back to empty
    }
  }, [])

  // ── Fetch subscription + active window ─────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user?.id) return

    try {
      const [subRes, windowRes] = await Promise.all([
        renderWindowSubscriptions.getActive(),
        renderWindows.getActive(),
      ])
      setActiveSub(subRes.data    ?? null)
      setActiveWindow(windowRes.data ?? null)
    } catch (err) {
      console.error('[useRenderWindowSubscription] refresh error:', err)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    fetchTiers()
    refresh()
  }, [user?.id, fetchTiers, refresh])

  // ── Poll every 60s to catch window open/close without reload ───────────
  useEffect(() => {
    if (!user?.id) return
    pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [user?.id, refresh])

  // ── Subscribe action — tierName is 'daily' | 'weekly' | 'monthly' ───────
  const subscribe = useCallback(async (tierName) => {
    if (!user?.email) { toast.error('Sign in to subscribe.'); return }
    if (!tierName)    { toast.error('Select a plan first.'); return }
    setSubscribing(true)
    try {
      await subscribeToRenderWindow({ user, tier: tierName })
      // Browser navigates away to Paystack — no further state to set.
    } catch (e) {
      toast.error(e.message || 'Could not start payment')
      setSubscribing(false)
    }
  }, [user])

  // ── Derived state ───────────────────────────────────────────────────────
  const hasActiveSub   = !!activeSub && new Date(activeSub.expires_at) > new Date()
  const windowIsOpen   = !!activeWindow
  const canUseRWModels = hasActiveSub && windowIsOpen

  const activeTier = hasActiveSub
    ? tiers.find((t) => t.id === activeSub.tier_id) ?? null
    : null

  const visibleTiers = tiers
    .slice()
    .sort((a, b) => a.display_order - b.display_order)

  const minutesRemaining = activeSub
    ? Math.max(0, Math.floor((new Date(activeSub.expires_at) - new Date()) / 60000))
    : null

  const hoursRemaining = minutesRemaining !== null
    ? (minutesRemaining / 60).toFixed(1)
    : null

  return {
    activeSub,
    activeWindow,
    activeTier,
    tiers:          visibleTiers,
    loading,
    subscribing,
    hasActiveSub,
    windowIsOpen,
    canUseRWModels,
    minutesRemaining,
    hoursRemaining,
    subscribe,
    refresh,
  }
}
