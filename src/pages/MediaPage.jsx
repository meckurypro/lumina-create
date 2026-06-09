// src/pages/MediaPage.jsx
//
// Thin wrapper. All heavy lifting is in MediaPageCore (generations)
// and AssetsPage (user uploads).

import { useState }                              from 'react'
import { useNavigate }                           from 'react-router-dom'
import { useAuth }                               from '@/context/AuthContext'
import { TopBar }                                from '@/components/layout/TopBar'
import { generations as generationsDb, supabase } from '@/lib/supabase'
import { Film }                                  from 'lucide-react'
import MediaPageCore                             from '@/components/media/MediaPageCore.jsx'
import { MediaEmptyState }                       from '@/components/media/MediaCardComponents.jsx'
import AssetsPage                                from '@/components/media/AssetsPage.jsx'

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { value: 'generations', label: 'Generations' },
  { value: 'assets',      label: 'Assets'      },
]

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────────

// Narrow column list — avoids pulling every JSONB/long-text column for every
// row. `select('*')` was the single biggest cause of slow Media page loads
// (the generations table has 38 columns, many large).
const GEN_LIST_COLUMNS = [
  'id', 'user_id', 'status', 'created_at',
  'output_url', 'output_thumbnail_url', 'output_type',
  'prompt', 'model', 'credits_charged', 'error_message',
  'generation_type', 'aspect_ratio', 'duration',
  'input_image_urls', 'start_frame_url', 'end_frame_url',
  'template_id', 'with_sound', 'skip_prompt_refinement',
  'provider_request_id', 'original_prompt', 'is_smart_edit',
  'prompt_engineering_used', 'generation_metadata',
  'title', 'resolution',
].join(', ')

