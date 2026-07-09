// src/components/media/CropFrameExtractModal.jsx
//
// Reframe/crop picker: a fixed-aspect box (matching the source video's own
// aspect ratio) stays centered while the user zooms and pans the video
// underneath it. Extraction reads back the box's on-screen window, converts
// it to native video pixel coordinates, and crops at full source resolution.
//
// Time scrub + crop are independent — user can pick both a moment in the
// video AND a reframed region, then extract combines them in one call.

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2, ZoomIn, RotateCcw } from 'lucide-react'
import { extractCroppedFrameAt } from '@/lib/videoFrame'

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const SEEK_THROTTLE_MS = 80

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

export default function CropFrameExtractModal({
  videoUrl,
  aspectRatio,   // e.g. '9:16', '16:9', '1:1' — the generation's own aspect ratio
  cost,
  isMaster,
  onExtract,     // (blob, { timestamp }) => Promise<void>
  onCancel,
}) {
  const videoRef       = useRef(null)
  const boxRef          = useRef(null)
  const dragStateRef    = useRef(null)
  const lastSeekAtRef   = useRef(0)
  const pendingSeekRef  = useRef(null)

  const [ready,      setReady]      = useState(false)
  const [duration,   setDuration]   = useState(0)
  const [scrubTime,  setScrubTime]  = useState(0)
  const [zoom,       setZoom]       = useState(MIN_ZOOM)
  const [pan,        setPan]        = useState({ x: 0, y: 0 })
  const [extracting, setExtracting] = useState(false)

  const boxAspect = parseAspect(aspectRatio)

  // ── Load metadata, default scrub to last frame ────────────────────────────
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

  // ── Geometry ────────────────────────────────────────────────────────────
  // displayScale = CSS px per native video px, at current zoom, such that the
  // video always fully covers the box (cover-fit at zoom=1, tighter at zoom>1).
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

    // Max pan so the video never leaves a gap at the box edges
    const maxPanX = Math.max(0, (videoDispW - boxW) / 2)
    const maxPanY = Math.max(0, (videoDispH - boxH) / 2)

    return { boxW, boxH, baseScale, displayScale, videoDispW, videoDispH, maxPanX, maxPanY }
  }, [zoom])

  // Clamp pan whenever zoom changes
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

  // ── Extract ─────────────────────────────────────────────────────────────
  const handleExtract = async () => {
    if (extracting) return
    const geo = getGeometry()
    if (!geo) return
    const v = videoRef.current

    // Convert box window -> native video pixel source rect
    const sWidth  = geo.boxW / geo.displayScale
    const sHeight = geo.boxH / geo.displayScale
    const sx = (v.videoWidth  - sWidth)  / 2 - pan.x / geo.displayScale
    const sy = (v.videoHeight - sHeight) / 2 - pan.y / geo.displayScale

    setExtracting(true)
    try {
      const blob = await extractCroppedFrameAt(videoUrl, scrubTime, { sx, sy, sWidth, sHeight })
      await onExtract(blob, { timestamp: scrubTime })
    } finally {
      setExtracting(false)
    }
  }

  const videoStyle = (() => {
    const geo = getGeometry()
    if (!geo) return { opacity: 0 }
    return {
      width:     geo.videoDispW,
      height:    geo.videoDispH,
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
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
        className="w-full max-w-sm rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Crop box — this container IS the crop window */}
        <div
          ref={boxRef}
          className="relative w-full overflow-hidden select-none"
          style={{ background: '#000', aspectRatio: `${boxAspect}`, maxHeight: 420, cursor: ready ? 'grab' : 'default' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <video
            ref={videoRef}
            src={videoUrl}
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
          {/* Rule-of-thirds guide, purely visual */}
          {ready && (
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)`,
              backgroundSize: '33.33% 33.33%',
            }} />
          )}
        </div>

        {/* Zoom */}
        <div className="px-4 pt-3 flex items-center gap-2.5">
          <ZoomIn size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="range"
            min={MIN_ZOOM} max={MAX_ZOOM} step={0.01}
            value={zoom}
            disabled={!ready}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--brand)' }}
          />
          <button
            onClick={resetCrop}
            disabled={!ready || (zoom === MIN_ZOOM && pan.x === 0 && pan.y === 0)}
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
            disabled={!ready}
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
            disabled={!ready || extracting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: !ready || extracting ? 'var(--bg-card)' : 'var(--brand)',
              color:      !ready || extracting ? 'var(--text-muted)' : '#fff',
            }}
          >
            {extracting ? <Loader2 size={14} className="animate-spin" /> : null}
            Extract Cropped Frame{!isMaster ? ` · ${cost} cr` : ''}
          </button>
          <button
            onClick={onCancel}
            disabled={extracting}
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
