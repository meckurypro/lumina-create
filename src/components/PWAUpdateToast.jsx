// src/components/PWAUpdateToast.jsx
// Drop this into your App.jsx root — shows a subtle banner when a new app version deploys.
// Uses vite-plugin-pwa's virtual module — only active in production builds.

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'

export default function PWAUpdateToast() {
  const [show,           setShow]           = useState(false)
  const [updateSW,       setUpdateSW]       = useState(null)
  const [updating,       setUpdating]       = useState(false)

  useEffect(() => {
    // Only runs in production (vite-plugin-pwa virtual module)
    // In dev, this import returns a no-op so nothing breaks
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const sw = registerSW({
          // Called when a new SW is waiting — show the toast
          onNeedRefresh() {
            setUpdateSW(() => sw)
            setShow(true)
          },
          // Called when app is ready to work offline
          onOfflineReady() {
            // Silently ready — no toast needed
            console.log('[PWA] Ready to work offline')
          },
        })
      })
      .catch(() => {
        // PWA not available (dev mode) — silently ignore
      })
  }, [])

  const handleUpdate = async () => {
    setUpdating(true)
    try {
      await updateSW?.(true) // true = reload after update
    } catch {
      window.location.reload()
    }
  }

  const handleDismiss = () => setShow(false)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0,  opacity: 1 }}
          exit={{    y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          className="fixed bottom-4 left-4 right-4 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl"
          style={{
            background:   '#111111',
            border:       '1px solid rgba(255,255,255,0.12)',
            maxWidth:     420,
            margin:       '0 auto',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Icon */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <RefreshCw size={16} style={{ color: '#60a5fa' }} />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold" style={{ color: '#ffffff' }}>Update available</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Tap to get the latest version
            </p>
          </div>

          {/* Update button */}
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 flex-shrink-0"
            style={{ background: '#2563eb', color: '#fff', opacity: updating ? 0.7 : 1 }}
          >
            {updating
              ? <RefreshCw size={11} className="animate-spin" />
              : 'Update'
            }
          </button>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
