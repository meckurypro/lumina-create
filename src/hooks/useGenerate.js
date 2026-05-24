// src/hooks/useGenerate.js
// ============================================================
// useGenerate — Full generation pipeline hook
// Routes through /api/generate (provider-agnostic).
// Supports both regular user credit deduction and staff pool.
// ============================================================

import { useState }            from 'react'
import { useAuth }             from '@/context/AuthContext'
import { generations as generationsDb, supabase } from '@/lib/supabase'
import { calculateCreditCost } from '@/lib/creditUtils'
import toast                   from 'react-hot-toast'

export const useGenerate = () => {
  const { user, profile, refreshProfile } = useAuth()

  const [status,       setStatus]       = useState('idle')
  const [progress,     setProgress]     = useState(null)
  const [result,       setResult]       = useState(null)
  const [generationId, setGenerationId] = useState(null)
  const [error,        setError]        = useState(null)

  const reset = () => {
    setStatus('idle')
    setProgress(null)
    setResult(null)
    setGenerationId(null)
    setError(null)
  }

  // ── Fetch active prompt from DB ─────────────────────────
  const getTemplatePrompt = async (templateSlug) => {
    const { data, error } = await supabase.rpc('get_active_prompt', {
      p_template_slug: templateSlug,
    })
    if (error || !data) throw new Error('Template prompt not found in database')
    return data
  }

  // ── Main generate function ──────────────────────────────
  const generate = async ({
    type,
    templateId,
    templateSlug,
    prompt,
    startFrame,         // already-uploaded URL (from TemplateRunner)
    endFrame,           // already-uploaded URL
    imageFrames,        // array of already-uploaded URLs
    _uploadedInputs,    // from TemplateRunner — pre-uploaded, keyed by field name
    aspectRatio   = '9:16',
    duration      = '5',
    model         = 'auto',
    shouldEnhance = true,
    isStaffGeneration = false,  // true → deduct from pool, not user credits
  }) => {
    if (!user) { toast.error('Please sign in to generate'); return null }

    const isStaff = isStaffGeneration ||
      profile?.is_staff === true     ||
      profile?.role === 'staff'      ||
      profile?.role === 'admin'

    // Local var — avoids stale state in catch block
    let localGenId = null

    try {
      reset()
      setStatus('uploading')

      // ── Resolve uploaded URLs ─────────────────────────
      // TemplateRunner pre-uploads and passes via _uploadedInputs
      const startFrameUrl = startFrame   || _uploadedInputs?.startFrame  || null
      const endFrameUrl   = endFrame     || _uploadedInputs?.endFrame    || null
      const imageUrls     = imageFrames  || _uploadedInputs?.imageFrames || []

      // ── Credit calculation ────────────────────────────
      const imageCount = imageUrls.length || 1
      const creditCost = calculateCreditCost(
        templateSlug ? `template_${templateSlug.replace(/-/g, '_')}` : type,
        { duration, imageCount }
      )

      // ── Create generation record ──────────────────────
      const { data: genRecord, error: genError } = await generationsDb.create({
        user_id:              user.id,
        template_id:          templateId            || null,
        generation_type:      type,
        status:               'pending',
        model:                model === 'auto' ? null : model,
        aspect_ratio:         aspectRatio,
        duration,
        credits_charged:      isStaff ? creditCost : creditCost,
        is_staff_generation:  isStaff,
      })

      if (genError) throw new Error('Failed to create generation record')

      localGenId = genRecord.id
      setGenerationId(genRecord.id)

      // ── Deduct credits ────────────────────────────────
      if (isStaff && type === 'template') {
        // Staff PromptIQ template → deduct from pool
        const { data: poolResult } = await supabase.rpc('deduct_staff_pool', {
          p_staff_id:      user.id,
          p_generation_id: genRecord.id,
          p_amount:        creditCost,
          p_template_id:   templateId || null,
        })
        if (!poolResult?.success) {
          throw new Error(poolResult?.error || 'Staff pool has insufficient credits')
        }
      } else {
        // Regular user (or staff using tools/public templates) → own credits
        const { data: deductResult } = await generationsDb.deductCredits(
          user.id,
          creditCost,
          genRecord.id
        )
        if (!deductResult?.success) {
          throw new Error(deductResult?.error || 'Insufficient credits')
        }
      }

      refreshProfile()

      // ── Update record with uploaded URLs ─────────────
      await generationsDb.update(genRecord.id, {
        start_frame_url:   startFrameUrl,
        end_frame_url:     endFrameUrl,
        input_image_urls:  imageUrls.length > 0 ? imageUrls : null,
        status:            'processing',
      })

      // ── Prompt resolution ─────────────────────────────
      setStatus('enhancing')

      let finalPrompt = prompt

      if (templateSlug) {
        // Always pull from DB — never hardcode
        finalPrompt = await getTemplatePrompt(templateSlug)
      } else if (shouldEnhance && prompt) {
        // Prompt enhancement is handled server-side in api/generate.js
        // We pass the raw prompt and let the server enhance it
        finalPrompt = prompt
      }

      await generationsDb.update(genRecord.id, {
        prompt:          prompt       || null,
        enhanced_prompt: finalPrompt  || null,
      })

      // ── Dispatch to /api/generate ─────────────────────
      setStatus('generating')

      const onProgress = (update) => setProgress(update)

      // Map type → action
      const actionMap = {
        text_to_image:   'text_to_image',
        image_to_image:  'image_to_image',
        text_to_video:   'text_to_video',
        image_to_video:  'image_to_video',
        start_end_frame: 'start_end_frame',
        end_frame_text:  'end_frame_text',
        template:        templateSlug
          ? `template_${templateSlug.replace(/-/g, '_')}`
          : 'start_end_frame',
      }

      const action = actionMap[type]
      if (!action) throw new Error(`Unknown generation type: ${type}`)

      // Build payload
      const payload = {
        action,
        prompt:        finalPrompt,
        imageUrl:      startFrameUrl,
        startFrameUrl,
        endFrameUrl,
        imageUrls:     imageUrls.length > 0 ? imageUrls : undefined,
        aspectRatio,
        duration,
        model:         model === 'auto' ? undefined : model,
      }

      const response = await fetch('/api/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `Generation API error ${response.status}`)
      }

      const generationResult = await response.json()

      if (!generationResult?.outputUrl) {
        throw new Error('No output URL returned from generation API')
      }

      // ── Mark completed ────────────────────────────────
      await generationsDb.update(genRecord.id, {
        status:      'completed',
        output_url:  generationResult.outputUrl,
        output_type: generationResult.outputType,
      })

      setResult(generationResult)
      setStatus('done')

      return { generationId: genRecord.id, ...generationResult }

    } catch (err) {
      setError(err.message)
      setStatus('error')

      toast.error(`${err.message || 'Generation failed'} — credits will be refunded automatically.`)

      // Mark failed — DB trigger auto-refunds credits
      if (localGenId) {
        await generationsDb.update(localGenId, {
          status:        'failed',
          error_message: err.message,
        })
      }

      return null
    }
  }

  return {
    generate,
    status,
    progress,
    result,
    generationId,
    error,
    reset,
    isLoading: ['uploading', 'enhancing', 'generating'].includes(status),
  }
}
