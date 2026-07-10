import { supabase } from '@/lib/supabase'

// Pre-submission failures (bad ComfyUI endpoint, low AI balance, unconfigured
// workflow, missing required inputs) complete in well under a second — see
// generation_time_ms on failed rows (~300-320ms observed). This polls briefly
// right after invoke so the frontend can show the real error instead of an
// optimistic "generating" toast that turns out false. If the row is still
// pending/processing after the window, we assume it's legitimately in flight
// and let the normal "check your Media page" flow take over — this is NOT a
// full generation-completion poll. The 3000ms/600ms defaults are a guess
// based on the two observed failure timings, not an empirically-derived spec.
export async function watchForEarlyFailure(generationId, { timeoutMs = 3000, intervalMs = 600 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const { data, error } = await supabase
      .from('generations')
      .select('status, error_message')
      .eq('id', generationId)
      .maybeSingle()

    if (error) {
      // Transient read error — keep polling rather than throwing.
      await new Promise((r) => setTimeout(r, intervalMs))
      continue
    }

    if (data?.status === 'failed') {
      return { failed: true, message: data.error_message || 'Generation failed. Please try again.' }
    }
    if (data?.status && data.status !== 'pending') {
      // moved to processing (or beyond) within the window — treat as healthy
      return { failed: false }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return { failed: false }
}
