// src/lib/renderWindowTeam.js
//
// Data access for Render Window Team subscriptions. Kept separate from
// lib/supabase.js so we don't need to touch that file's existing exports.
import { supabase } from '@/lib/supabase'

// ── Team tier catalog (RW Sellers only — gated in the UI, not here) ──────
export const teamTiers = {
  getAll: () =>
    supabase
      .from('render_window_team_tiers')
      .select('*')
      .order('display_order'),
}

// ── Current user's team state — either owner or member ───────────────────
export async function getMyTeamAsOwner(userId) {
  const { data: team, error } = await supabase
    .from('render_window_teams')
    .select('*, tier:render_window_team_tiers(*)')
    .eq('owner_id', userId)
    .eq('status', 'active')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (error || !team) return { data: null, error }

  const { data: seats } = await supabase
    .from('render_window_team_seats')
    .select('*, member:profiles(id, username, display_name)')
    .eq('team_id', team.id)
    .order('seat_number')

  return { data: { team, seats: seats || [] }, error: null }
}

export async function getMyTeamAsMember(userId) {
  const { data: seat, error } = await supabase
    .from('render_window_team_seats')
    .select('*, team:render_window_teams(*, tier:render_window_team_tiers(*))')
    .eq('member_id', userId)
    .is('removed_at', null)
    .maybeSingle()

  if (error || !seat?.team) return { data: null, error }
  if (seat.team.status !== 'active' || new Date(seat.team.expires_at) <= new Date()) {
    return { data: null, error: null }
  }

  return { data: { team: seat.team, seat }, error: null }
}

export async function getSeatUsageToday(teamId, seatNumber) {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('render_window_team_seat_usage')
    .select('units_used')
    .eq('team_id', teamId)
    .eq('seat_number', seatNumber)
    .eq('usage_date', today)
    .maybeSingle()

  return { data: data?.units_used ?? 0, error }
}

export async function getTeamUsageToday(teamId) {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('render_window_team_seat_usage')
    .select('seat_number, units_used')
    .eq('team_id', teamId)
    .eq('usage_date', today)

  if (error) return { data: {}, error }
  const map = {}
  ;(data || []).forEach((row) => { map[row.seat_number] = row.units_used })
  return { data: map, error: null }
}

// ── Actions (all via SECURITY DEFINER RPCs) ──────────────────────────────
export const joinTeamByCode = (userId, inviteCode) =>
  supabase.rpc('join_render_window_team', {
    p_user_id:     userId,
    p_invite_code: inviteCode,
  })

export const removeTeamMember = (ownerId, teamId, seatNumber) =>
  supabase.rpc('remove_render_window_team_member', {
    p_owner_id:    ownerId,
    p_team_id:     teamId,
    p_seat_number: seatNumber,
  })

export const resetTeamCode = (ownerId, teamId) =>
  supabase.rpc('reset_render_window_team_code', {
    p_owner_id: ownerId,
    p_team_id:  teamId,
  })
