// src/components/media/FrameExtractModal.jsx
//
// Unified frame extraction picker — merges what used to be two separate
// modals (plain frame scrubber + crop/reframe tool) into one flow:
//
//   1. Scrub to find a moment in the video (time slider)
//   2. Optionally zoom/pan to reframe (zoom slider + drag on preview)
//   3. Extract — captures whatever the preview currently shows
//
// The crop box IS the preview container, sized to the video's own aspect
// ratio. At zoom=1 with no pan, the "crop" exactly matches the full frame —
// so there's no separate "extract without cropping" path needed; cropping
// is just an optional refinement of the same single extraction action.
//
// "Jump to End Frame" only moves the scrub position to the precise last
// decodable frame (via the same crawl algorithm as before) — it does NOT
// extract by itself. Once you're at that exact position, the button hides,
// since "Extract Frame" now IS the end-frame extraction — no redundant
// second button doing the same thing.
//
// FIRE-AND-FORGET EXTRACTION: this modal is never unmounted by a click on
// Extract. The parent owns a `busy` prop that goes true while the upload /
// credit-deduct step runs in the background; this modal just disables its
// buttons during that window. When `busy` goes false again, the user is
// looking at the exact same scrub/zoom/pan state they fired the extraction
// from — nothing here resets — so they can immediately fire another
// extraction of a different crop of the same frame without redoing any
// setup. The user closes the modal manually via Cancel.

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2, ZoomIn, RotateCcw, SkipForward } from 'lucide-react'
import { captureCroppedFrameFromVideoElement, crawlToExactEndTime } from '@/lib/videoFrame'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const SEEK_THROTTLE_MS = 80
const END_EPSILON = 0.02 // how close scrubTime must be to a crawled end result to still count as "at end"

