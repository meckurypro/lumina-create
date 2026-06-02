// src/pages/MediaPage.jsx
//
// Thin wrapper. All heavy lifting is in MediaPageCore.

import { useNavigate }                           from 'react-router-dom'
import { useAuth }                               from '@/context/AuthContext'
import { TopBar }                                from '@/components/layout/TopBar'
import { generations as generationsDb, supabase } from '@/lib/supabase'
import { Film }                                  from 'lucide-react'
import MediaPageCore                             from '@/components/media/MediaPageCore.jsx'
import { MediaEmptyState }                       from '@/components/media/MediaCardComponents.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────────

async function fetchGenerations(user, { limit, offset, afterIso, statusFilter }) {
  let query = supabase
    .from('generations')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (afterIso)                               query = query.gte('created_at', afterIso)
  if (statusFilter && statusFilter !== 'all') query = query.eq('status', statusFilter)

  const { data, count, error } = await query
  if (error) return { data: [], count: 0 }
  return { data: data || [], count: count || 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// filterRelevantModels  (for Regenerate)
// ─────────────────────────────────────────────────────────────────────────────

function filterRelevantModels(models, gen) {
  const isUGC            = gen.prompt_engineering_used && gen.input_image_urls?.length > 0
  const isMotionTransfer = gen.generation_type === 'motion_transfer'
  const isVideo          = [
    'text_to_video', 'image_to_video', 'start_end_frame',
    'end_frame_text', 'motion_transfer', 'template',
  ].includes(gen.generation_type)

  return models.filter((m) => {
    if (m.is_locked) return false
    if (isUGC)            return m.supports_multi_image === true
    if (isMotionTransfer) return m.type === 'video' && m.feature === 'motion_transfer'
    if (isVideo)          return m.type === 'video' && m.feature !== 'motion_transfer'
    return m.type === 'image'
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// filterEditModels  (for Edit — I2I capable image models only)
// ─────────────────────────────────────────────────────────────────────────────

function filterEditModels(models, gen) {
  // Edit always produces an image (output → I2I input).
  // Only surface unlocked image models that support image-to-image input.
  return models.filter(
    (m) => !m.is_locked && m.type === 'image' && m.supports_image === true
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCreditCost  (for Regenerate)
// ─────────────────────────────────────────────────────────────────────────────

function computeCreditCost(selectedModel, gen) {
  if (!selectedModel) return 0
  // If the original generation had any input image, treat as I2I
  const hadInputImage = !!(gen.input_image_urls?.length || gen.start_frame_url)
  return (hadInputImage ? selectedModel.credit_cost_i2i : selectedModel.credit_cost_t2i) || 0
}

// ─────────────────────────────────────────────────────────────────────────────
// computeEditCreditCost  (for Edit — always I2I since output becomes input)
// ─────────────────────────────────────────────────────────────────────────────

function computeEditCreditCost(selectedModel) {
  if (!selectedModel) return 0
  return selectedModel.credit_cost_i2i || 0
}

// ─────────────────────────────────────────────────────────────────────────────
// onRegenerate
//
// Now receives editedPrompt (5th positional arg) so the user's prompt
// changes in the sheet are honoured.
// The ORIGINAL INPUT images (input_image_urls / start_frame_url) are reused —
// NOT the generated output.
// ─────────────────────────────────────────────────────────────────────────────

async function onRegenerate(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
  supabase, user, generationsDb, refreshProfile, setItems, setTotalCount,
}) {
  const isVideo = [
    'text_to_video', 'image_to_video', 'start_end_frame',
    'end_frame_text', 'motion_transfer', 'template',
  ].includes(gen.generation_type)

  const { data: genRow, error: genErr } = await generationsDb.create({
    user_id:                user.id,
    generation_type:        gen.generation_type,
    status:                 'pending',
    // Use the (possibly edited) prompt from the sheet
    prompt:                 editedPrompt ?? gen.prompt,
    model:                  chosenModel,
    aspect_ratio:           gen.aspect_ratio,
    duration:               gen.duration,
    credits_charged:        creditCost,
    output_type:            gen.output_type,
    // Reuse the ORIGINAL INPUT images — never the generated output
    start_frame_url:        null,
    input_image_urls:       gen.input_image_urls?.length
                              ? gen.input_image_urls
                              : gen.start_frame_url
                                ? [gen.start_frame_url]
                                : null,
    end_frame_url:          gen.end_frame_url   || null,
    template_id:            gen.template_id     || null,
    skip_prompt_refinement: gen.skip_prompt_refinement ?? false,
  })
  if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

  const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
  if (dErr || !deduct?.success) {
    await generationsDb.update(genRow.id, {
      status: 'failed', error_message: deduct?.error || 'Insufficient credits',
    })
    throw new Error(deduct?.error || 'Not enough credits')
  }

  const fnName = isVideo ? 'video-generate' : 'image-generate'
  supabase.functions.invoke(fnName, { body: { generationId: genRow.id } })
    .catch((e) => console.error(`${fnName} invoke error`, e))

  setItems((prev) => [genRow, ...prev])
  setTotalCount((c) => c + 1)
  refreshProfile()
}

// ─────────────────────────────────────────────────────────────────────────────
// onEdit
//
// Takes the GENERATED OUTPUT (gen.output_url) as the new start_frame_url,
// fires an image-to-image generation with the user's (possibly edited) prompt.
// ─────────────────────────────────────────────────────────────────────────────

async function onEdit(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
  supabase, user, generationsDb, refreshProfile, setItems, setTotalCount,
}) {
  if (!gen.output_url) throw new Error('No output URL to edit from')

  const { data: genRow, error: genErr } = await generationsDb.create({
    user_id:                user.id,
    generation_type:        'image_to_image',
    status:                 'pending',
    prompt:                 editedPrompt ?? gen.prompt,
    model:                  chosenModel,
    aspect_ratio:           gen.aspect_ratio,
    credits_charged:        creditCost,
    output_type:            'image',
    // The generated output becomes the new input
    start_frame_url:        gen.output_url,
    input_image_urls:       [gen.output_url],
    skip_prompt_refinement: true,
  })
  if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

  const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
  if (dErr || !deduct?.success) {
    await generationsDb.update(genRow.id, {
      status: 'failed', error_message: deduct?.error || 'Insufficient credits',
    })
    throw new Error(deduct?.error || 'Not enough credits')
  }

  supabase.functions.invoke('image-generate', { body: { generationId: genRow.id } })
    .catch((e) => console.error('image-generate invoke error', e))

  setItems((prev) => [genRow, ...prev])
  setTotalCount((c) => c + 1)
  refreshProfile()
}

// ─────────────────────────────────────────────────────────────────────────────
// MediaPage
// ─────────────────────────────────────────────────────────────────────────────

export default function MediaPage() {
  const { profile, credits } = useAuth()
  const isNovice = profile?.user_tier === 'novice'

  const headerSlot = ({ totalCount }) => (
    <>
      <TopBar showLogo showCredits />
      <div className="mx-auto w-full max-w-xl px-4 lg:px-0 pt-5 pb-1">
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Media</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {totalCount} generation{totalCount !== 1 ? 's' : ''}
        </p>
      </div>
    </>
  )

  const emptySlot = ({ timeFilter, statusFilter, setTimeFilter, setStatusFilter }) => (
    <MediaEmptyState
      icon={Film}
      title={
        timeFilter !== 'all' || statusFilter !== 'all'
          ? 'Nothing matches these filters'
          : 'No creations yet'
      }
      description={
        timeFilter !== 'all'
          ? 'Try a wider time range.'
          : statusFilter !== 'all'
            ? 'Switch to All to see everything.'
            : 'Start creating something.'
      }
      action={
        (timeFilter !== 'all' || statusFilter !== 'all') ? (
          <div className="flex gap-2">
            {timeFilter !== 'all' && (
              <button
                onClick={() => setTimeFilter('all')}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              >
                Show All Time
              </button>
            )}
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              >
                Show All Status
              </button>
            )}
          </div>
        ) : null
      }
    />
  )

  return (
    <MediaPageCore
      fetcher={fetchGenerations}
      onRegenerate={onRegenerate}
      filterRelevantModels={filterRelevantModels}
      computeCreditCost={computeCreditCost}
      onCardClick={(gen, navigate) => {
        if (gen.status === 'completed') navigate(`/result/${gen.id}`)
      }}
      // Edit flow
      filterEditModels={filterEditModels}
      computeEditCreditCost={computeEditCreditCost}
      onEdit={onEdit}
      headerSlot={headerSlot}
      emptySlot={emptySlot}
      isNovice={isNovice}
      allowGridView={false}
    />
  )
}
