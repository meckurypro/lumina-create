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

// ─── Aspect Ratio Helpers ─────────────────────────────────

/**
 * Returns one of: 'tall' (9:16), 'square' (1:1), 'wide' (16:9)
 * Falls back to 'square' if unknown.
 */
const classifyAspectRatio = (post) => {
  const ar = post.output_aspect_ratio
  if (!ar) return 'square'
  if (ar === '9:16' || ar === '9/16') return 'tall'
  if (ar === '16:9' || ar === '16/9') return 'wide'
  if (ar === '1:1' || ar === '1/1') return 'square'
  // Numeric fallback
  const parsed = parseFloat(ar)
  if (!isNaN(parsed)) {
    if (parsed < 0.75) return 'tall'
    if (parsed > 1.4)  return 'wide'
    return 'square'
  }
  return 'square'
}

/**
 * Pack posts into rows for the two-column masonry layout.
 *
 * Rules:
 *  - 'tall' card → occupies left OR right column for its full height.
 *    The opposite column gets two stacked cards to match.
 *  - 'square' / 'wide' → paired side by side in a standard row.
 *
 * Returns an array of row descriptors:
 *   { type: 'pair',   left: post, right: post }
 *   { type: 'tall-left',  tall: post, stack: [post, post?] }
 *   { type: 'tall-right', tall: post, stack: [post, post?] }
 */
const packIntoRows = (posts) => {
  const rows = []
  let i = 0

  while (i < posts.length) {
    const post = posts[i]
    const ar   = classifyAspectRatio(post)

    if (ar === 'tall') {
      // Consume up to 2 companions for the stacked column
      const companions = []
      let j = i + 1
      while (companions.length < 2 && j < posts.length) {
        companions.push(posts[j++])
      }
      // Alternate tall side to keep grid visually balanced
      const side = rows.filter(r => r.type === 'tall-left').length <=
                   rows.filter(r => r.type === 'tall-right').length
                   ? 'tall-left' : 'tall-right'
      rows.push({ type: side, tall: post, stack: companions })
      i = j
    } else {
      // Pair with next non-tall post if available
      const next = posts[i + 1]
      if (next) {
        rows.push({ type: 'pair', left: post, right: next })
        i += 2
      } else {
        // Lone card — render full-width pair with only left filled
        rows.push({ type: 'pair', left: post, right: null })
        i += 1
      }
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
          <>
            <img
              src={template.thumbnail_url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'cover', filter: 'blur(14px)', transform: 'scale(1.2)', opacity: 0.7 }}
            />
            <img
              src={template.thumbnail_url}
              alt={template.name}
              className="absolute inset-0 w-full h-full"
              style={{ objectFit: 'contain' }}
            />
          </>
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
 * Renders a single post thumbnail.
 *
 * @param {object}  post
 * @param {number}  rank          - animation stagger index
 * @param {boolean} liked
 * @param {string}  arClass       - 'tall' | 'square' | 'wide'
 * @param {boolean} fullWidth     - true when card spans both columns
 */
const MediaCard = ({ post, rank, liked, arClass, fullWidth = false, onLike, onPlayVideo, onClick }) => {
  const isVideo = post.output_type === 'video'

  /**
   * Image display strategy per aspect ratio:
   *  - tall   → natural height, full image visible (object-fit: contain with blurred bg)
   *  - square → 1:1 shell, full image visible (object-fit: contain with blurred bg)
   *  - wide   → square shell, zoomed to fill center (object-fit: cover) — clean crop
   */
  const imageStyle = arClass === 'wide'
    ? { objectFit: 'cover' }
    : { objectFit: 'contain' }

  /**
   * Card shell aspect ratio:
   *  - tall   → 9/16
   *  - square → 1/1
   *  - wide   → 1/1  (square shell for wide media, zoomed to fill)
   */
  const shellAspectRatio = arClass === 'tall' ? '9 / 16' : '1 / 1'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06 }}
      className={`rounded-3xl overflow-hidden${fullWidth ? ' w-full' : ''}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div
        className="relative overflow-hidden cursor-pointer bg-black"
        style={{ aspectRatio: shellAspectRatio }}
        onClick={onClick}
      >
        {/* Blurred background — only for non-wide (contain-mode) cards */}
        {arClass !== 'wide' && (
          <img
            src={post.thumbnail_url}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              objectFit: 'cover',
              filter: 'blur(20px)',
              transform: 'scale(1.15)',
              opacity: 0.72,
            }}
          />
        )}

        {/* Main image */}
        <img
          src={post.thumbnail_url}
          alt={post.title || `Creation by @${post.profiles?.username}`}
          className="absolute inset-0 w-full h-full"
          style={imageStyle}
          loading="lazy"
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

const MasonryGrid = ({ posts, likedPosts, onLike, onPlayVideo, onNavigate }) => {
  const rows = packIntoRows(posts)

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, rowIdx) => {
        if (row.type === 'pair') {
          return (
            <div key={rowIdx} className="grid grid-cols-2 gap-3">
              {[row.left, row.right].map((post, colIdx) => {
                if (!post) return <div key={colIdx} /> // empty slot
                const arClass = classifyAspectRatio(post)
                return (
                  <MediaCard
                    key={post.id}
                    post={post}
                    rank={rowIdx * 2 + colIdx}
                    liked={likedPosts.has(post.id)}
                    arClass={arClass}
                    onLike={onLike}
                    onPlayVideo={onPlayVideo}
                    onClick={() => onNavigate(post.id)}
                  />
                )
              })}
            </div>
          )
        }

        // tall-left or tall-right
        const tallOnLeft  = row.type === 'tall-left'
        const tallArClass = 'tall'
        const tallCard = (
          <MediaCard
            key={row.tall.id}
            post={row.tall}
            rank={rowIdx * 2}
            liked={likedPosts.has(row.tall.id)}
            arClass={tallArClass}
            onLike={onLike}
            onPlayVideo={onPlayVideo}
            onClick={() => onNavigate(row.tall.id)}
          />
        )

        const stackCards = (
          <div key="stack" className="flex flex-col gap-3">
            {row.stack.map((post, si) => {
              const arClass = classifyAspectRatio(post)
              return (
                <MediaCard
                  key={post.id}
                  post={post}
                  rank={rowIdx * 2 + si + 1}
                  liked={likedPosts.has(post.id)}
                  arClass={arClass}
                  onLike={onLike}
                  onPlayVideo={onPlayVideo}
                  onClick={() => onNavigate(post.id)}
                />
              )
            })}
          </div>
        )

        return (
          <div key={rowIdx} className="grid grid-cols-2 gap-3 items-start">
            {tallOnLeft ? tallCard   : stackCards}
            {tallOnLeft ? stackCards : tallCard}
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
              likedPosts={likedPosts}
              onLike={handleLike}
              onPlayVideo={(url) => setActiveVideo(url)}
              onNavigate={(id) => navigate('/feed/community', { state: { selectedPostId: id } })}
            />
          </div>
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
