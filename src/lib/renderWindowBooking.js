// src/lib/renderWindowBooking.js
//
// Data access for Render Window private bookings. Kept separate from
// lib/supabase.js so we don't need to touch that file's existing exports —
// same pattern as lib/renderWindowTeam.js.

import { supabase } from '@/lib/supabase'
import { initializePayment } from '@/lib/paystack'

const GLOBAL_RATE_SETTING_KEY = 'render_window_booking_hourly_rate_ngn'

// ── Global booking rate (single Naira/hr rate applied to every bookable
// render-window model) ──────────────────────────────────────────────────
export const renderWindowBookingSettings = {
  getRate: async () => {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', GLOBAL_RATE_SETTING_KEY)
      .maybeSingle()
    if (error) return { rate: null, error }
    return { rate: data?.value != null ? Number(data.value) : null, error: null }
  },

  setRate: (adminId, rateNgn) =>
    supabase
      .from('app_settings')
      .upsert(
        {
          key:         GLOBAL_RATE_SETTING_KEY,
          value:       String(rateNgn),
          description: 'Global hourly rate (NGN) charged for private render-window bookings',
          updated_by:  adminId,
          updated_at:  new Date().toISOString(),
        },
        { onConflict: 'key' }
      ),
}

// ── Bookable models — now derived automatically from render-window status.
// A model is bookable the moment an admin sets it to
// model_access_type = 'render_window' AND is_active = true. No separate
// per-model rate step; every bookable model shares the one global rate.
export const bookableModels = {
  getAll: async () => {
    const [{ data: models, error: modelsError }, { rate, error: rateError }] = await Promise.all([
      supabase
        .from('models')
        .select('id, label, value, feature, description, sublabel')
        .eq('model_access_type', 'render_window')
        .eq('is_active', true)
        .order('label'),
      renderWindowBookingSettings.getRate(),
    ])

    if (modelsError) return { data: [], error: modelsError }

    // Shape preserved as `booking_hourly_rate_ngn` so PrivateBookingPage's
    // BookingForm (which reads that field per model) needs no changes.
    const data = (models || []).map((m) => ({ ...m, booking_hourly_rate_ngn: rate }))
    return { data, error: rateError || null }
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
