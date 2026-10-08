// src/pages/CommunityFeedPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, X, ArrowLeft, Share2, Copy, Check } from 'lucide-react'
import { feed as feedDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton, EmptyState } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

// ─── Share Sheet ──────────────────────────────────────────

const ShareSheet = ({ post, onClose }) => {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/feed/post/${post.id}`

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || `Creation by @${post.profiles?.username}`,
          text: 'Check out this AI creation on Meckury AI',
          url: shareUrl,
        })
        onClose()
      } catch { /* cancelled */ }
    } else {
      handleCopy()
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => { setCopied(false); onClose() }, 1400)
    } catch {
      toast.error('Could not copy link')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full rounded-t-3xl overflow-hidden pb-10"
        style={{ background: 'var(--bg-card)', maxWidth: 480, border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>
        <div className="px-5 pb-2">
          <p className="text-base font-black mb-1" style={{ color: 'var(--text-primary)' }}>
            Share this creation
          </p>
          <p className="text-xs truncate mb-5" style={{ color: 'var(--text-muted)' }}>
            by @{post.profiles?.username || 'user'}
          </p>
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {shareUrl}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {navigator.share && (
              <button
                onClick={handleNativeShare}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left"
                style={{ background: 'var(--brand)', color: 'white' }}
              >
                <Share2 size={18} />
                <span className="text-sm font-bold">Share via…</span>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left"
              style={{ background: 'var(--bg-elevated)' }}
            >
              {copied
                ? <Check size={18} style={{ color: '#10b981' }} />
                : <Copy size={18} style={{ color: 'var(--text-primary)' }} />
              }
              <span className="text-sm font-semibold" style={{ color: copied ? '#10b981' : 'var(--text-primary)' }}>
                {copied ? 'Copied!' : 'Copy link'}
              </span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Full-Screen Mobile Card ───────────────────────────────

const FullScreenCard = ({ post, liked, onLike, onShare, isActive }) => {
  const isVideo = post.output_type === 'video'
  const videoRef = useRef(null)

  useEffect(() => {
    if (!isVideo || !videoRef.current) return
    if (isActive) {
      videoRef.current.play().catch(() => {})
    } else {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [isActive, isVideo])

  return (
    <div
      className="relative w-full flex-shrink-0"
      style={{ height: '100svh', scrollSnapAlign: 'start', background: '#000' }}
    >
      {/* Ambient blur layer */}
      <img
        src={post.thumbnail_url || post.output_url}
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: 'blur(40px) brightness(0.5)',
          transform: 'scale(1.1)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Crisp media */}
      {isVideo ? (
        <video
          ref={videoRef}
          src={post.output_url}
          loop
          playsInline
          muted={false}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: 1 }}
        />
      ) : (
        <img
          src={post.thumbnail_url || post.output_url}
          alt={`Creation by @${post.profiles?.username}`}
          className="absolute inset-0 w-full h-full object-contain"
          style={{ zIndex: 1 }}
        />
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      />

      {/* Bottom overlay — author + actions */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-4 pb-6"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 8px) + 80px)',
          zIndex: 3,
        }}
      >
        {/* Author */}
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'var(--brand)', color: 'white' }}
          >
            {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <span className="text-sm font-bold text-white drop-shadow">
            @{post.profiles?.username || 'user'}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col items-center gap-5">
          <button
            onClick={() => onLike(post.id)}
            aria-label={liked ? 'Unlike' : 'Like'}
            className="flex flex-col items-center gap-1"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: liked ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.15)' }}
            >
              <Heart
                size={22}
                fill={liked ? 'var(--brand)' : 'none'}
                style={{ color: liked ? 'var(--brand)' : 'white' }}
              />
            </div>
            <span className="text-xs font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              {post.likes_count || 0}
            </span>
          </button>

          <button
            onClick={() => onShare(post)}
            aria-label="Share"
            className="flex flex-col items-center gap-1"
          >
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Share2 size={20} color="white" />
            </div>
            <span className="text-xs font-bold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>
              Share
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Desktop Grid Card ────────────────────────────────────

const GridCard = ({ post, liked, onLike, onShare }) => {
  const isVideo = post.output_type === 'video'
  const videoRef = useRef(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!isVideo || !videoRef.current) return
    if (hovered) {
      videoRef.current.play().catch(() => {})
    } else {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [hovered, isVideo])

  const aspectRatio = post.aspect_ratio || '1 / 1'

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden relative cursor-pointer"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', aspectRatio }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isVideo ? (
        <video
          ref={videoRef}
          src={post.output_url}
          loop
          playsInline
          muted
          poster={post.thumbnail_url}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <img
          src={post.thumbnail_url || post.output_url}
          alt={`Creation by @${post.profiles?.username}`}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}

      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col justify-end p-3"
            style={{ background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.75) 100%)' }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'var(--brand)', color: 'white' }}
                >
                  {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-xs font-semibold text-white">
                  @{post.profiles?.username || 'user'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onShare(post) }}
                  aria-label="Share"
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  <Share2 size={13} color="white" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onLike(post.id) }}
                  aria-label={liked ? 'Unlike' : 'Like'}
                  className="flex items-center gap-1 px-2 py-1 rounded-full"
                  style={{ background: liked ? 'rgba(249,115,22,0.25)' : 'rgba(255,255,255,0.15)' }}
                >
                  <Heart
                    size={13}
                    fill={liked ? 'var(--brand)' : 'none'}
                    style={{ color: liked ? 'var(--brand)' : 'white' }}
                  />
                  <span className="text-xs font-bold text-white">{post.likes_count || 0}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Always-visible like count on mobile grid */}
      <div
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full lg:hidden"
        style={{ background: 'rgba(0,0,0,0.45)' }}
      >
        <Heart size={11} fill={liked ? 'var(--brand)' : 'none'} style={{ color: liked ? 'var(--brand)' : 'white' }} />
        <span className="text-xs font-bold text-white">{post.likes_count || 0}</span>
      </div>
    </motion.div>
  )
}

// ─── Mobile Full-Screen Feed ──────────────────────────────

const MobileFeed = ({ posts, likedPosts, onLike, onShare, onLoadMore, hasMore, loadingMore }) => {
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.dataset.index)
            setActiveIndex(index)
            if (index >= posts.length - 3 && hasMore && !loadingMore) {
              onLoadMore()
            }
          }
        })
      },
      { root: container, threshold: 0.6 }
    )

    const slides = container.querySelectorAll('[data-index]')
    slides.forEach((s) => observer.observe(s))
    return () => observer.disconnect()
  }, [posts.length, hasMore, loadingMore, onLoadMore])

  return (
    <div
      ref={containerRef}
      data-mobile-feed
      className="fixed inset-0 z-20 overflow-y-scroll"
      style={{
        scrollSnapType: 'y mandatory',
        background: '#000',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {posts.map((post, i) => (
        <div key={post.id} data-index={i} style={{ height: '100svh', scrollSnapAlign: 'start' }}>
          <FullScreenCard
            post={post}
            liked={likedPosts.has(post.id)}
            onLike={onLike}
            onShare={onShare}
            isActive={activeIndex === i}
          />
        </div>
      ))}
      {loadingMore && (
        <div
          className="flex items-center justify-center"
          style={{ height: '100svh', scrollSnapAlign: 'start', background: '#000' }}
        >
          <p className="text-sm text-white opacity-50">Loading more…</p>
        </div>
      )}
    </div>
  )
}

// ─── Community Feed Page ──────────────────────────────────

export default function CommunityFeedPage() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user }   = useAuth()

  const selectedPostId = location.state?.selectedPostId ?? null

  const [isMobile,    setIsMobile]    = useState(false)
  const [posts,       setPosts]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(true)
  const [totalCount,  setTotalCount]  = useState(0)
  const [likedPosts,  setLikedPosts]  = useState(new Set())
  const [sharePost,   setSharePost]   = useState(null)
  const [page,        setPage]        = useState(0)

  // Detect mobile once on mount
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadPosts = useCallback(async (offset = 0, reset = false) => {
    if (offset === 0) setLoading(true)
    else              setLoadingMore(true)

    const { data, count } = await feedDb.getAllCommunity({ limit: PAGE_SIZE, offset })

    if (data) {
      setPosts((prev) => reset ? data : [...prev, ...data])
      setTotalCount(count || 0)
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

  // Scroll mobile feed to the selected post once posts are loaded
  useEffect(() => {
    if (!selectedPostId || !isMobile || posts.length === 0) return
    const index = posts.findIndex((p) => p.id === selectedPostId)
    if (index < 0) return
    const container = document.querySelector('[data-mobile-feed]')
    if (container) {
      container.scrollTo({ top: index * window.innerHeight, behavior: 'instant' })
    }
  }, [selectedPostId, posts, isMobile])

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

  const handleLoadMore = useCallback(() => {
    const next = page + 1
    setPage(next)
    loadPosts(next * PAGE_SIZE)
  }, [page, loadPosts])

  // ── Mobile: full-screen snap scroll ──
  if (!loading && isMobile) {
    return (
      <>
        <button
          onClick={() => navigate('/feed')}
          className="fixed z-30 flex items-center gap-1.5 px-3 py-2 rounded-full"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            left: '16px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            color: 'white',
          }}
          aria-label="Back to Discover"
        >
          <ArrowLeft size={16} />
          <span className="text-xs font-semibold">Community</span>
        </button>

        {posts.length === 0 ? (
          <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#000' }}>
            <p className="text-white opacity-50 text-sm">No posts yet</p>
          </div>
        ) : (
          <MobileFeed
            posts={posts}
            likedPosts={likedPosts}
            onLike={handleLike}
            onShare={(p) => setSharePost(p)}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            loadingMore={loadingMore}
          />
        )}

        <AnimatePresence>
          {sharePost && (
            <ShareSheet post={sharePost} onClose={() => setSharePost(null)} />
          )}
        </AnimatePresence>
      </>
    )
  }

  // ── Desktop: grid layout ──
  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>
        <div className="pt-2 pb-5">
          <button
            onClick={() => navigate('/feed')}
            className="flex items-center gap-2 mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={16} />
            <span className="text-sm font-semibold">Back to Discover</span>
          </button>
          <h1 className="text-3xl lg:text-4xl font-black" style={{ color: 'var(--text-primary)' }}>
            The <span className="brand-gradient-text">Community</span>
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalCount > 0 ? `${totalCount} creation${totalCount !== 1 ? 's' : ''}` : 'All community posts'}
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-3xl" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="No posts yet"
            description="Be the first to share your creation with the community!"
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <GridCard
                    post={post}
                    liked={likedPosts.has(post.id)}
                    onLike={handleLike}
                    onShare={(p) => setSharePost(p)}
                  />
                </motion.div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-2xl text-sm font-semibold"
                  style={{
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    opacity: loadingMore ? 0.6 : 1,
                  }}
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
        <div className="h-6" />
      </PageWrapper>

      <AnimatePresence>
        {sharePost && (
          <ShareSheet post={sharePost} onClose={() => setSharePost(null)} />
        )}
      </AnimatePresence>
    </>
  )
}
