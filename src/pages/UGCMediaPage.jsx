// src/pages/UGCMediaPage.jsx
//
// Thin wrapper. All heavy lifting is in MediaPageCore.

import { useState, useEffect }                        from 'react'
import { useNavigate, useParams }                     from 'react-router-dom'
import { motion, AnimatePresence }                    from 'framer-motion'
import {
  ArrowLeft, Zap, User, Sparkles,
  Grid2X2, List,
}                                                     from 'lucide-react'
import { useAuth }                                    from '@/context/AuthContext'
import { ugcProfiles, ugcGenerations }                from '@/lib/ugc'
import { supabase, generations as generationsDb }     from '@/lib/supabase'
import toast                                          from 'react-hot-toast'
import MediaPageCore                                  from '@/components/media/MediaPageCore.jsx'
import { MediaEmptyState, Lightbox }                  from '@/components/media/MediaCardComponents.jsx'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

// ─────────────────────────────────────────────────────────────────────────────
// Fetcher
// ─────────────────────────────────────────────────────────────────────────────

function makeFetcher(profileId) {
  return async function fetchUGCGenerations(user, { limit, offset, afterIso, statusFilter }) {
    let query = supabase
      .from('ugc_generations')
      .select(
        `
        id,
        output_type,
        filter_applied,
        scene_prompt,
        aspect_ratio,
        created_at,
        generation:generations (
          id, status, output_url, output_thumbnail_url, output_type,
          prompt, model, credits_charged, aspect_ratio, duration,
          created_at, updated_at, error_message, input_image_urls,
          generation_type, skip_prompt_refinement, prompt_engineering_used,
          provider_request_id
        )
        `,
        { count: 'exact' }
      )
      .eq('ugc_profile_id', profileId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (afterIso) query = query.gte('created_at', afterIso)

    const { data, error, count } = await query
    if (error) return { data: [], count: 0 }

    let flat = (data || [])
      .filter((r) => r.generation)
      .map((r) => ({
        ...r.generation,
        ugc_generation_id:  r.id,
        ugc_scene_prompt:   r.scene_prompt,
        ugc_filter_applied: r.filter_applied,
        ugc_aspect_ratio:   r.aspect_ratio,
      }))

    if (statusFilter && statusFilter !== 'all') {
      flat = flat.filter((g) => g.status === statusFilter)
    }

    return { data: flat, count: count || 0 }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// filterRelevantModels  (for Regenerate — multi-image only)
// ─────────────────────────────────────────────────────────────────────────────

function filterRelevantModels(models /*, gen */) {
  return models.filter((m) => !m.is_locked && m.supports_multi_image === true)
}

// ─────────────────────────────────────────────────────────────────────────────
// filterEditModels  (for Edit — I2I capable image models)
// ─────────────────────────────────────────────────────────────────────────────

function filterEditModels(models, gen) {
  // UGC edit: allow multi-image models that also support regular image input,
  // plus regular I2I image models.
  return models.filter(
    (m) => !m.is_locked && m.type === 'image' && m.supports_image === true
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// computeCreditCost  (for Regenerate)
// ─────────────────────────────────────────────────────────────────────────────

function computeCreditCost(selectedModel, gen) {
  if (!selectedModel) return 0
  const isVideo = gen.output_type === 'video'
  return (selectedModel.credit_cost_t2i || 0) * (isVideo ? parseInt(gen.duration || 5) : 1)
}

// ─────────────────────────────────────────────────────────────────────────────
// computeEditCreditCost  (for Edit — always I2I)
// ─────────────────────────────────────────────────────────────────────────────

function computeEditCreditCost(selectedModel) {
  if (!selectedModel) return 0
  return selectedModel.credit_cost_i2i || 0
}

// ─────────────────────────────────────────────────────────────────────────────
// onRegenerate
//
// Now receives editedPrompt (5th positional arg).
// Reuses original INPUT images (input_image_urls), NOT the generated output.
// ─────────────────────────────────────────────────────────────────────────────

function makeOnRegenerate(profileId) {
  return async function onRegenerate(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
    supabase, user, generationsDb, refreshProfile, setItems, setTotalCount,
  }) {
    const isVideo = gen.output_type === 'video'

    const { data: genRow, error: genErr } = await generationsDb.create({
      user_id:                user.id,
      generation_type:        isVideo ? 'text_to_video' : 'text_to_image',
      status:                 'pending',
      // Use edited prompt from sheet, fall back to stored prompt
      prompt:                 editedPrompt ?? gen.prompt,
      model:                  chosenModel,
      aspect_ratio:           gen.aspect_ratio,
      duration:               isVideo ? gen.duration : undefined,
      credits_charged:        creditCost,
      output_type:            gen.output_type,
      // Reuse ORIGINAL input images — never the generated output
      input_image_urls:       gen.input_image_urls?.length ? gen.input_image_urls : null,
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

    await ugcGenerations.create({
      generation_id:   genRow.id,
      ugc_profile_id:  profileId,
      user_id:         user.id,
      output_type:     gen.output_type,
      filter_applied:  gen.ugc_filter_applied || 'hyper_realistic',
      // Store the edited prompt as scene_prompt so it shows correctly in the list
      scene_prompt:    editedPrompt ?? gen.ugc_scene_prompt ?? gen.prompt ?? '',
      refined_prompt:  null,
      selected_photos: [],
      aspect_ratio:    gen.aspect_ratio || '9:16',
    })

    const fnName = isVideo ? 'video-generate' : 'image-generate'
    supabase.functions.invoke(fnName, { body: { generationId: genRow.id } })
      .catch((e) => console.error(`${fnName} invoke error`, e))

    const optimistic = {
      ...genRow,
      ugc_generation_id:  null,
      ugc_scene_prompt:   editedPrompt ?? gen.ugc_scene_prompt ?? gen.prompt ?? '',
      ugc_filter_applied: gen.ugc_filter_applied || 'hyper_realistic',
      ugc_aspect_ratio:   gen.aspect_ratio || '9:16',
    }
    setItems((prev) => [optimistic, ...prev])
    setTotalCount((c) => c + 1)
    refreshProfile()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// onEdit
//
// Uses the generated OUTPUT as the new I2I input.
// Also writes a ugc_generations row to keep the UGC history consistent.
// ─────────────────────────────────────────────────────────────────────────────

function makeOnEdit(profileId) {
  return async function onEdit(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
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
      // Generated output → new input
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

    await ugcGenerations.create({
      generation_id:   genRow.id,
      ugc_profile_id:  profileId,
      user_id:         user.id,
      output_type:     'image',
      filter_applied:  gen.ugc_filter_applied || 'hyper_realistic',
      scene_prompt:    editedPrompt ?? gen.ugc_scene_prompt ?? gen.prompt ?? '',
      refined_prompt:  null,
      selected_photos: [],
      aspect_ratio:    gen.aspect_ratio || '9:16',
    })

    supabase.functions.invoke('image-generate', { body: { generationId: genRow.id } })
      .catch((e) => console.error('image-generate invoke error', e))

    const optimistic = {
      ...genRow,
      ugc_generation_id:  null,
      ugc_scene_prompt:   editedPrompt ?? gen.ugc_scene_prompt ?? gen.prompt ?? '',
      ugc_filter_applied: gen.ugc_filter_applied || 'hyper_realistic',
      ugc_aspect_ratio:   gen.aspect_ratio || '9:16',
    }
    setItems((prev) => [optimistic, ...prev])
    setTotalCount((c) => c + 1)
    refreshProfile()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UGCMediaPage
// ─────────────────────────────────────────────────────────────────────────────

export default function UGCMediaPage() {
  const { profileId }                              = useParams()
  const navigate                                   = useNavigate()
  const { profile: authProfile, credits }          = useAuth()
  const isNovice = authProfile?.user_tier === 'novice'

  const [profile,        setProfile]        = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [lightboxGen,    setLightboxGen]    = useState(null)
  const [totalCount,     setTotalCount]     = useState(0)

  useEffect(() => {
    ;(async () => {
      setProfileLoading(true)
      const { data, error } = await ugcProfiles.getById(profileId)
      if (error || !data) {
        toast.error('Character not found')
        navigate('/create/ugc')
        return
      }
      setProfile(data)
      setProfileLoading(false)
    })()
  }, [profileId, navigate])

  // Stable injections (created once outside render)
  const fetcher      = makeFetcher(profileId)
  const onRegenerate = makeOnRegenerate(profileId)
  const onEdit       = makeOnEdit(profileId)

  if (profileLoading) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
        />
      </div>
    )
  }

  // ── Slots ────────────────────────────────────────────────────────────────

  const headerSlot = ({ viewMode, setViewMode, allowGridView, totalCount: tc, credits: cr }) => (
    <div
      className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
      style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
    >
      <button
        onClick={() => navigate(`/create/ugc/${profileId}`)}
        className="p-2 -ml-2 rounded-xl"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={20} />
      </button>

      <button
        onClick={() => navigate(`/create/ugc/${profileId}`)}
        className="flex items-center gap-2.5"
      >
        {profile?.thumbnail_url ? (
          <img
            src={profile.thumbnail_url}
            alt={profile.name}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
            style={{ border: `2px solid ${ACCENT_BDR}` }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: ACCENT_SUB, border: `2px solid ${ACCENT_BDR}` }}
          >
            <User size={14} style={{ color: ACCENT }} />
          </div>
        )}
        <div className="flex flex-col items-start">
          <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>
            {profile?.name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            <Sparkles size={9} style={{ color: ACCENT }} />
            <p className="text-xs" style={{ color: ACCENT }}>
              {tc} generation{tc !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-2">
        {allowGridView && (
          <button
            onClick={() => setViewMode((v) => v === 'list' ? 'grid' : 'list')}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            {viewMode === 'list' ? <Grid2X2 size={15} /> : <List size={15} />}
          </button>
        )}
        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
          {Math.floor(cr)}
        </div>
      </div>
    </div>
  )

  const footerSlot = () => (
    <div
      className="px-4 lg:px-8 py-4"
      style={{ borderTop: `1px solid ${ACCENT_BDR}` }}
    >
      <div className="mx-auto w-full max-w-xl">
        <button
          onClick={() => navigate(`/create/ugc/${profileId}`)}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#ffffff' }}
        >
          <Zap size={15} fill="currentColor" />
          Generate New
        </button>
      </div>
    </div>
  )

  const emptySlot = ({ timeFilter, statusFilter, setTimeFilter, setStatusFilter }) => (
    <MediaEmptyState
      icon={Sparkles}
      title={
        timeFilter !== 'all' || statusFilter !== 'all'
          ? 'Nothing matches these filters'
          : `No generations yet`
      }
      description={
        timeFilter !== 'all'
          ? 'Try a wider time range.'
          : statusFilter !== 'all'
            ? 'Switch to All to see everything.'
            : `Create your first image or video featuring ${profile?.name}.`
      }
      accentColor={ACCENT}
      accentSubtle={ACCENT_SUB}
      accentBorder={ACCENT_BDR}
      action={
        timeFilter !== 'all' || statusFilter !== 'all' ? (
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
        ) : (
          <button
            onClick={() => navigate(`/create/ugc/${profileId}`)}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: ACCENT, color: '#ffffff' }}
          >
            <Zap size={15} fill="currentColor" />
            Generate
          </button>
        )
      }
    />
  )

  return (
    <>
      <MediaPageCore
        fetcher={fetcher}
        onRegenerate={onRegenerate}
        filterRelevantModels={filterRelevantModels}
        computeCreditCost={computeCreditCost}
        onCardClick={(gen) => {
          if (gen.status === 'completed') setLightboxGen(gen)
        }}
        // Edit flow
        filterEditModels={filterEditModels}
        computeEditCreditCost={computeEditCreditCost}
        onEdit={onEdit}
        headerSlot={headerSlot}
        footerSlot={footerSlot}
        emptySlot={emptySlot}
        accentColor={ACCENT}
        accentSubtle={ACCENT_SUB}
        accentBorder={ACCENT_BDR}
        extraStatusFilters={[
          { label: 'All',      value: 'all'   },
          { label: '📱 Image', value: 'image' },
          { label: '🎬 Video', value: 'video' },
        ]}
        isNovice={isNovice}
        allowGridView
      />

      <AnimatePresence>
        {lightboxGen && (
          <Lightbox
            key="lightbox"
            gen={lightboxGen}
            onClose={() => setLightboxGen(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