function fmtTime(s) {
  if (!Number.isFinite(s)) return '0:00.0'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

// Parses '9:16' -> 9/16. Falls back to 9/16 if unparseable.
function parseAspect(aspectRatio) {
  const [w, h] = String(aspectRatio || '9:16').split(':').map(Number)
  if (!w || !h) return 9 / 16
  return w / h
}

export default function FrameExtractModal({
  videoUrl,
  aspectRatio,   // e.g. '9:16', '16:9', '1:1' — the generation's own aspect ratio
  cost,
  isMaster,
  busy = false,  // true while a previously-fired extraction is uploading/deducting credits in the parent
  onExtract,     // (blob, { timestamp, isEndFrame }) => Promise<void> — parent handles upload/credits/toasts, does NOT close this modal
  onCancel,
}) {
  const videoRef       = useRef(null)
  const boxRef          = useRef(null)
  const objUrlRef       = useRef(null)
  const dragStateRef    = useRef(null)
  const lastSeekAtRef   = useRef(0)
  const pendingSeekRef  = useRef(null)

  const [ready,        setReady]        = useState(false)
  const [duration,     setDuration]     = useState(0)
  const [scrubTime,    setScrubTime]    = useState(0)
  const [zoom,         setZoom]         = useState(MIN_ZOOM)
  const [pan,          setPan]          = useState({ x: 0, y: 0 })
  const [exactEndTime, setExactEndTime] = useState(null) // set once crawl has run; null = not verified
  const [jumping,      setJumping]      = useState(false)
  const [capturing,    setCapturing]    = useState(false) // local canvas-capture step only (fast)

  const boxAspect = parseAspect(aspectRatio)
  const isAtExactEnd = exactEndTime !== null && Math.abs(scrubTime - exactEndTime) <= END_EPSILON
  const disabled = busy || capturing || jumping

  // ── Load video once via blob URL (avoids canvas taint, avoids re-fetching
  //    per extraction — the same element is used for preview AND capture) ──
  useEffect(() => {
    let cancelled = false
    fetch(videoUrl)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return
        const objUrl = URL.createObjectURL(blob)
        objUrlRef.current = objUrl
        if (videoRef.current) videoRef.current.src = objUrl
      })
    return () => {
      cancelled = true
      if (objUrlRef.current) URL.revokeObjectURL(objUrlRef.current)
    }
  }, [videoUrl])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    const onLoaded = () => {
      setDuration(v.duration)
      const start = Math.max(0, v.duration - 0.001)
      v.currentTime = start
      setScrubTime(start)
      setReady(true)
    }
    v.addEventListener('loadedmetadata', onLoaded)
    return () => v.removeEventListener('loadedmetadata', onLoaded)
  }, [])

  const seekTo = useCallback((t) => {
    const v = videoRef.current
    if (!v) return
    const now = Date.now()
    const remaining = SEEK_THROTTLE_MS - (now - lastSeekAtRef.current)
    clearTimeout(pendingSeekRef.current)
    if (remaining <= 0) {
      lastSeekAtRef.current = now
      v.currentTime = t
    } else {
      pendingSeekRef.current = setTimeout(() => {
        lastSeekAtRef.current = Date.now()
        v.currentTime = t
      }, remaining)
    }
  }, [])

  const handleSlider = (e) => {
    const t = Number(e.target.value)
    setScrubTime(t)
    seekTo(t)
  }

  // ── Jump to exact end — moves the scrub position only, never extracts ────
  const handleJumpToEnd = async () => {
    const v = videoRef.current
    if (!v || disabled) return
    setJumping(true)
    try {
      const exact = await crawlToExactEndTime(v, duration)
      setExactEndTime(exact)
      setScrubTime(exact)
    } catch {
      setScrubTime(duration)
    } finally {
      setJumping(false)
    }
  }

  // ── Geometry (crop box <-> native video pixel mapping) ───────────────────
  const getGeometry = useCallback(() => {
    const v = videoRef.current
    const box = boxRef.current
    if (!v || !box || !v.videoWidth) return null

    const boxW = box.clientWidth
    const boxH = box.clientHeight
    const baseScale = Math.max(boxW / v.videoWidth, boxH / v.videoHeight)
    const displayScale = baseScale * zoom

    const videoDispW = v.videoWidth  * displayScale
    const videoDispH = v.videoHeight * displayScale

    const maxPanX = Math.max(0, (videoDispW - boxW) / 2)
    const maxPanY = Math.max(0, (videoDispH - boxH) / 2)

    return { boxW, boxH, baseScale, displayScale, videoDispW, videoDispH, maxPanX, maxPanY }
  }, [zoom])

  useEffect(() => {
    const geo = getGeometry()
    if (!geo) return
    setPan((p) => ({
      x: Math.min(Math.max(p.x, -geo.maxPanX), geo.maxPanX),
      y: Math.min(Math.max(p.y, -geo.maxPanY), geo.maxPanY),
    }))
  }, [zoom, getGeometry])

  // ── Drag to pan ─────────────────────────────────────────────────────────
  const onPointerDown = (e) => {
    if (disabled) return
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!dragStateRef.current) return
    const geo = getGeometry()
    if (!geo) return
    const dx = e.clientX - dragStateRef.current.startX
    const dy = e.clientY - dragStateRef.current.startY
    setPan({
      x: Math.min(Math.max(dragStateRef.current.panX + dx, -geo.maxPanX), geo.maxPanX),
      y: Math.min(Math.max(dragStateRef.current.panY + dy, -geo.maxPanY), geo.maxPanY),
    })
  }
  const onPointerUp = () => { dragStateRef.current = null }

  const resetCrop = () => { setZoom(MIN_ZOOM); setPan({ x: 0, y: 0 }) }

  // ── Extract — fires the parent's onExtract and returns immediately once
  //    the capture (fast, local) is done. Does NOT close this modal, does
  //    NOT reset scrub/zoom/pan. Parent shows its own overlay via `busy`. ──
  const handleExtract = async () => {
    if (disabled) return
    const geo = getGeometry()
    if (!geo) return
    const v = videoRef.current

    const sWidth  = geo.boxW / geo.displayScale
    const sHeight = geo.boxH / geo.displayScale
    const sx = (v.videoWidth  - sWidth)  / 2 - pan.x / geo.displayScale
    const sy = (v.videoHeight - sHeight) / 2 - pan.y / geo.displayScale

    setCapturing(true)
    try {
      const blob = await captureCroppedFrameFromVideoElement(v, { sx, sy, sWidth, sHeight })
      // Fire-and-forget from this modal's perspective — parent's promise
      // may take a while (upload + credit deduction), but we don't await
      // gating our own UI on it beyond the `busy` prop the parent controls.
      onExtract(blob, { timestamp: scrubTime, isEndFrame: isAtExactEnd })
    } finally {
      setCapturing(false)
    }
  }

 const videoStyle = (() => {
    const geo = getGeometry()
    if (!geo) return { opacity: 0 }
    return {
      width:     geo.videoDispW,
      height:    geo.videoDispH,
      maxWidth:  'none',   // override Tailwind Preflight's `video { max-width: 100% }` —
      maxHeight: 'none',   // without this, the video is silently clamped to box size
      transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px)`,
      position:  'absolute',
      left:      '50%',
      top:       '50%',
      touchAction: 'none',
    }
  })()

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={disabled ? undefined : onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Outer wrapper gives the box a DEFINITE height; box derives width
            from aspectRatio off that height, capped by maxWidth so wide
            (16:9) sources don't overflow the modal. This keeps the box's
            actual rendered ratio true to boxAspect at all times — unlike
            width:100% + aspect-ratio + maxHeight, which conflict and
            silently distort the box when the height cap kicks in. */}
        <div className="w-full flex justify-center" style={{ background: '#000', height: 420 }}>
          <div
            ref={boxRef}
            className="relative h-full overflow-hidden select-none"
            style={{ aspectRatio: `${boxAspect}`, maxWidth: '100%', cursor: ready && !disabled ? 'grab' : 'default' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <video
              ref={videoRef}
              muted
              playsInline
              preload="auto"
              style={videoStyle}
            />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.8)' }} />
              </div>
            )}
            {ready && (zoom > MIN_ZOOM || pan.x !== 0 || pan.y !== 0) && (
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)`,
                backgroundSize: '33.33% 33.33%',
              }} />
            )}
          </div>
        </div>

        {/* Zoom */}
        <div className="px-4 pt-3 flex items-center gap-2.5">
          <ZoomIn size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="range"
            min={MIN_ZOOM} max={MAX_ZOOM} step={0.01}
            value={zoom}
            disabled={!ready || disabled}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--brand)' }}
          />
          <button
            onClick={resetCrop}
            disabled={!ready || disabled || (zoom === MIN_ZOOM && pan.x === 0 && pan.y === 0)}
            className="p-1.5 rounded-lg flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}
            title="Reset crop"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        {/* Time scrub */}
        <div className="px-4 pt-2 pb-1 flex flex-col gap-1.5">
          <input
            type="range"
            min={0} max={duration || 0} step={0.01}
            value={scrubTime}
            disabled={!ready || disabled}
            onChange={handleSlider}
            className="w-full"
            style={{ accentColor: 'var(--brand)' }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{fmtTime(scrubTime)}</span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtTime(duration)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
          <button
            onClick={handleExtract}
            disabled={!ready || disabled}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: !ready || disabled ? 'var(--bg-card)' : 'var(--brand)',
              color:      !ready || disabled ? 'var(--text-muted)' : '#fff',
            }}
          >
            {capturing || busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {isAtExactEnd ? 'Extract End Frame' : 'Extract Frame'}{!isMaster ? ` · ${cost} cr` : ''}
          </button>

          {/* Only shown when NOT already at the verified exact end —
              once there, "Extract Frame" above already covers it, so a
              second button doing the same thing would be redundant. */}
          {!isAtExactEnd && (
            <button
              onClick={handleJumpToEnd}
              disabled={!ready || disabled}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{
                background: 'transparent',
                color: !ready || disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              {jumping ? <Loader2 size={13} className="animate-spin" /> : <SkipForward size={13} />}
              Jump to End Frame
            </button>
          )}

          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
