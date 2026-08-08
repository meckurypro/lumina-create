// src/pages/CreateCopyMotionPage.jsx
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, X, Film, Image as ImageIcon,
  AlertCircle, RefreshCw, CheckCircle2, Scissors, Undo2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRenderWindowEligibility } from '@/hooks/useRenderWindowEligibility'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import { getActiveRenderWindowModelIds } from '@/lib/renderWindowModels'
import toast from 'react-hot-toast'
import { applyModelPreferences } from '@/hooks/useModelPreferences'
import { detectAspectRatio, formatDuration, readVideoMetadata } from '@/lib/mediaUtils'
import { ModelDropdown } from '@/components/create/ModelDropdown'
import { SettingChips } from '@/components/create/SettingChips'
import { watchForEarlyFailure } from '@/lib/generationWatch'
import {
  calculateModelCostUsd, fetchGlobalPricingSettings, fetchToolMargin,
} from '@/lib/pricing'

// ── Theme constants ────────────────────────────────────────────────────────
const ACCENT     = 'var(--tool-motion)'
const ACCENT_SUB = 'var(--tool-motion-subtle)'
const ACCENT_BDR = 'var(--tool-motion-border)'

const TOOL_KEY = 'copy_motion'
const CONVERSION_COST = 2

// ── Subject image constraints (Kling API limits) ───────────────────────────
const SUBJECT_IMAGE_MAX_BYTES = 10 * 1024 * 1024 // 10 MB hard limit per WaveSpeed/Kling docs

// ── Session storage keys ───────────────────────────────────────────────────
const SS_SUBJECT_IMG       = 'meckury_copymotion_subject'
const SS_VIDEO_META        = 'meckury_copymotion_video_meta'
const SS_COPY_MOTION_VIDEO = 'meckury_copymotion_video_asset'

// ── Helpers ────────────────────────────────────────────────────────────────
const restoreImage = (key) => new Promise((resolve) => {
  try {
    const saved = sessionStorage.getItem(key)
    if (!saved) return resolve(null)
    sessionStorage.removeItem(key)
    const item = JSON.parse(saved)
    if (item.url && !item.base64) {
      return resolve({ file: null, url: item.url, name: item.name })
    }
    const { base64, name, type } = item
    const bytes = atob(base64.split(',')[1])
    const ab    = new ArrayBuffer(bytes.length)
    const ia    = new Uint8Array(ab)
    for (let i = 0; i < bytes.length; i++) ia[i] = bytes.charCodeAt(i)
    const blob  = new Blob([ab], { type })
    resolve({ file: new File([blob], name, { type }), url: URL.createObjectURL(blob) })
  } catch { resolve(null) }
})

const persistVideoMeta = (name, duration, aspectRatio) => {
  try {
    sessionStorage.setItem(SS_VIDEO_META, JSON.stringify({ name, duration, aspectRatio }))
  } catch { /* noop */ }
}

const restoreVideoMeta = () => {
  try {
    const saved = sessionStorage.getItem(SS_VIDEO_META)
    return saved ? JSON.parse(saved) : null
  } catch { return null }
}

// ── Compatibility check ────────────────────────────────────────────────────
function checkVideoCompatibility({ videoMeta, model, targetAspectRatio, targetDuration }) {
  if (!model || !videoMeta) {
    return { compatible: false, reason: 'Video or model not ready', fixes: { needsTrim: false, needsCrop: false } }
  }

  const supportedRatios   = model.supported_aspect_ratios ?? ['9:16', '16:9', '1:1']
  const aspectOk          = supportedRatios.includes(videoMeta.aspectRatio) &&
                            videoMeta.aspectRatio === targetAspectRatio
  const isFlexibleDuration = model.model_access_type === 'render_window' && model.max_duration_seconds != null

  if (isFlexibleDuration) {
    if (videoMeta.duration != null && videoMeta.duration > model.max_duration_seconds) {
      return {
        compatible: false,
        reason: `Video is ${videoMeta.duration}s — max is ${model.max_duration_seconds}s for this model.`,
        fixes: { needsTrim: false, needsCrop: false, tooShort: false, tooLong: true },
      }
    }
    const needsCrop = !aspectOk
    if (!needsCrop) {
      return { compatible: true, reason: null, fixes: { needsTrim: false, needsCrop: false } }
    }
    return {
      compatible: false,
      reason:     `Aspect ratio ${videoMeta.aspectRatio || 'unknown'} → ${targetAspectRatio}`,
      fixes:      { needsTrim: false, needsCrop: true, tooShort: false },
    }
  }

  const durations = (model.supported_durations ?? []).map(Number).sort((a, b) => a - b)

  if (durations.length === 0) {
    return { compatible: false, reason: 'Model has no supported durations configured', fixes: { needsTrim: false, needsCrop: false } }
  }

  const minDur = durations[0]

  if (videoMeta.duration != null && videoMeta.duration < minDur) {
    return {
      compatible: false,
      reason: `Video is ${videoMeta.duration}s — minimum is ${minDur}s for this model.`,
      fixes: { needsTrim: false, needsCrop: false, tooShort: true },
    }
  }

  const needsTrim = videoMeta.duration !== targetDuration
  const needsCrop = !aspectOk

  if (!needsTrim && !needsCrop) {
    return { compatible: true, reason: null, fixes: { needsTrim: false, needsCrop: false } }
  }

  const reasons = []
  if (needsCrop) reasons.push(`Aspect ratio ${videoMeta.aspectRatio || 'unknown'} → ${targetAspectRatio}`)
  if (needsTrim) reasons.push(`Trim ${videoMeta.duration}s → ${targetDuration}s`)

  return {
    compatible: false,
    reason:     reasons.join(' · '),
    fixes:      { needsTrim, needsCrop, tooShort: false },
  }
}

