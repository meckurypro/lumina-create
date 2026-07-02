// src/pages/CreateVideoUpscalerPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, Film } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-motion)'
const ACCENT_SUB = 'var(--tool-motion-subtle)'
const ACCENT_BDR = 'var(--tool-motion-border)'

const SS_UPSCALE_VIDEO = 'meckury_upscale_video'

// ── helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(secs) {
  if (!secs && secs !== 0) return ''
  const s = Math.round(Number(secs))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r ? `${m}m ${r}s` : `${m}m`
}

async function readVideoMeta(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const vid = document.createElement('video')
    vid.preload = 'metadata'
    vid.onloadedmetadata = () => {
      resolve({
        url,
        duration:    vid.duration ? Math.round(vid.duration) : null,
        width:       vid.videoWidth  || null,
        height:      vid.videoHeight || null,
      })
      URL.revokeObjectURL(url)
    }
    vid.onerror = () => {
      resolve({ url, duration: null, width: null, height: null })
    }
    vid.src = url
  })
}

// ── Model Dropdown ────────────────────────────────────────────────────────────
const ModelDropdown = ({ models, value, onChange }) => {
  const [open, setOpen] = useState(false)
  const unlocked = models.filter((m) => !m.is_locked)
  const locked   = models.filter((m) =>  m.is_locked)
  const selected = models.find((m) => m.value === value) || unlocked[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
      >
        <span>{selected?.label || 'Model'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d={open ? 'M2 7l3-4 3 4' : 'M2 3l3 4 3-4'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute right-0 top-9 z-50 w-56 rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border:     '1px solid var(--border-color)',
                boxShadow:  '0 8px 32px rgba(0,0,0,0.28)',
                maxHeight:  '60vh',
                overflowY:  'auto',
              }}
            >
              <div className="py-1">
                {unlocked.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { onChange(m.value); setOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                    style={{ background: m.value === value ? ACCENT_SUB : 'transparent' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                      {m.description && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.description}</p>
                      )}
                    </div>
                    {m.value === value && <span style={{ color: ACCENT, fontSize: 14 }}>✓</span>}
                  </button>
                ))}
              </div>
              {locked.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 12px' }} />
                  <div className="py-1">
                    {locked.map((m) => (
                      <div key={m.value} className="flex items-center justify-between px-4 py-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{m.label}</p>
                        <span style={{ fontSize: 11, opacity: 0.4 }}>🔒</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Video Upload Zone ─────────────────────────────────────────────────────────
const VideoUploadZone = ({ value, onUpload, onRemove }) => {
  if (value) {
    return (
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ aspectRatio: '16/9', background: 'var(--bg-elevated)', maxHeight: 280 }}
      >
        <video
          src={value.url}
          className="w-full h-full object-cover"
          muted loop autoPlay playsInline
        />
        {/* Meta badges */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          {value.duration != null && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
              {formatDuration(value.duration)}
            </span>
          )}
          {value.width && value.height && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
              {value.width}×{value.height}
            </span>
          )}
          {value.size && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
              {formatBytes(value.size)}
            </span>
          )}
        </div>
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <label
      className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all"
      style={{ height: '200px', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
    >
      <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
      <Film size={28} style={{ color: ACCENT, marginBottom: 10 }} />
      <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload a video</span>
      <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        MP4 · MOV · WEBM
      </span>
    </label>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CreateVideoUpscalerPage() {
  const navigate = useNavigate()
  const { user, credits, refreshProfile } = useAuth()

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelValue,    setModelValue]    = useState('')
  const [video,         setVideo]         = useState(null)   // { file, url, duration, width, height, size }
  const [quality,       setQuality]       = useState(null)
  const [submitting,    setSubmitting]    = useState(false)

  // ── Restore seed from Assets ───────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SS_UPSCALE_VIDEO)
      if (!saved) return
      sessionStorage.removeItem(SS_UPSCALE_VIDEO)
      const item = JSON.parse(saved)
      if (item.url) {
        const vid    = document.createElement('video')
        vid.preload  = 'metadata'
        vid.onloadedmetadata = () => {
          setVideo({
            file:     null,
            url:      item.url,
            duration: vid.duration ? Math.round(vid.duration) : null,
            width:    vid.videoWidth  || null,
            height:   vid.videoHeight || null,
            size:     null,
          })
        }
        vid.onerror = () => setVideo({ file: null, url: item.url, duration: null, width: null, height: null, size: null })
        vid.src = item.url
      }
    } catch { /* corrupt */ }
  }, [])

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem(SS_UPSCALE_VIDEO) } catch {}
    }
  }, [])

  // ── Load upscaler models ───────────────────────────────────────────────────
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'video')
      .eq('feature', 'upscale')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const list = data || []
    setModels(list)
    const first = list.find((m) => !m.is_locked)
    if (first) {
      setModelValue(first.value)
      const resCosts = first.credit_cost_resolution
      if (resCosts) setQuality(Object.keys(resCosts)[0])
    }
    setModelsLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

