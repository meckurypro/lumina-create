// src/lib/renderWindowBooking.js
//
// Data access for Render Window private bookings. Kept separate from
// lib/supabase.js so we don't need to touch that file's existing exports —
// same pattern as lib/renderWindowTeam.js.

import { supabase } from '@/lib/supabase'
import { initializePayment } from '@/lib/paystack'

// ── Booking durations (admin-configurable list of bookable lengths, each
// with its own flat per-model price — e.g. "30 minutes" → ₦3,000/model) ──
export const renderWindowBookingDurations = {
  // Public — active durations only, for the booking dropdown
  getActive: async () => {
    const { data, error } = await supabase
      .from('render_window_booking_durations')
      .select('id, label, minutes, price_ngn')
      .eq('is_active', true)
      .order('sort_order')
    return { data: data || [], error }
  },

  // Admin — full list including inactive, for the manager UI
  getAll: async () => {
    const { data, error } = await supabase
      .from('render_window_booking_durations')
      .select('*')
      .order('sort_order')
    return { data: data || [], error }
  },

  create: (payload) =>
    supabase.from('render_window_booking_durations').insert(payload).select().single(),

  update: (id, patch) =>
    supabase.from('render_window_booking_durations').update(patch).eq('id', id).select().single(),

  remove: (id) =>
    supabase.from('render_window_booking_durations').delete().eq('id', id),
}

// ── Booking coupons ────────────────────────────────────────────────────
// Percent or flat-₦ discounts applied to a booking's subtotal. Validation
// is re-run server-side at initialize-payment and again at verify-payment —
// this client-side `validate` call is purely for showing a live discounted
// total as the user types a code; it never itself grants the discount.
export const renderWindowBookingCoupons = {
  // Live preview — read-only, does not redeem anything.
  validate: (code, userId, subtotalNgn) =>
    supabase.rpc('validate_render_window_coupon', {
      p_code:         code,
      p_user_id:      userId,
      p_subtotal_ngn: subtotalNgn,
    }),

  // Admin — full list for the manager UI
  getAll: async () => {
    const { data, error } = await supabase
      .from('render_window_booking_coupons')
      .select('*')
      .order('created_at', { ascending: false })
    return { data: data || [], error }
  },

  create: (adminId, payload) =>
    supabase
      .from('render_window_booking_coupons')
      .insert({ ...payload, code: payload.code.toUpperCase(), created_by: adminId })
      .select()
      .single(),

  update: (id, patch) =>
    supabase
      .from('render_window_booking_coupons')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),

  remove: (id) =>
    supabase.from('render_window_booking_coupons').delete().eq('id', id),
}

// ── Bookable models — now derived automatically from render-window status.
// A model is bookable the moment an admin sets it to
// model_access_type = 'render_window' AND is_active = true. No separate
// per-model rate step; every bookable model shares the one global rate.
export const bookableModels = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('models')
      .select('id, label, value, feature, description, sublabel')
      .eq('model_access_type', 'render_window')
      .eq('is_active', true)
      .order('label')
    return { data: data || [], error }
  },
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
export async function bookRenderWindowSlot({ user, modelIds, startAt, durationId, whatsappNumber, couponCode }) {
  if (!user?.email) throw new Error('Sign in to book a session.')
  if (!modelIds?.length) throw new Error('Select at least one model.')
  if (!startAt) throw new Error('Pick a start time.')
  if (!durationId) throw new Error('Pick a duration.')

  // For a paid booking, initializePayment navigates the browser away and
  // this call never meaningfully resolves. For a free (100%-off) booking,
  // it resolves with { free: true, bookingId } instead.
  return await initializePayment({
    email:         user.email,
    userId:        user.id,
    packageSlug:   'render_window_booking',
    modelIds,
    startAt:       new Date(startAt).toISOString(),
    durationId,
    whatsappNumber: whatsappNumber || null,
    couponCode:     couponCode || null,
  })
}

// ── User resubmits a reset_pending booking with new models/time/duration ──
export const submitBookingReconfig = (userId, bookingId, modelIds, startAt, durationId) =>
  supabase.rpc('submit_booking_reconfig', {
    p_user_id:       userId,
    p_booking_id:    bookingId,
    p_model_ids:     modelIds,
    p_start_at:      new Date(startAt).toISOString(),
    p_duration_id:   durationId,
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
