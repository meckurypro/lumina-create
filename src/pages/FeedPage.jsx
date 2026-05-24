// src/pages/FeedPage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Play, Film, Image, X, Sparkles, ArrowRight, Star } from 'lucide-react'
import { feed as feedDb, templates as templatesDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton, EmptyState } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

// ─── Video Modal ──────────────────────────────────────────

const VideoModal = ({ url, onClose }) => {
  const videoRef = useRef(null)

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
            ref={videoRef}
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
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
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

// ─── Feed Card ────────────────────────────────────────────

const FeedCard = ({ post, liked, onLike, onPlayVideo }) => {
  const isVideo = post.output_type === 'video'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="relative aspect-[9/16] max-h-96 bg-black overflow-hidden">
        <img
          src={post.thumbnail_url}
          alt={post.title || `Creation by @${post.profiles?.username}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isVideo && (
          <button
            onClick={() => onPlayVideo(post.output_url)}
            className="absolute inset-0 flex items-center justify-center"
            aria-label={`Play video by @${post.profiles?.username}`}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            >
              <Play size={20} fill="white" className="text-white ml-0.5" />
            </div>
          </button>
        )}
        <div
          className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(4px)' }}
        >
          {isVideo ? <Film size={10} /> : <Image size={10} />}
          {isVideo ? 'Video' : 'Image'}
        </div>
      </div>

      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--brand)', color: 'white' }}
            aria-hidden="true"
          >
            {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              @{post.profiles?.username || 'user'}
            </p>
            {post.templates?.name && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{post.templates.name}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => onLike(post.id)}
          aria-label={liked ? 'Unlike post' : 'Like post'}
          aria-pressed={liked}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
          style={{
            background: liked ? 'rgba(249,115,22,0.12)' : 'var(--bg-elevated)',
            color:      liked ? 'var(--brand)' : 'var(--text-muted)',
          }}
        >
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          <span className="text-xs font-bold">{post.likes_count || 0}</span>
        </button>
      </div>
    </motion.div>
  )
}

// ─── Feed Page ────────────────────────────────────────────

const PAGE_SIZE = 20

export default function FeedPage() {
  const navigate                            = useNavigate()
  const { user }                            = useAuth()
  const [posts,             setPosts]             = useState([])
  const [publicTemplates,   setPublicTemplates]   = useState([])
  const [templatesLoading,  setTemplatesLoading]  = useState(true)
  const [loading,           setLoading]           = useState(true)
  const [likedPosts,        setLikedPosts]        = useState(new Set())
  const [page,              setPage]              = useState(0)
  const [hasMore,           setHasMore]           = useState(true)
  const [loadingMore,       setLoadingMore]       = useState(false)
  const [activeVideo,       setActiveVideo]       = useState(null)

  useEffect(() => {
    const loadTemplates = async () => {
      const { data } = await templatesDb.getPublic()
      setPublicTemplates(data || [])
      setTemplatesLoading(false)
    }
    loadTemplates()
  }, [])

  const loadPosts = useCallback(async (offset = 0, reset = false) => {
    if (offset === 0) setLoading(true)
    else setLoadingMore(true)

    const { data, count } = await feedDb.getPosts({ limit: PAGE_SIZE, offset })

    if (data) {
      setPosts((prev) => reset ? data : [...prev, ...data])
      setHasMore((offset + PAGE_SIZE) < (count || 0))
    }

    setLoading(false)
    setLoadingMore(false)
  }, [])

  const loadUserLikes = useCallback(async () => {
    if (!user) return
    const { data } = await feedDb.getUserLikes(user.id)
    setLikedPosts(new Set(data || []))
  }, [user])

  useEffect(() => {
    loadPosts(0, true)
    loadUserLikes()
  }, [loadPosts, loadUserLikes])

  const handleLike = async (postId) => {
    if (!user) return toast.error('Sign in to like posts')
    const wasLiked = likedPosts.has(postId)
    setLikedPosts((prev) => {
      const next = new Set(prev)
      wasLiked ? next.delete(postId) : next.add(postId)
      return next
    })
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 }
          : p
      )
    )
    const { data } = await feedDb.toggleLike(user.id, postId)
    if (!data?.success) {
      setLikedPosts((prev) => {
        const next = new Set(prev)
        wasLiked ? next.add(postId) : next.delete(postId)
        return next
      })
      setPosts((prev) =>
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
        type:               'template',
        templateId:         template.id,
        templateSlug:       template.slug,
        templateName:       template.name,
        templateDescription: template.description,
        minImages:          template.min_images,
        maxImages:          template.max_images,
        creditCost:         template.credit_cost,
        creditCostPerImage: template.credit_cost_per_image,
      },
    })
  }

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    loadPosts(nextPage * PAGE_SIZE)
  }

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>

        <div className="pt-2 pb-5">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Discover
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Templates + community creations
          </p>
        </div>

        {/* Public Templates strip */}
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
                  <div
                    key={i}
                    className="flex-shrink-0 w-40 h-40 rounded-3xl"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
                {publicTemplates.map((template, i) => (
                  <TemplateDiscoverCard
                    key={template.id}
                    template={template}
                    index={i}
                    onUse={handleTemplateUse}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
            Community Feed
          </p>
          <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
        </div>

        {/* Feed grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] max-h-64" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No posts yet"
            description="Be the first to share your creation with the community!"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {posts.map((post) => (
                <FeedCard
                  key={post.id}
                  post={post}
                  liked={likedPosts.has(post.id)}
                  onLike={handleLike}
                  onPlayVideo={(url) => setActiveVideo(url)}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                  style={{
                    background: 'var(--bg-elevated)',
                    color:      'var(--text-secondary)',
                    border:     '1px solid var(--border)',
                  }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </PageWrapper>

      {activeVideo && (
        <VideoModal url={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </>
  )
}