// ── Edge function caller ───────────────────────────────────────────────────
async function callTranscodeEdgeFunction({
  file, userId, targetAspectRatio, targetDuration, startTime, onProgress,
}) {
  onProgress?.(5)

  const ext     = (file.name.split('.').pop() || 'mp4').toLowerCase()
  const srcPath = `${userId}/copy-motion-src/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('generation-uploads')
    .upload(srcPath, file, {
      upsert:       false,
      cacheControl: '3600',
      contentType:  file.type || 'video/mp4',
    })
  if (upErr) throw new Error(upErr.message || 'Could not upload source video')

  onProgress?.(20)

  const { data: { publicUrl: sourceUrl } } = supabase.storage
    .from('generation-uploads')
    .getPublicUrl(srcPath)

  let virtualPct = 25
  const tick = setInterval(() => {
    virtualPct = Math.min(virtualPct + 2, 90)
    onProgress?.(virtualPct)
  }, 800)

  let result
  try {
    const { data, error } = await supabase.functions.invoke('process-video-for-motion', {
      body: { sourceUrl, targetAspectRatio, targetDuration, startTime },
    })
    if (error)          throw new Error(error.message || 'Conversion edge function failed')
    if (!data?.success) throw new Error(data?.error   || 'Conversion failed')
    result = data
  } finally {
    clearInterval(tick)
    supabase.storage.from('generation-uploads').remove([srcPath]).catch(() => {})
  }

  onProgress?.(100)

  return {
    url:         result.url,
    duration:    result.duration,
    aspectRatio: result.aspectRatio,
    width:       result.width,
    height:      result.height,
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

const CompatBadge = ({ status }) => {
  if (!status) return null
  const map = {
    checking:     { bg: 'rgba(0,0,0,0.72)',      color: '#fff', icon: <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }} className="w-3 h-3 rounded-full border border-white" style={{ borderTopColor: 'transparent' }} />, text: 'Checking…' },
    compatible:   { bg: 'rgba(16,185,129,0.85)', color: '#fff', icon: <CheckCircle2 size={11} />, text: 'Ready'            },
    converted:    { bg: 'rgba(16,185,129,0.85)', color: '#fff', icon: <CheckCircle2 size={11} />, text: 'Converted · Ready' },
    incompatible: { bg: 'rgba(239,160,20,0.9)',  color: '#fff', icon: <RefreshCw   size={11} />, text: 'Needs conversion' },
    rejected:     { bg: 'rgba(239,68,68,0.92)',  color: '#fff', icon: <AlertCircle size={11} />, text: 'Too short'        },
    reconvert:    { bg: 'rgba(239,160,20,0.9)',  color: '#fff', icon: <RefreshCw   size={11} />, text: 'Settings changed' },
  }
  const cfg = map[status]
  if (!cfg) return null
  return (
    <div
      className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.icon}
      {cfg.text}
    </div>
  )
}

const VideoUploadZone = ({ value, ghostMeta, onUpload, onRemove, compatStatus, tooShort }) => {
  if (value) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}>
        <video
          src={value.url}
          className="w-full h-full object-cover"
          muted loop autoPlay playsInline
          style={{ filter: tooShort ? 'blur(4px)' : 'none' }}
        />
        {value.duration != null && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
            {formatDuration(value.duration)}
          </div>
        )}
        <CompatBadge status={compatStatus} />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', zIndex: 10 }}
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  if (ghostMeta) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}>
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 px-3 text-center">
          <RefreshCw size={20} style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Re-upload video</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>{ghostMeta.name}</p>
          {ghostMeta.duration != null && (
            <p className="text-xs" style={{ color: ACCENT }}>{formatDuration(ghostMeta.duration)}</p>
          )}
        </div>
        <label className="absolute inset-0 cursor-pointer">
          <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
        </label>
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.65)', color: 'white', zIndex: 10 }}
        >
          <X size={13} />
        </button>
      </div>
    )
  }

  return (
    <label
      className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
      style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
    >
      <input type="file" accept="video/*" className="hidden" onChange={onUpload} />
      <Film size={24} style={{ color: ACCENT, marginBottom: 8 }} />
      <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload video</span>
      <span className="text-xs mt-1 text-center px-4" style={{ color: 'var(--text-muted)' }}>
        MP4 · MOV · WEBM
      </span>
    </label>
  )
}

const ImageUploadZone = ({ value, onUpload, onRemove, sizeError }) => {
  if (value) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}>
        <img src={value.url} alt="Subject" className="w-full h-full object-cover" />
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
    <div className="flex flex-col gap-1.5">
      <label
        className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
        style={{
          aspectRatio: '1/1',
          border:      `1.5px dashed ${sizeError ? 'rgba(239,68,68,0.6)' : ACCENT_BDR}`,
          background:  sizeError ? 'rgba(239,68,68,0.06)' : ACCENT_SUB,
        }}
      >
        <input type="file" accept="image/jpeg,image/jpg,image/png" className="hidden" onChange={onUpload} />
        <ImageIcon size={24} style={{ color: sizeError ? '#ef4444' : ACCENT, marginBottom: 8 }} />
        <span className="text-sm font-semibold" style={{ color: sizeError ? '#ef4444' : ACCENT }}>
          {sizeError ? 'Image too large' : 'Upload image'}
        </span>
        <span className="text-xs mt-1 text-center px-4" style={{ color: 'var(--text-muted)' }}>
          {sizeError ? 'Max 10 MB · Try a smaller file' : 'The image that moves'}
        </span>
      </label>
      {sizeError && (
        <p className="text-xs text-center" style={{ color: '#ef4444' }}>
          Kling rejects images over 10 MB. Use a smaller file.
        </p>
      )}
    </div>
  )
}

const NoModelsState = () => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-16 gap-4 text-center"
  >
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
      <AlertCircle size={26} style={{ color: ACCENT }} />
    </div>
    <div>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No models available yet</p>
      <p className="text-xs mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
        Copy Motion models are being set up. Check back soon!
      </p>
    </div>
  </motion.div>
)

const FullscreenOverlay = ({ phase, convertProgress }) => {
  const isConverting = phase === 'converting'
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 px-8"
      style={{ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', background: 'rgba(0,0,0,0.45)' }}
    >
      {isConverting ? (
        <>
          <div className="relative w-16 h-16 flex items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
              <motion.circle
                cx="32" cy="32" r="28"
                fill="none"
                stroke={ACCENT}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 28}`}
                strokeDashoffset={`${2 * Math.PI * 28 * (1 - convertProgress / 100)}`}
                style={{ transformOrigin: '32px 32px', rotate: '-90deg' }}
                transition={{ duration: 0.3 }}
              />
            </svg>
            <span className="text-xs font-bold" style={{ color: '#fff' }}>{convertProgress}%</span>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold tracking-wide" style={{ color: '#fff' }}>Converting your video</p>
            <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.55)', maxWidth: 240, lineHeight: 1.6 }}>
              Trimming, cropping and re-encoding. Hang tight.
            </p>
          </div>
        </>
      ) : (
        <>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            className="w-10 h-10 rounded-full border-2"
            style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
          />
          <p className="text-sm font-semibold tracking-wide" style={{ color: '#fff' }}>Generating…</p>
        </>
      )}
    </motion.div>
  )
}

