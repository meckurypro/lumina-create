// src/components/create/MediaAssetPickerModal.jsx
//
// Shared "browse Media / Assets" picker used by UploadZone's long-press
// (mobile) / right-click (desktop) context menu across every Create page.
//
// Media tab   -> generations table (status=completed, output_url present)
// Assets tab  -> assets table via existing lib/assets.js listAssets()
//
// onSelect receives a normalized shape regardless of source:
//   { url, name, mimeType, aspectRatio, thumbnailUrl, isVideo, source }

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, VideoIcon, FolderOpen, Film, Search } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { listAssets, isVideoAsset } from '@/lib/assets'

const PAGE_SIZE = 24

const GEN_COLUMNS = [
  'id', 'output_url', 'output_thumbnail_url', 'output_type',
  'prompt', 'created_at', 'aspect_ratio', 'status',
].join(', ')

async function fetchMediaItems(userId, { typeFilter, search, offset }) {
  let query = supabase
    .from('generations')
    .select(GEN_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('output_url', 'is', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (typeFilter && typeFilter !== 'all') query = query.eq('output_type', typeFilter)
  if (search.trim()) query = query.ilike('prompt', `%${search.trim()}%`)

  const { data, count, error } = await query
  if (error) throw new Error(error.message || 'Failed to load media')
  return { data: data || [], count: count || 0 }
}

export default function MediaAssetPickerModal({
  open,
  initialTab = 'media',   // 'media' | 'assets'
  typeFilter = 'all',     // 'image' | 'video' | 'all' — applies to both tabs
  accent = 'var(--brand, #5B6EF7)',
  onSelect,
  onClose,
}) {
  const { user } = useAuth()
  const [tab,         setTab]         = useState(initialTab)
  const [items,       setItems]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore,     setHasMore]     = useState(false)
  const [offset,      setOffset]      = useState(0)
  const [search,      setSearch]      = useState('')
  const debounceRef = useRef(null)

  useEffect(() => { if (open) { setTab(initialTab); setSearch('') } }, [open, initialTab])

  const load = useCallback(async (reset, nextOffset, q) => {
    if (!user) return
    reset ? setLoading(true) : setLoadingMore(true)
    try {
      if (tab === 'media') {
        const { data, count } = await fetchMediaItems(user.id, { typeFilter, search: q, offset: nextOffset })
        setItems((prev) => reset ? data : [...prev, ...data])
        setHasMore(nextOffset + PAGE_SIZE < count)
      } else {
        const { data, count } = await listAssets(user.id, {
          search: q, limit: PAGE_SIZE, offset: nextOffset, typeFilter,
        })
        setItems((prev) => reset ? data : [...prev, ...data])
        setHasMore(nextOffset + PAGE_SIZE < count)
      }
    } catch (err) {
      console.error('[MediaAssetPickerModal] load failed', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [user, tab, typeFilter])

  useEffect(() => {
    if (!open) return
    setOffset(0)
    load(true, 0, '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, typeFilter])

  const handleSearchChange = (val) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setOffset(0); load(true, 0, val) }, 350)
  }

  const handleLoadMore = () => {
    const next = offset + PAGE_SIZE
    setOffset(next)
    load(false, next, search)
  }

  const handleSelect = (item) => {
    if (tab === 'media') {
      onSelect({
        url:          item.output_url,
        name:         item.prompt?.slice(0, 40) || `Generation ${item.id.slice(0, 8)}`,
        mimeType:     item.output_type === 'video' ? 'video/mp4' : 'image/jpeg',
        aspectRatio:  item.aspect_ratio || null,
        thumbnailUrl: item.output_thumbnail_url || item.output_url,
        isVideo:      item.output_type === 'video',
        source:       'media',
      })
    } else {
      onSelect({
        url:          item.file_url,
        name:         item.name,
        mimeType:     item.mime_type,
        aspectRatio:  null,
        thumbnailUrl: item.thumbnail_url || item.file_url,
        isVideo:      isVideoAsset(item),
        source:       'assets',
      })
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="w-full sm:max-w-lg max-h-[85dvh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Choose a file</p>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-4 pb-3 flex-shrink-0">
              {[{ value: 'media', label: 'Media' }, { value: 'assets', label: 'Assets' }].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTab(t.value)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: tab === t.value ? accent : 'var(--bg-elevated)',
                    color:      tab === t.value ? '#fff'  : 'var(--text-secondary)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-4 pb-3 flex-shrink-0">
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
              >
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder={tab === 'media' ? 'Search by prompt…' : 'Search by name…'}
                  className="flex-1 bg-transparent text-sm outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl animate-pulse"
                      style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
                    />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2 text-center">
                  <FolderOpen size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Nothing here yet
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {tab === 'media'
                      ? 'Completed generations will show up here.'
                      : 'Uploaded assets will show up here.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {items.map((item) => {
                      const isVideo = tab === 'media' ? item.output_type === 'video' : isVideoAsset(item)
                      const thumb   = tab === 'media'
                        ? (item.output_thumbnail_url || item.output_url)
                        : (item.thumbnail_url || item.file_url)
                      const hasThumb = tab === 'media' ? !!item.output_thumbnail_url : !!item.thumbnail_url
                      const showImg  = !isVideo || hasThumb

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className="relative rounded-xl overflow-hidden"
                          style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
                        >
                          {showImg ? (
                            <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <VideoIcon size={18} style={{ color: 'var(--text-muted)' }} />
                            </div>
                          )}
                          {isVideo && (
                            <div
                              className="absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: 'rgba(0,0,0,0.6)' }}
                            >
                              <Film size={10} color="#fff" />
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {hasMore && (
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="w-full mt-3 py-2.5 rounded-xl text-sm font-semibold"
                      style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                    >
                      {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
