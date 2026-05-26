// src/pages/FeedPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Film, Image, X, Sparkles, ArrowRight, Star, TrendingUp } from 'lucide-react'
import { feed as feedDb, templates as templatesDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton, EmptyState } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

// ─── Aspect Ratio Helpers ─────────────────────────────────

/**
 * Classify a width/height pair into 'tall' | 'square' | 'wide'.
 */
const classify = (w, h) => {
  if (!w || !h) return 'square'
  const ratio = w / h
  if (ratio < 0.8)  return 'tall'   // 9:16 and anything taller than ~4:5
  if (ratio > 1.25) return 'wide'   // 16:9 and anything wider than ~5:4
  return 'square'
}

/**
 * Also check post.output_aspect_ratio string if present,
 * as a cheap first-pass before the image loads.
 */
const classifyFromMeta = (post) => {
  const ar = post.output_aspect_ratio
  if (!ar) return null
  if (ar === '9:16' || ar === '9/16') return 'tall'
  if (ar === '16:9' || ar === '16/9') return 'wide'
  if (ar === '1:1'  || ar === '1/1')  return 'square'
  const parsed = parseFloat(ar)
  if (!isNaN(parsed)) return classify(parsed, 1)
  return null
}

// ─── Layout Engine ────────────────────────────────────────

/**
 * Pack posts (each with a known arClass) into row descriptors.
 *
 * Row types:
 *   { type: 'pair',       left: post,  right: post | null }
 *   { type: 'tall-left',  tall: post,  stack: post[] }   ← 1-2 companions on the right
 *   { type: 'tall-right', tall: post,  stack: post[] }   ← 1-2 companions on the left
 *
 * A tall card consumes itself + up to 2 companions (the stacked column).
 * Non-tall posts are paired side-by-side.
 */
const packIntoRows = (posts, arMap) => {
  const rows = []
  let i = 0
  let tallLeftCount = 0
  let tallRightCount = 0

  while (i < posts.length) {
    const post = posts[i]
    const ar   = arMap[post.id] || 'square'

    if (ar === 'tall') {
      const companions = []
      let j = i + 1
      while (companions.length < 2 && j < posts.length) {
        companions.push(posts[j++])
      }
      // Alternate sides
      const side = tallLeftCount <= tallRightCount ? 'tall-left' : 'tall-right'
      if (side === 'tall-left') tallLeftCount++
      else tallRightCount++
      rows.push({ type: side, tall: post, stack: companions })
      i = j
    } else {
      const next = posts[i + 1]
      rows.push({ type: 'pair', left: post, right: next || null })
      i += next ? 2 : 1
    }
  }

  return rows
}

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
        className="h-24 w-full relative flex items-center justify-center overflow-hidden"
        style={{
          background: template.thumbnail_url
            ? undefined
            : 'linear-gradient(135deg, rgba(249,115,22,0.2), rgba(234,88,12,0.08))',
        }}
      >
        {template.thumbnail_url ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }}
          />
        ) : (
          <Sparkles size={28} style={{ color: 'var(--brand)', opacity: 0.5 }} />
        )}

        {template.is_featured && (
          <div
            className="absolute top-2 left-2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-bold z-10"
            style={{ background: 'var(--brand)', color: 'white', fontSize: '9px' }}
          >
            <Star size={8} fill="white" />
            Hot
          </div>
        )}

        <div
          className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-full font-bold z-10"
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

// ─── Media Card ───────────────────────────────────────────

/**
 * Single post card. Probes image dimensions on first load to determine
 * its true aspect ratio class, then reports it upward via onAspectRatio.
 *
 * Rendering rules (NO blur anywhere):
 *  - tall   → 9/16 shell, object-fit: cover  → portrait fills the card
 *  - square → 1/1  shell, object-fit: cover  → square fills the card
 *  - wide   → 1/1  shell, object-fit: cover  → wide image zoomed/cropped to fill square
 */
const MediaCard = ({ post, rank, arClass, onAspectRatio, onPlayVideo, onClick }) => {
  const isVideo      = post.output_type === 'video'
  const shellRatio   = arClass === 'tall' ? '9 / 16' : '1 / 1'

  const handleImgLoad = useCallback((e) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget
    if (w && h) onAspectRatio(post.id, classify(w, h))
  }, [post.id, onAspectRatio])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.055, duration: 0.32 }}
      className="rounded-3xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div
        className="relative overflow-hidden cursor-pointer"
        style={{ aspectRatio: shellRatio, background: '#111' }}
        onClick={onClick}
      >
        {/* Main image — always cover, no blur */}
        <img
          src={post.thumbnail_url}
          alt={post.title || `Creation by @${post.profiles?.username}`}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
          loading="lazy"
          onLoad={handleImgLoad}
        />

        {/* Type badge */}
        <div
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs z-10"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(4px)' }}
        >
          {isVideo ? <Film size={10} /> : <Image size={10} />}
        </div>

        {/* Play button for video */}
        {isVideo && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onPlayVideo(post.output_url || post.thumbnail_url)
            }}
            className="absolute inset-0 flex items-center justify-center z-10"
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
    </motion.div>
  )
}