// ── Re-conversion warning panel ────────────────────────────────────────────
const ReconvertWarningPanel = ({
  compat, trimStart, targetDuration,
  convertedAspectRatio, convertedDuration,
  canAffordConvert, isProcessing,
  onRevert, onReconvert, onRemoveVideo,
}) => {
  const changes = []
  if (compat.fixes?.needsCrop)  changes.push(`aspect ratio`)
  if (compat.fixes?.needsTrim)  changes.push(`duration`)

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: 'rgba(239,160,20,0.08)', border: '1px solid rgba(239,160,20,0.35)' }}
    >
      <div className="flex items-start gap-2">
        <RefreshCw size={14} style={{ color: '#efa014', marginTop: 2, flexShrink: 0 }} />
        <div className="flex-1">
          <p className="text-sm font-semibold" style={{ color: '#efa014' }}>
            Settings changed after conversion
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
            You changed the <strong style={{ color: 'var(--text-primary)' }}>{changes.join(' and ')}</strong>{' '}
            after your video was already converted. Your converted video is{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {convertedDuration}s · {convertedAspectRatio}
            </strong>
            , but your current settings expect{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {targetDuration}s · {compat.fixes?.needsCrop ? 'a different ratio' : convertedAspectRatio}
            </strong>.
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            Revert your settings (free) or re-convert to match the new settings (
            <strong style={{ color: 'var(--text-primary)' }}>{CONVERSION_COST} credits</strong>).
            {compat.fixes?.needsTrim && trimStart > 0 && (
              <> Re-convert will clip <strong>{trimStart}s → {trimStart + targetDuration}s</strong>.</>
            )}
          </p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onRevert}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: !isProcessing ? ACCENT_SUB : 'var(--bg-elevated)',
            color:      !isProcessing ? ACCENT     : 'var(--text-muted)',
            border:     `1px solid ${ACCENT_BDR}`,
            cursor:     !isProcessing ? 'pointer'  : 'not-allowed',
          }}
        >
          <Undo2 size={13} />
          Revert settings
        </button>

        <button
          onClick={onReconvert}
          disabled={!canAffordConvert || isProcessing}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: canAffordConvert && !isProcessing ? '#efa014'          : 'var(--bg-elevated)',
            color:      canAffordConvert && !isProcessing ? '#fff'             : 'var(--text-muted)',
            cursor:     canAffordConvert && !isProcessing ? 'pointer'          : 'not-allowed',
          }}
        >
          Re-convert · {CONVERSION_COST} cr
        </button>

        <button
          onClick={onRemoveVideo}
          className="w-full py-2 rounded-xl text-xs font-medium"
          style={{ background: 'transparent', color: 'var(--text-muted)' }}
        >
          Remove video and start over
        </button>
      </div>

      {!canAffordConvert && (
        <p className="text-xs" style={{ color: '#ef4444' }}>
          Not enough credits to re-convert.
        </p>
      )}
    </motion.div>
  )
}

// ── First-time conversion panel ────────────────────────────────────────────
const FirstConversionPanel = ({
  compat, trimStart, targetDuration,
  canAffordConvert, isProcessing,
  onConvert, onRemoveVideo,
}) => (
  <motion.div
    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
    transition={{ duration: 0.15 }}
    className="rounded-2xl p-4 flex flex-col gap-3"
    style={{ background: 'rgba(239,160,20,0.08)', border: '1px solid rgba(239,160,20,0.25)' }}
  >
    <div className="flex items-start gap-2">
      <RefreshCw size={14} style={{ color: '#efa014', marginTop: 2, flexShrink: 0 }} />
      <div className="flex-1">
        <p className="text-sm font-semibold" style={{ color: '#efa014' }}>This video needs conversion</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
          {compat.reason}
          {compat.fixes?.needsTrim && targetDuration != null && (
            <> · Clip: <strong>{trimStart}s → {trimStart + targetDuration}s</strong></>
          )}
        </p>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Cost: <strong style={{ color: 'var(--text-primary)' }}>{CONVERSION_COST} credits</strong>.
          The converted video will load directly here — no redirect needed.
        </p>
      </div>
    </div>
    <div className="flex gap-2">
      <button
        onClick={onConvert}
        disabled={!canAffordConvert || isProcessing}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: canAffordConvert && !isProcessing ? ACCENT : 'var(--bg-elevated)',
          color:      canAffordConvert && !isProcessing ? '#fff'  : 'var(--text-muted)',
          cursor:     canAffordConvert && !isProcessing ? 'pointer' : 'not-allowed',
        }}
      >
        Convert &amp; Continue · {CONVERSION_COST} cr
      </button>
      <button
        onClick={onRemoveVideo}
        className="px-4 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
      >
        Cancel
      </button>
    </div>
    {!canAffordConvert && (
      <p className="text-xs" style={{ color: '#ef4444' }}>
        Not enough credits for conversion.
      </p>
    )}
  </motion.div>
)

