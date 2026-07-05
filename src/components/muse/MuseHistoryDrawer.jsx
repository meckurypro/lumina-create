// src/components/muse/MuseHistoryDrawer.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, MessageCircle } from 'lucide-react'
import { listMuseSessions } from '@/lib/museChat'

export default function MuseHistoryDrawer({ activeSessionId, onSelect, onClose }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    listMuseSessions()
      .then(({ sessions }) => setSessions(sessions))
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="fixed top-0 left-0 bottom-0 z-50 w-[86%] max-w-[300px] flex flex-col"
        style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
          <p className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>Chats with Muse</p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--bg-elevated)]"
          >
            <X size={17} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex flex-col gap-2 px-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: 'var(--bg-elevated)' }} />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 px-4 text-center">
              <MessageCircle size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                No conversations yet — start one!
              </p>
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSessionId
              return (
                <button
                  key={s.id}
                  onClick={() => onSelect(s.id)}
                  className="w-full text-left px-3 py-3 rounded-2xl mb-1 transition-all"
                  style={{ background: isActive ? 'var(--bg-elevated)' : 'transparent' }}
                >
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                  >
                    {s.title || 'New chat'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {new Date(s.last_message_at || s.created_at).toLocaleDateString('en-NG', {
                      day: 'numeric', month: 'short',
                    })}
                  </p>
                </button>
              )
            })
          )}
        </div>
      </motion.div>
    </>
  )
}
