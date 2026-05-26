// src/pages/ResultPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, Share2, ArrowLeft, Upload, CheckCircle, Film, Image, Sparkles } from 'lucide-react'
import { generations, feed } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Loader } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function ResultPage() {
  const navigate        = useNavigate()
  const { id }          = useParams()
  const location        = useLocation()
  const { user }        = useAuth()

  const [generation, setGeneration] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished]   = useState(false)

  const outputUrl  = location.state?.outputUrl
  const outputType = location.state?.outputType

  useEffect(() => {
    const loadGeneration = async () => {
      const { data } = await generations.getById(id)
      setGeneration(data)
      setLoading(false)
    }
    loadGeneration()
  }, [id])

  const displayUrl  = outputUrl  || generation?.output_url
  const displayType = outputType || generation?.output_type || 'video'

  const handleDownload = async () => {
    if (!displayUrl) return
    try {
      const response = await fetch(displayUrl)
      const blob     = await response.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = `meckury-${id}.${displayType === 'video' ? 'mp4' : 'png'}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded!')
    } catch {
      window.open(displayUrl, '_blank')
    }
  }

  const handleShare = async () => {
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
  }

  const handlePublishToFeed = async () => {
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
  }

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 h-14 z-10"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Your creation
        </h1>
        <div className="w-10" />
      </div>

      {/* ── Media — takes all remaining space ── */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
        {loading && !displayUrl ? (
          <Loader size="lg" text="Loading..." />
        ) : displayUrl ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="w-full h-full flex items-center justify-center"
          >
            {displayType === 'video' ? (
              <video
                src={displayUrl}
                controls
                autoPlay
                loop
                playsInline
                className="rounded-2xl object-contain"
                style={{
                  maxWidth:  '100%',
                  maxHeight: '100%',
                  background: '#000',
                }}
              />
            ) : (
              <img
                src={displayUrl}
                alt="Generated"
                className="rounded-2xl object-contain"
                style={{ maxWidth: '100%', maxHeight: '100%' }}
              />
            )}
          </motion.div>
        ) : (
          <div className="text-center" style={{ color: 'var(--text-muted)' }}>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--bg-elevated)' }}
            >
              {displayType === 'video'
                ? <Film  size={28} style={{ color: 'var(--text-muted)' }} />
                : <Image size={28} style={{ color: 'var(--text-muted)' }} />
              }
            </div>
            <p className="text-sm">Content not available</p>
            <p className="text-xs mt-1">The generation may have failed or expired</p>
          </div>
        )}
      </div>

      {/* ── Actions bar ── */}
      {displayUrl && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.25 }}
          className="flex-shrink-0 px-4 pb-6 pt-3"
          style={{ borderTop: '1px solid var(--border-color)' }}
        >
          {/* Primary row — Download + Share */}
          <div className="flex gap-2 mb-2">
            <button
              onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.97]"
              style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
            >
              <Download size={15} />
              Download
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

          {/* Secondary row — Publish */}
          {!published ? (
            <button
              onClick={handlePublishToFeed}
              disabled={publishing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.97]"
              style={{
                background: 'transparent',
                color:      'var(--text-muted)',
                border:     '1px solid var(--border-color)',
                opacity:    publishing ? 0.6 : 1,
              }}
            >
              <Sparkles size={14} />
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
          ) : (
            <div
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-medium"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              <CheckCircle size={14} style={{ color: '#10b981' }} />
              Published
            </div>
          )}

          {/* Tertiary — Create something else */}
          <button
            onClick={() => navigate('/create')}
            className="w-full text-center text-xs mt-3"
            style={{ color: 'var(--text-muted)' }}
          >
            Create something else →
          </button>
        </motion.div>
      )}
    </div>
  )
}
