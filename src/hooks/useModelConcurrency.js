// src/hooks/useModelConcurrency.js
//
// For render_window-access models only: tells the UI whether the current
// user may submit a new job for this model right now, or whether they
// already have one pending/processing (and should wait). Users with active
// private booking access for the model are always allowed (fire-and-forget).
//
// Usage:
//   const { blocked, reason, refresh } = useModelConcurrency(selectedModel)
//   ...
//   const generateDisabled = ...existing checks... || blocked

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { checkModelConcurrency } from '@/lib/renderWindowBooking'
import { supabase } from '@/lib/supabase'

const POLL_INTERVAL_MS = 8_000

export function useModelConcurrency(model) {
  const { user } = useAuth()
  const [blocked, setBlocked] = useState(false)
  const [reason,  setReason]  = useState(null)
  const [checked, setChecked] = useState(false)

  const pollRef = useRef(null)

  const isRenderWindowModel = model?.model_access_type === 'render_window'

  const refresh = useCallback(async () => {
    if (!user?.id || !model?.id || !isRenderWindowModel) {
      setBlocked(false)
      setReason(null)
      setChecked(true)
      return
    }
    const { data, error } = await checkModelConcurrency(user.id, model.id)
    if (error) {
      // Fail open — don't lock a user out of generating because the check
      // itself errored. The backend gate is the real enforcement point.
      setBlocked(false)
      setReason(null)
      setChecked(true)
      return
    }
    setBlocked(data?.allowed === false)
    setReason(data?.reason ?? null)
    setChecked(true)
  }, [user?.id, model?.id, isRenderWindowModel])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!isRenderWindowModel) return
    pollRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(pollRef.current)
  }, [isRenderWindowModel, refresh])

  // Also refresh instantly on realtime generation status changes for this
  // user, so the button unlocks the moment a job finishes rather than
  // waiting for the next poll tick.
  useEffect(() => {
    if (!user?.id || !isRenderWindowModel) return
    const channel = supabase
      .channel(`concurrency-${user.id}-${model.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'generations', filter: `user_id=eq.${user.id}`,
      }, () => refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, model?.id, isRenderWindowModel, refresh])

  return { blocked, reason, checked, refresh }
}
