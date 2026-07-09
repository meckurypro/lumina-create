// src/components/media/FrameExtractModal.jsx
//
// Lets the user scrub through a video and extract the exact frame they land
// on, OR extract the absolute last frame via the existing precise crawl-to-end
// logic in videoFrame.js (extractLastFrame — untouched behavior).
//
// Slider drag is throttled (~80ms) so we don't hammer video.currentTime /
// force a decode on every pointermove tick. The <video> element itself is
// the live preview — no canvas render until the user actually extracts.

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Loader2, SkipForward } from 'lucide-react'
import { extractLastFrame, extractFrameAt } from '@/lib/videoFrame'

const SEEK_THROTTLE_MS = 80

function fmtTime(s) {
  if (!Number.isFinite(s)) return '0:00.0'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

export default function FrameExtractModal({
  videoUrl,
  cost,
  isMaster,
  onExtract,   // (blob, { isEndFrame }) => Promise<void> — caller handles upload/credits/toasts
  onCancel,
}) {
  const videoRef        = useRef(null)
  const lastSeekAtRef   = useRef(0)
  const pendingSeekRef  = useRef(null)

  const [duration,   setDuration]   = useState(0)
  const [scrubTime,  setScrubTime]  = useState(0)
  const [ready,      setReady]      = useState(false)
  const [dragging,   setDragging]   = useState(false)
  const [extracting, setExtracting] = useState(null) // 'frame' | 'end' | null

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

  const handleExtractFrame = async () => {
    if (extracting) return
    setExtracting('frame')
    try {
      const blob = await extractFrameAt(videoUrl, scrubTime)
      await onExtract(blob, { isEndFrame: false, timestamp: scrubTime })
    } finally {
      setExtracting(null)
    }
  }

  const handleExtractEnd = async () => {
    if (extracting) return
    setExtracting('end')
    try {
      const blob = await extractLastFrame(videoUrl)
      await onExtract(blob, { isEndFrame: true, timestamp: duration })
    } finally {
      setExtracting(null)
    }
  }

  const isAtEnd = duration > 0 && scrubTime >= duration - 0.05

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
        {/* Preview */}
        <div className="relative w-full" style={{ background: '#000', aspectRatio: '9/16', maxHeight: 380 }}>
          <video
            ref={videoRef}
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            className="w-full h-full object-contain"
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={22} className="animate-spin" style={{ color: 'rgba(255,255,255,0.8)' }} />
            </div>
          )}
        </div>

        {/* Scrubber */}
        <div className="px-4 pt-3 pb-1 flex flex-col gap-1.5">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.01}
            value={scrubTime}
            disabled={!ready}
            onChange={handleSlider}
            onPointerDown={() => setDragging(true)}
            onPointerUp={() => setDragging(false)}
            className="w-full"
            style={{ accentColor: 'var(--brand)' }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {fmtTime(scrubTime)}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {fmtTime(duration)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
          <button
            onClick={handleExtractFrame}
            disabled={!ready || !!extracting}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: !ready || extracting ? 'var(--bg-card)' : 'var(--brand)',
              color:      !ready || extracting ? 'var(--text-muted)' : '#fff',
            }}
          >
            {extracting === 'frame' ? <Loader2 size={14} className="animate-spin" /> : null}
            Extract This Frame{!isMaster ? ` · ${cost} cr` : ''}
          </button>

          <button
            onClick={handleExtractEnd}
            disabled={!ready || !!extracting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'transparent',
              color: !ready || extracting ? 'var(--text-muted)' : 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}
          >
            {extracting === 'end'
              ? <Loader2 size={13} className="animate-spin" />
              : <SkipForward size={13} />}
            {isAtEnd ? `Extract Absolute End Frame${!isMaster ? ` · ${cost} cr` : ''}` : 'Jump to Absolute End Frame'}
          </button>

          <button
            onClick={onCancel}
            disabled={!!extracting}
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