// ── Derived ────────────────────────────────────────────────────────────────
  const selectedModel  = models.find((m) => m.value === modelValue)
  const resCosts       = selectedModel?.credit_cost_resolution ?? null
  const qualityOptions = resCosts ? Object.entries(resCosts) : []
  const perSecondRate  = selectedModel?.credit_cost_per_second ?? null
  const minBillableSec = selectedModel?.min_billable_seconds ?? 1

  useEffect(() => {
    if (!resCosts) { setQuality(null); return }
    const keys = Object.keys(resCosts)
    if (!quality || !keys.includes(quality)) setQuality(keys[0])
  }, [modelValue]) // eslint-disable-line

  // Per-second models: rate comes from credit_cost_resolution[quality] when
  // tiered, or the flat credit_cost_per_second when untiered (e.g. Runway).
  // Cost = rate × actual uploaded duration, floored to min_billable_seconds —
  // mirrors CreateVideoPage's billing logic.
  const billableSeconds = video?.duration != null
    ? Math.max(video.duration, minBillableSec)
    : minBillableSec

  const creditCost = perSecondRate != null
    ? Math.ceil((resCosts && quality ? (resCosts[quality] ?? perSecondRate) : perSecondRate) * billableSeconds)
    : (resCosts && quality ? (resCosts[quality] ?? 0) : (selectedModel?.credit_cost_i2i ?? 0))

  const canAfford  = credits >= creditCost
  const canUpscale = !!video && canAfford && !submitting && !!selectedModel && creditCost > 0

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 200 * 1024 * 1024) {
      toast.error('Video must be under 200 MB.')
      e.target.value = ''
      return
    }

    const meta = await readVideoMeta(file)
    setVideo({ file, url: meta.url, duration: meta.duration, width: meta.width, height: meta.height, size: file.size })
  }

  const handleRemove = () => {
    if (video?.url && video?.file) URL.revokeObjectURL(video.url)
    setVideo(null)
  }

  // ── Upscale ───────────────────────────────────────────────────────────────
  const handleUpscale = async () => {
    if (!video)         return toast.error('Upload a video first')
    if (!selectedModel) return toast.error('Select a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      // Upload video
      let publicUrl
      if (!video.file) {
        publicUrl = video.url
      } else {
        const ext  = video.file.name.split('.').pop()?.toLowerCase() || 'mp4'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { data: uploadData, error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, video.file, {
            upsert:       false,
            cacheControl: '3600',
            contentType:  video.file.type || 'video/mp4',
          })
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`)
        ;({ data: { publicUrl } } = supabase.storage
          .from('generation-uploads')
          .getPublicUrl(uploadData.path))
      }

      // Create generation row
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        'video_to_video',
        status:                 'pending',
        prompt:                 'upscale',
        model:                  modelValue,
        aspect_ratio:           '16:9',
        resolution:             quality,
        credits_charged:        creditCost,
        output_type:            'video',
        input_image_urls:       [publicUrl],
        skip_prompt_refinement: true,
        title:                  `Video Upscale${quality ? ` · ${quality.toUpperCase()}` : ''}`,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // Invoke edge function
      const { data: invokeData, error: invokeErr } = await supabase.functions
        .invoke('video-upscale', { body: { generationId: genRow.id } })

      if (invokeErr || invokeData?.error) {
        const msg = invokeData?.error || invokeErr?.message || 'Upscale failed'
        toast.error(msg)
        await refreshProfile()
        return
      }

      refreshProfile()
      toast.success('Upscaling your video… Check your Media page.', { duration: 4000 })
      handleRemove()

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Generating overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Upscaling…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button onClick={() => navigate('/create', { state: { tab: 'utilities' } })} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Video Upscaler</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>AI Video Enhancement</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && models.length > 0 && (
            <ModelDropdown models={models} value={modelValue} onChange={setModelValue} />
          )}
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* Info banner */}
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
          >
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Upload a video and choose your target resolution. The AI enhances clarity and sharpness — no prompt needed. Result lands in your{' '}
              <strong style={{ color: 'var(--text-primary)' }}>Media</strong> page.
            </p>
          </div>

          {/* Video upload */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Source Video
            </p>
            <VideoUploadZone
              value={video}
              onUpload={handleUpload}
              onRemove={handleRemove}
            />
          </div>

          {/* Quality picker — dynamic from model */}
          {qualityOptions.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Output Resolution
              </p>
            <div className="flex gap-2 flex-wrap">
                {qualityOptions.map(([key, rate]) => {
                  const tierCost = perSecondRate != null
                    ? Math.ceil(rate * billableSeconds)
                    : rate
                  return (
                    <button
                      key={key}
                      onClick={() => setQuality(key)}
                      className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                      style={{
                        background: quality === key ? ACCENT : 'var(--bg-elevated)',
                        color:      quality === key ? '#ffffff' : 'var(--text-secondary)',
                      }}
                    >
                      {key.toUpperCase()} · {tierCost} cr
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* No models state */}
          {!modelsLoading && models.length === 0 && (
            <div
              className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            >
              <span style={{ fontSize: 32 }}>🎬</span>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No upscaler models yet</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Video upscaler models are being set up. Check back soon.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Upscale button */}
      {models.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={handleUpscale}
              disabled={!canUpscale}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{
                background: canUpscale ? ACCENT : 'var(--bg-elevated)',
                color:      canUpscale ? '#ffffff' : 'var(--text-muted)',
              }}
            >
              <Zap size={15} fill="currentColor" />
              {!video
                ? 'Upload a video to upscale'
                : !canAfford
                  ? 'Not enough credits'
                  : `Upscale${creditCost ? ` · ${creditCost} cr` : ''}`
              }
            </button>
            {!canAfford && video && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Not enough credits.{' '}
                <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                  Top up
                </button>
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
