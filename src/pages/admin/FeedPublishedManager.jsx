import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Film, Image, X, XCircle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

// ─── Post Grid Item ───────────────────────────────────────

const PostGridItem = ({ post, onSelect }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="relative rounded-2xl overflow-hidden cursor-pointer"
    style={{ aspectRatio: '1 / 1', background: '#111', border: '1px solid var(--border-color)' }}
    onClick={() => onSelect(post)}
  >
    <img
      src={post.thumbnail_url}
      alt={post.title || ''}
      className="absolute inset-0 w-full h-full object-cover"
    />
    <div
      className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
    >
      {post.output_type === 'video'
        ? <Film  size={9} color="white" />
        : <Image size={9} color="white" />
      }
    </div>
  </motion.div>
)

// ─── Post Detail Overlay ──────────────────────────────────

const PostDetailOverlay = ({ post, onClose, onRemove }) => {
  const [confirming, setConfirming] = useState(false)
  const [removing,   setRemoving]   = useState(false)
  const isVideo = post.output_type === 'video'
  const preview = post.output_url || post.thumbnail_url

  const handleRemove = async () => {
    setRemoving(true)
    onRemove(post.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.92)' }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div>
          <p className="text-sm font-bold text-white">@{post.profiles?.username}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {post.templates?.name || post.output_type} · {new Date(post.published_at || post.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <X size={18} color="white" />
        </button>
      </div>

      {/* Media */}
      <div className="flex-1 flex items-center justify-center px-4 min-h-0">
        <div className="w-full max-w-sm rounded-2xl overflow-hidden bg-black" style={{ maxHeight: '70vh' }}>
          {isVideo
            ? <video src={preview} controls autoPlay loop playsInline className="w-full object-contain" style={{ maxHeight: '70vh' }} />
            : <img   src={preview} alt="" className="w-full object-contain" style={{ maxHeight: '70vh' }} />
          }
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-5 flex-shrink-0">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <XCircle size={16} />
            Remove from Feed
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-center mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              This will silently remove the post. The user won't be notified.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold"
                style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
              >
                <XCircle size={14} />
                {removing ? 'Removing…' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Feed Published Manager ───────────────────────────────

export default function FeedPublishedManager() {
  const { user }                          = useAuth()
  const [query,        setQuery]          = useState('')
  const [searching,    setSearching]      = useState(false)
  const [userResults,  setUserResults]    = useState([])
  const [selectedUser, setSelectedUser]   = useState(null)
  const [posts,        setPosts]          = useState([])
  const [postsLoading, setPostsLoading]   = useState(false)
  const [selectedPost, setSelectedPost]   = useState(null)

  // ── Search users by username ──

  const handleSearch = useCallback(async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setSelectedUser(null)
    setPosts([])
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .ilike('username', `%${q}%`)
      .limit(8)
    setSearching(false)
    if (error) { toast.error('Search failed'); return }
    setUserResults(data || [])
  }, [query])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  // ── Load published posts for a user ──

  const handleSelectUser = useCallback(async (profile) => {
    setSelectedUser(profile)
    setUserResults([])
    setQuery(profile.username)
    setPostsLoading(true)
    const { data, error } = await supabase
      .from('feed_posts')
      .select('*, profiles!feed_posts_user_id_fkey(username, avatar_url), templates(name)')
      .eq('user_id', profile.id)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
    setPostsLoading(false)
    if (error) { toast.error('Failed to load posts'); return }
    setPosts(data || [])
  }, [])

  // ── Remove post ──

  const handleRemove = useCallback(async (postId) => {
    const { data, error } = await supabase.rpc('remove_feed_post', {
      p_admin_id: user.id,
      p_post_id:  postId,
    })
    if (error || !data?.success) {
      toast.error('Failed to remove post')
      setSelectedPost(null)
      return
    }
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setSelectedPost(null)
    toast.success('Post removed from feed')
  }, [user.id])

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Search a user by username, then view and remove their published posts.
      </p>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search username…"
            className="input-base w-full pl-9 text-sm"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-2 rounded-xl text-sm font-bold"
          style={{ background: 'var(--brand)', color: 'white', opacity: !query.trim() ? 0.5 : 1 }}
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {/* User results dropdown */}
      <AnimatePresence>
        {userResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
          >
            {userResults.map((profile, i) => (
              <button
                key={profile.id}
                onClick={() => handleSelectUser(profile)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{
                  borderTop: i > 0 ? '1px solid var(--border-color)' : undefined,
                  background: 'transparent',
                }}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0"
                  style={{ background: 'var(--brand)', color: 'white' }}
                >
                  {profile.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{profile.username}</p>
                  {profile.display_name && (
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{profile.display_name}</p>
                  )}
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selected user + posts */}
      {selectedUser && (
        <div>
          {/* User header */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
              style={{ background: 'var(--brand)', color: 'white' }}
            >
              {selectedUser.username?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>@{selectedUser.username}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {postsLoading ? 'Loading posts…' : `${posts.length} published post${posts.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <button
              onClick={() => { setSelectedUser(null); setPosts([]); setQuery('') }}
              className="p-2 rounded-xl"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Posts grid */}
          {postsLoading ? (
            <div className="grid grid-cols-3 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl" style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }} />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle size={28} className="mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No published posts</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This user has no posts currently in the feed.</p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-3 gap-2">
              <AnimatePresence>
                {posts.map((post) => (
                  <PostGridItem key={post.id} post={post} onSelect={setSelectedPost} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>
      )}

      {/* Post detail overlay */}
      <AnimatePresence>
        {selectedPost && (
          <PostDetailOverlay
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onRemove={handleRemove}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