// ── Page ───────────────────────────────────────────────────────────────────
export default function CreateCopyMotionPage() {
  const navigate                                   = useNavigate()
  const { user, credits, refreshProfile, profile } = useAuth()
 const { eligible: canUseRWModels }               = useRenderWindowEligibility()
  const isNovice                                   = profile?.user_tier !== 'master'
  const [weeklyUsed,  setWeeklyUsed]               = useState(null)
  const [weeklyLimit, setWeeklyLimit]              = useState(20)

  // Media
  const [motionVideo,    setMotionVideo]    = useState(null)
  const [videoGhostMeta, setVideoGhostMeta] = useState(null)
  const [subjectImage,   setSubjectImage]   = useState(null)
  const [subjectSizeErr, setSubjectSizeErr] = useState(false)

  // Settings
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [withSound,     setWithSound]     = useState(false)
  const [model,         setModel]         = useState('')
  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)

  // Trim
  const [targetDuration, setTargetDuration] = useState(null)
  const [trimStart,      setTrimStart]      = useState(0)

  // Pipeline
  const [phase,           setPhase]           = useState(null) // null | 'converting' | 'submitting'
  const [convertProgress, setConvertProgress] = useState(0)

  const [convertedSettings, setConvertedSettings] = useState(null)
  // { aspectRatio, duration } — set when a conversion completes, cleared on video removal.

  // ── pricing engine state ──────────────────────────────────────────────
  const [globalSettings, setGlobalSettings] = useState(null)
  const [toolMargin,     setToolMargin]     = useState(null)

  useEffect(() => {
    (async () => {
      const [gs, margin] = await Promise.all([
        fetchGlobalPricingSettings(),
        fetchToolMargin(TOOL_KEY),
      ])
      setGlobalSettings(gs)
      setToolMargin(margin)
    })()
  }, [])

// ── Cleanup on unmount ───────────────────────────────────
  useEffect(() => {
    return () => {
      try {
        [SS_SUBJECT_IMG, SS_VIDEO_META, SS_COPY_MOTION_VIDEO].forEach(k => sessionStorage.removeItem(k))
      } catch {}
    }
  }, [])

  // ── Load models ──────────────────────────────────────────
const COPY_MOTION_CROSSOVER_ALLOWLIST = ['meckury_vipro']

const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const [{ data }, { data: crossover }, activeRWModelIds] = await Promise.all([
      supabase
        .from('models')
        .select('*')
        .eq('type', 'video')
        .eq('is_active', true)
        .eq('is_user_facing', true)
        .eq('feature', 'motion_transfer')
        .order('sort_order'),
      supabase
        .from('models')
        .select('*')
        .eq('is_active', true)
        .eq('is_user_facing', true)
        .in('value', COPY_MOTION_CROSSOVER_ALLOWLIST),
      canUseRWModels ? getActiveRenderWindowModelIds() : Promise.resolve(new Set()),
    ])
    const merged = [...(data || [])]
    for (const m of crossover || []) {
      if (!merged.some((x) => x.value === m.value)) merged.push(m)
    }
    const isMaster      = profile?.user_tier === 'master'
    const tierFiltered  = merged
      .filter((m) => isMaster || m.tier_required !== 'master')
      .filter((m) => m.model_access_type !== 'render_window' || (canUseRWModels && activeRWModelIds.has(m.id)))
    const list          = await applyModelPreferences(tierFiltered, user?.id)
    setModels(list)
    const firstUnlocked = list.find((m) => !m.is_locked)
    setModel(firstUnlocked?.value || '')
    setModelsLoading(false)
  }, [profile?.user_tier, canUseRWModels])
