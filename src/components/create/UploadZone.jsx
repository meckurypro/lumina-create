// src/components/create/UploadZone.jsx
//
// Unified "empty state" upload trigger used across every Create page
// (image ref, video frame, subject photo, motion video, etc). Renders a
// consistent dashed box (icon + label), and adds a long-press (mobile) /
// right-click (desktop) context menu offering "Upload from Media" and
// "Upload from Assets", backed by MediaAssetPickerModal.
//
// This component owns ONLY the empty/trigger state. Each page keeps its
// own "filled" preview (thumbnail, remove button, badges, aspect ratio,
// compat status) since that varies a lot per tool — swap in UploadZone
// wherever a page currently renders its own <label><input type=file>...
// dashed box, and wire onFile/onPick into the page's existing setters.

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ImagePlus, Film, FolderOpen, Sparkles } from 'lucide-react'
import MediaAssetPickerModal from './MediaAssetPickerModal'

const LONG_PRESS_MS = 480

export default function UploadZone({
  kind = 'image',              // 'image' | 'video'
  onFile,                      // (File) => void — local device upload
  onPick,                      // (pickedItem) => void — from Media/Assets picker
  accent       = 'var(--brand, #5B6EF7)',
  accentSub    = 'rgba(91,110,247,0.1)',
  accentBorder = 'rgba(91,110,247,0.3)',
  label,
  sublabel,
  disabled     = false,
  size         = 'md',         // 'sm' | 'md' | 'lg' — icon scale only
  aspectRatio  = '1/1',
  allowBrowse  = true,         // set false to hide the long-press/right-click menu entirely
  className    = '',
}) {
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [menuPos,    setMenuPos]    = useState({ x: 0, y: 0 })
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTab,  setPickerTab]  = useState('media')

  const inputRef        = useRef(null)
  const pressTimer      = useRef(null)
  const longPressFired   = useRef(false)

  const ICON_SIZE  = { sm: 18, md: 22, lg: 28 }[size] ?? 22
  const LABEL_SIZE = size === 'lg' ? 'text-sm' : 'text-xs'

  const openMenuAt = (x, y) => {
    setMenuPos({ x, y })
    setMenuOpen(true)
  }

  const handleContextMenu = (e) => {
    if (disabled || !allowBrowse) return
    e.preventDefault()
    openMenuAt(e.clientX, e.clientY)
  }

  const handleTouchStart = (e) => {
    if (disabled || !allowBrowse) return
    longPressFired.current = false
    const touch = e.touches[0]
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true
      openMenuAt(touch.clientX, touch.clientY)
    }, LONG_PRESS_MS)
  }
  const clearPressTimer = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null }
  }

  const handleClick = (e) => {
    if (disabled) return
    if (longPressFired.current) {
      // Long press already opened the menu — swallow the click that
      // touchend synthesizes right after, so it doesn't also open the
      // native file picker underneath the menu.
      longPressFired.current = false
      e.preventDefault()
      return
    }
    inputRef.current?.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) onFile?.(file)
    e.target.value = ''
  }

  const openPicker = (tab) => {
    setMenuOpen(false)
    setPickerTab(tab)
    setPickerOpen(true)
  }

  return (
    <div className={`relative ${className}`}>
      <label
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={clearPressTimer}
        onTouchMove={clearPressTimer}
        className="flex flex-col items-center justify-center rounded-2xl w-full transition-all select-none"
        style={{
          aspectRatio,
          border:     `1.5px dashed ${accentBorder}`,
          background: accentSub,
          cursor:     disabled ? 'not-allowed' : 'pointer',
          opacity:    disabled ? 0.4 : 1,
          WebkitTouchCallout: 'none', // prevent iOS long-press callout stealing the gesture
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={kind === 'video' ? 'video/*' : 'image/*'}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
        {kind === 'video'
          ? <Film size={ICON_SIZE} style={{ color: accent, marginBottom: 6 }} />
          : <ImagePlus size={ICON_SIZE} style={{ color: accent, marginBottom: 6 }} />}
        <span className={`${LABEL_SIZE} font-semibold`} style={{ color: accent }}>
          {label || (kind === 'video' ? 'Upload video' : 'Upload image')}
        </span>
        {sublabel && (
          <span className="text-xs mt-1 text-center px-3" style={{ color: 'var(--text-muted)' }}>
            {sublabel}
          </span>
        )}
        {!disabled && allowBrowse && (
          <span className="text-xs mt-1.5 opacity-60 text-center px-3" style={{ color: 'var(--text-muted)' }}>
            Hold (or right-click) to browse Media &amp; Assets
          </span>
        )}
      </label>

      {/* Context menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-[65]"
              onClick={() => setMenuOpen(false)}
              onContextMenu={(e) => { e.preventDefault(); setMenuOpen(false) }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="fixed z-[66] rounded-2xl overflow-hidden py-1.5"
              style={{
                left:       Math.min(menuPos.x, window.innerWidth - 220),
                top:        Math.min(menuPos.y, window.innerHeight - 120),
                minWidth:   200,
                background: 'var(--bg-card)',
                border:     '1px solid var(--border-color)',
                boxShadow:  '0 8px 30px rgba(0,0,0,0.35)',
              }}
            >
              <button
                onClick={() => openPicker('media')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                <FolderOpen size={15} style={{ color: accent }} />
                Upload from Media
              </button>
              <button
                onClick={() => openPicker('assets')}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                <Sparkles size={15} style={{ color: accent }} />
                Upload from Assets
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {allowBrowse && (
        <MediaAssetPickerModal
          open={pickerOpen}
          initialTab={pickerTab}
          typeFilter={kind}
          accent={accent}
          onSelect={(picked) => onPick?.(picked)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}
