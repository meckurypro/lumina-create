// src/components/ugc/UGCPhotoValidator.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { X, Check, AlertTriangle, RefreshCw, ImageOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

// TinyFaceDetector weights served from a CDN mirror — swap to '/models' if
// you later choose to self-host the same files under /public/models
const FACE_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model'

const FACE_SHOT_TYPES = {
  photo_face_front:         'face_front',
  photo_face_three_quarter: 'three_quarter',
  photo_face_side_90:       'side_90',
}

// TinyFaceDetector is trained mostly on frontal/near-frontal faces, so a true
// 90° side profile (often only one eye visible, sometimes none at all)
// reliably scores lower than a front-facing shot. We loosen the confidence
// threshold for that slot instead of rejecting perfectly good photos. Front
// and ¾ shots stay stricter since detection there is easy and a miss is
// usually a genuine problem with the photo.
const FACE_DETECTION_THRESHOLD = {
  face_front:    0.5,
  three_quarter: 0.4,
  side_90:       0.2,
}
const DEFAULT_FACE_DETECTION_THRESHOLD = 0.5

// Larger inputSize improves detection on angled/partial faces at a modest
// perf cost — worth it here since this runs once per photo, not per frame.
const FACE_DETECTOR_INPUT_SIZE = 512

const MIN_BODY_DIMENSION = 480 // px, on the shorter side
const OUTPUT_QUALITY     = 0.92

// ─────────────────────────────────────────────────────────────────────────────
// face-api lazy singleton loader
// ─────────────────────────────────────────────────────────────────────────────
let faceApiPromise = null
function loadFaceApi() {
  if (!faceApiPromise) {
    faceApiPromise = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL)
      return faceapi
    })().catch((err) => {
      faceApiPromise = null // allow retry on next attempt
      throw err
    })
  }
  return faceApiPromise
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => resolve({ img, url })
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

function canvasToBlob(canvas, type = 'image/jpeg', quality = OUTPUT_QUALITY) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// Render a full, uncropped copy of the source image to a canvas. Used as the
// fallback path when face detection can't be trusted (load failure, or a
// user override on a hard-to-detect angle) — the photo still goes through
// the quality-check stage untouched instead of being auto-cropped.
function fullFrameCanvas(img) {
  const canvas = document.createElement('canvas')
  canvas.width  = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d').drawImage(img, 0, 0)
  return canvas
}

// Crop to a 3:4 portrait region around the detected face box, with generous
// padding so the result reads as "head and shoulders", then apply a light
// brightness/contrast lift. Returns a canvas.
function cropAndEnhanceFace(img, box) {
  const { x, y, width, height } = box

  // Pad generously around the face box to capture head + shoulders
  const padX = width  * 1.0
  const padTop = height * 0.9
  const padBottom = height * 1.6

  let cropX = x - padX
  let cropY = y - padTop
  let cropW = width  + padX * 2
  let cropH = height + padTop + padBottom

  // Enforce 3:4 (w:h) aspect ratio, expanding the smaller dimension
  const targetRatio = 3 / 4
  const currentRatio = cropW / cropH
  if (currentRatio > targetRatio) {
    // too wide — grow height
    const newH = cropW / targetRatio
    cropY -= (newH - cropH) / 2
    cropH = newH
  } else {
    // too tall — grow width
    const newW = cropH * targetRatio
    cropX -= (newW - cropW) / 2
    cropW = newW
  }

  // Clamp to image bounds
  cropX = Math.max(0, cropX)
  cropY = Math.max(0, cropY)
  cropW = Math.min(cropW, img.naturalWidth  - cropX)
  cropH = Math.min(cropH, img.naturalHeight - cropY)

  // Re-clamp ratio after bounds clamping (best-effort — edge photos may end
  // up slightly off-ratio, which is fine for our purposes)
  const OUTPUT_W = 768
  const OUTPUT_H = Math.round(OUTPUT_W / (cropW / cropH))

  const canvas = document.createElement('canvas')
  canvas.width  = OUTPUT_W
  canvas.height = OUTPUT_H
  const ctx = canvas.getContext('2d')

  // Subtle brightness/contrast lift — nothing heavy
  ctx.filter = 'brightness(1.06) contrast(1.04) saturate(1.03)'
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, OUTPUT_W, OUTPUT_H)
  ctx.filter = 'none'

  return canvas
}

