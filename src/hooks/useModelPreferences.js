// src/hooks/useModelPreferences.js
import { supabase } from '@/lib/supabase'

/**
 * Given a raw models array and the current user id,
 * returns the list filtered by the user's model preferences.
 * - Models with no preference row default to active (shown).
 * - Required models are never hidden regardless of preference.
 */
export async function applyModelPreferences(models, userId) {
  if (!userId || !models.length) return models

  const { data: prefs } = await supabase
    .from('user_model_preferences')
    .select('model_id, is_active')
    .eq('user_id', userId)
    .cache('no-store')

  if (!prefs || !prefs.length) return models

  const prefMap = {}
  prefs.forEach((p) => { prefMap[p.model_id] = p.is_active })

  return models.filter((m) => {
    // Required models are never hidden
    if (m.is_required) return true
    // No preference row = default active
    if (prefMap[m.id] === undefined) return true
    return prefMap[m.id]
  })
}
