// src/lib/activeModels.js
import { supabase } from '@/lib/supabase'

// Returns [] for ineligible users (not an error) — see RPC comment for
// exactly which access types count as eligible.
export async function getActiveModelsIfEligible(userId) {
  const { data, error } = await supabase.rpc('get_active_models_if_eligible', {
    p_user_id: userId,
  })
  return { data: data || [], error }
}
