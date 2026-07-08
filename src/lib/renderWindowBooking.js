// src/lib/renderWindowBooking.js
//
// Data access for Render Window private bookings. Kept separate from
// lib/supabase.js so we don't need to touch that file's existing exports —
// same pattern as lib/renderWindowTeam.js.

import { supabase } from '@/lib/supabase'
import { initializePayment } from '@/lib/paystack'

// ── Bookable models (admin has set an hourly rate) ────────────────────────
export const bookableModels = {
  getAll: () =>
    supabase
      .from('models')
      .select('id, label, value, feature, booking_hourly_rate_ngn')
      .not('booking_hourly_rate_ngn', 'is', null)
      .eq('is_active', true)
      .order('label'),
}

// ── Current user's bookings ────────────────────────────────────────────────
export async function getMyBookings(userId) {
  const { data, error } = await supabase
    .from('render_window_bookings')
    .select(`
      id, status, requested_start_at, duration_hours, ends_at,
      amount_ngn, whatsapp_number, admin_notes, created_at,
      accepted_at, cancelled_at,
      models:render_window_booking_models(model_id, hourly_rate_ngn, model:models(id, label, value))
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { data: data || [], error }
}

// ── Start a booking checkout — mirrors subscribeToRenderWindow's pattern ──
export async function bookRenderWindowSlot({ user, modelIds, startAt, durationHours, whatsappNumber }) {
  if (!user?.email) throw new Error('Sign in to book a session.')
  if (!modelIds?.length) throw new Error('Select at least one model.')
  if (!startAt) throw new Error('Pick a start time.')
  if (!durationHours || durationHours <= 0) throw new Error('Pick a duration.')

  await initializePayment({
    email:         user.email,
    userId:        user.id,
    packageSlug:   'render_window_booking',
    modelIds,
    startAt:       new Date(startAt).toISOString(),
    durationHours,
    whatsappNumber: whatsappNumber || null,
  })
  // Browser navigates away to Paystack — no further state to set.
}

// ── User resubmits a reset_pending booking with new models/time/duration ──
export const submitBookingReconfig = (userId, bookingId, modelIds, startAt, durationHours) =>
  supabase.rpc('submit_booking_reconfig', {
    p_user_id:        userId,
    p_booking_id:     bookingId,
    p_model_ids:      modelIds,
    p_start_at:       new Date(startAt).toISOString(),
    p_duration_hours: durationHours,
  })

// ── Admin: list all bookings ───────────────────────────────────────────────
export async function adminGetBookings({ status } = {}) {
  let query = supabase
    .from('render_window_bookings')
    .select(`
      id, status, requested_start_at, duration_hours, ends_at,
      amount_ngn, whatsapp_number, admin_notes, created_at,
      accepted_at, cancelled_at,
      user:profiles!render_window_bookings_user_id_fkey(id, username, display_name),
      models:render_window_booking_models(model_id, hourly_rate_ngn, model:models(id, label, value))
    `)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error } = await query
  return { data: data || [], error }
}

// ── Admin actions ───────────────────────────────────────────────────────────
export const adminAcceptBooking = (adminId, bookingId) =>
  supabase.rpc('admin_accept_booking', { p_admin_id: adminId, p_booking_id: bookingId })

export const adminCancelBooking = (adminId, bookingId, notes) =>
  supabase.rpc('admin_cancel_booking', { p_admin_id: adminId, p_booking_id: bookingId, p_notes: notes || null })

export const adminResetBooking = (adminId, bookingId, notes) =>
  supabase.rpc('admin_reset_booking', { p_admin_id: adminId, p_booking_id: bookingId, p_notes: notes || null })

// Note: "Reschedule" from the plain-language spec is implemented as a Reset
// with a note — the user (or admin, verbally) then picks a new time via the
// same reconfig flow, keeping one code path for both "reset" and
// "reschedule" instead of two near-identical ones.

// ── Concurrency check (used by Create* pages before allowing Generate) ────
export const checkModelConcurrency = (userId, modelId) =>
  supabase.rpc('check_render_window_concurrency', { p_user_id: userId, p_model_id: modelId })
