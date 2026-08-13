// src/hooks/useModelPreferences.js
import { supabase } from '@/lib/supabase'

export async function applyModelPreferences(models, userId) {
  if (!userId || !models.length) return models

  const { data: prefs, error } = await supabase
    .from('user_model_preferences')
    .select('model_id, is_active')
    .eq('user_id', userId)

  // No rows at all = user predates the prefs system → show everything
  if (error || !prefs || !prefs.length) return models

  const prefMap = {}
  prefs.forEach((p) => { prefMap[p.model_id] = p.is_active })

  return models.filter((m) => {
    if (m.is_required) return true          // always show required
    if (prefMap[m.id] === undefined) return true   // no explicit pref yet = show by default
    return prefMap[m.id]                    // respect explicit preference
  })
}
