// src/lib/assets.js
//
// Supabase helpers for the Assets feature.
// Storage bucket: 'assets'       (private, signed URLs) — original files
// Storage bucket: 'asset-thumbs' (public, permanent)    — tiny WebP thumbnails
// Table: assets (id, user_id, name, file_path, file_url, thumbnail_url, mime_type, size_bytes, created_at)

import { supabase } from '@/lib/supabase'

const BUCKET        = 'assets'
const THUMB_BUCKET  = 'asset-thumbs'
const SIGNED_SECS   = 60 * 60 * 24 * 7   // 7-day signed URLs

// Thumbnail target: 240px on the long edge, WebP at quality 72
const THUMB_MAX_PX  = 240
const THUMB_QUALITY = 0.72

// ─────────────────────────────────────────────────────────────────────────────
// generateImageThumbnail
// Resizes an image File/Blob to THUMB_MAX_PX on the long edge, returns WebP Blob.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateImageThumbnail(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fileOrBlob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale  = Math.min(THUMB_MAX_PX / img.width, THUMB_MAX_PX / img.height, 1.0)
      const w      = Math.max(1, Math.round(img.width  * scale))
      const h      = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/webp',
        THUMB_QUALITY,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// generateVideoThumbnail
// Seeks to 5% into a video File/Blob, extracts a frame, returns WebP Blob.
// ─────────────────────────────────────────────────────────────────────────────

export async function generateVideoThumbnail(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const url   = URL.createObjectURL(fileOrBlob)
    const video = document.createElement('video')
    video.muted       = true
    video.preload     = 'auto'
    video.crossOrigin = 'anonymous'
    video.playsInline = true

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Video load failed')) }

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.1, (video.duration || 1) * 0.05)
    }

    video.onseeked = () => {
      URL.revokeObjectURL(url)
      const scale  = Math.min(THUMB_MAX_PX / video.videoWidth, THUMB_MAX_PX / video.videoHeight, 1.0)
      const w      = Math.max(1, Math.round(video.videoWidth  * scale))
      const h      = Math.max(1, Math.round(video.videoHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h
      canvas.getContext('2d').drawImage(video, 0, 0, w, h)
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/webp',
        THUMB_QUALITY,
      )
    }

    video.src = url
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// uploadThumbnail
// Uploads a WebP Blob to asset-thumbs/{userId}/{assetId}.webp
// Returns the public URL (no signing needed — public bucket).
// ─────────────────────────────────────────────────────────────────────────────

async function uploadThumbnail(userId, assetId, blob) {
  const path = `${userId}/${assetId}.webp`
  const { error } = await supabase.storage
    .from(THUMB_BUCKET)
    .upload(path, blob, {
      contentType:  'image/webp',
      upsert:       true,
      cacheControl: '31536000',  // 1 year — thumbnails are immutable
    })
  if (error) throw new Error(error.message || 'Thumbnail upload failed')
  const { data } = supabase.storage.from(THUMB_BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// uploadAsset
// Upload original file + generate+upload thumbnail in parallel.
// Returns the new asset row including thumbnail_url.
// ─────────────────────────────────────────────────────────────────────────────

export async function uploadAsset(userId, file, displayName, onProgress) {
  const ext      = file.name.split('.').pop()
  const filePath = `${userId}/${crypto.randomUUID()}.${ext}`
  const isVideo  = file.type.startsWith('video/')
  const isImage  = file.type.startsWith('image/')

  // ── Upload original to storage ────────────────────────────────────────────
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert:       false,
      onUploadProgress: onProgress
        ? ({ loaded, total }) => onProgress(Math.round((loaded / total) * 100))
        : undefined,
    })
  if (uploadErr) throw new Error(uploadErr.message || 'Upload failed')

  // ── Get a signed URL for the original ─────────────────────────────────────
  const { data: signedData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_SECS)
  if (signErr) throw new Error(signErr.message || 'Could not get signed URL')

  const name = displayName || file.name.replace(/\.[^.]+$/, '')

  // ── Insert asset row (without thumbnail yet — we need the id) ─────────────
  const { data: asset, error: insertErr } = await supabase
    .from('assets')
    .insert({
      user_id:    userId,
      name,
      file_path:  filePath,
      file_url:   signedData.signedUrl,
      mime_type:  file.type || null,
      size_bytes: file.size || null,
    })
    .select()
    .single()
  if (insertErr) throw new Error(insertErr.message || 'Could not save asset')

  // ── Generate + upload thumbnail in background (non-blocking) ──────────────
  // We do this after insert so we have asset.id for the thumb path.
  // The row gets updated with thumbnail_url once done.
  // If it fails, the asset is still usable — thumb will be backfilled by cron.
  ;(async () => {
    try {
      let thumbBlob = null
      if (isImage) {
        thumbBlob = await generateImageThumbnail(file)
      } else if (isVideo) {
        thumbBlob = await generateVideoThumbnail(file)
      }
      if (!thumbBlob) return

      const thumbUrl = await uploadThumbnail(userId, asset.id, thumbBlob)
      await supabase
        .from('assets')
        .update({ thumbnail_url: thumbUrl })
        .eq('id', asset.id)
    } catch (err) {
      // Non-fatal — cron will backfill
      console.warn('[uploadAsset] thumbnail generation failed (will be backfilled):', err.message)
    }
  })()

  return asset
}

// ─────────────────────────────────────────────────────────────────────────────
// list
// ─────────────────────────────────────────────────────────────────────────────

export async function listAssets(userId, { search = '' } = {}) {
  let query = supabase
    .from('assets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (search.trim()) {
    query = query.ilike('name', `%${search.trim()}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message || 'Failed to load assets')
  return data || []
}

// ─────────────────────────────────────────────────────────────────────────────
// rename
// ─────────────────────────────────────────────────────────────────────────────

export async function renameAsset(assetId, newName) {
  const { data, error } = await supabase
    .from('assets')
    .update({ name: newName.trim() })
    .eq('id', assetId)
    .select()
    .single()
  if (error) throw new Error(error.message || 'Rename failed')
  return data
}

// ─────────────────────────────────────────────────────────────────────────────
// delete
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteAsset(asset) {
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .remove([asset.file_path])
  if (storageErr) console.warn('[deleteAsset] storage remove:', storageErr.message)

  // Also delete thumbnail if it exists
  if (asset.thumbnail_url) {
    const thumbPath = `${asset.user_id}/${asset.id}.webp`
    await supabase.storage.from(THUMB_BUCKET).remove([thumbPath]).catch(() => {})
  }

  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', asset.id)
  if (error) throw new Error(error.message || 'Delete failed')
}

// ─────────────────────────────────────────────────────────────────────────────
// refreshSignedUrl
// ─────────────────────────────────────────────────────────────────────────────

export async function refreshSignedUrl(filePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_SECS)
  if (error) throw new Error(error.message || 'Could not refresh URL')
  return data.signedUrl
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isVideoAsset(asset) {
  return asset.mime_type?.startsWith('video/')
}

export function isImageAsset(asset) {
  return !asset.mime_type || asset.mime_type.startsWith('image/')
}

export function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 ** 2)   return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3)   return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}
