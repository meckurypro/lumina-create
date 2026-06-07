// src/pages/UGCBrandMediaPage.jsx
// Thin wrapper around MediaPageCore for brand generations.

import { useState, useEffect }                        from 'react'
import { useNavigate, useParams }                     from 'react-router-dom'
import { motion, AnimatePresence }                    from 'framer-motion'
import {
  ArrowLeft, Zap, Building2, Sparkles,
  Grid2X2, List,
}                                                     from 'lucide-react'
import { useAuth }                                    from '@/context/AuthContext'
import { ugcBrandProfiles, ugcBrandGenerations }      from '@/lib/ugcBrands'
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

function makeFetcher(brandId) {
  return async function fetchBrandGenerations(user, { limit, offset, afterIso, statusFilter }) {
    let query = supabase
      .from('ugc_brand_generations')
      .select(
        `
        id,
        output_type,
        scene_prompt,
        aspect_ratio,
        with_sound,
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
      .eq('ugc_brand_id', brandId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (afterIso) query = query.gte('created_at', afterIso)

    const { data, error, count } = await query
    if (error) return { data: [], count: 0 }

    let flat = (data || [])
      .filter((r) => r.generation)
      .map((r) => ({
        ...r.generation,
        brand_generation_id: r.id,
        brand_scene_prompt:  r.scene_prompt,
        brand_aspect_ratio:  r.aspect_ratio,
        brand_with_sound:    r.with_sound,
      }))

    if (statusFilter && statusFilter !== 'all') {
      flat = flat.filter((g) => g.status === statusFilter)
    }

    return { data: flat, count: count || 0 }
  }
}

function filterRelevantModels(models) {
  return models.filter((m) => !m.is_locked && m.type === 'image')
}

function filterEditModels(models) {
  return models.filter((m) => !m.is_locked && m.type === 'image' && m.supports_image === true)
}

function computeCreditCost(selectedModel, gen) {
  if (!selectedModel) return 0
  return selectedModel.credit_cost_t2i || 0
}

function computeEditCreditCost(selectedModel) {
  if (!selectedModel) return 0
  return selectedModel.credit_cost_i2i || 0
}

function makeOnRegenerate(brandId) {
  return async function onRegenerate(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
    supabase, user, generationsDb, refreshProfile, setItems, setTotalCount,
  }) {
    const isVideo = gen.output_type === 'video'

    const { data: genRow, error: genErr } = await generationsDb.create({
      user_id:         user.id,
      generation_type: isVideo ? 'text_to_video' : 'text_to_image',
      status:          'pending',
      prompt:          editedPrompt ?? gen.prompt,
      model:           chosenModel,
      aspect_ratio:    gen.aspect_ratio,
      duration:        isVideo ? gen.duration : undefined,
      credits_charged: creditCost,
      output_type:     gen.output_type,
    })
    if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

    const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
    if (dErr || !deduct?.success) {
      await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
      throw new Error(deduct?.error || 'Not enough credits')
    }

    await ugcBrandGenerations.create({
      generation_id: genRow.id,
      ugc_brand_id:  brandId,
      user_id:       user.id,
      output_type:   gen.output_type,
      scene_prompt:  editedPrompt ?? gen.brand_scene_prompt ?? gen.prompt ?? '',
      aspect_ratio:  gen.aspect_ratio || '9:16',
    })

    const fn = isVideo ? 'brand-generate' : 'brand-generate'
    supabase.functions.invoke(fn, { body: { generationId: genRow.id } })
      .catch((e) => console.error(`${fn} invoke error`, e))

    const optimistic = {
      ...genRow,
      brand_generation_id: null,
      brand_scene_prompt:  editedPrompt ?? gen.brand_scene_prompt ?? gen.prompt ?? '',
      brand_aspect_ratio:  gen.aspect_ratio || '9:16',
    }
    setItems((prev) => [optimistic, ...prev])
    setTotalCount((c) => c + 1)
    refreshProfile()
  }
}

function makeOnEdit(brandId) {
  return async function onEdit(gen, chosenModel, creditCost, selectedModelObj, editedPrompt, {
    supabase, user, generationsDb, refreshProfile, setItems, setTotalCount,
  }) {
    if (!gen.output_url) throw new Error('No output URL to edit from')

    const inputImages = [gen.output_url]

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
      skip_prompt_refinement: false,
      is_smart_edit:          true,
    })
    if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

    const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
    if (dErr || !deduct?.success) {
      await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
      throw new Error(deduct?.error || 'Not enough credits')
    }

    await ugcBrandGenerations.create({
      generation_id: genRow.id,
      ugc_brand_id:  brandId,
      user_id:       user.id,
      output_type:   'image',
      scene_prompt:  editedPrompt ?? gen.brand_scene_prompt ?? gen.prompt ?? '',
      aspect_ratio:  gen.aspect_ratio || '9:16',
    })

    supabase.functions.invoke('image-generate', { body: { generationId: genRow.id } })
      .catch((e) => console.error('image-generate invoke error', e))

    const optimistic = {
      ...genRow,
      brand_generation_id: null,
      brand_scene_prompt:  editedPrompt ?? gen.brand_scene_prompt ?? gen.prompt ?? '',
      brand_aspect_ratio:  gen.aspect_ratio || '9:16',
    }
    setItems((prev) => [optimistic, ...prev])
    setTotalCount((c) => c + 1)
    refreshProfile()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UGCBrandMediaPage
// ─────────────────────────────────────────────────────────────────────────────

export default function UGCBrandMediaPage() {
  const { brandId }                                = useParams()
  const navigate                                   = useNavigate()
  const { profile: authProfile, credits }          = useAuth()
  const isNovice = authProfile?.user_tier === 'novice'

  const [brand,        setBrand]        = useState(null)
  const [brandLoading, setBrandLoading] = useState(true)
  const [lightboxGen,  setLightboxGen]  = useState(null)
  const [totalCount,   setTotalCount]   = useState(0)

  useEffect(() => {
    ;(async () => {
      setBrandLoading(true)
      const { data, error } = await ugcBrandProfiles.getById(brandId)
      if (error || !data) {
        toast.error('Brand not found')
        navigate('/create/ugc')
        return
      }
      setBrand(data)
      setBrandLoading(false)
    })()
  }, [brandId, navigate])

  const fetcher      = makeFetcher(brandId)
  const onRegenerate = makeOnRegenerate(brandId)
  const onEdit       = makeOnEdit(brandId)

  if (brandLoading) {
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

  const headerSlot = ({ viewMode, setViewMode, allowGridView, totalCount: tc, credits: cr }) => (
    <div
      className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
      style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
    >
      <button
        onClick={() => navigate(`/create/ugc/brand/${brandId}`)}
        className="p-2 -ml-2 rounded-xl"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft size={20} />
      </button>

      <button
        onClick={() => navigate(`/create/ugc/brand/${brandId}`)}
        className="flex items-center gap-2.5"
      >
        {brand?.logo_url ? (
          <img
            src={brand.logo_url}
            alt={brand.brand_name}
            className="w-8 h-8 rounded-full object-contain flex-shrink-0"
            style={{ border: `2px solid ${ACCENT_BDR}`, padding: 2, background: 'var(--bg-elevated)' }}
          />
        ) : (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: ACCENT_SUB, border: `2px solid ${ACCENT_BDR}` }}
          >
            <Building2 size={14} style={{ color: ACCENT }} />
          </div>
        )}
        <div className="flex flex-col items-start">
          <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>
            {brand?.brand_name}
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
    <div className="px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
      <div className="mx-auto w-full max-w-xl">
        <button
          onClick={() => navigate(`/create/ugc/brand/${brandId}`)}
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
            : `Create your first ad or content piece for ${brand?.brand_name}.`
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
            onClick={() => navigate(`/create/ugc/brand/${brandId}`)}
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
        onTotalCountChange={setTotalCount}
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
