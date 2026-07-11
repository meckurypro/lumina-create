// src/hooks/useRenderWindowBooking.js
import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import {
  getMyBookings,
  bookRenderWindowSlot,
  submitBookingReconfig,
} from '@/lib/renderWindowBooking'

const POLL_INTERVAL_MS = 30_000

export function useRenderWindowBooking() {
  const { user } = useAuth()
  const [bookings,    setBookings]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [booking,     setBookingBusy] = useState(false)
  const [now,         setNow]         = useState(() => new Date())
  const pollRef = useRef(null)
  const tickRef = useRef(null)

  const refresh = useCallback(async () => {
    if (!user?.id) { setLoading(false); return }
    const { data, error } = await getMyBookings(user.id)
    if (error) console.error('[useRenderWindowBooking] refresh error:', error)
    setBookings(data)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    setLoading(true)
    refresh()
  }, [user?.id, refresh])

  useEffect(() => {
    if (!user?.id) return
    pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [user?.id, refresh])

  // 1s ticker for the countdown display
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tickRef.current)
  }, [])

const book = useCallback(async ({ modelIds, startAt, durationId, whatsappNumber, couponCode }) => {
    setBookingBusy(true)
    try {
      const result = await bookRenderWindowSlot({ user, modelIds, startAt, durationId, whatsappNumber, couponCode })
      if (result?.free) {
        toast.success('Your free booking is confirmed — awaiting admin approval.')
        setBookingBusy(false)
        refresh()
      }
      // Otherwise the browser is already navigating to Paystack.
    } catch (e) {
      toast.error(e.message || 'Could not start booking payment')
      setBookingBusy(false)
    }
  }, [user, refresh])
  const reconfigure = useCallback(async (bookingId, { modelIds, startAt, durationId }) => {
    if (!user?.id) return
    const { data, error } = await submitBookingReconfig(user.id, bookingId, modelIds, startAt, durationId)
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || 'Could not save your new booking time')
      return false
    }
    toast.success('Booking updated — awaiting admin confirmation')
    refresh()
    return true
  }, [user?.id, refresh])

  // ── Derived state ──────────────────────────────────────────────────────
  // A booking is "active" (live) only once its start time has actually
  // arrived — accepted-but-not-yet-started bookings must NOT count as
  // active just because they haven't ended yet.
  const activeBookings = bookings.filter(
    (b) => b.status === 'accepted' &&
      new Date(b.requested_start_at) <= now &&
      new Date(b.ends_at) > now
  )

  const upcomingBooking = bookings
    .filter((b) => b.status === 'accepted' && new Date(b.requested_start_at) > now)
    .sort((a, b) => new Date(a.requested_start_at) - new Date(b.requested_start_at))[0] ?? null

  const pendingBookings      = bookings.filter((b) => b.status === 'pending')
  const resetPendingBookings = bookings.filter((b) => b.status === 'reset_pending')

  const countdownMs = upcomingBooking
    ? new Date(upcomingBooking.requested_start_at).getTime() - now.getTime()
    : null

  return {
    bookings,
    loading,
    booking,
    activeBookings,
    upcomingBooking,
    pendingBookings,
    resetPendingBookings,
    countdownMs,
    book,
    reconfigure,
    refresh,
  }
}
