import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Film, Image, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'

export default function FeedModerationItem({ post, onApprove, onReject }) {
  const [rejectMode, setRejectMode] = useState(false)
  const [notes,      setNotes]      = useState('')
  const [expanded,   setExpanded]   = useState(false)
  const isVideo = post.output_type === 'video'
  const preview = post.output_url || post.thumbnail_url

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden mb-3"
      style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}
    >
      <div className="flex gap-3 p-3 items-center">
        <div
          className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-black cursor-pointer relative"
          onClick={() => setExpanded((v) => !v)}
        >
          {post.thumbnail_url
            ? <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
                {isVideo ? <Film size={18} style={{ color: 'var(--text-muted)' }} /> : <Image size={18} style={{ color: 'var(--text-muted)' }} />}
              </div>
          }
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
            {expanded ? <EyeOff size={13} color="white" /> : <Eye size={13} color="white" />}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            @{post.profiles?.username}
          </p>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {post.templates?.name || post.output_type} · {new Date(post.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => onApprove(post.id)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}
            title="Approve"
          >
            <CheckCircle size={16} />
          </button>
          <button
            onClick={() => setRejectMode((v) => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: rejectMode ? 'rgba(239,68,68,0.2)' : 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            title="Reject"
          >
            <XCircle size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && preview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mx-3 mb-3 rounded-xl overflow-hidden bg-black" style={{ maxHeight: 400 }}>
              {isVideo
                ? <video src={preview} className="w-full object-contain" style={{ maxHeight: 400 }} controls autoPlay loop playsInline />
                : <img   src={preview} alt="full preview" className="w-full object-contain" style={{ maxHeight: 400 }} />
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-3 pb-3 flex flex-col gap-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Reason for rejection (optional)…"
                rows={2}
                className="w-full text-sm rounded-xl px-3 py-2 resize-none"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { onReject(post.id, notes); setRejectMode(false); setNotes('') }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}
                >
                  <XCircle size={14} /> Confirm Reject
                </button>
                <button
                  onClick={() => { setRejectMode(false); setNotes('') }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
