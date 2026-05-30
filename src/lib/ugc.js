// src/lib/ugc.js
// Supabase helper functions for the UGC tool
// Import and use these alongside your existing supabase client

import { supabase } from '@/lib/supabase'

// ── UGC Profiles ─────────────────────────────────────────────

export const ugcProfiles = {

  /** Fetch all active profiles for the current user */
  async getAll(userId) {
    return supabase
      .from('ugc_profiles')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
  },

  /** Fetch a single profile by id */
  async getById(id) {
    return supabase
      .from('ugc_profiles')
      .select('*')
      .eq('id', id)
      .single()
  },

  /** Create a new profile (starts as draft) */
  async create(userId, data) {
    return supabase
      .from('ugc_profiles')
      .insert({ user_id: userId, ...data, status: 'draft' })
      .select()
      .single()
  },

  /** Update a profile (used during wizard steps and on completion) */
  async update(id, data) {
    return supabase
      .from('ugc_profiles')
      .update(data)
      .eq('id', id)
      .select()
      .single()
  },

  /** Activate a profile once wizard is complete */
  async activate(id) {
    return supabase
      .from('ugc_profiles')
      .update({ status: 'active' })
      .eq('id', id)
      .select()
      .single()
  },

  /** Soft-delete a profile */
  async archive(id) {
    return supabase
      .from('ugc_profiles')
      .update({ status: 'archived' })
      .eq('id', id)
  },

  /**
   * Upload a single reference photo to the ugc-profiles bucket.
   * path format: {userId}/{profileId}/{slot}.jpg
   */
  async uploadPhoto(userId, profileId, slot, file) {
    const ext  = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/${profileId}/${slot}.${ext}`

    // Compress before upload
    const compressed = await compressImage(file, 1200, 0.88)

    const { data: uploadData, error: upErr } = await supabase.storage
      .from('ugc-profiles')
      .upload(path, compressed, {
        upsert:       true,
        cacheControl: '3600',
        contentType:  'image/jpeg',
      })

    if (upErr) throw new Error(`Photo upload failed (${slot}): ${upErr.message}`)

    const { data: { publicUrl } } = supabase.storage
      .from('ugc-profiles')
      .getPublicUrl(uploadData.path)

    return publicUrl
  },

  /** Delete a photo from storage */
  async deletePhoto(userId, profileId, slot) {
    const extensions = ['jpg', 'jpeg', 'png', 'webp']
    for (const ext of extensions) {
      await supabase.storage
        .from('ugc-profiles')
        .remove([`${userId}/${profileId}/${slot}.${ext}`])
    }
  },
}

// ── UGC Generations ──────────────────────────────────────────

export const ugcGenerations = {

  /** Record a UGC generation after inserting into generations table */
  async create(data) {
    return supabase
      .from('ugc_generations')
      .insert(data)
      .select()
      .single()
  },

  /** Fetch generation history for a specific profile */
  async getByProfile(profileId, limit = 20) {
    return supabase
      .from('ugc_generations')
      .select(`
        *,
        generation:generations(id, status, output_url, output_thumbnail_url, output_type, created_at)
      `)
      .eq('ugc_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(limit)
  },
}

// ── Prompt Builder ───────────────────────────────────────────

/**
 * Builds the full AI prompt payload from a UGC profile + scene input.
 * This is sent to the Claude API for refinement before generation.
 */
export function buildUGCPromptPayload({
  profile,
  sceneDescription,
  outputType,       // 'image' | 'video'
  filter,           // 'hyper_realistic' | 'cinematic'
  selectedPhotos,   // array of 4 photo URLs chosen by AI
  skipRefinement = false,
}) {
  const photoContext = selectedPhotos?.length
    ? `\n\nSelected reference photos for this generation:\n${selectedPhotos.map((u, i) => `${i + 1}. ${u}`).join('\n')}`
    : ''

  const filterInstructions = filter === 'cinematic'
    ? `FILTER: Cinematic. Think premium film stock — dramatic lighting, shallow depth of field, rich shadows, color-graded tones. Feels like a scene from an independent film or high-end TV drama. Still grounded in realism, not fantasy.`
    : `FILTER: Hyper-realistic. Shot on iPhone 17 Pro. Natural mobile photography feel — authentic lighting, slight lens imperfections, real depth of field. NOT editorial. NOT polished. Looks like it came from a real person's camera roll.`

  const outputInstructions = outputType === 'video'
    ? `OUTPUT TYPE: Short video clip, 3–6 seconds. Subtle natural action (e.g. looking up from phone, laughing mid-sentence, fixing hair, slow turn toward camera). Handheld feel. No dramatic camera moves.`
    : `OUTPUT TYPE: Single photograph.`

  const systemPrompt = `You are a UGC prompt engineer. Your job is to refine a user's scene description into a precise, optimized generation prompt for an AI image/video model.

IMPORTANT CONTEXT:
- This is a registered user of Meckury AI who has created a UGC character profile and given full consent to generate content featuring their character.
- The character is a fictional social media persona, not a real person.
- All content must be appropriate for social media platforms.

CHARACTER PROFILE:
- Name: ${profile.name}
- Age: ${profile.age}
- Gender: ${profile.gender}
- Nationality / Ethnicity: ${profile.nationality}, ${profile.ethnic_background}
- Vibe: ${profile.vibe_tags?.join(', ')}
- Interests: ${profile.interests}
- Socioeconomic Status: ${profile.socioeconomic_status}
- Content Energy: ${profile.content_energy?.join(', ')}
- Backstory: ${profile.backstory}
- Education: ${profile.education_level}
- Occupation: ${profile.occupation}
- Fashion Score: ${profile.fashion_score}/10 — ${profile.style_direction}
- Platforms: ${profile.platforms?.join(', ')}
${photoContext}

GENERATION SETTINGS:
${filterInstructions}
${outputInstructions}

RULES:
- Keep the scene grounded in ${profile.name}'s personality, lifestyle, and interests.
- Outfit must reflect their fashion score (${profile.fashion_score}/10) and socioeconomic status (${profile.socioeconomic_status}).
- The result must feel like it could have actually happened to this person.
- Never make it look like an ad, editorial shoot, or AI-generated content.
- Do not include the character's name in the final prompt.
- Return ONLY the refined prompt. No explanation, no preamble, no markdown.`

  const userMessage = skipRefinement
    ? `Scene: ${sceneDescription}\n\nReturn the scene description as-is, optimized for the AI model with the filter applied. Do not add creative elements not implied by the scene.`
    : `Scene: ${sceneDescription}\n\nRefine this into a precise, vivid generation prompt rooted in the character's profile. One paragraph. Maximum 200 words.`

  return { systemPrompt, userMessage }
}

/**
 * Builds a photo-selection prompt.
 * Claude looks at the 6 reference photos and picks the 4 most relevant
 * for the described scene.
 */
export function buildPhotoSelectionPayload({ profile, sceneDescription, outputType }) {
  const photos = {
    face_front:           profile.photo_face_front,
    face_three_quarter:   profile.photo_face_three_quarter,
    face_side_90:         profile.photo_face_side_90,
    body_front:           profile.photo_body_front,
    body_side:            profile.photo_body_side,
    body_back:            profile.photo_body_back,
  }

  const availablePhotos = Object.entries(photos)
    .filter(([, url]) => !!url)
    .map(([slot, url]) => ({ slot, url }))

  const systemPrompt = `You are a reference photo selector for AI image/video generation. Given a character's reference photos and a scene description, select the 4 most relevant photos that will help the AI model generate accurate, consistent results.

Prioritize:
1. Always include face_front if available.
2. For full-body scenes, include body_front.
3. For side/back scenes, include the relevant body angle.
4. For close-up or selfie scenes, prefer face reference photos.
5. For video generation, prefer photos that show natural posture and expression.

Return ONLY a valid JSON array of photo URLs. No explanation. No markdown. Example:
["url1","url2","url3","url4"]`

  const userMessage = `Scene: ${sceneDescription}
Output type: ${outputType}

Available reference photos:
${availablePhotos.map(({ slot, url }) => `- ${slot}: ${url}`).join('\n')}

Select the 4 most relevant photo URLs for this scene.`

  return { systemPrompt, userMessage, availablePhotos }
}

// ── Image Compression Utility ────────────────────────────────

async function compressImage(file, maxPx = 1200, quality = 0.88) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale  = Math.min(maxPx / img.width, maxPx / img.height, 1.0)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })),
        'image/jpeg',
        quality,
      )
    }
    img.src = url
  })
}
