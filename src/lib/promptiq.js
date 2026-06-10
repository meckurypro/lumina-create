// src/lib/promptiq.js
//
// Supabase helpers for PromptIQ access control.
// Tables: promptiq_tools (registry), promptiq_staff_access (per-staff grants)

import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// TOOL REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export const promptiqTools = {

  /** Get all active tools (admin view — includes inactive if showAll=true) */
  async getAll(showAll = false) {
    let q = supabase
      .from('promptiq_tools')
      .select('*')
      .order('sort_order', { ascending: true })
    if (!showAll) q = q.eq('is_active', true)
    return q
  },

  /** Create a tool entry */
  async create(payload) {
    return supabase
      .from('promptiq_tools')
      .insert(payload)
      .select()
      .single()
  },

  /** Update a tool entry */
  async update(id, payload) {
    return supabase
      .from('promptiq_tools')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
  },

  /**
   * Sync promptiq-visibility templates into promptiq_tools.
   * Call this after creating/updating templates in the admin panel.
   * Safe to call repeatedly — uses ON CONFLICT DO UPDATE.
   */
  async syncTemplateTools() {
    const { data: templates, error } = await supabase
      .from('templates')
      .select('slug, name, description')
      .eq('visibility', 'promptiq')
      .eq('is_active', true)

    if (error || !templates?.length) return { error }

    const rows = templates.map((t, i) => ({
      tool_type:    'template',
      identifier:   t.slug,
      display_name: t.name,
      description:  t.description || null,
      sort_order:   100 + i, // templates sort after built-in tools
    }))

    return supabase
      .from('promptiq_tools')
      .upsert(rows, { onConflict: 'identifier' })
      .select()
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// STAFF ACCESS
// ─────────────────────────────────────────────────────────────────────────────

export const promptiqAccess = {

  /**
   * Get full access map for the calling staff user.
   * Returns: { [identifier]: { has_access, is_free, tool_type, display_name } }
   * Uses RPC so it works within RLS (staff can only read their own row).
   */
  async getMyAccess(staffId) {
    const { data, error } = await supabase
      .rpc('get_staff_all_tool_access', { p_staff_id: staffId })
    return { data: data || {}, error }
  },

  /**
   * Get access for a single tool for the calling staff user.
   * Returns: { has_access, is_free }
   */
  async getMyToolAccess(staffId, toolIdentifier) {
    const { data, error } = await supabase
      .rpc('get_staff_tool_access', {
        p_staff_id:        staffId,
        p_tool_identifier: toolIdentifier,
      })
    return { data: data || { has_access: false, is_free: false }, error }
  },

  /**
   * Admin: get access grants for a specific staff member.
   * Returns array joined with tool details.
   */
  async getForStaff(staffId) {
    return supabase
      .from('promptiq_tools')
      .select(`
        id,
        identifier,
        display_name,
        description,
        tool_type,
        sort_order,
        is_active,
        promptiq_staff_access!left (
          id,
          has_access,
          is_free,
          granted_by,
          updated_at
        )
      `)
      .eq('is_active', true)
      .eq('promptiq_staff_access.staff_id', staffId)
      .order('sort_order', { ascending: true })
  },

  /**
   * Admin: upsert a single tool access grant for a staff member.
   */
  async adminSetAccess(adminId, staffId, toolIdentifier, hasAccess, isFree) {
    const { data, error } = await supabase.rpc('admin_set_staff_tool_access', {
      p_admin_id:        adminId,
      p_staff_id:        staffId,
      p_tool_identifier: toolIdentifier,
      p_has_access:      hasAccess,
      p_is_free:         isFree,
    })
    return { data, error }
  },

  /**
   * Admin: bulk upsert access for a staff member.
   * grants: [{ identifier, has_access, is_free }]
   */
  async adminBulkSetAccess(adminId, staffId, grants) {
    const results = await Promise.allSettled(
      grants.map(({ identifier, has_access, is_free }) =>
        promptiqAccess.adminSetAccess(adminId, staffId, identifier, has_access, is_free)
      )
    )
    const failed = results.filter(r => r.status === 'rejected' || r.value?.data?.success === false)
    return { success: failed.length === 0, failedCount: failed.length }
  },
}
