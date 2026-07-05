// src/components/muse/AttachmentPicker.jsx
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Upload, ImageIcon, VideoIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { uploadAsset, listAssets, isVideoAsset } from '@/lib/assets'

export default function AttachmentPicker({ onSelect, onClose }) {
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const [assets, setAssets]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!user) return
    listAssets(user.id, { limit: 30 })
      .then(({ data }) => setAssets(data || []))
      .catch(() => toast.error('Could not load your assets'))
      .finally(() => setLoading(false))
  }, [user])

  const handleUpload = async (files) => {
    const file = files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const asset = await uploadAsset(user.id, file, file.name.replace(/\.[^.]+$/, ''))
      onSelect({
        asset_id:      asset.id,
        thumbnail_url: asset.thumbnail_url || asset.file_url,
        asset_type:    file.type.startsWith('video/') ? 'video' : 'image',
      })
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handlePick = (asset) => {
    onSelect({
      asset_id:      asset.id,
      thumbnail_url: asset.thumbnail_url || asset.file_url,
      asset_type:    isVideoAsset(asset) ? 'video' : 'image',
    })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      >
        <div
          className="w-full max-w-xl rounded-t-3xl px-4 pt-4 flex flex-col"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', maxHeight: '70vh' }}
        >
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
          </div>

          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Add media</p>
            <button onClick={onClose}>
              <X size={18} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {/* Upload button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold mb-4"
            style={{ background: 'var(--brand)', color: '#fff', opacity: uploading ? 0.6 : 1 }}
          >
            <Upload size={16} />
            {uploading ? 'Uploading…' : 'Upload a photo or video'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
            Or pick from your Assets
          </p>

          {/* Assets grid */}
          <div className="flex-1 overflow-y-auto pb-6">
            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <ImageIcon size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No assets yet — upload one above</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {assets.map((asset) => {
                  const isVideo = isVideoAsset(asset)
                  return (
                    <button
                      key={asset.id}
                      onClick={() => handlePick(asset)}
                      className="aspect-square rounded-xl overflow-hidden relative"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      {asset.thumbnail_url ? (
                        <img
                          src={asset.thumbnail_url}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : !isVideo ? (
                        <img
                          src={asset.file_url}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <VideoIcon size={16} style={{ color: 'var(--text-muted)' }} />
                        </div>
                      )}

                      {isVideo && (
                        <div
                          className="absolute bottom-1 right-1 w-5 h-5 rounded-md flex items-center justify-center"
                          style={{ background: 'rgba(0,0,0,0.55)' }}
                        >
                          <VideoIcon size={11} color="#fff" />
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}
