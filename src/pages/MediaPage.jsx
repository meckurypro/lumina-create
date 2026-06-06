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
  return models.filter(
    (m) => !m.is_locked && m.type === 'image' && m.supports_image === true
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCreditCost  (for Regenerate)
// ─────────────────────────────────────────────────────────────────────────────

function computeCreditCost(selectedModel, gen) {
  if (!selectedModel) return 0
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
    prompt:                 editedPrompt ?? gen.prompt,
    model:                  chosenModel,
    aspect_ratio:           gen.aspect_ratio,
    duration:               gen.duration,
    credits_charged:        creditCost,
    output_type:            gen.output_type,
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
  const { profile, credits }     = useAuth()
  const isNovice                 = profile?.user_tier === 'novice'
  const [activeTab, setActiveTab] = useState('generations')

  const headerSlot = ({ totalCount }) => (
    <>
      <TopBar showLogo showCredits />
      <div className="mx-auto w-full max-w-xl px-4 lg:px-0 pt-5 pb-1">
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Media</h1>

        {/* Tab switcher */}
        <div className="flex gap-1 mt-3 mb-1 p-1 rounded-2xl w-fit" style={{ background: 'var(--bg-elevated)' }}>
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
            {totalCount} generation{totalCount !== 1 ? 's' : ''}
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
    // Outer wrapper needed so AssetsPage (which is not inside MediaPageCore)
    // can share the same full-height layout.
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header is always rendered; it owns the tab switcher */}
      <div className="flex-shrink-0">
        {headerSlot({ totalCount: 0 })}
      </div>

      {activeTab === 'generations' ? (
        // MediaPageCore renders its own flex column with overflow-y-auto.
        // We re-use it as a flex child here, so we need it to fill remaining space.
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <MediaPageCoreInner
            isNovice={isNovice}
            emptySlot={emptySlot}
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
//
// Thin shim: MediaPageCore renders its own h-dvh wrapper which conflicts
// when nested. We pass a no-op headerSlot so the outer header is the one
// that renders, and MediaPageCore just renders its content + sheets.
// ─────────────────────────────────────────────────────────────────────────────

function MediaPageCoreInner({ isNovice, emptySlot }) {
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
      // No headerSlot — header already rendered above
      headerSlot={null}
      emptySlot={emptySlot}
      isNovice={isNovice}
      allowGridView={false}
    />
  )
}
