// src/hooks/useRenderWindowSubscription.js
//
// Provides render window subscription state and the subscribe action.
// Polls the active window every 60s so the UI stays in sync without
// requiring a page reload when a window opens or closes.

import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { renderWindows, renderWindowSubscriptions } from '@/lib/supabase'
import { subscribeToRenderWindow } from '@/lib/subscription'

const POLL_INTERVAL_MS = 60_000  // 60 seconds

export const useRenderWindowSubscription = () => {
  const { user } = useAuth()

  const [activeSub,      setActiveSub]      = useState(null)   // rw_subscription row | null
  const [activeWindow,   setActiveWindow]   = useState(null)   // render_windows row | null
  const [rwPrice,        setRwPrice]        = useState(null)   // number | null
  const [loading,        setLoading]        = useState(true)
  const [subscribing,    setSubscribing]    = useState(false)

  const pollRef = useRef(null)

  // ── Fetch price from app_settings via a simple select ──────────────────
  // We read it client-side only for display purposes.
  // The actual amount charged is always validated server-side.
  const fetchPrice = useCallback(async () => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'render_window_price_ngn')
        .single()
      if (data?.value) setRwPrice(Number(data.value))
    } catch {
      // Non-fatal — price display falls back to null
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
    fetchPrice()
    refresh()
  }, [user?.id, fetchPrice, refresh])

  // ── Poll every 60s to catch window open/close without reload ───────────
  useEffect(() => {
    if (!user?.id) return
    pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [user?.id, refresh])

  // ── Subscribe action ────────────────────────────────────────────────────
  const subscribe = useCallback(async () => {
    if (!user?.email) { toast.error('Sign in to subscribe.'); return }
    setSubscribing(true)
    try {
      await subscribeToRenderWindow({ user })
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

  const minutesRemaining = activeSub
    ? Math.max(0, Math.floor((new Date(activeSub.expires_at) - new Date()) / 60000))
    : null

  const hoursRemaining = minutesRemaining !== null
    ? (minutesRemaining / 60).toFixed(1)
    : null

  return {
    activeSub,
    activeWindow,
    rwPrice,
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