useEffect(() => {
    loadModels()
  }, [loadModels])
  // ── Derived model config ─────────────────────────────────
  const selectedModel         = models.find((m) => m.value === model)
  const supportedAspectRatios = selectedModel?.supported_aspect_ratios ?? ['9:16', '16:9', '1:1']
  const supportsSound         = selectedModel?.supports_sound ?? false
  const modelDurations        = useMemo(() => (
    selectedModel?.supported_durations
      ? selectedModel.supported_durations.map(Number).sort((a, b) => a - b)
      : []
  ), [selectedModel])
  const isFlexibleDuration    = selectedModel?.model_access_type === 'render_window'
    && selectedModel?.max_duration_seconds != null

  // ── Restore session on mount ─────────────────────────────
  useEffect(() => {
    restoreImage(SS_SUBJECT_IMG).then((f) => { if (f) setSubjectImage(f) })

    try {
      const raw = sessionStorage.getItem(SS_COPY_MOTION_VIDEO)
      if (raw) {
        sessionStorage.removeItem(SS_COPY_MOTION_VIDEO)
        const payload = JSON.parse(raw)
        if (payload?.url) {
          const vid    = document.createElement('video')
          vid.preload  = 'metadata'
          vid.onloadedmetadata = () => {
            const duration    = vid.duration ? Math.round(vid.duration) : null
            const width       = vid.videoWidth  || null
            const height      = vid.videoHeight || null
            const aspectRatio = width && height ? detectAspectRatio(width, height) : null
            setMotionVideo({ file: null, url: payload.url, duration, width, height, aspectRatio })
            if (aspectRatio && supportedAspectRatios.includes(aspectRatio)) {
              setAspectRatio(aspectRatio)
            }
            persistVideoMeta(payload.name, duration, aspectRatio)
          }
          vid.onerror = () => {
            setMotionVideo({ file: null, url: payload.url, duration: null, width: null, height: null, aspectRatio: null })
          }
          vid.src = payload.url
          return
        }
      }
    } catch { /* noop */ }

    const meta = restoreVideoMeta()
    if (meta) {
      setVideoGhostMeta(meta)
      if (meta.aspectRatio) setAspectRatio(meta.aspectRatio)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Weekly limit for Novices
  useEffect(() => {
    if (!isNovice || !profile?.id) return
    const fetchWeekly = async () => {
      const [{ data: settingRow }, { count }] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', 'novice_copy_motion_weekly_limit').single(),
        supabase
          .from('generations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('generation_type', 'motion_transfer')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ])
      if (settingRow) setWeeklyLimit(Number(JSON.parse(settingRow.value)))
      setWeeklyUsed(count ?? 0)
    }
    fetchWeekly()
  }, [isNovice, profile?.id])

  // Snap aspect ratio when model changes
  useEffect(() => {
    if (selectedModel && !supportedAspectRatios.includes(aspectRatio)) {
      setAspectRatio(supportedAspectRatios[0] ?? '9:16')
    }
  }, [model]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!supportsSound) setWithSound(false) }, [supportsSound])

  // Default targetDuration
  useEffect(() => {
    if (isFlexibleDuration) {
      setTargetDuration(motionVideo?.duration != null ? Math.round(motionVideo.duration) : null)
      setTrimStart(0)
      return
    }
    if (modelDurations.length === 0) { setTargetDuration(null); return }
    if (motionVideo?.duration == null) { setTargetDuration(modelDurations[0]); return }
    const exact = modelDurations.find((d) => d === motionVideo.duration)
    if (exact != null) { setTargetDuration(exact); setTrimStart(0); return }
    const fits = modelDurations.filter((d) => d <= motionVideo.duration)
    setTargetDuration(fits.length ? fits[fits.length - 1] : modelDurations[0])
    setTrimStart(0)
  }, [motionVideo?.duration, modelDurations, isFlexibleDuration])

  // Clamp trimStart
  useEffect(() => {
    if (!motionVideo?.duration || !targetDuration) return
    const maxStart = Math.max(0, motionVideo.duration - targetDuration)
    if (trimStart > maxStart) setTrimStart(maxStart)
  }, [motionVideo?.duration, targetDuration, trimStart])

  // ── Compatibility ────────────────────────────────────────
  const compat = useMemo(() => {
    if (!motionVideo || !selectedModel || !targetDuration) {
      return { compatible: false, reason: null, fixes: { needsTrim: false, needsCrop: false } }
    }
    return checkVideoCompatibility({
      videoMeta: {
        duration:    motionVideo.duration,
        width:       motionVideo.width,
        height:      motionVideo.height,
        aspectRatio: motionVideo.aspectRatio,
      },
      model:             selectedModel,
      targetAspectRatio: aspectRatio,
      targetDuration,
    })
  }, [motionVideo, selectedModel, aspectRatio, targetDuration])

  // ── Conversion state classification ─────────────────────
  const wasConverted    = !!motionVideo?._converted
  const settingsDrifted = wasConverted && convertedSettings != null && (
    convertedSettings.aspectRatio !== aspectRatio ||
    convertedSettings.duration    !== targetDuration
  )

  const needsConversion = !!motionVideo && !compat.compatible && !compat.fixes?.tooShort && !compat.fixes?.tooLong

  const showReconvertWarning  = needsConversion && settingsDrifted
  const showFirstConvertPanel = needsConversion && !settingsDrifted

  const compatStatus = !motionVideo
    ? null
    : (compat.fixes?.tooShort || compat.fixes?.tooLong)
      ? 'rejected'
      : settingsDrifted
        ? 'reconvert'
        : wasConverted && compat.compatible
          ? 'converted'
          : compat.compatible
            ? 'compatible'
            : 'incompatible'

  // ── Price via the shared pricing engine ──────────────────
  // Real cost scales with duration via cost_usd_resolution (per-second for
  // non-flat-rate models) — no separate hand-rolled duration multiplier needed.
  const priced = useMemo(() => {
    if (!selectedModel || !globalSettings || !toolMargin || !targetDuration) return null
    let costUsd = calculateModelCostUsd({ model: selectedModel, resolution: undefined, duration: targetDuration })
    if (costUsd == null) return null

    if (withSound && supportsSound) {
      costUsd *= (selectedModel?.sound_cost_multiplier ?? 1.5)
    }

    const priceUsd = costUsd * toolMargin
    const credits  = Math.ceil(priceUsd / globalSettings.usdPerCredit)
    return { costUsd, priceUsd, credits }
  }, [selectedModel, globalSettings, toolMargin, targetDuration, withSound, supportsSound])

  const isPriced   = priced !== null
  const creditCost = priced?.credits ?? 0

  const canAfford        = credits >= creditCost
  const canAffordConvert = credits >= CONVERSION_COST
  const weeklyBlocked    = isNovice && weeklyUsed !== null && weeklyUsed >= weeklyLimit
  const hasVideo         = !!motionVideo
  const hasVideoOrGhost  = hasVideo || !!videoGhostMeta
  const hasSubject       = !!subjectImage
  const isProcessing     = phase !== null

const videoRequired   = selectedModel?.requires_video ?? true
  const subjectRequired = selectedModel?.requires_image ?? true

 const canGenerate =
    (!videoRequired   || (hasVideo && compat.compatible && !settingsDrifted)) &&
    (!subjectRequired || (hasSubject && !subjectSizeErr)) &&
    canAfford &&
    !!selectedModel &&
    !isProcessing &&
    !weeklyBlocked &&
    isPriced
  // ── Upload handlers ──────────────────────────────────────
  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 40 * 1024 * 1024) {
      toast.error('Video must be under 40 MB.')
      e.target.value = ''
      return
    }

    const url  = URL.createObjectURL(file)
    const meta = await readVideoMetadata(file)

    const uploadCap = isFlexibleDuration ? selectedModel.max_duration_seconds : 35

    if (meta.duration != null && meta.duration > uploadCap) {
      URL.revokeObjectURL(url)
      toast.error(`Video must be ${uploadCap} seconds or under.`)
      e.target.value = ''
      return
    }

    setMotionVideo({ file, url, duration: meta.duration, width: meta.width, height: meta.height, aspectRatio: meta.aspectRatio })
    setVideoGhostMeta(null)
    setConvertedSettings(null) // fresh upload — clear any prior conversion snapshot
    if (meta.aspectRatio && supportedAspectRatios.includes(meta.aspectRatio)) {
      setAspectRatio(meta.aspectRatio)
    }
    persistVideoMeta(file.name, meta.duration, meta.aspectRatio)
  }

  const handleSubjectUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > SUBJECT_IMAGE_MAX_BYTES) {
      setSubjectSizeErr(true)
      setSubjectImage(null)
      e.target.value = ''
      return
    }

    setSubjectSizeErr(false)
    setSubjectImage({ file, url: URL.createObjectURL(file) })
    }

  const handleRemoveVideo = () => {
    if (motionVideo?.url && motionVideo?.file) URL.revokeObjectURL(motionVideo.url)
    setMotionVideo(null)
    setVideoGhostMeta(null)
    setTrimStart(0)
    setConvertedSettings(null)
    try {
      sessionStorage.removeItem(SS_VIDEO_META)
      sessionStorage.removeItem(SS_COPY_MOTION_VIDEO)
    } catch { /* noop */ }
  }

  const handleRemoveSubject = () => {
    if (subjectImage?.url) URL.revokeObjectURL(subjectImage.url)
    setSubjectImage(null)
    setSubjectSizeErr(false)
    try { sessionStorage.removeItem(SS_SUBJECT_IMG) } catch { /* noop */ }
  }

  // ── Revert settings to match converted video ─────────────
  const handleRevertSettings = () => {
    if (!convertedSettings) return
    setAspectRatio(convertedSettings.aspectRatio)
    setTargetDuration(convertedSettings.duration)
    setTrimStart(0)
    toast.success('Settings reverted — your converted video is ready.', { duration: 2500 })
  }

  // ── Shared conversion logic ───────────────────────────────
  const runConversion = async ({ targetAspectRatio, targetDur, start }) => {
    if (!user)              { toast.error('Please sign in'); return }
    if (!motionVideo?.file) { toast.error('This video cannot be re-converted from a URL — remove it and re-upload.'); return }
    if (!canAffordConvert)  { toast.error(`Conversion costs ${CONVERSION_COST} credits.`); return }

    setPhase('converting')
    setConvertProgress(0)

    let processed
    try {
      processed = await callTranscodeEdgeFunction({
        file:              motionVideo.file,
        userId:            user.id,
        targetAspectRatio: targetAspectRatio,
        targetDuration:    targetDur,
        startTime:         start,
        onProgress:        (p) => setConvertProgress(p),
      })
    } catch (err) {
      setPhase(null)
      setConvertProgress(0)
      toast.error(err?.message || 'Video conversion failed.')
      return
    }

    try {
      const { data: deduct, error: dErr } = await supabase.rpc('deduct_credits', {
        p_user_id:       user.id,
        p_amount:        CONVERSION_COST,
        p_generation_id: null,
        p_description:   'Copy Motion video conversion',
      })
      if (dErr || !deduct?.success) {
        toast.error('Converted, but credit charge failed: ' + (deduct?.error || dErr?.message || 'unknown'))
      }
    } catch (err) {
      toast.error('Converted, but credit charge failed: ' + (err?.message || 'unknown'))
    }

    refreshProfile()
    setPhase(null)
    setConvertProgress(0)

    setMotionVideo({
      file:        null,
      url:         processed.url,
      duration:    processed.duration,
      width:       processed.width,
      height:      processed.height,
      aspectRatio: processed.aspectRatio,
      _converted:  true,
    })
    setConvertedSettings({
      aspectRatio: processed.aspectRatio,
      duration:    processed.duration,
    })
    setAspectRatio(processed.aspectRatio)
    setTargetDuration(processed.duration)
    setTrimStart(0)

    toast.success('Video converted — ready to generate!', { duration: 3000 })
  }

  const handleConvert = () => runConversion({
    targetAspectRatio: aspectRatio,
    targetDur:         targetDuration,
    start:             trimStart,
  })

  const handleReconvert = () => runConversion({
    targetAspectRatio: aspectRatio,
    targetDur:         targetDuration,
    start:             trimStart,
  })

  // ── Generate ─────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!hasVideo)          return toast.error('Upload a motion reference video')
    if (!compat.compatible) return toast.error('Convert the video first, then generate.')
    if (settingsDrifted)    return toast.error('Revert or re-convert before generating.')
    if (!hasSubject)        return toast.error('Upload a subject image')
    if (subjectSizeErr)     return toast.error('Subject image is too large. Use a file under 10 MB.')
    if (!selectedModel)     return toast.error('Pick a model')
    if (!isPriced)          return toast.error('This model isn\'t priced yet — contact support')
    if (!canAfford)         return toast.error('Not enough credits')
    if (!user)              return toast.error('Please sign in')

    setPhase('submitting')
    try {
      let motionVideoUrl
      if (!motionVideo.file) {
        motionVideoUrl = motionVideo.url
      } else {
        const vidExt  = motionVideo.file.name.split('.').pop()?.toLowerCase() || 'mp4'
        const vidPath = `${user.id}/${crypto.randomUUID()}.${vidExt}`
        const { error: vidErr } = await supabase.storage
          .from('generation-uploads')
          .upload(vidPath, motionVideo.file, {
            upsert:       false,
            cacheControl: '3600',
            contentType:  motionVideo.file.type || 'video/mp4',
          })
        if (vidErr) throw new Error('Video upload failed')
        ;({ data: { publicUrl: motionVideoUrl } } = supabase.storage
          .from('generation-uploads')
          .getPublicUrl(vidPath))
      }

      let subjectImageUrl
      if (!subjectImage.file) {
        subjectImageUrl = subjectImage.url
      } else {
        const imgExt  = subjectImage.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const imgPath = `${user.id}/${crypto.randomUUID()}.${imgExt}`
        const { error: imgErr } = await supabase.storage
          .from('generation-uploads')
          .upload(imgPath, subjectImage.file, {
            upsert:       false,
            cacheControl: '3600',
            contentType:  subjectImage.file.type,
          })
        if (imgErr) throw new Error('Image upload failed')
        ;({ data: { publicUrl: subjectImageUrl } } = supabase.storage
          .from('generation-uploads')
          .getPublicUrl(imgPath))
      }

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        'motion_transfer',
        status:                 'pending',
        prompt:                 null,
        model,
        aspect_ratio:           aspectRatio,
        duration:               String(targetDuration),
        credits_charged:        creditCost,
        output_type:            'video',
        start_frame_url:        subjectImageUrl,
        input_image_urls:       [motionVideoUrl],
        with_sound:             withSound,
        skip_prompt_refinement: true,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(
        user.id, creditCost, genRow.id
      )
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, {
          status:        'failed',
          error_message: deduct?.error || 'Insufficient credits',
        })
        throw new Error(deduct?.error || 'Not enough credits')
      }

