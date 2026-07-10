import { supabase } from '@/lib/supabase'

// Render-window models must pass BOTH gates: canUseRWModels (subscription/window-open
// eligibility) AND actual attachment to the currently-live window's render_window_models
// rows — otherwise every RW-type model a user has preference-enabled leaks into the
// dropdown regardless of whether it's the model actually running right now.
export async function getActiveRenderWindowModelIds() {
  const { data: activeWindow } = await supabase
    .from('render_windows')
    .select('id')
    .eq('status', 'active')
    .maybeSingle()
  if (!activeWindow) return new Set()

  const { data: attached } = await supabase
    .from('render_window_models')
    .select('model_id')
    .eq('render_window_id', activeWindow.id)

  return new Set((attached || []).map((a) => a.model_id))
}
