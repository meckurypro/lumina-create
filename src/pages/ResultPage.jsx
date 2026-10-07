// src/pages/ResultPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Share2, ArrowLeft, Sparkles, CheckCircle, Film, Image } from 'lucide-react'
import { generations, feed } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

// ─── Skeleton ────────────────────────────────────────────
const MediaSkeleton = () => (
  <div
    className="w-full h-full rounded-2xl animate-pulse"
    style={{ background: 'var(--bg-elevated)', maxWidth: 420, maxHeight: '70dvh', aspectRatio: '9/16' }}
  />
)

// ─── Empty state ─────────────────────────────────────────
const EmptyState = ({ type }) => (
  <div className="flex flex-col items-center gap-3 text-center">
    <div
      className="w-16 h-16 rounded-2xl flex items-center justify-center"
      style={{ background: 'var(--bg-elevated)' }}
    >
      {type === 'video'
        ? <Film  size={28} style={{ color: 'var(--text-muted)' }} />
        : <Image size={28} style={{ color: 'var(--text-muted)' }} />
      }
    </div>
    <div>
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Content not available</p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>The generation may have failed or expired</p>
    </div>
  </div>
)

// ─── Main page ────────────────────────────────────────────
export default function ResultPage() {
  const navigate          = useNavigate()
  const { id }            = useParams()
  const location          = useLocation()
  const { user, profile } = useAuth()
  const isNovice          = profile?.user_tier !== 'master'

  // ── Derive from nav state immediately — no DB wait ──────
  const stateUrl  = location.state?.outputUrl
  const stateType = location.state?.outputType

  const [generation,  setGeneration]  = useState(null)
  const [mediaReady,  setMediaReady]  = useState(false)   // media element fired onCanPlay / onLoad
  const [dbLoading,   setDbLoading]   = useState(!stateUrl) // skip DB loading if we already have URL
  const [publishing,  setPublishing]  = useState(false)
  const [published,   setPublished]   = useState(false)
  const [dlLoading,   setDlLoading]   = useState(false)

  // ── Resolved URL / type (state wins, DB fills fallback) ──
  const displayUrl  = stateUrl  || generation?.output_url
  const displayType = stateType || generation?.output_type || 'video'

  // ── DB fetch — runs in background, doesn't block render ─
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data } = await generations.getById(id)
      if (!cancelled) {
        setGeneration(data)
        setDbLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // ── Download ────────────────────────────────────────────
  // The `download` HTML attribute is IGNORED for cross-origin
  // URLs, so clicking would navigate to Supabase Storage instead
  // of saving. We fetch the asset as a blob and trigger a save
  // from a same-origin object URL. This guarantees one-click
  // download with no redirect.
  const handleDownload = useCallback(async () => {
    if (!displayUrl) return
    setDlLoading(true)
    const filename = `meckury-${id}.${displayType === 'video' ? 'mp4' : 'png'}`
    try {
      const res = await fetch(displayUrl, { mode: 'cors', credentials: 'omit' })
      if (!res.ok) throw new Error('Network response was not ok')
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Revoke after a tick so the download has time to start
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      toast.success('Download started!')
    } catch (err) {
      console.error('Download failed', err)
      toast.error('Download failed — opening in a new tab')
      window.open(displayUrl, '_blank', 'noopener,noreferrer')
    } finally {
      setDlLoading(false)
    }
  }, [displayUrl, displayType, id])

  // ── Share ────────────────────────────────────────────────
  const handleShare = useCallback(async () => {
    if (!displayUrl) return
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Created with Meckury AI',
          text:  'Check out this AI creation!',
          url:   displayUrl,
        })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(displayUrl)
      toast.success('Link copied!')
    }
  }, [displayUrl])

  // ── Publish ──────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!generation || !displayUrl) return
    setPublishing(true)
    const { error } = await feed.submit({
      user_id:       user.id,
      generation_id: id,
      template_id:   generation.template_id,
      thumbnail_url: generation.thumbnail_url || displayUrl,
      output_url:    displayUrl,
      output_type:   displayType,
    })
    setPublishing(false)
    if (error) { toast.error('Failed to publish'); return }
    setPublished(true)
    toast.success('Published!')
  }, [generation, displayUrl, displayType, id, user?.id])

  const showSkeleton = !displayUrl && dbLoading

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 h-14 z-10"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm lg:text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          Your creation
        </h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

      {/* ── Media (screening room) ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center p-4 lg:p-10"
        style={{ background: 'radial-gradient(70% 60% at 50% 40%, var(--brand-light), transparent 70%), var(--bg-secondary)' }}>
        <AnimatePresence mode="wait">
          {showSkeleton ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex items-center justify-center"
            >
              <MediaSkeleton />
            </motion.div>

          ) : displayUrl ? (
            <motion.div
              key="media"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: mediaReady ? 1 : 0.4, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full flex items-center justify-center"
            >
              {displayType === 'video' ? (
                <video
                  src={displayUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  // preload="metadata" — fetch enough to show first frame; mobile browsers
                  // may ignore this anyway but it signals intent without forcing full download
                  preload="metadata"
                  onCanPlay={() => setMediaReady(true)}
                  className="rounded-2xl object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%', background: '#000', border: '1px solid var(--glass-border)', boxShadow: '0 40px 90px -40px rgba(0,0,0,0.75)' }}
                />
              ) : (
                <img
                  src={displayUrl}
                  alt="Generated"
                  // fetchpriority="high" tells the browser this is the most important asset
                  fetchPriority="high"
                  decoding="async"
                  onLoad={() => setMediaReady(true)}
                  className="rounded-2xl object-contain"
                  style={{ maxWidth: '100%', maxHeight: '100%', border: '1px solid var(--glass-border)', boxShadow: '0 40px 90px -40px rgba(0,0,0,0.75)' }}
                />
              )}
            </motion.div>

          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <EmptyState type={displayType} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Actions ── */}
      <AnimatePresence>
        {displayUrl && (
          <motion.div
            key="actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="flex-shrink-0 px-4 pb-6 pt-3 border-t lg:border-t-0 lg:border-l lg:w-[360px] lg:pt-8 lg:px-6 lg:overflow-y-auto"
            style={{ borderColor: 'var(--border-color)', background: 'var(--bg-primary)' }}
          >
            {/* Details */}
            {generation && (generation.prompt || generation.model) && (
              <div className="mb-4">
                {generation.prompt && (
                  <p className="text-sm leading-relaxed mb-3 line-clamp-3 lg:line-clamp-6" style={{ color: 'var(--text-secondary)' }}>
                    {generation.prompt}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {[generation.model, generation.aspect_ratio, generation.duration ? `${generation.duration}s` : null].filter(Boolean).map((t) => (
                    <span key={t} className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>{t}</span>
                  ))}
                </div>
              </div>
            )}
            {/* Primary — Download + Share */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={handleDownload}
                disabled={dlLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{
                  background: 'var(--gradient-brand)',
                  color:      '#ffffff',
                  boxShadow:  'var(--shadow-brand)',
                  opacity:    dlLoading ? 0.7 : 1,
                }}
              >
                <Download size={15} />
                {dlLoading ? 'Starting…' : 'Download'}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              >
                <Share2 size={15} />
                Share
              </button>
            </div>

            {/* Secondary — Publish (Masters only) */}
            {!isNovice && (
              published ? (
                <div
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                >
                  <CheckCircle size={14} style={{ color: '#10b981' }} />
                  Published
                </div>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={publishing || !generation}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.97]"
                  style={{
                    background: 'transparent',
                    color:      'var(--text-muted)',
                    border:     '1px solid var(--border-color)',
                    opacity:    publishing || !generation ? 0.6 : 1,
                  }}
                >
                  <Sparkles size={14} />
                  {publishing ? 'Publishing…' : 'Publish'}
                </button>
              )
            )}

            {/* Tertiary */}
            <button
              onClick={() => navigate('/create')}
              className="w-full text-center text-xs mt-3"
              style={{ color: 'var(--text-muted)' }}
            >
              Create something else →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>

    </div>
  )
}