// ─── Masonry Grid ─────────────────────────────────────────

const MasonryGrid = ({ posts, onPlayVideo, onNavigate }) => {
  // arMap: { [postId]: 'tall' | 'square' | 'wide' }
  // Seeded with metadata-derived values where available.
  const [arMap, setArMap] = useState(() => {
    const seed = {}
    posts.forEach((p) => {
      const meta = classifyFromMeta(p)
      if (meta) seed[p.id] = meta
    })
    return seed
  })

  const handleAspectRatio = useCallback((id, arClass) => {
    setArMap((prev) => {
      if (prev[id] === arClass) return prev   // no-op if unchanged
      return { ...prev, [id]: arClass }
    })
  }, [])

  const rows = packIntoRows(posts, arMap)

  const renderCard = (post, rank) => (
    <MediaCard
      key={post.id}
      post={post}
      rank={rank}
      arClass={arMap[post.id] || 'square'}
      onAspectRatio={handleAspectRatio}
      onPlayVideo={onPlayVideo}
      onClick={() => onNavigate(post.id)}
    />
  )

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, rowIdx) => {
        if (row.type === 'pair') {
          return (
            <div key={rowIdx} className="grid grid-cols-2 gap-3">
              {row.left  && renderCard(row.left,  rowIdx * 3)}
              {row.right ? renderCard(row.right, rowIdx * 3 + 1) : <div />}
            </div>
          )
        }

        // tall-left or tall-right
        const tallOnLeft = row.type === 'tall-left'

        const tallCol = renderCard(row.tall, rowIdx * 3)

        const stackCol = (
          <div className="flex flex-col gap-3" style={{ minWidth: 0 }}>
            {row.stack.map((post, si) => renderCard(post, rowIdx * 3 + si + 1))}
          </div>
        )

        return (
          <div key={rowIdx} className="grid grid-cols-2 gap-3 items-start">
            {tallOnLeft ? tallCol  : stackCol}
            {tallOnLeft ? stackCol : tallCol}
          </div>
        )
      })}
    </div>
  )
}

// ─── Feed Page ────────────────────────────────────────────

export default function FeedPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [trending,         setTrending]         = useState([])
  const [publicTemplates,  setPublicTemplates]  = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [trendingLoading,  setTrendingLoading]  = useState(true)
  const [likedPosts,       setLikedPosts]       = useState(new Set())
  const [activeVideo,      setActiveVideo]      = useState(null)

  useEffect(() => {
    templatesDb.getPublic().then(({ data }) => {
      setPublicTemplates(data || [])
      setTemplatesLoading(false)
    })
  }, [])

  useEffect(() => {
    feedDb.getTrending({ limit: 8 }).then(({ data }) => {
      setTrending(data || [])
      setTrendingLoading(false)
    })
  }, [])

  const loadUserLikes = useCallback(async () => {
    if (!user) return
    const { data } = await feedDb.getUserLikes(user.id)
    setLikedPosts(new Set(data || []))
  }, [user])

  useEffect(() => { loadUserLikes() }, [loadUserLikes])

  const handleLike = async (postId) => {
    if (!user) return toast.error('Sign in to like posts')
    const wasLiked = likedPosts.has(postId)

    setLikedPosts((prev) => {
      const next = new Set(prev)
      wasLiked ? next.delete(postId) : next.add(postId)
      return next
    })
    setTrending((prev) =>
      prev.map((p) => p.id === postId
        ? { ...p, likes_count: wasLiked ? p.likes_count - 1 : p.likes_count + 1 }
        : p)
    )

    const { data } = await feedDb.toggleLike(user.id, postId)
    if (!data?.success) {
      setLikedPosts((prev) => {
        const next = new Set(prev)
        wasLiked ? next.add(postId) : next.delete(postId)
        return next
      })
      setTrending((prev) =>
        prev.map((p) => p.id === postId
          ? { ...p, likes_count: wasLiked ? p.likes_count + 1 : p.likes_count - 1 }
          : p)
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
              <Skeleton key={i} className="aspect-square rounded-3xl" />
            ))}
          </div>
        ) : trending.length === 0 ? (
          <EmptyState
            icon={Film}
            title="No posts yet"
            description="Be the first to share your creation with the community!"
          />
        ) : (
          <div className="mb-4">
            <MasonryGrid
              posts={trending}
              onPlayVideo={(url) => setActiveVideo(url)}
              onNavigate={(id) => navigate('/feed/community', { state: { selectedPostId: id } })}
            />
          </div>
        )}

        <div className="h-6" />
      </PageWrapper>

      {activeVideo && (
        <VideoModal url={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </>
  )
}