// ─────────────────────────────────────────────────────────────────────────────
// UI sub-components
// ─────────────────────────────────────────────────────────────────────────────
const Spinner = ({ size = 18 }) => (
  <motion.div
    animate={{ rotate: 360 }}
    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
    style={{
      width: size, height: size, borderRadius: '9999px',
      border: '2px solid rgba(255,255,255,0.25)',
      borderTopColor: '#fff',
    }}
  />
)

const StatusBadge = ({ result }) => {
  const map = {
    pass:   { bg: 'rgba(34,197,94,0.15)',  fg: '#22c55e', label: 'Looks great' },
    warn:   { bg: 'rgba(234,179,8,0.15)',  fg: '#eab308', label: 'Usable, with notes' },
    reject: { bg: 'rgba(239,68,68,0.15)',  fg: '#ef4444', label: 'Not usable' },
  }
  const s = map[result] || map.warn
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold"
      style={{ background: s.bg, color: s.fg }}
    >
      {s.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Props:
 *  - file:      File object selected by the user
 *  - slotKey:   one of the ugc_profiles photo_* column names
 *  - onApprove: (blob: Blob) => void  — final processed image to upload
 *  - onCancel:  () => void            — user backed out, no upload happens
 */
export default function UGCPhotoValidator({ file, slotKey, onApprove, onCancel }) {
  const isFaceShot = slotKey in FACE_SHOT_TYPES
  const shotType   = FACE_SHOT_TYPES[slotKey]

  // Side-90 is the hardest angle for a frontal-trained detector — one eye is
  // frequently fully occluded. Give that slot a manual "use anyway" escape
  // hatch on the reject screen in case even the loosened threshold misses.
  const allowManualOverride = shotType === 'side_90'

  // stage: 'loading' | 'face_check' | 'reject_no_face' | 'reject_multi_face'
  //      | 'preview' | 'quality_check' | 'result' | 'body_preview' | 'reject_low_res'
  const [stage,        setStage]        = useState('loading')
  const [originalUrl,  setOriginalUrl]  = useState(null)
  const [processedCanvas, setProcessedCanvas] = useState(null)
  const [processedUrl, setProcessedUrl] = useState(null)
  const [qualityResult, setQualityResult] = useState(null)
  const [error,        setError]        = useState(null)

  const imgRef = useRef(null)

  // ── Stage 1 + 2: load image, run face detection, crop/enhance ────────────
  const runFacePipeline = useCallback(async (img) => {
    setStage('loading')

    let faceapi
    try {
      faceapi = await loadFaceApi()
    } catch (err) {
      console.error('face-api failed to load, skipping detection:', err)
      // Graceful fallback — proceed without crop, straight to quality check
      // on the original image
      const canvas = fullFrameCanvas(img)
      setProcessedCanvas(canvas)
      const blob = await canvasToBlob(canvas)
      setProcessedUrl(URL.createObjectURL(blob))
      setStage('preview')
      return
    }

    let detections
    try {
      detections = await faceapi.detectAllFaces(
        img,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: FACE_DETECTOR_INPUT_SIZE,
          scoreThreshold: FACE_DETECTION_THRESHOLD[shotType] ?? DEFAULT_FACE_DETECTION_THRESHOLD,
        })
      )
    } catch (err) {
      console.error('Face detection failed:', err)
      detections = []
    }

    if (detections.length === 0) {
      setStage('reject_no_face')
      return
    }
    if (detections.length > 1) {
      setStage('reject_multi_face')
      return
    }

    const box = detections[0].box
    const canvas = cropAndEnhanceFace(img, box)
    setProcessedCanvas(canvas)
    const blob = await canvasToBlob(canvas)
    setProcessedUrl(URL.createObjectURL(blob))
    setStage('preview')
  }, [shotType])

  // ── Body shots: lightweight resolution check only ─────────────────────────
  const runBodyPipeline = useCallback(async (img) => {
    const shorterSide = Math.min(img.naturalWidth, img.naturalHeight)
    if (shorterSide < MIN_BODY_DIMENSION) {
      setStage('reject_low_res')
      return
    }
    setStage('body_preview')
  }, [])

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    let objectUrl  = null

    ;(async () => {
      try {
        const { img, url } = await loadImageFromFile(file)
        if (cancelled) { URL.revokeObjectURL(url); return }
        objectUrl = url
        imgRef.current = img
        setOriginalUrl(url)

        if (isFaceShot) {
          await runFacePipeline(img)
        } else {
          await runBodyPipeline(img)
        }
      } catch (err) {
        console.error('Failed to load image:', err)
        setError('This file could not be read as an image.')
        setStage('reject_no_face')
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [file, isFaceShot, runFacePipeline, runBodyPipeline])

  useEffect(() => {
    return () => {
      if (processedUrl) URL.revokeObjectURL(processedUrl)
    }
  }, [processedUrl])

  // ── Stage 3: Claude Haiku quality check ───────────────────────────────────
  const runQualityCheck = async () => {
    setStage('quality_check')
    try {
      const blob      = await canvasToBlob(processedCanvas)
      const dataUrl   = await blobToDataUrl(blob)

      const { data, error: fnError } = await supabase.functions.invoke('ugc-photo-validate', {
        body: { image: dataUrl, mediaType: 'image/jpeg', shotType },
      })

      if (fnError) throw fnError

      setQualityResult(data)
      setStage('result')
    } catch (err) {
      console.error('Quality check failed:', err)
      // Degrade gracefully — let the user proceed with a neutral warning
      setQualityResult({
        result: 'warn',
        reason: "We couldn't run the quality check right now. You can proceed, or retake the photo if unsure.",
        issues: [],
      })
      setStage('result')
    }
  }

  // ── Manual override — used when detection rejects a shot the user is sure
  // is fine (currently offered only for the side-90 slot). Skips cropping
  // entirely and sends the untouched original into the preview stage. ──────
  const overrideNoFaceDetected = async () => {
    if (!imgRef.current) return
    const canvas = fullFrameCanvas(imgRef.current)
    setProcessedCanvas(canvas)
    const blob = await canvasToBlob(canvas)
    setProcessedUrl(URL.createObjectURL(blob))
    setStage('preview')
  }

  // ── Final approve — hand processed blob back to parent ────────────────────
  const approveFace = async () => {
    const blob = await canvasToBlob(processedCanvas)
    // Wrap as a File so ugc.js's uploadPhoto/compressImage (which read
    // file.name) work unchanged.
    const namedFile = new File([blob], `${slotKey}.jpg`, { type: 'image/jpeg' })
    onApprove(namedFile)
  }

  const approveBody = () => {
    onApprove(file)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.2 }}
        className="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)', maxHeight: '92vh', border: `1px solid ${ACCENT_BDR}` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {isFaceShot ? 'Photo Check' : 'Photo Preview'}
          </p>
          <button onClick={onCancel} className="p-1.5 rounded-xl" style={{ color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">

          {/* Loading */}
          {stage === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Spinner size={28} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Checking your photo…</p>
            </div>
          )}

          {/* No face detected */}
          {stage === 'reject_no_face' && (
            <RejectPanel
              icon={<ImageOff size={28} />}
              title="No face detected"
              message={
                error ||
                (allowManualOverride
                  ? "We couldn't confirm a face at this angle. Side profiles can be tricky to detect automatically — if you're confident this photo is clear and unobstructed, you can use it anyway."
                  : "We couldn't find a clear face in this photo. Please choose a photo where your face is visible and unobstructed.")
              }
              onCancel={onCancel}
              onOverride={allowManualOverride ? overrideNoFaceDetected : null}
              overrideLabel="Use This Photo Anyway"
            />
          )}

          {/* Multiple faces */}
          {stage === 'reject_multi_face' && (
            <RejectPanel
              icon={<AlertTriangle size={28} />}
              title="Multiple faces detected"
              message="This photo has more than one person in it. Please upload a photo with only yourself in frame."
              onCancel={onCancel}
            />
          )}

          {/* Body shot too low-res */}
          {stage === 'reject_low_res' && (
            <RejectPanel
              icon={<AlertTriangle size={28} />}
              title="Resolution too low"
              message="This photo's resolution is too low to use as a reference. Please choose a higher-resolution photo."
              onCancel={onCancel}
            />
          )}

          {/* Face shot: before/after preview */}
          {stage === 'preview' && (
            <div>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                We've cropped and lightly enhanced your photo. Looks good?
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <PreviewCard label="Original" src={originalUrl} />
                <PreviewCard label="Processed" src={processedUrl} accent />
              </div>
              <div className="flex gap-2">
                <SecondaryButton onClick={onCancel}>Choose Different</SecondaryButton>
                <PrimaryButton onClick={runQualityCheck}>Looks Good</PrimaryButton>
              </div>
            </div>
          )}

          {/* Stage 3 in progress */}
          {stage === 'quality_check' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Spinner size={28} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Running final quality check…</p>
            </div>
          )}

          {/* Stage 3 result */}
          {stage === 'result' && qualityResult && (
            <div>
              <div className="rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }}>
                <img src={processedUrl} alt="Processed" className="w-full h-full object-cover" />
              </div>

              <div className="mb-3">
                <StatusBadge result={qualityResult.result} />
              </div>

              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {qualityResult.reason}
              </p>

              {qualityResult.result === 'pass' && (
                <div className="flex gap-2">
                  <SecondaryButton onClick={onCancel}>Choose Different</SecondaryButton>
                  <PrimaryButton onClick={approveFace}><Check size={14} /> Use This Photo</PrimaryButton>
                </div>
              )}

              {qualityResult.result === 'warn' && (
                <div className="flex gap-2">
                  <SecondaryButton onClick={onCancel}><RefreshCw size={13} /> Retake</SecondaryButton>
                  <PrimaryButton onClick={approveFace}>Use Anyway</PrimaryButton>
                </div>
              )}

              {qualityResult.result === 'reject' && (
                <SecondaryButton full onClick={onCancel}><RefreshCw size={13} /> Choose Different Photo</SecondaryButton>
              )}
            </div>
          )}

          {/* Body shot preview — pass-through, no enhancement */}
          {stage === 'body_preview' && (
            <div>
              <div className="rounded-2xl overflow-hidden mb-4" style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }}>
                <img src={originalUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
                Body reference photos are used as-is, with no automatic cropping or enhancement.
              </p>
              <div className="flex gap-2">
                <SecondaryButton onClick={onCancel}>Choose Different</SecondaryButton>
                <PrimaryButton onClick={approveBody}><Check size={14} /> Use This Photo</PrimaryButton>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational helpers
// ─────────────────────────────────────────────────────────────────────────────
const PreviewCard = ({ label, src, accent }) => (
  <div>
    <p className="text-xs font-semibold mb-1.5" style={{ color: accent ? ACCENT : 'var(--text-muted)' }}>{label}</p>
    <div className="rounded-xl overflow-hidden" style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)', border: accent ? `1px solid ${ACCENT_BDR}` : '1px solid var(--border-color)' }}>
      {src && <img src={src} alt={label} className="w-full h-full object-cover" />}
    </div>
  </div>
)

const RejectPanel = ({ icon, title, message, onCancel, onOverride, overrideLabel = 'Use Anyway' }) => (
  <div className="flex flex-col items-center text-center py-8 gap-3">
    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
      {icon}
    </div>
    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
    <p className="text-xs max-w-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{message}</p>
    <div className="flex gap-2 mt-2">
      <button
        onClick={onCancel}
        className="px-5 py-2.5 rounded-xl text-xs font-bold"
        style={{
          background: 'var(--bg-elevated)',
          color:      'var(--text-secondary)',
          border:     '1px solid var(--border-color)',
        }}
      >
        Choose Different Photo
      </button>
      {onOverride && (
        <button
          onClick={onOverride}
          className="px-5 py-2.5 rounded-xl text-xs font-bold"
          style={{ background: ACCENT, color: '#fff' }}
        >
          {overrideLabel}
        </button>
      )}
    </div>
  </div>
)

const PrimaryButton = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
    style={{ background: ACCENT, color: '#fff' }}
  >
    {children}
  </button>
)

const SecondaryButton = ({ children, onClick, full }) => (
  <button
    onClick={onClick}
    className={`${full ? 'w-full' : 'flex-1'} flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]`}
    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
  >
    {children}
  </button>
)
