// src/lib/assets.js
//
// Supabase helpers for the Assets feature.
// Storage bucket: 'assets'  (private, signed URLs)
// Table: assets (id, user_id, name, file_path, file_url, mime_type, size_bytes, created_at)

import { supabase } from '@/lib/supabase'

const BUCKET      = 'assets'
const SIGNED_SECS = 60 * 60 * 24 * 7   // 7-day signed URLs

// ─────────────────────────────────────────────────────────────────────────────
// upload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a File to storage and insert an assets row.
 * Returns the new asset row.
 *
 * @param {string}   userId
 * @param {File}     file
 * @param {string}   [displayName]   defaults to file.name (without extension)
 * @param {function} [onProgress]    called with 0-100 number
 */
export async function uploadAsset(userId, file, displayName, onProgress) {
  const ext      = file.name.split('.').pop()
  const filePath = `${userId}/${crypto.randomUUID()}.${ext}`

  // ── Upload to storage ──────────────────────────────────────────────────────
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

  // ── Get a signed URL ───────────────────────────────────────────────────────
  const { data: signedData, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_SECS)

  if (signErr) throw new Error(signErr.message || 'Could not get signed URL')

  const name = displayName || file.name.replace(/\.[^.]+$/, '')

  // ── Insert asset row ───────────────────────────────────────────────────────
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

  return asset
}

// ─────────────────────────────────────────────────────────────────────────────
// list
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all assets for a user, newest first.
 * Optionally filters by name using ilike.
 */
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
  // Remove from storage first
  const { error: storageErr } = await supabase.storage
    .from(BUCKET)
    .remove([asset.file_path])

  // Non-fatal if the file is already gone
  if (storageErr) console.warn('[deleteAsset] storage remove:', storageErr.message)

  const { error } = await supabase
    .from('assets')
    .delete()
    .eq('id', asset.id)

  if (error) throw new Error(error.message || 'Delete failed')
}

// ─────────────────────────────────────────────────────────────────────────────
// refreshSignedUrl
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get a fresh signed URL for a file_path.
 * Useful when an asset's URL has expired.
 */
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
