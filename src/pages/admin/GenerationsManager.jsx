import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle,
  ChevronDown, ChevronUp, ExternalLink, Copy, Zap, Film,
  Image, User, Calendar, Search, X, Filter, Download, Eye,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const PAGE_SIZE = 25

const STATUS_CONFIG = {
  completed:  { label: 'Completed',  color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: CheckCircle  },
  processing: { label: 'Processing', color: '#eab308', bg: 'rgba(234,179,8,0.12)',   icon: Clock        },
  pending:    { label: 'Pending',    color: '#6366f1', bg: 'rgba(99,102,241,0.12)',   icon: Clock        },
  failed:     { label: 'Failed',     color: '#ef4444', bg: 'rgba(239,68,68,0.12)',    icon: XCircle      },
}

const GEN_TYPE_LABELS = {
  text_to_image:   'T2I',
  image_to_image:  'I2I',
  image_to_video:  'I2V',
  text_to_video:   'T2V',
  start_end_frame: 'S→E',
  lipsync:         'Sync',
  face_swap:       'Face',
  head_swap:       'Head',
}

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

const timeAgo = (d) => {
  if (!d) return '—'
  const diff = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const fmtMs = (ms) => {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

const copyToClipboard = (text, label = 'Copied') => {
  navigator.clipboard.writeText(text).then(() => toast.success(label))
}

// Detect video by extension OR content-type hint in the URL.
const looksLikeVideo = (url = '') =>
  /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url)

// Blob-download — `download` attribute is ignored for cross-origin URLs,
// so we MUST fetch the asset and create a same-origin object URL.
const blobDownload = async (url, filename) => {
  const toastId = toast.loading('Preparing download…')
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
    if (!res.ok) throw new Error('Network response was not ok')
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    toast.success('Downloaded', { id: toastId })
  } catch (err) {
    console.error('Download failed', err)
    toast.error('Download failed', { id: toastId })
  }
}

// In-app lightbox for previewing media without leaving the admin.
const MediaLightbox = ({ url, kind, filename, onClose }) => {
  if (!url) return null
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 16, right: 16,
          width: 40, height: 40, borderRadius: 9999,
          background: 'rgba(255,255,255,0.12)', color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <X size={18} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); blobDownload(url, filename) }}
        style={{
          position: 'absolute', top: 16, left: 16,
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 9999,
          background: 'rgba(255,255,255,0.12)', color: '#fff',
          border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 700,
        }}
      >
        <Download size={13} /> Download
      </button>
      {kind === 'video' ? (
        <video
          src={url}
          controls
          autoPlay
          playsInline
          style={{ maxWidth: '95vw', maxHeight: '88vh', borderRadius: 12, background: '#000' }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={url}
          alt={filename}
          style={{ maxWidth: '95vw', maxHeight: '88vh', borderRadius: 12, objectFit: 'contain' }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>,
    document.body
  )
}

// Row-level Preview + Download pair shown on each collapsed generation row.
const RowMediaActions = ({ url, kind, filename }) => {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title="Preview output"
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '4px 8px', borderRadius: 8,
          background: 'rgba(16,185,129,0.1)', color: '#10b981',
          fontSize: 10, fontWeight: 700,
          border: '1px solid rgba(16,185,129,0.2)', cursor: 'pointer',
        }}
      >
        <Eye size={9} /> Preview
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); blobDownload(url, filename) }}
        title="Download output"
        style={{
          display: 'flex', alignItems: 'center', gap: 3,
          padding: '4px 8px', borderRadius: 8,
          background: 'rgba(99,102,241,0.1)', color: '#6366f1',
          fontSize: 10, fontWeight: 700,
          border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer',
        }}
      >
        <Download size={9} /> Download
      </button>
      {open && (
        <MediaLightbox url={url} kind={kind} filename={filename} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────
// Status Badge
// ─────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#888', bg: 'rgba(136,136,136,0.1)', icon: Clock }
  const Icon = cfg.icon
  const isPulse = status === 'processing' || status === 'pending'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 8,
      background: cfg.bg, color: cfg.color,
      fontSize: 10, fontWeight: 800, letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {isPulse ? (
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.4 }}
          style={{ display: 'flex' }}
        >
          <Icon size={9} />
        </motion.span>
      ) : (
        <Icon size={9} />
      )}
      {cfg.label.toUpperCase()}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