const { data: invokeData, error: invokeErr } = await supabase.functions
        .invoke('video-generate', { body: { generationId: genRow.id } })

      if (invokeErr || invokeData?.error) {
        const msg = invokeData?.error || invokeErr?.message || 'Generation blocked'
        toast.error(msg)
        await refreshProfile()
        return
      }

      const { failed, message } = await watchForEarlyFailure(genRow.id)
      await refreshProfile()

      if (failed) {
        toast.error(message)
        return
      }

      toast.success('Copy Motion is being generated. Check your Media page.', { duration: 4000 })

      handleRemoveVideo()
      handleRemoveSubject()
      setWithSound(false)
    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setPhase(null)
    }
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <AnimatePresence>
        {isProcessing && (
          <FullscreenOverlay phase={phase} convertProgress={convertProgress} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Copy Motion</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>
            Motion Transfer
            {isNovice && weeklyUsed !== null && (
              <span className="ml-1.5 opacity-60">· {weeklyUsed}/{weeklyLimit} this week</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && models.length > 0 && (
            <ModelDropdown
              models={models} value={model} onChange={setModel}
              accent={ACCENT} accentSub={ACCENT_SUB} accentBdr={ACCENT_BDR}
              width={240}
            />
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {modelsLoading ? (
            <div className="flex flex-col gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="w-full rounded-2xl animate-pulse" style={{ height: 200, background: 'var(--bg-elevated)' }} />
              ))}
            </div>
          ) : models.length === 0 ? (
            <NoModelsState />
          ) : (
            <>
              {/* Info banner */}
              <div className="rounded-2xl px-4 py-3 flex gap-3 items-start" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                <Film size={16} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Upload a <strong style={{ color: 'var(--text-primary)' }}>motion reference video</strong> and a{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>subject image</strong>. The AI copies the motion from the video onto your image.
                </p>
              </div>

              {/* Upload grid */}
              <div>
                <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Inputs</p>
                <div className="grid grid-cols-2 gap-3 items-start">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Motion Video</p>
                    <VideoUploadZone
                      value={motionVideo}
                      ghostMeta={videoGhostMeta}
                      onUpload={handleVideoUpload}
                      onRemove={handleRemoveVideo}
                      compatStatus={compatStatus}
                      tooShort={!!compat.fixes?.tooShort || !!compat.fixes?.tooLong}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Subject Image</p>
                    <ImageUploadZone
                      value={subjectImage}
                      onUpload={handleSubjectUpload}
                      onRemove={handleRemoveSubject}
                      sizeError={subjectSizeErr}
                    />
                  </div>
                </div>

                {/* Too short — hard reject */}
                <AnimatePresence>
                  {(compat.fixes?.tooShort || compat.fixes?.tooLong) && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
                    >
                      <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
                      <p className="text-xs" style={{ color: '#ef4444' }}>{compat.reason}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Compatible confirmation */}
                {compat.compatible && motionVideo && !settingsDrifted && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Video is{' '}
                    <strong style={{ color: ACCENT }}>
                      {motionVideo.duration}s · {motionVideo.aspectRatio}
                      {motionVideo._converted && ' · converted'}
                    </strong>{' '}
                    — ready to generate.
                  </p>
                )}
              </div>

              {/* Trim UI */}
              {motionVideo && !compat.fixes?.tooShort && !isFlexibleDuration && modelDurations.length > 0 && (
                <div className="rounded-2xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Scissors size={14} style={{ color: ACCENT }} />
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      Trim length
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap mb-4">
                    {modelDurations.map((d) => {
                      const tooLong = motionVideo.duration != null && d > motionVideo.duration
                      return (
                        <button
                          key={d}
                          disabled={tooLong}
                          onClick={() => { setTargetDuration(d); setTrimStart(0) }}
                          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
                          style={{
                            background: d === targetDuration ? ACCENT    : 'var(--bg-card)',
                            color:      d === targetDuration ? '#ffffff' : 'var(--text-secondary)',
                            opacity:    tooLong ? 0.3 : 1,
                            cursor:     tooLong ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {d}s
                        </button>
                      )
                    })}
                  </div>

                  {motionVideo.duration != null && targetDuration != null && motionVideo.duration > targetDuration && (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Start time</p>
                        <p className="text-xs font-bold" style={{ color: ACCENT }}>
                          {trimStart}s → {trimStart + targetDuration}s
                        </p>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={Math.max(0, motionVideo.duration - targetDuration)}
                        step={1}
                        value={trimStart}
                        onChange={(e) => setTrimStart(Number(e.target.value))}
                        className="w-full accent-current"
                        style={{ accentColor: ACCENT }}
                      />
                    </>
                  )}

                  {motionVideo.duration === targetDuration && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Video already matches the selected duration — no trim needed.
                    </p>
                  )}
                </div>
              )}

              {/* Conversion panels */}
              <AnimatePresence mode="wait">
                {showReconvertWarning && (
                  <ReconvertWarningPanel
                    key="reconvert-warning"
                    compat={compat}
                    trimStart={trimStart}
                    targetDuration={targetDuration}
                    convertedAspectRatio={convertedSettings?.aspectRatio}
                    convertedDuration={convertedSettings?.duration}
                    canAffordConvert={canAffordConvert}
                    isProcessing={isProcessing}
                    onRevert={handleRevertSettings}
                    onReconvert={handleReconvert}
                    onRemoveVideo={handleRemoveVideo}
                  />
                )}
                {showFirstConvertPanel && (
                  <FirstConversionPanel
                    key="first-convert"
                    compat={compat}
                    trimStart={trimStart}
                    targetDuration={targetDuration}
                    canAffordConvert={canAffordConvert}
                    isProcessing={isProcessing}
                    onConvert={handleConvert}
                    onRemoveVideo={handleRemoveVideo}
                  />
                )}
              </AnimatePresence>

              {/* Settings */}
              <div>
                <SettingChips
                  label="Aspect Ratio"
                  options={['9:16', '16:9', '1:1'].map((v) => ({
                    label:    v,
                    value:    v,
                    disabled: !supportedAspectRatios.includes(v),
                  }))}
                  value={aspectRatio}
                  onChange={setAspectRatio}
                  accent={ACCENT}
                />
                {supportsSound && (
                  <SettingChips
                    label="Sound"
                    options={[
                      { label: '🔇 Silent',     value: 'false' },
                      { label: '🔊 With Sound', value: 'true'  },
                    ]}
                    value={String(withSound)}
                    onChange={(v) => setWithSound(v === 'true')}
                    accent={ACCENT}
                  />
                )}
              </div>

              {selectedModel && !isPriced && (
                <p className="text-xs text-center" style={{ color: '#fbbf24' }}>
                  This model isn't priced yet — contact support.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Generate button */}
      {models.length > 0 && (
        <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
          <div className="mx-auto w-full max-w-xl">
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
              style={{
                background: canGenerate ? ACCENT    : 'var(--bg-elevated)',
                color:      canGenerate ? '#ffffff' : 'var(--text-muted)',
                cursor:     canGenerate ? 'pointer' : 'not-allowed',
              }}
            >
              <Zap size={15} fill="currentColor" />
              {isProcessing
                ? phase === 'converting' ? 'Converting…' : 'Generating…'
                : targetDuration
                  ? `Generate · ${creditCost} cr · ${targetDuration}s`
                  : 'Generate'}
            </button>

            {/* Contextual hint text */}
            {showReconvertWarning && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Revert your settings or re-convert above to continue.
              </p>
            )}
            {!showReconvertWarning && needsConversion && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Convert your video above to continue.
              </p>
            )}
            {!needsConversion && !hasVideoOrGhost && !hasSubject && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Upload both a motion video and a subject image to continue
              </p>
            )}
            {!needsConversion && (hasVideoOrGhost || hasSubject) && (!hasVideoOrGhost || !hasSubject) && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                {!hasVideoOrGhost ? 'Still need a motion reference video' : 'Still need a subject image'}
              </p>
            )}
            {videoGhostMeta && !motionVideo && hasSubject && (
              <p className="text-xs text-center mt-2" style={{ color: ACCENT }}>
                Re-upload your motion video to continue
              </p>
            )}
            {subjectSizeErr && !subjectImage && (
              <p className="text-xs text-center mt-2" style={{ color: '#ef4444' }}>
                Subject image exceeds 10 MB. Upload a smaller file to continue.
              </p>
            )}
            {compat.compatible && !settingsDrifted && hasVideo && hasSubject && !canAfford && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Not enough credits.{' '}
                <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                  Top up
                </button>
              </p>
            )}
            {weeklyBlocked && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Weekly limit reached ({weeklyLimit} uses). Resets in 7 days.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
    }
