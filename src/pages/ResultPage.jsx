// src/pages/ResultPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Download, Share2, ArrowLeft, Upload, CheckCircle, Film, Image } from 'lucide-react'
import { generations, feed } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
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
      a.download     = `meckury-${id}.${displayType === 'video' ? 'mp4' : 'jpg'}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded!')
    } catch {
      // CORS fallback — fal.ai CDN may not allow fetch; open in new tab instead
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

    // NOTE: for video posts, thumbnail_url should ideally be a separate
    // static image. If your schema requires it, generate/store a thumbnail
    // during generation and use generation.thumbnail_url here instead.
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

    if (error) { toast.error('Failed to submit to feed'); return }

    setPublished(true)
    toast.success('Submitted for review! 🎉')
  }

  return (
    <div className="page-container min-h-dvh" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-4 h-14"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => navigate('/create')}
          className="flex items-center gap-2 p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Back to create"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold" style={{ fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)' }}>
          Your creation
        </h1>
        <div className="w-10" aria-hidden="true" />
      </div>

      <div className="px-4 py-5 pb-32">
        {loading && !displayUrl ? (
          <Loader size="lg" text="Loading your creation..." />
        ) : displayUrl ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            {/* Preview */}
            <div
              className="rounded-3xl overflow-hidden mb-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              {displayType === 'video' ? (
                <video
                  src={displayUrl} controls autoPlay loop playsInline
                  className="w-full max-h-[70vh] object-contain"
                  style={{ background: '#000' }}
                />
              ) : (
                <img src={displayUrl} alt="Generated content" className="w-full max-h-[70vh] object-contain" />
              )}
            </div>

            <div
              className="flex items-center gap-2 mb-6 p-3 rounded-2xl"
              style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)' }}
            >
              <CheckCircle size={18} style={{ color: 'var(--brand)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>
                Creation complete! Download or share it.
              </p>
            </div>

            <div className="flex gap-3 mb-4">
              <Button onClick={handleDownload} variant="primary" size="lg" fullWidth icon={Download}>
                Download
              </Button>
              <Button onClick={handleShare} variant="secondary" size="lg" icon={Share2}>
                Share
              </Button>
            </div>

            {!published ? (
              <Button onClick={handlePublishToFeed} loading={publishing} variant="outline" size="md" fullWidth icon={Upload}>
                Submit to community feed
              </Button>
            ) : (
              <div
                className="flex items-center justify-center gap-2 py-3 rounded-2xl"
                style={{ background: 'rgba(249,115,22,0.08)' }}
              >
                <CheckCircle size={16} style={{ color: 'var(--brand)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--brand)' }}>Submitted for review!</p>
              </div>
            )}

            <div className="mt-4 text-center">
              <button
                onClick={() => navigate('/create')}
                className="text-sm font-semibold"
                style={{ color: 'var(--text-muted)' }}
              >
                Create something else →
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'var(--bg-elevated)' }}
            >
              {displayType === 'video'
                ? <Film  size={28} style={{ color: 'var(--text-muted)' }} />
                : <Image size={28} style={{ color: 'var(--text-muted)' }} />
              }
            </div>
            <p>Content not available</p>
            <p className="text-xs mt-1">The generation may have failed or expired</p>
          </div>
        )}
      </div>
    </div>
  )
}