// URL Preview Chip
// ─────────────────────────────────────────────────────────

const UrlChip = ({ label, url, color = '#6366f1' }) => {
  const [previewOpen, setPreviewOpen] = useState(false)
  if (!url) return null
  const isVideo = looksLikeVideo(url)
  const kind    = isVideo ? 'video' : 'image'
  const ext     = isVideo ? 'mp4' : (url.match(/\.(png|jpg|jpeg|webp|gif)(\?|#|$)/i)?.[1] || 'png')
  const safeLabel = label.toLowerCase().replace(/\s+/g, '-')
  const filename  = `${safeLabel}.${ext}`

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {/* Preview — in-app lightbox, no redirect */}
      <button
        onClick={(e) => { e.stopPropagation(); setPreviewOpen(true) }}
        title={`Preview ${label}`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '2px 7px', borderRadius: 6,
          background: `${color}15`, color,
          fontSize: 10, fontWeight: 700,
          border: `1px solid ${color}30`, cursor: 'pointer',
        }}
      >
        {isVideo ? <Film size={8} /> : <Image size={8} />}
        {label}
        <Eye size={8} />
      </button>
      {/* One-click download — blob fetch, never navigates */}
      <button
        onClick={(e) => { e.stopPropagation(); blobDownload(url, filename) }}
        title={`Download ${label}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
      >
        <Download size={9} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); copyToClipboard(url, `${label} URL copied`) }}
        title="Copy URL"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex' }}
      >
        <Copy size={9} />
      </button>
      {previewOpen && (
        <MediaLightbox
          url={url}
          kind={kind}
          filename={filename}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </span>
  )
}

// ─────────────────────────────────────────────────────────
// Generation Row (expanded detail)
// ─────────────────────────────────────────────────────────

const GenDetail = ({ gen }) => {
  const inputUrls = Array.isArray(gen.input_image_urls) ? gen.input_image_urls : []

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{
        padding: '12px 14px 14px',
        borderTop: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>

        {/* IDs row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <DetailField label="Generation ID" value={gen.id} mono copyable />
          <DetailField label="User ID"       value={gen.user_id} mono copyable />
          {gen.provider_request_id && (
            <DetailField label="Provider Request ID" value={gen.provider_request_id} mono copyable />
          )}
          {gen.template_id && (
            <DetailField label="Template ID" value={gen.template_id} mono copyable />
          )}
        </div>

        {/* Prompt */}
        {gen.prompt && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Original Prompt
            </p>
            <p style={{
              fontSize: 11, color: 'var(--text-secondary)',
              lineHeight: 1.6, padding: '8px 10px', borderRadius: 8,
              background: 'var(--bg-elevated)', maxHeight: 120, overflowY: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {gen.prompt}
            </p>
          </div>
        )}

        {/* Enhanced prompt */}
        {gen.enhanced_prompt && (
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Enhanced Prompt
            </p>
            <p style={{
              fontSize: 11, color: 'var(--text-secondary)',
              lineHeight: 1.6, padding: '8px 10px', borderRadius: 8,
              background: 'var(--bg-elevated)', maxHeight: 100, overflowY: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {gen.enhanced_prompt}
            </p>
          </div>
        )}

        {/* Error */}
        {gen.error_message && (
          <div style={{
            padding: '8px 10px', borderRadius: 8,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: '#ef4444', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Error
            </p>
            <p style={{ fontSize: 11, color: '#ef4444', lineHeight: 1.5 }}>{gen.error_message}</p>
          </div>
        )}

        {/* URLs */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Media URLs
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <UrlChip label="Output"      url={gen.output_url}           color="#10b981" />
            <UrlChip label="Thumbnail"   url={gen.output_thumbnail_url} color="#6366f1" />
            <UrlChip label="Start Frame" url={gen.start_frame_url}      color="#f59e0b" />
            <UrlChip label="End Frame"   url={gen.end_frame_url}        color="#f97316" />
            {inputUrls.map((u, i) => (
              <UrlChip key={i} label={`Input ${i + 1}`} url={u} color="#8b5cf6" />
            ))}
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <MetaChip label="Model"       value={gen.model} />
          <MetaChip label="Type"        value={gen.generation_type} />
          <MetaChip label="Aspect"      value={gen.aspect_ratio} />
          <MetaChip label="Duration"    value={gen.duration ? `${gen.duration}s` : null} />
          <MetaChip label="Resolution"  value={gen.resolution} />
          <MetaChip label="Credits"     value={gen.credits_charged} />
          <MetaChip label="Gen Time"    value={fmtMs(gen.generation_time_ms)} />
          <MetaChip label="Output Type" value={gen.output_type} />
          <MetaChip label="With Sound"  value={gen.with_sound ? 'Yes' : 'No'} />
          <MetaChip label="Smart Edit"  value={gen.is_smart_edit ? 'Yes' : 'No'} />
          <MetaChip label="PE Used"     value={gen.prompt_engineering_used ? 'Yes' : 'No'} />
          <MetaChip label="Vision Used" value={gen.vision_analysis_used ? 'Yes' : 'No'} />
          <MetaChip label="Staff Gen"   value={gen.is_staff_generation ? 'Yes' : 'No'} />
          <MetaChip label="Published"   value={gen.is_published ? 'Yes' : 'No'} />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <MetaChip label="Created" value={fmtDate(gen.created_at)} />
          <MetaChip label="Updated" value={fmtDate(gen.updated_at)} />
          {gen.storage_protected_at && (
            <MetaChip label="Storage Protected" value={fmtDate(gen.storage_protected_at)} />
          )}
        </div>

      </div>
    </motion.div>
  )
}

const DetailField = ({ label, value, mono, copyable }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
    <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </p>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <p style={{
        fontSize: 10, color: 'var(--text-secondary)',
        fontFamily: mono ? 'monospace' : undefined,
        wordBreak: 'break-all',
      }}>
        {value || '—'}
      </p>
      {copyable && value && (
        <button
          onClick={() => copyToClipboard(value, `${label} copied`)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}
        >
          <Copy size={9} />
        </button>
      )}
    </div>
  </div>
)

const MetaChip = ({ label, value }) => {
  if (!value || value === '—') return null
  return (
    <span style={{
      display: 'inline-flex', flexDirection: 'column',
      padding: '3px 8px', borderRadius: 7,
      background: 'var(--bg-elevated)', border: '1px solid var(--border-color)',
    }}>
      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 700 }}>{value}</span>
    </span>
  )
}

// ─────────────────────────────────────────────────────────
// Generation Row
// ─────────────────────────────────────────────────────────

const GenRow = ({ gen, onSync, syncing }) => {
  const [expanded, setExpanded] = useState(false)
  const isProcessing = gen.status === 'processing' || gen.status === 'pending'
  const typeLabel = GEN_TYPE_LABELS[gen.generation_type] || gen.generation_type
  const isVideo = gen.output_type === 'video'

  return (
    <div style={{
      borderRadius: 14,
      background: 'var(--bg-card)',
      border: `1px solid ${isProcessing ? 'rgba(234,179,8,0.25)' : 'var(--border-color)'}`,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      {/* Main row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 10,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Left */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>

          {/* Top line: type badge + status + model */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5,
              background: isVideo ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
              color: isVideo ? '#f59e0b' : '#818cf8',
              letterSpacing: '0.05em',
            }}>
              {isVideo ? <><Film size={8} style={{ display: 'inline', marginRight: 2 }} /></> : <><Image size={8} style={{ display: 'inline', marginRight: 2 }} /></>}
              {typeLabel}
            </span>
            <StatusBadge status={gen.status} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
              {gen.model}
            </span>
          </div>

          {/* Second line: user ID + time + credits */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
              <User size={9} />
              <span style={{ fontFamily: 'monospace', fontSize: 9 }}>{gen.user_id?.slice(0, 8)}…</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
              <Calendar size={9} />
              {timeAgo(gen.created_at)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)' }}>
              <Zap size={9} />
              {gen.credits_charged} cr
            </span>
            {gen.generation_time_ms && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                ⏱ {fmtMs(gen.generation_time_ms)}
              </span>
            )}
          </div>

          {/* Error snippet */}
          {gen.error_message && (
            <p style={{
              fontSize: 10, color: '#ef4444', lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              ⚠ {gen.error_message}
            </p>
          )}

          {/* Prompt snippet */}
          {gen.prompt && !gen.error_message && (
            <p style={{
              fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {gen.prompt.slice(0, 80)}{gen.prompt.length > 80 ? '…' : ''}
            </p>
          )}

        </div>

        {/* Right: actions + expand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, justifyContent: 'center' }}>
          {isProcessing && (
            <button
              onClick={(e) => { e.stopPropagation(); onSync(gen) }}
              disabled={syncing}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '5px 10px', borderRadius: 8, border: 'none',
                background: syncing ? 'var(--bg-elevated)' : 'rgba(234,179,8,0.15)',
                color: syncing ? 'var(--text-muted)' : '#eab308',
                fontSize: 10, fontWeight: 800, cursor: syncing ? 'not-allowed' : 'pointer',
                letterSpacing: '0.04em', textTransform: 'uppercase',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
            >
              {syncing ? (
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ display: 'flex' }}>
                  <RefreshCw size={10} />
                </motion.span>
              ) : (
                <RefreshCw size={10} />
              )}
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          )}

          {gen.output_url && (
            <RowMediaActions
              url={gen.output_url}
              filename={`gen-${gen.id.slice(0,8)}.${looksLikeVideo(gen.output_url) ? 'mp4' : 'png'}`}
              kind={looksLikeVideo(gen.output_url) ? 'video' : 'image'}
            />
          )}

          <span style={{ color: 'var(--text-muted)', display: 'flex' }}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && <GenDetail key="detail" gen={gen} />}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Stats Bar
// ─────────────────────────────────────────────────────────

const StatsBar = ({ counts }) => {
  const items = [
    { label: 'Total',      value: counts.total,      color: 'var(--text-primary)' },
    { label: 'Completed',  value: counts.completed,  color: '#10b981' },
    { label: 'Processing', value: counts.processing, color: '#eab308' },
    { label: 'Pending',    value: counts.pending,    color: '#6366f1' },
    { label: 'Failed',     value: counts.failed,     color: '#ef4444' },
  ]

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16,
      padding: '12px 14px', borderRadius: 14,
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    }}>
      {items.map(({ label, value, color }) => (
        <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: '1 1 60px' }}>
          <span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1 }}>{value ?? '—'}</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{label}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Filter Bar
// ─────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { value: 'all',        label: 'All',        color: '#aaa'     },
  { value: 'completed',  label: 'Completed',  color: '#10b981'  },
  { value: 'processing', label: 'Processing', color: '#eab308'  },
  { value: 'pending',    label: 'Pending',    color: '#6366f1'  },
  { value: 'failed',     label: 'Failed',     color: '#ef4444'  },
]

const TYPE_FILTERS = [
  { value: 'all',   label: 'All Types' },
  { value: 'image', label: 'Images'    },
  { value: 'video', label: 'Videos'    },
]

// ─────────────────────────────────────────────────────────
// Main GenerationsManager
// ─────────────────────────────────────────────────────────

export default function GenerationsManager() {
  const [gens,          setGens]          = useState([])
  const [loading,       setLoading]       = useState(true)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const [hasMore,       setHasMore]       = useState(false)
  const [page,          setPage]          = useState(0)
  const [counts,        setCounts]        = useState({})

  const [statusFilter,  setStatusFilter]  = useState('all')
  const [typeFilter,    setTypeFilter]    = useState('all')
  const [userSearch,    setUserSearch]    = useState('')
  const [searchInput,   setSearchInput]   = useState('')

  const [syncingId,     setSyncingId]     = useState(null)
  const [bulkSyncing,   setBulkSyncing]   = useState(false)

  const debounceRef = useRef(null)

  // ── Fetch counts ──────────────────────────────────────

  const fetchCounts = useCallback(async () => {
    const { data } = await supabase
      .from('generations')
      .select('status')
    if (!data) return
    const c = { total: data.length, completed: 0, processing: 0, pending: 0, failed: 0 }
    for (const g of data) { if (c[g.status] !== undefined) c[g.status]++ }
    setCounts(c)
  }, [])

  // ── Fetch generations ─────────────────────────────────

  const fetchGens = useCallback(async ({
    offset       = 0,
    sFilter      = statusFilter,
    tFilter      = typeFilter,
    userQ        = userSearch,
    reset        = false,
  } = {}) => {
    if (offset === 0) setLoading(true)
    else              setLoadingMore(true)

    let query = supabase
      .from('generations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (sFilter !== 'all') query = query.eq('status', sFilter)
    if (tFilter !== 'all') query = query.eq('output_type', tFilter)
    if (userQ.trim())      query = query.ilike('user_id', `%${userQ.trim()}%`)

    const { data, count, error } = await query

    if (error) { toast.error('Failed to load generations'); setLoading(false); setLoadingMore(false); return }

    setGens(prev => reset ? (data || []) : [...prev, ...(data || [])])
    setHasMore((offset + PAGE_SIZE) < (count || 0))
    setLoading(false)
    setLoadingMore(false)
  }, [statusFilter, typeFilter, userSearch])

  useEffect(() => {
    setPage(0)
    setGens([])
    fetchGens({ offset: 0, reset: true })
    fetchCounts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, typeFilter, userSearch])

  // ── Single sync ───────────────────────────────────────

  const handleSync = async (gen) => {
    if (!gen.provider_request_id) {
      toast.error('No provider_request_id — cannot sync')
      return
    }
    setSyncingId(gen.id)
    try {
      const { error: pollErr } = await supabase.functions.invoke(
        'video-poll-single',
        { body: { generationId: gen.id } }
      )
      if (pollErr) throw new Error(pollErr.message || 'Poll failed')

      const { data: fresh } = await supabase
        .from('generations')
        .select('*')
        .eq('id', gen.id)
        .single()

      if (fresh) {
        setGens(prev => prev.map(g => g.id === gen.id ? fresh : g))
        fetchCounts()
      }

      const status = fresh?.status
      if (status === 'completed')  toast.success('✅ Generation completed!')
      else if (status === 'failed') toast.error(`Failed: ${fresh?.error_message || 'Unknown'}`)
      else toast('Still processing.', { icon: '⏳' })

    } catch (err) {
      toast.error(err.message || 'Sync failed')
    } finally {
      setSyncingId(null)
    }
  }

  // ── Bulk sync ─────────────────────────────────────────

  const handleBulkSync = async () => {
    const processingGens = gens.filter(
      g => (g.status === 'processing' || g.status === 'pending') && g.provider_request_id
    )
    if (!processingGens.length) {
      toast('No in-progress generations with a provider ID.', { icon: 'ℹ️' })
      return
    }
    setBulkSyncing(true)
    toast(`Syncing ${processingGens.length} generation${processingGens.length > 1 ? 's' : ''}…`, { icon: '⏳' })

    let resolved = 0
    let failed   = 0
    let still    = 0

    await Promise.allSettled(
      processingGens.map(async (gen) => {
        try {
          await supabase.functions.invoke('video-poll-single', { body: { generationId: gen.id } })
          const { data: fresh } = await supabase.from('generations').select('*').eq('id', gen.id).single()
          if (fresh) setGens(prev => prev.map(g => g.id === gen.id ? fresh : g))
          if      (fresh?.status === 'completed') resolved++
          else if (fresh?.status === 'failed')    failed++
          else                                    still++
        } catch { still++ }
      })
    )

    fetchCounts()
    setBulkSyncing(false)
    toast.success(`Bulk sync done — ${resolved} completed, ${failed} failed, ${still} still pending`)
  }

  // ── Search debounce ───────────────────────────────────

  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchInput(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setUserSearch(val), 350)
  }

  const clearSearch = () => { setSearchInput(''); setUserSearch('') }

  // ── Derived ───────────────────────────────────────────

  const processingCount = gens.filter(g => g.status === 'processing' || g.status === 'pending').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Stats */}
      <StatsBar counts={counts} />

      {/* Bulk sync + search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>

        {/* Search by user ID */}
        <div style={{ position: 'relative', flex: '1 1 180px' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search by User ID…"
            style={{
              width: '100%', paddingLeft: 30, paddingRight: searchInput ? 30 : 10,
              paddingTop: 8, paddingBottom: 8,
              borderRadius: 10, border: '1px solid var(--border-color)',
              background: 'var(--bg-elevated)', color: 'var(--text-primary)',
              fontSize: 12, outline: 'none', boxSizing: 'border-box',
            }}
          />
          {searchInput && (
            <button onClick={clearSearch} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 2 }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Bulk sync button */}
        <button
          onClick={handleBulkSync}
          disabled={bulkSyncing || processingCount === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10, border: 'none',
            background: processingCount > 0 ? 'rgba(234,179,8,0.15)' : 'var(--bg-elevated)',
            color: processingCount > 0 ? '#eab308' : 'var(--text-muted)',
            fontSize: 12, fontWeight: 800, cursor: processingCount > 0 ? 'pointer' : 'not-allowed',
            letterSpacing: '0.03em', whiteSpace: 'nowrap',
            transition: 'all 0.15s', opacity: bulkSyncing ? 0.7 : 1,
          }}
        >
          {bulkSyncing ? (
            <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} style={{ display: 'flex' }}>
              <RefreshCw size={13} />
            </motion.span>
          ) : (
            <RefreshCw size={13} />
          )}
          {bulkSyncing ? 'Syncing all…' : `Sync All Processing${processingCount > 0 ? ` (${processingCount})` : ''}`}
        </button>
      </div>

      {/* Status filters */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            style={{
              padding: '5px 12px', borderRadius: 10, border: 'none',
              fontSize: 11, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.03em', transition: 'all 0.15s',
              background: statusFilter === f.value ? `${f.color}22` : 'var(--bg-card)',
              color: statusFilter === f.value ? f.color : 'var(--text-muted)',
              outline: statusFilter === f.value ? `1.5px solid ${f.color}50` : 'none',
            }}
          >
            {f.label}
            {f.value !== 'all' && counts[f.value] ? ` · ${counts[f.value]}` : ''}
          </button>
        ))}
      </div>

      {/* Type filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            style={{
              padding: '4px 10px', borderRadius: 8, border: 'none',
              fontSize: 10, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.03em', transition: 'all 0.15s',
              background: typeFilter === f.value ? 'var(--brand)' : 'var(--bg-elevated)',
              color: typeFilter === f.value ? 'white' : 'var(--text-muted)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{
              height: 74, borderRadius: 14,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              opacity: 1 - i * 0.1,
              animation: 'pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.06}s`,
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100%{opacity:0.35} 50%{opacity:0.7} }`}</style>
        </div>

      ) : gens.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          <Filter size={28} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>No generations found</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Try adjusting the filters above.</p>
        </div>

      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {gens.map(gen => (
            <GenRow
              key={gen.id}
              gen={gen}
              onSync={handleSync}
              syncing={syncingId === gen.id}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && !loadingMore && (
        <button
          onClick={() => {
            const next = page + 1
            setPage(next)
            fetchGens({ offset: next * PAGE_SIZE })
          }}
          style={{
            width: '100%', marginTop: 12, padding: '14px',
            borderRadius: 14, border: '1px solid var(--border-color)',
            background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
          }}
        >
          Load more
        </button>
      )}

      {loadingMore && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              border: '2px solid var(--border-color)',
              borderTopColor: '#eab308',
            }}
          />
        </div>
      )}

    </div>
  )
}
