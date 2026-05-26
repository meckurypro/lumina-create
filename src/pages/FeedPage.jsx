// src/pages/FeedPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Play, Film, Image, X, Sparkles, ArrowRight, Star, TrendingUp, Users, ChevronRight } from 'lucide-react'
import { feed as feedDb, templates as templatesDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton, EmptyState } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

// ─── Video Modal ──────────────────────────────────────────

const VideoModal = ({ url, onClose }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.9)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute -top-10 right-0 p-2 rounded-xl text-white"
            aria-label="Close video"
          >
            <X size={20} />
          </button>
          <video
            src={url}
            controls autoPlay playsInline loop
            className="w-full rounded-3xl"
            style={{ background: '#000', maxHeight: '80vh', objectFit: 'contain' }}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Template Discover Card ───────────────────────────────

const TemplateDiscoverCard = ({ template, index, onUse }) => {
  const creditLabel = template.credit_cost_per_image
    ? `${template.credit_cost_per_image} cr/photo`
    : `${template.credit_cost ?? 2} credits`

  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onUse(template)}
      className="flex-shrink-0 w-40 rounded-3xl overflow-hidden text-left"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div
        className="h-24 w-full relative flex items-center justify-center"
        style={{
          background: template.thumbnail_url
            ? undefined
            : 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,88,12,0.08))',
        }}
      >
        {template.thumbnail_url ? (
          <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover" />
        ) : (
          <Sparkles size={28} style={{ color: 'var(--brand)', opacity: 0.5 }} />
        )}

        {template.is_featured && (
          <div
            className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold"
            style={{ background: 'var(--brand)', color: 'white', fontSize: '9px' }}
          >
            <Star size={8} fill="white" />
            Hot
          </div>
        )}

        <div
          className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-full font-bold"
          style={{ background: 'rgba(0,0,0,0.55)', color: 'white', backdropFilter: 'blur(4px)', fontSize: '9px' }}
        >
          ⚡ {creditLabel}
        </div>
      </div>

      <div className="px-3 py-2.5 flex items-center justify-between">
        <p className="text-xs font-bold leading-tight flex-1 mr-1" style={{ color: 'var(--text-primary)' }}>
          {template.name}
        </p>
        <ArrowRight size={13} style={{ color: 'var(--brand)', flexShrink: 0 }} />
      </div>
    </motion.button>
  )
}

// ─── Trending Feed Card ───────────────────────────────────

