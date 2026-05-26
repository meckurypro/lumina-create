// src/pages/CommunityFeedPage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, Play, Film, Image, X, ArrowLeft,
  Share2, Copy, Check, MoreHorizontal,
} from 'lucide-react'
import { feed as feedDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton, EmptyState } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

// ─── Video Modal ──────────────────────────────────────────

const VideoModal = ({ url, onClose }) => {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        className="relative max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 p-2 rounded-xl"
          style={{ color: 'white' }}
          aria-label="Close"
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
  )
}

// ─── Share Sheet ──────────────────────────────────────────

const ShareSheet = ({ post, onClose }) => {
  const [copied, setCopied] = useState(false)
  const shareUrl = `${window.location.origin}/feed/post/${post.id}`

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title || `Creation by @${post.profiles?.username}`,
          text: `Check out this AI creation on Meckury AI`,
          url: shareUrl,
        })
        onClose()
      } catch (e) {
        // User cancelled — no error toast needed
      }
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
        {/* Handle */}
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

          {/* Link preview */}
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {shareUrl}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {/* Native share (mobile) */}
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

            {/* Copy link */}
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left transition-all"
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

// ─── Community Feed Card ──────────────────────────────────

const CommunityCard = ({ post, liked, onLike, onPlayVideo, onShare }) => {
  const isVideo = post.output_type === 'video'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] max-h-96 bg-black overflow-hidden">
        <img
          src={post.thumbnail_url}
          alt={post.title || `Creation by @${post.profiles?.username}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isVideo && (
          <button
            onClick={() => onPlayVideo(post.output_url || post.thumbnail_url)}
            className="absolute inset-0 flex items-center justify-center"
            aria-label={`Play video by @${post.profiles?.username}`}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            >
              <Play size={20} fill="white" className="text-white ml-0.5" />
            </div>
          </button>
        )}

        {/* Type badge */}
        <div
          className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs"
          style={{ background: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(4px)' }}
        >
          {isVideo ? <Film size={10} /> : <Image size={10} />}
          {isVideo ? 'Video' : 'Image'}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        {/* Author */}
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--brand)', color: 'white' }}
          >
            {post.profiles?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              @{post.profiles?.username || 'user'}
            </p>
            {post.templates?.name && (
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {post.templates.name}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Share */}
          <button
            onClick={() => onShare(post)}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)' }}
            aria-label="Share"
          >
            <Share2 size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          {/* Like */}
          <button
            onClick={() => onLike(post.id)}
            aria-label={liked ? 'Unlike' : 'Like'}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
            style={{
              background: liked ? 'rgba(249,115,22,0.12)' : 'var(--bg-elevated)',
              color: liked ? 'var(--brand)' : 'var(--text-muted)',
            }}
          >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
            <span className="text-xs font-bold">{post.likes_count || 0}</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Community Feed Page ──────────────────────────────────

export default function CommunityFeedPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [posts,        setPosts]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [loadingMore,  setLoadingMore]  = useState(false)
  const [hasMore,      setHasMore]      = useState(true)
  const [totalCount,   setTotalCount]   = useState(0)
  const [likedPosts,   setLikedPosts]   = useState(new Set())
  const [activeVideo,  setActiveVideo]  = useState(null)
  const [sharePost,    setSharePost]    = useState(null)
  const [page,         setPage]         = useState(0)

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

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    loadPosts(next * PAGE_SIZE)
  }

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>

        {/* Header */}
        <div className="pt-2 pb-5">
          <button
            onClick={() => navigate('/feed')}
            className="flex items-center gap-2 mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            <ArrowLeft size={16} />
            <span className="text-sm font-semibold">Back to Discover</span>
          </button>

          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Community
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalCount > 0 ? `${totalCount} creation${totalCount !== 1 ? 's' : ''}` : 'All community posts'}
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] max-h-64 rounded-3xl" />
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
              {posts.map((post, i) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <CommunityCard
                    post={post}
                    liked={likedPosts.has(post.id)}
                    onLike={handleLike}
                    onPlayVideo={(url) => setActiveVideo(url)}
                    onShare={(p) => setSharePost(p)}
                  />
                </motion.div>
              ))}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
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

            {loadingMore && (
              <div className="grid grid-cols-2 gap-3 mt-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[9/16] max-h-64 rounded-3xl" />
                ))}
              </div>
            )}
          </>
        )}

        <div className="h-6" />
      </PageWrapper>

      {/* Video modal */}
      <AnimatePresence>
        {activeVideo && (
          <VideoModal url={activeVideo} onClose={() => setActiveVideo(null)} />
        )}
      </AnimatePresence>

      {/* Share sheet */}
      <AnimatePresence>
        {sharePost && (
          <ShareSheet post={sharePost} onClose={() => setSharePost(null)} />
        )}
      </AnimatePresence>
    </>
  )
}
