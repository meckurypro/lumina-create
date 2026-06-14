// src/lib/filma.js
//
// Supabase helpers for Filma — Africa's first AI filmmaking machine.
// Storage bucket: 'filma-uploads' (private, signed URLs)
// Tables: filma_films, filma_actors, filma_parts, filma_scenes,
//         filma_scene_actors, filma_scene_environments, filma_shots,
//         filma_shot_refs, filma_dropdown_customs

import { supabase } from '@/lib/supabase'

const BUCKET      = 'filma-uploads'
const SIGNED_SECS = 60 * 60 * 24 * 7  // 7-day signed URLs

// ─────────────────────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload any file to filma-uploads/{userId}/{subfolder}/{uuid}.{ext}
 * Returns a 7-day signed URL.
 */
export async function filmaUpload(userId, file, subfolder = 'misc') {
  const ext      = file.name.split('.').pop().toLowerCase()
  const filePath = `${userId}/${subfolder}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert:       false,
      contentType:  file.type,
    })
  if (upErr) throw new Error(upErr.message || 'Upload failed')

  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_SECS)
  if (signErr) throw new Error(signErr.message || 'Could not sign URL')

  return { url: data.signedUrl, path: filePath }
}

/**
 * Upload from a Blob (e.g. extracted end frame from canvas)
 */
export async function filmaUploadBlob(userId, blob, filename, subfolder = 'frames') {
  const file = new File([blob], filename, { type: blob.type })
  return filmaUpload(userId, file, subfolder)
}

/**
 * Delete a file from storage by path
 */
export async function filmaDeleteFile(filePath) {
  const { error } = await supabase.storage.from(BUCKET).remove([filePath])
  if (error) console.warn('[filmaDeleteFile]', error.message)
}

/**
 * Refresh a signed URL for an existing file path
 */
export async function filmaRefreshUrl(filePath) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_SECS)
  if (error) throw new Error(error.message || 'Could not refresh URL')
  return data.signedUrl
}


// ─────────────────────────────────────────────────────────────────────────────
// FILMS
// ─────────────────────────────────────────────────────────────────────────────

export const filmaFilms = {

  /** Get all films for a user, ordered by most recent */
  async getAll(userId) {
    const { data, error } = await supabase
      .from('filma_films')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    return { data, error }
  },

  /** Get a single film by id */
  async getById(filmId) {
    const { data, error } = await supabase
      .from('filma_films')
      .select('*')
      .eq('id', filmId)
      .single()
    return { data, error }
  },

  /** Create a new film project */
  async create(userId, payload) {
    const { data, error } = await supabase
      .from('filma_films')
      .insert({ user_id: userId, ...payload })
      .select()
      .single()
    return { data, error }
  },

  /** Update film fields */
  async update(filmId, payload) {
    const { data, error } = await supabase
      .from('filma_films')
      .update(payload)
      .eq('id', filmId)
      .select()
      .single()
    return { data, error }
  },

  /** Delete a film and all related records (cascade) */
  async delete(filmId) {
    const { error } = await supabase
      .from('filma_films')
      .delete()
      .eq('id', filmId)
    return { error }
  },

  /** Update film status */
  async setStatus(filmId, status) {
    return filmaFilms.update(filmId, { status })
  },

  /** Upload thumbnail and save URL to film */
  async uploadThumbnail(userId, filmId, file) {
    const { url } = await filmaUpload(userId, file, 'thumbnails')
    const { data, error } = await filmaFilms.update(filmId, { thumbnail_url: url })
    if (error) throw new Error(error.message)
    return url
  },

  /** Save the story summary and reset scaffolded flag */
  async saveStorySummary(filmId, storySummary) {
    const { data, error } = await supabase
      .from('filma_films')
      .update({ story_summary: storySummary, scaffolded: false })
      .eq('id', filmId)
      .select()
      .single()
    return { data, error }
  },

  /** Mark film as scaffolded (called after filma-scaffold-film edge fn succeeds) */
  async markScaffolded(filmId) {
    const { error } = await supabase
      .from('filma_films')
      .update({ scaffolded: true })
      .eq('id', filmId)
    return { error }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// ACTORS
// ─────────────────────────────────────────────────────────────────────────────

export const filmaActors = {

  /** Get all actors for a film */
  async getByFilm(filmId) {
    const { data, error } = await supabase
      .from('filma_actors')
      .select('*')
      .eq('film_id', filmId)
      .order('sort_order', { ascending: true })
    return { data, error }
  },

  /** Create a new actor record */
  async create(userId, filmId, payload) {
    const { data, error } = await supabase
      .from('filma_actors')
      .insert({ user_id: userId, film_id: filmId, ...payload })
      .select()
      .single()
    return { data, error }
  },

  /**
   * Import from UGC profile — copies key fields into filma_actors.
   */
  async importFromUGC(userId, filmId, ugcProfile, characterName, roleDescription) {
    const payload = {
      name:               characterName || ugcProfile.name,
      role_description:   roleDescription,
      gender:             ugcProfile.gender || null,
      nationality:        ugcProfile.nationality || null,
      ethnic_background:  ugcProfile.ethnic_background || null,
      ugc_profile_id:     ugcProfile.id,
      face_reference_url: ugcProfile.photo_face_front || null,
      body_reference_url: ugcProfile.photo_body_front || null,
      thumbnail_url:      ugcProfile.thumbnail_url || null,
    }
    return filmaActors.create(userId, filmId, payload)
  },

  /** Update an actor */
  async update(actorId, payload) {
    const { data, error } = await supabase
      .from('filma_actors')
      .update(payload)
      .eq('id', actorId)
      .select()
      .single()
    return { data, error }
  },

  /** Delete an actor */
  async delete(actorId) {
    const { error } = await supabase
      .from('filma_actors')
      .delete()
      .eq('id', actorId)
    return { error }
  },

  /** Reorder actors */
  async reorder(actorId, sortOrder) {
    const { error } = await supabase
      .from('filma_actors')
      .update({ sort_order: sortOrder })
      .eq('id', actorId)
    return { error }
  },

  /** Upload actor face/body reference image */
  async uploadReference(userId, file, type = 'face') {
    return filmaUpload(userId, file, `actors/${type}`)
  },

  /**
   * Returns true if the actor has all 3 required face photos.
   * Mirrors the DB trigger logic on the frontend for instant feedback.
   * Use actor data already in state — no extra DB call needed.
   */
  isComplete(actor) {
    return !!(
      actor?.photo_face_front &&
      actor?.photo_face_three_quarter &&
      actor?.photo_face_side_90
    )
  },

  /**
   * Get all actors for a film with their completeness status.
   * is_complete is maintained by a DB trigger — no client-side computation needed.
   */
  async getByFilmWithStatus(filmId) {
    const { data, error } = await supabase
      .from('filma_actors')
      .select('*')
      .eq('film_id', filmId)
      .order('sort_order', { ascending: true })
    return { data, error }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// PARTS (episodes / parts / chapters)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaParts = {

  /** Get all parts for a film, ordered by season + part number */
  async getByFilm(filmId) {
    const { data, error } = await supabase
      .from('filma_parts')
      .select('*')
      .eq('film_id', filmId)
      .order('season_number', { ascending: true })
      .order('part_number',   { ascending: true })
    return { data, error }
  },

  /** Create a part */
  async create(filmId, payload) {
    const { data, error } = await supabase
      .from('filma_parts')
      .insert({ film_id: filmId, ...payload })
      .select()
      .single()
    return { data, error }
  },

  /** Bulk create parts (e.g. when user sets "3 episodes") */
  async bulkCreate(filmId, parts) {
    const rows = parts.map((p) => ({ film_id: filmId, ...p }))
    const { data, error } = await supabase
      .from('filma_parts')
      .insert(rows)
      .select()
    return { data, error }
  },

  /** Update a part (rename, change scene count) */
  async update(partId, payload) {
    const { data, error } = await supabase
      .from('filma_parts')
      .update(payload)
      .eq('id', partId)
      .select()
      .single()
    return { data, error }
  },

  /** Delete a part */
  async delete(partId) {
    const { error } = await supabase
      .from('filma_parts')
      .delete()
      .eq('id', partId)
    return { error }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SCENES
// ─────────────────────────────────────────────────────────────────────────────

export const filmaScenes = {

  /** Get all scenes for a part */
  async getByPart(partId) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .select('*')
      .eq('part_id', partId)
      .order('scene_number', { ascending: true })
    return { data, error }
  },

  /** Get all scenes for a film (with part info) */
  async getByFilm(filmId) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .select('*, filma_parts(label, part_number, season_number)')
      .eq('film_id', filmId)
      .order('scene_number', { ascending: true })
    return { data, error }
  },

  /** Get a single scene with scene_actors + shots count */
  async getById(sceneId) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .select(`
        *,
        filma_scene_actors (
          id, actor_id, outfit_image_url,
          filma_actors (id, name, thumbnail_url, face_reference_url, role_description)
        )
      `)
      .eq('id', sceneId)
      .single()
    return { data, error }
  },

  /** Create a single scene with a specific scene_number */
  async create(filmId, partId, sceneNumber) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .insert({ film_id: filmId, part_id: partId, scene_number: sceneNumber, title: null })
      .select()
      .single()
    return { data, error }
  },

  /** Create scenes for a part (bulk, based on total_scenes) */
  async bulkCreate(filmId, partId, totalScenes) {
    const rows = Array.from({ length: totalScenes }, (_, i) => ({
      film_id:      filmId,
      part_id:      partId,
      scene_number: i + 1,
      title:        null,
    }))
    const { data, error } = await supabase
      .from('filma_scenes')
      .insert(rows)
      .select()
    return { data, error }
  },

  /** Update scene fields */
  async update(sceneId, payload) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .update(payload)
      .eq('id', sceneId)
      .select()
      .single()
    return { data, error }
  },

  /** Hard delete a scene row */
  async delete(sceneId) {
    const { error } = await supabase
      .from('filma_scenes')
      .delete()
      .eq('id', sceneId)
    return { error }
  },

  /** Upload master image for scene */
  async uploadMasterImage(userId, file) {
    return filmaUpload(userId, file, 'scenes/master')
  },

  /** Save script text + reset scaffolded flag */
  async saveScript(sceneId, scriptText) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .update({ script_text: scriptText, scaffolded: false })
      .eq('id', sceneId)
      .select()
      .single()
    return { data, error }
  },

  /** Mark scene as scaffolded (called after edge fn inserts shots) */
  async markScaffolded(sceneId) {
    const { error } = await supabase
      .from('filma_scenes')
      .update({ scaffolded: true })
      .eq('id', sceneId)
    return { error }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SCENE ACTORS (junction: actors in a specific scene + wardrobe)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaSceneActors = {

  /** Get all scene-actor records for a scene */
  async getByScene(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .select(`
        *,
        filma_actors (id, name, thumbnail_url, face_reference_url, gender, role_description)
      `)
      .eq('scene_id', sceneId)
    return { data, error }
  },

  /** Add an actor to a scene */
  async add(filmId, sceneId, actorId) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .insert({ film_id: filmId, scene_id: sceneId, actor_id: actorId })
      .select()
      .single()
    return { data, error }
  },

  /** Remove an actor from a scene */
  async remove(sceneId, actorId) {
    const { error } = await supabase
      .from('filma_scene_actors')
      .delete()
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
    return { error }
  },

  /** Upload outfit image for an actor in a scene */
  async uploadOutfit(userId, file) {
    return filmaUpload(userId, file, 'scenes/outfits')
  },

  /** Save outfit image URL to scene_actor record */
  async setOutfit(sceneId, actorId, outfitImageUrl) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .update({ outfit_image_url: outfitImageUrl })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
    return { data, error }
  },

  /** Set AI-suggested or user-edited wardrobe prompt for an actor in a scene */
  async setWardrobePrompt(sceneId, actorId, promptText) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .update({ wardrobe_prompt: promptText, wardrobe_locked: false })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
    return { data, error }
  },

  /** Upload outfit image and save URL; resets wardrobe_locked to false */
  async uploadOutfitAndSave(userId, sceneId, actorId, file) {
    const { url } = await filmaUpload(userId, file, 'scenes/outfits')
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .update({ outfit_image_url: url, wardrobe_locked: false })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
    return { data, error, url }
  },

  /** Lock an actor's wardrobe for this scene (marks it ready) */
  async lockWardrobe(sceneId, actorId) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .update({ wardrobe_locked: true })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
    return { data, error }
  },

  /** Unlock an actor's wardrobe */
  async unlockWardrobe(sceneId, actorId) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .update({ wardrobe_locked: false })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
    return { data, error }
  },

  /**
   * Check whether all actors in a scene have their wardrobe locked.
   * Returns { ready: boolean, total: number, locked: number }
   */
  async checkWardrobeReady(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .select('actor_id, wardrobe_locked')
      .eq('scene_id', sceneId)
    if (error) return { ready: false, total: 0, locked: 0, error }
    const total  = (data || []).length
    const locked = (data || []).filter((sa) => sa.wardrobe_locked).length
    return { ready: total > 0 && locked === total, total, locked }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SCENE ENVIRONMENTS
// Each scene has a master (is_master=true) + up to 3 angle shots.
// ─────────────────────────────────────────────────────────────────────────────

export const filmaSceneEnvironments = {

  /** Get all environment shots for a scene, ordered by sort_order */
  async getByScene(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .select('*')
      .eq('scene_id', sceneId)
      .order('sort_order', { ascending: true })
    return { data, error }
  },

  /** Get the master environment shot for a scene */
  async getMaster(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .select('*')
      .eq('scene_id', sceneId)
      .eq('is_master', true)
      .single()
    return { data, error }
  },

  /** Create an environment slot (master or angle) */
  async create(filmId, sceneId, payload) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .insert({ film_id: filmId, scene_id: sceneId, ...payload })
      .select()
      .single()
    return { data, error }
  },

  /** Update fields — image_url, prompt_text, label, locked */
  async update(envId, payload) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', envId)
      .select()
      .single()
    return { data, error }
  },

  /** Lock an environment slot (marks it ready to use in generation) */
  async lock(envId) {
    return filmaSceneEnvironments.update(envId, { locked: true })
  },

  /** Unlock an environment slot */
  async unlock(envId) {
    return filmaSceneEnvironments.update(envId, { locked: false })
  },

  /** Delete an environment shot */
  async delete(envId) {
    const { error } = await supabase
      .from('filma_scene_environments')
      .delete()
      .eq('id', envId)
    return { error }
  },

  /**
   * Upload an image and save it to an environment slot.
   * If envId is provided, updates an existing row.
   * If envId is null, creates a new row.
   */
  async uploadAndSave(userId, filmId, sceneId, file, {
    label,
    isMaster = false,
    sortOrder = 0,
    envId = null,
  }) {
    const { url, path } = await filmaUpload(userId, file, 'scenes/environments')

    if (envId) {
      const { data, error } = await filmaSceneEnvironments.update(envId, {
        image_url: url,
        locked: false, // reset lock when image is replaced
      })
      return { data, error, url, path }
    }

    const { data, error } = await filmaSceneEnvironments.create(filmId, sceneId, {
      label,
      image_url: url,
      is_master: isMaster,
      sort_order: sortOrder,
      locked: false,
    })
    return { data, error, url, path }
  },

  /**
   * Set prompt text on an environment slot (AI-suggested or user-edited).
   * Does not set locked — user must explicitly lock after reviewing.
   */
  async setPrompt(envId, promptText) {
    return filmaSceneEnvironments.update(envId, { prompt_text: promptText })
  },

  /**
   * Check whether all environment slots for a scene are locked.
   * Used as a gate before wardrobe / shot scaffolding.
   * Returns { ready: boolean, total: number, locked: number }
   */
  async checkReady(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .select('id, locked')
      .eq('scene_id', sceneId)
    if (error) return { ready: false, total: 0, locked: 0, error }
    const total  = (data || []).length
    const locked = (data || []).filter((e) => e.locked).length
    return { ready: total > 0 && locked === total, total, locked }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SHOTS
// ─────────────────────────────────────────────────────────────────────────────

export const filmaShots = {

  /** Get all shots for a scene, ordered by shot_number */
  async getByScene(sceneId) {
    const { data, error } = await supabase
      .from('filma_shots')
      .select(`
        *,
        filma_shot_refs (id, image_url, description, sort_order),
        filma_actors!filma_shots_speaking_actor_id_fkey (id, name, thumbnail_url)
      `)
      .eq('scene_id', sceneId)
      .order('shot_number', { ascending: true })
    return { data, error }
  },

  /** Get a single shot with all refs */
  async getById(shotId) {
    const { data, error } = await supabase
      .from('filma_shots')
      .select(`
        *,
        filma_shot_refs (id, image_url, description, sort_order),
        filma_actors!filma_shots_speaking_actor_id_fkey (id, name, thumbnail_url, face_reference_url)
      `)
      .eq('id', shotId)
      .single()
    return { data, error }
  },

  /** Update shot fields */
  async update(shotId, payload) {
    const { data, error } = await supabase
      .from('filma_shots')
      .update(payload)
      .eq('id', shotId)
      .select()
      .single()
    return { data, error }
  },

  /** Set shot status */
  async setStatus(shotId, status) {
    return filmaShots.update(shotId, { status })
  },

  /** Upload start frame */
  async uploadStartFrame(userId, file) {
    return filmaUpload(userId, file, 'shots/frames')
  },

  /** Upload end frame */
  async uploadEndFrame(userId, file) {
    return filmaUpload(userId, file, 'shots/frames')
  },

  /**
   * Upload audio for a dialogue shot.
   * max 15s validated client-side before calling this.
   */
  async uploadAudio(userId, file) {
    return filmaUpload(userId, file, 'shots/audio')
  },

  /**
   * Save audio metadata to shot.
   * Call after uploading audio.
   */
  async setAudio(shotId, { audioUrl, firstWord, lastWord, durationSeconds }) {
    return filmaShots.update(shotId, {
      audio_mode:             'uploaded',
      audio_url:              audioUrl,
      audio_first_word:       firstWord,
      audio_last_word:        lastWord,
      audio_duration_seconds: durationSeconds,
      duration_seconds:       durationSeconds,
    })
  },

  /** Clear audio — revert to AI voice */
  async clearAudio(shotId) {
    return filmaShots.update(shotId, {
      audio_mode:             'ai_voice',
      audio_url:              null,
      audio_first_word:       null,
      audio_last_word:        null,
      audio_duration_seconds: null,
      duration_seconds:       null,
    })
  },

  /** Set start frame */
  async setStartFrame(shotId, url) {
    return filmaShots.update(shotId, { start_frame_url: url })
  },

  /** Set end frame */
  async setEndFrame(shotId, url) {
    return filmaShots.update(shotId, { end_frame_url: url })
  },

  /**
   * Push end frame from shot N to shot N+1.
   * extractedFrameBlob: Blob from canvas extraction.
   * Returns the next shot id.
   */
  async pushEndFrame(userId, currentShotId, extractedFrameBlob) {
    const { url } = await filmaUploadBlob(
      userId,
      extractedFrameBlob,
      `endframe_${currentShotId}.png`,
      'shots/frames'
    )

    const { data: fnData, error: fnErr } = await supabase
      .rpc('filma_push_end_frame', { p_shot_id: currentShotId })
    if (fnErr) throw new Error(fnErr.message)
    if (!fnData.success) throw new Error(fnData.error)

    await filmaShots.setStartFrame(fnData.next_shot_id, url)
    await filmaShots.setStatus(currentShotId, 'completed')

    return { nextShotId: fnData.next_shot_id, frameUrl: url }
  },

  /** Save generation output to shot */
  async setOutput(shotId, { generationId, outputUrl, thumbnailUrl }) {
    return filmaShots.update(shotId, {
      generation_id:        generationId,
      output_url:           outputUrl,
      output_thumbnail_url: thumbnailUrl,
      status:               'completed',
    })
  },

  /** Delete a shot */
  async delete(shotId) {
    const { error } = await supabase
      .from('filma_shots')
      .delete()
      .eq('id', shotId)
    return { error }
  },

  /**
   * One-shot sync: checks the linked generation row and updates filma_shots
   * if it has resolved. Call on load when shot status is 'generating' or
   * 'processing' to pick up results from while the user was away.
   * Returns the latest shot state (updated or original).
   */
  async syncFromGeneration(shotId) {
    const { data: shot } = await supabase
      .from('filma_shots')
      .select('id, status, generation_id, output_url')
      .eq('id', shotId)
      .single()

    if (!shot?.generation_id) return shot

    // Already resolved — nothing to do
    if (shot.status === 'completed' || shot.status === 'failed') return shot

    // Drive video-poll-single to resolve the WaveSpeed result
    await supabase.functions.invoke('video-poll-single', {
      body: { generationId: shot.generation_id },
    }).catch(() => {})

    // Re-fetch the generation to see if it resolved
    const { data: gen } = await supabase
      .from('generations')
      .select('status, output_url, output_thumbnail_url, error_message')
      .eq('id', shot.generation_id)
      .single()

    if (!gen) return shot

    if (gen.status === 'completed' && gen.output_url) {
      const { data: updated } = await supabase
        .from('filma_shots')
        .update({
          status:               'completed',
          output_url:           gen.output_url,
          output_thumbnail_url: gen.output_thumbnail_url || gen.output_url,
        })
        .eq('id', shotId)
        .select()
        .single()
      return updated || shot
    }

    if (gen.status === 'failed') {
      await supabase
        .from('filma_shots')
        .update({ status: 'failed' })
        .eq('id', shotId)
      return { ...shot, status: 'failed' }
    }

    return shot
  },

  /**
   * Poll a shot's status until completed/failed or timeout.
   * Each tick drives video-poll-single (which resolves WaveSpeed and writes
   * to generations), then syncs the result back to filma_shots.
   *
   * Returns a stop function — call it to cancel polling (e.g. on unmount).
   * onUpdate(shotData) — called each tick with the latest shot state.
   * onDone({ success, data, error }) — called when polling ends.
   */
  poll(shotId, { onUpdate, onDone, intervalMs = 5000, timeoutMs = 600000 }) {
    let stopped = false

    const interval = setInterval(async () => {
      if (stopped) return

      try {
        // ── Fetch current shot state ───────────────────────────────────────
        const { data: shot, error } = await supabase
          .from('filma_shots')
          .select('id, status, generation_id, output_url, output_thumbnail_url')
          .eq('id', shotId)
          .single()

        if (stopped || error || !shot) return

        onUpdate?.(shot)

        // ── Already resolved directly ──────────────────────────────────────
        if (shot.status === 'completed' && shot.output_url) {
          stop()
          onDone?.({ success: true, data: shot })
          return
        }

        if (shot.status === 'failed') {
          stop()
          onDone?.({ success: false, error: 'Generation failed' })
          return
        }

        // ── Drive video-poll-single to resolve WaveSpeed ───────────────────
        if (shot.generation_id) {
          try {
            await supabase.functions.invoke('video-poll-single', {
              body: { generationId: shot.generation_id },
            })
          } catch (invokeErr) {
            console.warn('[filmaShots.poll] invoke error:', invokeErr)
            return
          }

          if (stopped) return

          // ── Re-fetch generation to check resolved state ──────────────────
          const { data: gen } = await supabase
            .from('generations')
            .select('status, output_url, output_thumbnail_url, error_message')
            .eq('id', shot.generation_id)
            .single()

          if (stopped || !gen) return

          if (gen.status === 'completed' && gen.output_url) {
            // Sync output back to filma_shots
            await supabase
              .from('filma_shots')
              .update({
                status:               'completed',
                output_url:           gen.output_url,
                output_thumbnail_url: gen.output_thumbnail_url || gen.output_url,
              })
              .eq('id', shotId)

            const resolvedShot = {
              ...shot,
              status:               'completed',
              output_url:           gen.output_url,
              output_thumbnail_url: gen.output_thumbnail_url || gen.output_url,
            }

            onUpdate?.(resolvedShot)
            stop()
            onDone?.({ success: true, data: resolvedShot })
            return
          }

          if (gen.status === 'failed') {
            await supabase
              .from('filma_shots')
              .update({ status: 'failed' })
              .eq('id', shotId)

            stop()
            onDone?.({ success: false, error: gen.error_message || 'Generation failed' })
            return
          }

          // Still processing — call onUpdate with latest shot state
          onUpdate?.(shot)
        }

      } catch (err) {
        if (!stopped) console.warn('[filmaShots.poll]', err)
      }
    }, intervalMs)

    const timeout = setTimeout(() => {
      if (!stopped) {
        stop()
        onDone?.({ success: false, error: 'Generation timed out' })
      }
    }, timeoutMs)

    function stop() {
      stopped = true
      clearInterval(interval)
      clearTimeout(timeout)
    }

    return stop
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SHOT REFS (extra reference images per shot)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaShotRefs = {

  /** Get all refs for a shot */
  async getByShot(shotId) {
    const { data, error } = await supabase
      .from('filma_shot_refs')
      .select('*')
      .eq('shot_id', shotId)
      .order('sort_order', { ascending: true })
    return { data, error }
  },

  /** Add a reference image to a shot */
  async add(filmId, sceneId, shotId, imageUrl, description, sortOrder = 0) {
    const { data, error } = await supabase
      .from('filma_shot_refs')
      .insert({
        film_id:     filmId,
        scene_id:    sceneId,
        shot_id:     shotId,
        image_url:   imageUrl,
        description,
        sort_order:  sortOrder,
      })
      .select()
      .single()
    return { data, error }
  },

  /** Update description */
  async updateDescription(refId, description) {
    const { data, error } = await supabase
      .from('filma_shot_refs')
      .update({ description })
      .eq('id', refId)
      .select()
      .single()
    return { data, error }
  },

  /** Delete a ref */
  async delete(refId) {
    const { error } = await supabase
      .from('filma_shot_refs')
      .delete()
      .eq('id', refId)
    return { error }
  },

  /** Upload reference image */
  async upload(userId, file) {
    return filmaUpload(userId, file, 'shots/refs')
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN CUSTOMS (research log for "Other" entries)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaDropdownCustoms = {

  /** Log a custom "Other" entry */
  async log(userId, fieldName, value, filmId = null) {
    const { error } = await supabase
      .from('filma_dropdown_customs')
      .insert({ user_id: userId, field_name: fieldName, value, film_id: filmId })
    if (error) console.warn('[filmaDropdownCustoms.log]', error.message)
  },

  /** Admin: get all custom entries for a field */
  async getByField(fieldName) {
    const { data, error } = await supabase
      .from('filma_dropdown_customs')
      .select('*')
      .eq('field_name', fieldName)
      .order('created_at', { ascending: false })
    return { data, error }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SCAFFOLDING — trigger AI scene & film scaffolding via edge functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call the filma-scaffold edge function.
 * Sends scene context (script, cast, film details) to AI.
 * AI returns shot array; edge function calls filma_scaffold_scene RPC.
 */
export async function filmaScaffoldScene(sceneId) {
  const { data, error } = await supabase.functions.invoke('filma-scaffold', {
    body: { sceneId },
  })

  if (error) {
    // supabase-js wraps non-2xx edge function responses in a generic
    // FunctionsHttpError. The real error message from our function body
    // lives in error.context (a Response object) — try to extract it.
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || body?.message || error.message || 'Scaffold failed')
      } catch {
        // context wasn't valid JSON — fall through to generic message
      }
    }
    throw new Error(error.message || 'Scaffold failed')
  }

  if (!data?.success) throw new Error(data?.error || 'Scaffold returned no data')
  return data
}

/**
 * Call the filma-scaffold-film edge function.
 * Sends story summary + film details to Claude.
 * Claude returns parts/scenes/actors skeleton.
 * Edge function calls filma_scaffold_film RPC to persist.
 */
export async function filmaScaffoldFilm(filmId) {
  const { data, error } = await supabase.functions.invoke('filma-scaffold-film', {
    body: { filmId },
  })

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || body?.message || error.message || 'Scaffold failed')
      } catch {
        // context wasn't valid JSON — fall through
      }
    }
    throw new Error(error.message || 'Film scaffold failed')
  }

  if (!data?.success) throw new Error(data?.error || 'Scaffold returned no data')
  return data
}


// ─────────────────────────────────────────────────────────────────────────────
// GENERATE — trigger shot generation via edge function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call the filma-generate edge function for a single shot.
 * Edge function reads all context from DB, builds the director prompt,
 * submits to WaveSpeed (Kling O3 Pro), and creates a generations row.
 * Polling is handled by filmaShots.poll() which drives video-poll-single.
 */
export async function filmaGenerateShot(shotId) {
  const { data, error } = await supabase.functions.invoke('filma-generate', {
    body: { shotId },
  })
  if (error) throw new Error(error.message || 'Generation failed')
  if (!data?.success) throw new Error(data?.error || 'Generation failed')
  return data
}


// ─────────────────────────────────────────────────────────────────────────────
// ASSET GENERATION — scene environments & wardrobe (Filma-generated images)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call the filma-suggest-scene-prompts edge function.
 * Returns an array of environment slot suggestions:
 * [{ label, prompt_text, is_master, sort_order }, ...]
 * Master shot first, then angle shots.
 */
export async function filmaSuggestScenePrompts(sceneId) {
  const { data, error } = await supabase.functions.invoke('filma-suggest-scene-prompts', {
    body: { sceneId },
  })

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || body?.message || error.message || 'Suggest failed')
      } catch {
        // fall through
      }
    }
    throw new Error(error.message || 'Scene prompt suggestion failed')
  }

  if (!data?.success) throw new Error(data?.error || 'No suggestions returned')
  return data // { success, prompts: [...] }
}

/**
 * Call the filma-suggest-wardrobe-prompt edge function.
 * Returns a wardrobe prompt string for one actor in a scene.
 * {
 *   success: true,
 *   prompt: "Full detailed wardrobe description...",
 *   key_identifiers: [...],
 *   continuity_flags: [...]
 * }
 */
export async function filmaSuggestWardrobePrompt(sceneId, actorId) {
  const { data, error } = await supabase.functions.invoke('filma-suggest-wardrobe-prompt', {
    body: { sceneId, actorId },
  })

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || body?.message || error.message || 'Suggest failed')
      } catch {
        // fall through
      }
    }
    throw new Error(error.message || 'Wardrobe prompt suggestion failed')
  }

  if (!data?.success) throw new Error(data?.error || 'No wardrobe prompt returned')
  return data
}

/**
 * Call the filma-generate-asset edge function.
 * Filma generates an image (scene environment or wardrobe outfit) using
 * the actor's face refs as the model, and uploads it to the relevant slot.
 *
 * assetType: 'scene_environment' | 'wardrobe'
 * targetId:  envId for scene_environment, scene_actor composite key for wardrobe
 *
 * Returns { success, imageUrl, creditsCharged }
 */
export async function filmaGenerateAsset({ assetType, sceneId, actorId, envId, prompt }) {
  const { data, error } = await supabase.functions.invoke('filma-generate-asset', {
    body: { assetType, sceneId, actorId, envId, prompt },
  })

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || body?.message || error.message || 'Generation failed')
      } catch {
        // fall through
      }
    }
    throw new Error(error.message || 'Asset generation failed')
  }

  if (!data?.success) throw new Error(data?.error || 'Asset generation failed')
  return data
}


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get full film with parts, scenes (no shots — too heavy).
 * Used for the structure overview page.
 */
export async function filmaGetFilmStructure(filmId) {
  const [filmRes, partsRes, actorsRes] = await Promise.all([
    filmaFilms.getById(filmId),
    filmaParts.getByFilm(filmId),
    filmaActors.getByFilm(filmId),
  ])

  if (filmRes.error) throw new Error(filmRes.error.message)

  const parts = partsRes.data || []
  const partsWithScenes = await Promise.all(
    parts.map(async (part) => {
      const { data: scenes } = await filmaScenes.getByPart(part.id)
      return { ...part, scenes: scenes || [] }
    })
  )

  return {
    film:   filmRes.data,
    parts:  partsWithScenes,
    actors: actorsRes.data || [],
  }
}

/**
 * Get scene workspace data — scene + environments + actors + shots + shot refs.
 * Used for FilmaScenePage and FilmaShotPage.
 */
export async function filmaGetSceneWorkspace(sceneId) {
  const [sceneRes, shotsRes, envsRes] = await Promise.all([
    filmaScenes.getById(sceneId),
    filmaShots.getByScene(sceneId),
    filmaSceneEnvironments.getByScene(sceneId),
  ])

  if (sceneRes.error) throw new Error(sceneRes.error.message)

  return {
    scene:        sceneRes.data,
    shots:        shotsRes.data || [],
    environments: envsRes.data  || [],
  }
}


// ─────────────────────────────────────────────────────────────────────────────
// AUDIO DURATION HELPER (client-side)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get duration of an audio File in seconds.
 * Used to validate 1s–15s constraint before upload.
 */
export function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const url   = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration)
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read audio file'))
    }
    audio.src = url
  })
}