const TrendingCard = ({ post, rank, liked, onLike, onPlayVideo }) => {
  const isVideo = post.output_type === 'video'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06 }}
      className="rounded-3xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] max-h-80 bg-black overflow-hidden">
        <img
          src={post.thumbnail_url}
          alt={post.title || `Creation by @${post.profiles?.username}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Rank badge */}
        <div
          className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center font-black text-white"
          style={{
            background: rank === 0 ? 'var(--brand)' : 'rgba(0,0,0,0.6)',
            fontSize: '10px',
            backdropFilter: 'blur(4px)',
          }}
        >
          {rank + 1}
        </div>

        {/* Type badge */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(4px)' }}
        >
          {isVideo ? <Film size={10} /> : <Image size={10} />}
        </div>

        {/* Play button for video */}
        {isVideo && (
          <button
            onClick={() => onPlayVideo(post.output_url || post.thumbnail_url)}
            className="absolute inset-0 flex items-center justify-center"
            aria-label={`Play video by @${post.profiles?.username}`}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            >
              <Play size={16} fill="white" className="text-white ml-0.5" />
            </div>
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--brand)', color: 'white' }}
          >
            {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
            @{post.profiles?.username || 'user'}
          </p>
        </div>

        <button
          onClick={() => onLike(post.id)}
          aria-label={liked ? 'Unlike' : 'Like'}
          className="flex items-center gap-1 px-2 py-1 rounded-xl flex-shrink-0"
          style={{
            background: liked ? 'rgba(249,115,22,0.12)' : 'var(--bg-elevated)',
            color: liked ? 'var(--brand)' : 'var(--text-muted)',
          }}
        >
          <Heart size={12} fill={liked ? 'currentColor' : 'none'} />
          <span style={{ fontSize: '11px', fontWeight: 700 }}>{post.likes_count || 0}</span>
        </button>
      </div>
    </motion.div>
  )
}

// ─── See All Banner ───────────────────────────────────────

const SeeAllBanner = ({ count, onClick }) => (
  <motion.button
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4 rounded-2xl mt-1"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(249,115,22,0.1)' }}
      >
        <Users size={16} style={{ color: 'var(--brand)' }} />
      </div>
      <div className="text-left">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          All community posts
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Browse everything the community has made
        </p>
      </div>
    </div>
    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
  </motion.button>
)

// ─── Feed Page ────────────────────────────────────────────

export default function FeedPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [trending,          setTrending]          = useState([])
  const [publicTemplates,   setPublicTemplates]   = useState([])
  const [templatesLoading,  setTemplatesLoading]  = useState(true)
  const [trendingLoading,   setTrendingLoading]   = useState(true)
  const [likedPosts,        setLikedPosts]        = useState(new Set())
  const [activeVideo,       setActiveVideo]       = useState(null)

  // Load templates
  useEffect(() => {
    const loadTemplates = async () => {
      const { data } = await templatesDb.getPublic()
      setPublicTemplates(data || [])
      setTemplatesLoading(false)
    }
    loadTemplates()
  }, [])

  // Load trending
  useEffect(() => {
    const loadTrending = async () => {
      const { data } = await feedDb.getTrending({ limit: 8 })
      setTrending(data || [])
      setTrendingLoading(false)
    }
    loadTrending()
  }, [])

  // Load user likes
  const loadUserLikes = useCallback(async () => {
    if (!user) return
    const { data } = await feedDb.getUserLikes(user.id)
    setLikedPosts(new Set(data || []))
  }, [user])

  useEffect(() => { loadUserLikes() }, [loadUserLikes])

  const handleLike = async (postId) => {
    if (!user) return toast.error('Sign in to like posts')
    const wasLiked = likedPosts.has(postId)

    // Optimistic update
    setLikedPosts((prev) => {
      const next = new Set(prev)
      wasLiked ? next.delete(postId) : next.add(postId)
      return next
    })
    setTrending((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      )
    )

    const { data } = await feedDb.toggleLike(user.id, postId)
    if (!data?.success) {
      // Rollback
      setLikedPosts((prev) => {
        const next = new Set(prev)
        wasLiked ? next.add(postId) : next.delete(postId)
        return next
      })
      setTrending((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, likes_count: wasLiked ? p.likes_count + 1 : p.likes_count - 1 }
            : p
        )
      )
    }
  }

  const handleTemplateUse = (template) => {
    navigate('/generate', {
      state: {
        type:                'template',
        templateId:          template.id,
        templateSlug:        template.slug,
        templateName:        template.name,
        templateDescription: template.description,
        minImages:           template.min_images,
        maxImages:           template.max_images,
        creditCost:          template.credit_cost,
        creditCostPerImage:  template.credit_cost_per_image,
      },
    })
  }

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>

        {/* Header */}
        <div className="pt-2 pb-5">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Discover
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Templates + community creations
          </p>
        </div>

        {/* Templates strip */}
        {(templatesLoading || publicTemplates.length > 0) && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
                ✦ Templates
              </p>
              <button
                onClick={() => navigate('/create')}
                className="text-xs font-semibold flex items-center gap-1"
                style={{ color: 'var(--brand)' }}
              >
                See all <ArrowRight size={12} />
              </button>
            </div>

            {templatesLoading ? (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-40 h-40 rounded-3xl" style={{ background: 'var(--bg-card)' }} />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
                {publicTemplates.map((template, i) => (
                  <TemplateDiscoverCard key={template.id} template={template} index={i} onUse={handleTemplateUse} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trending section */}
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={14} style={{ color: 'var(--brand)' }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>
            Trending
          </p>
        </div>

        {trendingLoading ? (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] max-h-64 rounded-3xl" />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No posts yet"
            description="Be the first to share your creation with the community!"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {trending.map((post, i) => (
                <TrendingCard
                  key={post.id}
                  post={post}
                  rank={i}
                  liked={likedPosts.has(post.id)}
                  onLike={handleLike}
                  onPlayVideo={(url) => setActiveVideo(url)}
                />
              ))}
            </div>

            {/* See all community posts CTA */}
            <SeeAllBanner
              count={trending.length}
              onClick={() => navigate('/feed/community')}
            />
          </>
        )}

        {/* Bottom padding for BottomNav */}
        <div className="h-6" />

      </PageWrapper>

      {activeVideo && (
        <VideoModal url={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </>
  )
}
