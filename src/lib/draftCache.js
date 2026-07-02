// src/lib/draftCache.js
//
// Lightweight IndexedDB key-value store for Create-page drafts (images,
// video files, prompts). Replaces the old sessionStorage+base64 approach,
// which had to be disabled in CreateImagePage/CreateVideoPage due to quota
// exhaustion. No external dependency — vanilla IndexedDB, promisified.

const DB_NAME = 'meckury_drafts'
const STORE = 'kv'
const DB_VERSION = 1

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB unavailable')); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

/** Raw get — returns whatever was stored (any structured-clonable value), or null. */
export async function draftGet(key) {
  try {
    const db = await openDB()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => reject(req.error)
    })
  } catch {
    return null
  }
}

/** Raw set — stores any structured-clonable value (including File/Blob). */
export async function draftSet(key, value) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  }
}

/** Raw delete. */
export async function draftDelete(key) {
  try {
    const db = await openDB()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    return true
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Image-array helpers — direct replacement for the persistImages/restoreImage
// pattern duplicated across CreateImagePage, CreateVideoPage, UGCGeneratePage,
// UGCBrandGeneratePage, CinematicTransitionPage.
//
// Draft shape in the store: array of { file: File } | { url: string } | null,
// each with ar/w/h. File objects are stored directly — no base64.
// ─────────────────────────────────────────────────────────────────────────

export async function saveDraftImages(key, images) {
  const serializable = (images || []).map((img) => {
    if (!img) return null
    if (img.file) return { file: img.file, ar: img.ar ?? null, w: img.w ?? null, h: img.h ?? null }
    return { url: img.url, ar: img.ar ?? null, w: img.w ?? null, h: img.h ?? null }
  })
  return draftSet(key, serializable)
}

export async function loadDraftImages(key) {
  const saved = await draftGet(key)
  if (!Array.isArray(saved)) return []
  return saved.filter(Boolean).map((item) => {
    if (item.file) {
      return { file: item.file, url: URL.createObjectURL(item.file), ar: item.ar, w: item.w, h: item.h }
    }
    return { file: null, url: item.url, ar: item.ar, w: item.w, h: item.h }
  })
}

// ─────────────────────────────────────────────────────────────────────────
// Single-file helpers — for video/audio drafts (CreateVideoPage's start/end
// frame, CreateTalkingHeadPage's subject video, etc).
// ─────────────────────────────────────────────────────────────────────────

export async function saveDraftFile(key, fileOrRef) {
  if (!fileOrRef) return draftDelete(key)
  if (fileOrRef.file) return draftSet(key, { file: fileOrRef.file, name: fileOrRef.name ?? fileOrRef.file.name })
  if (fileOrRef.url) return draftSet(key, { url: fileOrRef.url, name: fileOrRef.name ?? null })
  return draftDelete(key)
}

export async function loadDraftFile(key) {
  const saved = await draftGet(key)
  if (!saved) return null
  if (saved.file) return { file: saved.file, url: URL.createObjectURL(saved.file), name: saved.name }
  if (saved.url) return { file: null, url: saved.url, name: saved.name }
  return null
}

/** Small plain-JSON drafts (prompt text, small metadata) — same API shape, still IndexedDB, no quota worry. */
export async function saveDraftJSON(key, value) {
  if (value === null || value === undefined || value === '') return draftDelete(key)
  return draftSet(key, value)
}

export async function loadDraftJSON(key) {
  return draftGet(key)
}