async function fetchGenerations(user, { limit, offset, afterIso, statusFilter }) {
  let query = supabase
    .from('generations')
    .select(GEN_LIST_COLUMNS, { count: 'exact' })
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
//
// Routes model filtering by generation_type — the source of truth.
// This ensures lipsync never shows image/video models, motion_transfer
// never shows lipsync models, etc.
// ─────────────────────────────────────────────────────────────────────────────

function filterRelevantModels(models, gen) {
  const type = gen.generation_type

  return models.filter((m) => {
    if (m.is_locked) return false

    // Lipsync — only lipsync feature models (same as CreateTalkingHeadPage)
    if (type === 'lipsync') {
      return m.feature === 'lipsync'
    }

    // Motion transfer — only motion_transfer feature models
    if (type === 'motion_transfer') {
      return m.type === 'video' && m.feature === 'motion_transfer'
    }

    // UGC (multi-image generations) — only multi-image capable models
    const isUGC = gen.prompt_engineering_used && gen.input_image_urls?.length > 0
    if (isUGC) return m.supports_multi_image === true

    // Video types — video models, excluding motion_transfer feature
    const isVideo = [
      'text_to_video', 'image_to_video', 'start_end_frame',
      'end_frame_text', 'template',
    ].includes(type)
    if (isVideo) return m.type === 'video' && m.feature !== 'motion_transfer'

    // Image types (text_to_image, image_to_image)
    return m.type === 'image'
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// filterEditModels  (for Edit — I2I capable image models only)
// ─────────────────────────────────────────────────────────────────────────────

function filterEditModels(models, gen) {
  return models.filter(
    (m) => !m.is_locked && m.type === 'image' && m.supports_image === true
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCreditCost  (for Regenerate)
//
// Each generation_type has its own credit logic matching the create page.
// ─────────────────────────────────────────────────────────────────────────────

function computeCreditCost(selectedModel, gen) {
  if (!selectedModel) return 0

  // Lipsync: flat-rate or base × duration — mirrors CreateTalkingHeadPage
  if (gen.generation_type === 'lipsync') {
    const base = selectedModel.credit_cost_i2i || selectedModel.credit_cost_t2i || 0
    if (selectedModel.is_flat_rate) return base
    return Math.ceil(base * parseInt(gen.duration || '5', 10))
  }

  // Motion transfer: always I2I cost × duration multiplier
  if (gen.generation_type === 'motion_transfer') {
    const base = selectedModel.credit_cost_i2i || 0
    const dur  = parseInt(gen.duration || '5', 10)
    const multiplier = (() => {
      if (dur <= 5)  return 1
      if (dur <= 8)  return 1.6
      if (dur <= 10) return 2
      if (dur <= 12) return 2.4
      if (dur <= 15) return 3
      if (dur <= 20) return 4
      if (dur <= 30) return 6
      return Math.ceil(dur / 5)
    })()
    return Math.ceil(base * multiplier)
  }

  // Video types: per-second pricing
  const isVideo = [
    'text_to_video', 'image_to_video', 'start_end_frame',
    'end_frame_text', 'template',
  ].includes(gen.generation_type)
  if (isVideo) {
    const hadInput = !!(gen.input_image_urls?.length || gen.start_frame_url || gen.end_frame_url)
    const base     = (hadInput ? selectedModel.credit_cost_i2i : selectedModel.credit_cost_t2i) || 0
    if (selectedModel.is_flat_rate) return base
    return Math.ceil(base * parseInt(gen.duration || '5', 10))
  }

  // Image types
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
// Routes the edge function call by generation_type — never guesses based
// on output_type. Lipsync → talking-head-generate, video → video-generate,
// image → image-generate.
// ─────────────────────────────────────────────────────────────────────────────

async function onRegenerate(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
  supabase, user, generationsDb, refreshProfile, setItems, setTotalCount,
}) {
  const type      = gen.generation_type
  const isLipsync = type === 'lipsync'
  const isVideo   = [
    'text_to_video', 'image_to_video', 'start_end_frame',
    'end_frame_text', 'motion_transfer', 'template',
  ].includes(type)

  const { data: genRow, error: genErr } = await generationsDb.create({
    user_id:                user.id,
    generation_type:        type,
    status:                 'pending',
    prompt:                 editedPrompt ?? gen.prompt,
    model:                  chosenModel,
    aspect_ratio:           gen.aspect_ratio,
    duration:               gen.duration,
    credits_charged:        creditCost,
    output_type:            gen.output_type,
    // Preserve all original inputs verbatim — regeneration replays exactly
    start_frame_url:        gen.start_frame_url  || null,
    end_frame_url:          gen.end_frame_url     || null,
    input_image_urls:       gen.input_image_urls?.length
                              ? gen.input_image_urls
                              : gen.start_frame_url
                                ? [gen.start_frame_url]
                                : null,
    template_id:            gen.template_id      || null,
    with_sound:             gen.with_sound        ?? false,
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

  // Route to the correct edge function — strictly by generation_type
  const fnName = isLipsync ? 'talking-head-generate'
               : isVideo   ? 'video-generate'
               :              'image-generate'

  // For lipsync: pass regenFromId so the edge function can reconstruct
  // the original meta (audio URLs, subject mode, etc.) from the source row.
  const body = isLipsync
    ? { generationId: genRow.id, meta: { lipsync: true, regenFromId: gen.id } }
    : { generationId: genRow.id }

  supabase.functions.invoke(fnName, { body })
    .catch((e) => console.error(`${fnName} invoke error`, e))

  setItems((prev) => [genRow, ...prev])
  setTotalCount((c) => c + 1)
  refreshProfile()
}

// ─────────────────────────────────────────────────────────────────────────────
// onEdit
// ─────────────────────────────────────────────────────────────────────────────

async function onEdit(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
  supabase, user, generationsDb, refreshProfile, setItems, setTotalCount,
}) {
  if (!gen.output_url) throw new Error('No output URL to edit from')

  const originalInputUrl = gen.input_image_urls?.[0] || gen.start_frame_url || null
  const inputImages = originalInputUrl
    ? [gen.output_url, originalInputUrl]
    : [gen.output_url]

  const { data: genRow, error: genErr } = await generationsDb.create({
    user_id:                user.id,
    generation_type:        'image_to_image',
    status:                 'pending',
    prompt:                 editedPrompt ?? gen.prompt,
    model:                  chosenModel,
    aspect_ratio:           gen.aspect_ratio,
    credits_charged:        creditCost,
    output_type:            'image',
    start_frame_url:        gen.output_url,
    input_image_urls:       inputImages,
    original_prompt:        gen.prompt || null,
    skip_prompt_refinement: false,
    is_smart_edit:          true,
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
  const { profile }               = useAuth()
  const isNovice                  = profile?.user_tier === 'novice'
  const [activeTab, setActiveTab] = useState('generations')

  // FIX: totalCount is now real state, updated by MediaPageCore via
  // onTotalCountChange, then passed into headerSlot for display.
  const [totalCount, setTotalCount] = useState(0)

  const headerSlot = ({ totalCount: count }) => (
    <>
      <TopBar showLogo showCredits />
      <div className="mx-auto w-full max-w-xl px-4 lg:px-0 pt-5 pb-1">
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Media</h1>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-3 mb-1 p-1 rounded-2xl w-fit ml-auto" style={{ background: 'var(--bg-elevated)' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className="px-4 py-1.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: isActive ? 'var(--bg-primary)' : 'transparent',
                  color:      isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow:  isActive ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Sub-heading */}
        {activeTab === 'generations' && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {count} generation{count !== 1 ? 's' : ''}
          </p>
        )}
        {activeTab === 'assets' && (
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Your uploaded images & videos
          </p>
        )}
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
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header renders with live totalCount from state */}
      <div className="flex-shrink-0">
        {headerSlot({ totalCount })}
      </div>

      {activeTab === 'generations' ? (
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <MediaPageCoreInner
            isNovice={isNovice}
            emptySlot={emptySlot}
            onTotalCountChange={setTotalCount}
          />
        </div>
      ) : (
        <AssetsPage />
      )}

    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MediaPageCoreInner
// ─────────────────────────────────────────────────────────────────────────────

function MediaPageCoreInner({ isNovice, emptySlot, onTotalCountChange }) {
  return (
    <MediaPageCore
      fetcher={fetchGenerations}
      onRegenerate={onRegenerate}
      filterRelevantModels={filterRelevantModels}
      computeCreditCost={computeCreditCost}
      onCardClick={(gen, navigate) => {
        if (gen.status === 'completed') navigate(`/result/${gen.id}`)
      }}
      filterEditModels={filterEditModels}
      computeEditCreditCost={computeEditCreditCost}
      onEdit={onEdit}
      headerSlot={null}
      emptySlot={emptySlot}
      isNovice={isNovice}
      allowGridView={false}
      onTotalCountChange={onTotalCountChange}
    />
  )
}
