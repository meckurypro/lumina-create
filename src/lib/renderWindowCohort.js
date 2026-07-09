// src/lib/renderWindowCohort.js
//
// Mirrors the shape of src/lib/renderWindowTeam.js so the two feel
// consistent to work with. All functions return { data, error }.
import { supabase } from '@/lib/supabase'

// ── Member-facing ───────────────────────────────────────────────────────

export async function getMyCohortAsMember(userId) {
  const { data, error } = await supabase.rpc('get_my_cohort_as_member', {
    p_user_id: userId,
  })
  return { data: data ?? null, error }
}

export async function getCohortSeatUsageToday(cohortId, seatNumber) {
  const { data, error } = await supabase.rpc('get_cohort_seat_usage_today', {
    p_cohort_id:   cohortId,
    p_seat_number: seatNumber,
  })
  return { data: data ?? 0, error }
}

export async function leaveCohort(userId) {
  const { data, error } = await supabase.rpc('leave_cohort', {
    p_user_id: userId,
  })
  return { data, error }
}

// Unified — tries Team code, then Cohort code. Use this from the shared
// "Have a code?" input on the Render Window page instead of calling
// joinTeamByCode directly.
export async function joinRenderWindowCode(userId, code) {
  const { data, error } = await supabase.rpc('join_render_window_code', {
    p_user_id: userId,
    p_code:    code,
  })
  return { data, error }
}

// ── Admin-facing ─────────────────────────────────────────────────────────

export const cohortAdmin = {
  async getAll() {
    const { data, error } = await supabase
      .from('render_window_cohorts')
      .select('*')
      .order('created_at', { ascending: false })
    return { data: data || [], error }
  },

  async getSeats(cohortId) {
    const { data, error } = await supabase
      .from('render_window_cohort_seats')
      .select('*, member:profiles(username)')
      .eq('cohort_id', cohortId)
      .order('seat_number')
    return { data: data || [], error }
  },

  async getSeatUsageMap(cohortId) {
    const { data, error } = await supabase
      .from('render_window_cohort_seat_usage')
      .select('seat_number, units_used')
      .eq('cohort_id', cohortId)
      .eq('usage_date', new Date().toISOString().slice(0, 10))
    if (error) return { data: {}, error }
    const map = {}
    for (const row of data) map[row.seat_number] = row.units_used
    return { data: map, error: null }
  },

  async create(adminId, { name, cohortCode, seatCount, dailyUnitQuota, durationDays }) {
    const { data, error } = await supabase.rpc('admin_create_cohort', {
      p_admin_id:         adminId,
      p_name:             name,
      p_cohort_code:      cohortCode,
      p_seat_count:       seatCount,
      p_daily_unit_quota: dailyUnitQuota,
      p_duration_days:    durationDays,
    })
    return { data, error }
  },

  async update(adminId, cohortId, updates) {
    const { data, error } = await supabase.rpc('admin_update_cohort', {
      p_admin_id:         adminId,
      p_cohort_id:        cohortId,
      p_name:             updates.name ?? null,
      p_daily_unit_quota: updates.dailyUnitQuota ?? null,
      p_ends_at:          updates.endsAt ?? null,
      p_add_seats:        updates.addSeats ?? null,
      p_status:           updates.status ?? null,
    })
    return { data, error }
  },

 async removeMember(adminId, cohortId, seatNumber) {
    const { data, error } = await supabase.rpc('admin_remove_cohort_member', {
      p_admin_id:    adminId,
      p_cohort_id:   cohortId,
      p_seat_number: seatNumber,
    })
    return { data, error }
  },
  async searchUsers(query) {
    const { data, error } = await supabase.rpc('admin_search_users', {
      p_query: query,
    })
    return { data: data || [], error }
  },
  async addMember(adminId, cohortId, userId) {
    const { data, error } = await supabase.rpc('admin_add_cohort_member', {
      p_admin_id:  adminId,
      p_cohort_id: cohortId,
      p_user_id:   userId,
    })
    return { data, error }
  },
}
