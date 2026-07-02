// src/lib/ugcMentions.js
// Data fetching + trigger-detection helpers shared by CreateImagePage and
// CreateVideoPage's "@" (uploaded references) and "/" (saved UGC
// characters/brands) mention pickers.

import { ugcProfiles } from '@/lib/ugc'
import { ugcBrandProfiles, ugcBrandProducts } from '@/lib/ugcBrands'

/** Fetch everything the "/" picker's root list needs in one round trip pair. */
export async function fetchMentionLibrary(userId) {
  const [{ data: characters }, { data: brands }] = await Promise.all([
    ugcProfiles.getAll(userId),
    ugcBrandProfiles.getAll(userId),
  ])

  const activeCharacters = (characters || []).filter((c) => c.status === 'active' && c.photo_face_front)
  const activeBrands     = (brands || []).filter((b) => b.status === 'active')

  return { characters: activeCharacters, brands: activeBrands }
}

/** Fetch a single brand's image-bearing products for the drill-down list.
 *  Services have no image_url and are excluded — nothing to fetch for them. */
export async function fetchBrandProducts(brandId) {
  const { data } = await ugcBrandProducts.getAll(brandId)
  return (data || []).filter((p) => !!p.image_url)
}

/**
 * Detects a live "@query" or "/query" being typed immediately before the
 * cursor. Returns null if no active trigger, otherwise the trigger char,
 * the query typed so far, and the string index where the trigger character
 * itself starts (so callers can splice it back out on insert).
 */
export function getMentionMatch(text, cursorPos) {
  const upto = text.slice(0, cursorPos)
  const m = /(^|\s)([@/])([a-zA-Z0-9 _-]{0,40})$/.exec(upto)
  if (!m) return null
  return { trigger: m[2], query: m[3].trim().toLowerCase(), start: m.index + m[1].length }
}
