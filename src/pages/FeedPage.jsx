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

const classify = (w, h) => {
  if (!w || !h) return 'square'
  const ratio = w / h
  if (ratio < 0.8)  return 'tall'
  if (ratio > 1.25) return 'wide'
  return 'square'
}

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

// ─── Sort trending into buckets ───────────────────────────

/**
 * Given up to 6 posts (each with a known arClass),
 * returns { tall, wide, squares[] } picking by likes_count desc.
 */
const bucketPosts = (posts, arMap) => {
  const scored = [...posts].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
  let tall = null
  let wide = null
  const squares = []

  for (const post of scored) {
    const ar = arMap[post.id] || 'square'
    if (ar === 'tall' && !tall) { tall = post; continue }
    if (ar === 'wide' && !wide) { wide = post; continue }
    squares.push(post)
  }

  return { tall, wide, squares }
}

/**
 * Build the two slides from bucketed posts.
 * Slide 1: winner (tall vs wide by likes) + squares[0] + squares[1]
 * Slide 2: loser + squares[2] + squares[3]
 */
const buildSlides = (tall, wide, squares) => {
  const tallLikes  = tall  ? (tall.likes_count  || 0) : -1
  const wideLikes  = wide  ? (wide.likes_count  || 0) : -1
  const tallWins   = tallLikes >= wideLikes

  const hero1  = tallWins ? tall  : wide
  const hero2  = tallWins ? wide  : tall
  const hero1Type = tallWins ? 'tall' : 'wide'
  const hero2Type = tallWins ? 'wide' : 'tall'

  const slide1 = { hero: hero1, heroType: hero1Type, pair: [squares[0] || null, squares[1] || null] }
  const slide2 = { hero: hero2, heroType: hero2Type, pair: [squares[2] || null, squares[3] || null] }

  return [slide1, slide2]
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

// ─── Media Card (generic) ─────────────────────────────────

const MediaCard = ({ post, style, className = '', onPlayVideo, onClick }) => {
  if (!post) return <div className={`rounded-3xl ${className}`} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', ...style }} />

  const isVideo = post.output_type === 'video'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-3xl overflow-hidden relative cursor-pointer ${className}`}
      style={{ background: '#111', border: '1px solid var(--border-color)', ...style }}
      onClick={onClick}
    >
      <img
        src={post.thumbnail_url}
        alt={post.title || 'Creation'}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'cover', objectPosition: 'center' }}
        loading="lazy"
      />

      {/* Type badge */}
      <div
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs z-10"
        style={{ background: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(4px)' }}
      >
        {isVideo ? <Film size={10} /> : <Image size={10} />}
      </div>

      {/* Play button */}
      {isVideo && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onPlayVideo(post.output_url || post.thumbnail_url)
          }}
          className="absolute inset-0 flex items-center justify-center z-10"
          aria-label="Play video"
        >
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          >
            <Play size={16} fill="white" className="text-white ml-0.5" />
          </div>
        </button>
      )}
    </motion.div>
  )
}

// ─── Slide Layouts ────────────────────────────────────────

/**
 * TallSlide: 9:16 hero on the left, two 1:1 stacked on the right.
 * The two 1:1 cards + gap between them must exactly match the hero's height.
 * We use CSS grid rows to enforce this.
 *
 * Grid: two equal columns. Left col = 9:16 aspect ratio. Right col = two squares
 * each taking exactly half the left col's height minus half the gap.
 */
const TallSlide = ({ hero, pair, onPlayVideo, onNavigate }) => {
  const gap = 12 // px — same as gap-3

  return (
    /*
     * We drive the height from the left column's 9:16 aspect ratio.
     * The grid itself has no fixed height — it's driven by the left column.
     * Right column items use flex with equal sizing.
     */
    <div className="w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
      {/* Left — 9:16 hero */}
      <div style={{ aspectRatio: '9 / 16', position: 'relative' }}>
        <MediaCard
          post={hero}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onPlayVideo={onPlayVideo}
          onClick={() => hero && onNavigate(hero.id)}
        />
      </div>

      {/* Right — two 1:1 stacked, sharing the exact same height as the left col */}
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {[pair[0], pair[1]].map((post, i) => (
          <div key={i} style={{ flex: 1, position: 'relative' }}>
            <MediaCard
              post={post}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              onPlayVideo={onPlayVideo}
              onClick={() => post && onNavigate(post.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * WideSlide: 16:9 hero on the bottom, two 1:1 side-by-side on top.
 * Total width of the two 1:1s = full width = same as 16:9 hero width.
 * Height of the 1:1 row = half the total width (since each card is square
 * and they share the full width with a gap).
 */
const WideSlide = ({ hero, pair, onPlayVideo, onNavigate }) => {
  const gap = 12

  return (
    <div className="w-full" style={{ display: 'flex', flexDirection: 'column', gap }}>
      {/* Top — two 1:1 cards side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap }}>
        {[pair[0], pair[1]].map((post, i) => (
          <div key={i} style={{ aspectRatio: '1 / 1', position: 'relative' }}>
            <MediaCard
              post={post}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              onPlayVideo={onPlayVideo}
              onClick={() => post && onNavigate(post.id)}
            />
          </div>
        ))}
      </div>

      {/* Bottom — 16:9 hero, full width */}
      <div style={{ aspectRatio: '16 / 9', position: 'relative', width: '100%' }}>
        <MediaCard
          post={hero}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          onPlayVideo={onPlayVideo}
          onClick={() => hero && onNavigate(hero.id)}
        />
      </div>
    </div>
  )
}

// ─── Swipeable Trending Section ───────────────────────────

const TrendingSection = ({ slides, onPlayVideo, onNavigate, onEscape }) => {
  const [activeSlide, setActiveSlide] = useState(0)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current

    // Only trigger on clear horizontal swipe
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return

    if (dx < 0) {
      // swipe left
      if (activeSlide === 0) {
        setActiveSlide(1)
      } else {
        // already on slide 1 — escape to community feed
        onEscape()
      }
    } else {
      // swipe right
      if (activeSlide === 1) setActiveSlide(0)
    }

    touchStartX.current = null
    touchStartY.current = null
  }

  // Also support mouse drag for desktop testing
  const mouseStartX = useRef(null)

  const handleMouseDown = (e) => { mouseStartX.current = e.clientX }
  const handleMouseUp   = (e) => {
    if (mouseStartX.current === null) return
    const dx = e.clientX - mouseStartX.current
    if (Math.abs(dx) < 40) return
    if (dx < 0) {
      if (activeSlide === 0) setActiveSlide(1)
      else onEscape()
    } else {
      if (activeSlide === 1) setActiveSlide(0)
    }
    mouseStartX.current = null
  }

  const slide = slides[activeSlide]
  if (!slide) return null

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      style={{ userSelect: 'none' }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlide}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.28 }}
        >
          {slide.heroType === 'tall' ? (
            <TallSlide
              hero={slide.hero}
              pair={slide.pair}
              onPlayVideo={onPlayVideo}
              onNavigate={onNavigate}
            />
          ) : (
            <WideSlide
              hero={slide.hero}
              pair={slide.pair}
              onPlayVideo={onPlayVideo}
              onNavigate={onNavigate}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators */}
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {slides.map((_, i) => (
          <div
            key={i}
            style={{
              width:  i === activeSlide ? 18 : 6,
              height: 6,
              borderRadius: 99,
              background: i === activeSlide ? 'var(--brand)' : 'var(--border-color)',
              transition: 'width 0.25s, background 0.25s',
            }}
          />
        ))}
        {/* Third dot — represents community feed */}
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: 'var(--border-color)',
            opacity: 0.4,
          }}
        />
      </div>
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
  const [activeVideo,      setActiveVideo]      = useState(null)

  // arMap is resolved progressively as images load.
  // We also seed it from metadata right away.
  const [arMap, setArMap] = useState({})

  useEffect(() => {
    templatesDb.getPublic().then(({ data }) => {
      setPublicTemplates(data || [])
      setTemplatesLoading(false)
    })
  }, [])

  useEffect(() => {
    // Fetch only 6
    feedDb.getTrending({ limit: 6 }).then(({ data }) => {
      const posts = data || []
      setTrending(posts)

      // Seed arMap from metadata immediately
      const seed = {}
      posts.forEach((p) => {
        const meta = classifyFromMeta(p)
        if (meta) seed[p.id] = meta
      })
      setArMap(seed)

      setTrendingLoading(false)
    })
  }, [])

  // For any post whose arClass isn't known from metadata,
  // we probe the image dimensions once it loads.
  // We expose a setter that child cards can call.
  const handleAspectRatioProbed = useCallback((id, arClass) => {
    setArMap((prev) => {
      if (prev[id] === arClass) return prev
      return { ...prev, [id]: arClass }
    })
  }, [])

  // Probing component — invisible, just loads the image to get dimensions
  const AspectProbe = ({ post }) => {
    if (arMap[post.id]) return null // already known
    return (
      <img
        src={post.thumbnail_url}
        style={{ display: 'none' }}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget
          if (w && h) handleAspectRatioProbed(post.id, classify(w, h))
        }}
        alt=""
      />
    )
  }

  const slides = (() => {
    if (trending.length === 0) return []
    const { tall, wide, squares } = bucketPosts(trending, arMap)
    return buildSlides(tall, wide, squares)
  })()

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
            {/* Invisible probes to resolve arMap for posts not known from metadata */}
            {trending.map((p) => <AspectProbe key={p.id} post={p} />)}

            {slides.length > 0 && (
              <TrendingSection
                slides={slides}
                onPlayVideo={(url) => setActiveVideo(url)}
                onNavigate={(id) => navigate('/feed/community', { state: { selectedPostId: id } })}
                onEscape={() => navigate('/feed/community')}
              />
            )}
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
