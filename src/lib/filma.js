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

export async function filmaUploadBlob(userId, blob, filename, subfolder = 'frames') {
  const file = new File([blob], filename, { type: blob.type })
  return filmaUpload(userId, file, subfolder)
}

export async function filmaDeleteFile(filePath) {
  const { error } = await supabase.storage.from(BUCKET).remove([filePath])
  if (error) console.warn('[filmaDeleteFile]', error.message)
}

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

  async getAll(userId) {
    const { data, error } = await supabase
      .from('filma_films')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    return { data, error }
  },

  async getById(filmId) {
    const { data, error } = await supabase
      .from('filma_films')
      .select('*')
      .eq('id', filmId)
      .single()
    return { data, error }
  },

  async create(userId, payload) {
    const { data, error } = await supabase
      .from('filma_films')
      .insert({ user_id: userId, ...payload })
      .select()
      .single()
    return { data, error }
  },

  async update(filmId, payload) {
    const { data, error } = await supabase
      .from('filma_films')
      .update(payload)
      .eq('id', filmId)
      .select()
      .single()
    return { data, error }
  },

  async delete(filmId) {
    const { error } = await supabase
      .from('filma_films')
      .delete()
      .eq('id', filmId)
    return { error }
  },

  async setStatus(filmId, status) {
    return filmaFilms.update(filmId, { status })
  },

  async uploadThumbnail(userId, filmId, file) {
    const { url } = await filmaUpload(userId, file, 'thumbnails')
    const { data, error } = await filmaFilms.update(filmId, { thumbnail_url: url })
    if (error) throw new Error(error.message)
    return url
  },

  async saveStorySummary(filmId, storySummary) {
    const { data, error } = await supabase
      .from('filma_films')
      .update({ story_summary: storySummary, scaffolded: false })
      .eq('id', filmId)
      .select()
      .single()
    return { data, error }
  },

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

  async getByFilm(filmId) {
    const { data, error } = await supabase
      .from('filma_actors')
      .select('*')
      .eq('film_id', filmId)
      .order('sort_order', { ascending: true })
    return { data, error }
  },

  async create(userId, filmId, payload) {
    const { data, error } = await supabase
      .from('filma_actors')
      .insert({ user_id: userId, film_id: filmId, ...payload })
      .select()
      .single()
    return { data, error }
  },

  /**
   * Import from UGC profile — copies all face + body photos into filma_actors.
   * Face photos are the source of truth for identity.
   * Body photos are the source of truth for physique — never to be altered by AI.
   */
  async importFromUGC(userId, filmId, ugcProfile, characterName, roleDescription) {
    const payload = {
      name:                    characterName || ugcProfile.name,
      role_description:        roleDescription,
      gender:                  ugcProfile.gender             || null,
      nationality:             ugcProfile.nationality        || null,
      ethnic_background:       ugcProfile.ethnic_background  || null,
      ugc_profile_id:          ugcProfile.id,
      // Face references — identity source of truth
      face_reference_url:      ugcProfile.photo_face_front   || null,
      photo_face_front:        ugcProfile.photo_face_front   || null,
      photo_face_three_quarter: ugcProfile.photo_face_three_quarter || null,
      photo_face_side_90:      ugcProfile.photo_face_side_90 || null,
      // Body references — physique source of truth (do not alter)
      body_reference_url:      ugcProfile.photo_body_front   || null,
      photo_body_front:        ugcProfile.photo_body_front   || null,
      photo_body_side:         ugcProfile.photo_body_side    || null,
      photo_body_back:         ugcProfile.photo_body_back    || null,
      thumbnail_url:           ugcProfile.thumbnail_url      || null,
    }
    return filmaActors.create(userId, filmId, payload)
  },

  async update(actorId, payload) {
    const { data, error } = await supabase
      .from('filma_actors')
      .update(payload)
      .eq('id', actorId)
      .select()
      .single()
    return { data, error }
  },

  async delete(actorId) {
    const { error } = await supabase
      .from('filma_actors')
      .delete()
      .eq('id', actorId)
    return { error }
  },

  async reorder(actorId, sortOrder) {
    const { error } = await supabase
      .from('filma_actors')
      .update({ sort_order: sortOrder })
      .eq('id', actorId)
    return { error }
  },

  async uploadReference(userId, file, type = 'face') {
    return filmaUpload(userId, file, `actors/${type}`)
  },

  /**
   * Returns true if the actor has all 3 required face photos.
   * Face completeness is the gate for generation readiness.
   * Body photos are supplementary — encouraged but not blocking.
   */
  isComplete(actor) {
    return !!(
      actor?.photo_face_front &&
      actor?.photo_face_three_quarter &&
      actor?.photo_face_side_90
    )
  },

  /**
   * Returns true if the actor has at least a front body photo.
   * Used by the generation pipeline to decide whether to include body refs.
   */
  hasBodyReference(actor) {
    return !!(actor?.photo_body_front || actor?.body_reference_url)
  },

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

  async getByFilm(filmId) {
    const { data, error } = await supabase
      .from('filma_parts')
      .select('*')
      .eq('film_id', filmId)
      .order('season_number', { ascending: true })
      .order('part_number',   { ascending: true })
    return { data, error }
  },

  async create(filmId, payload) {
    const { data, error } = await supabase
      .from('filma_parts')
      .insert({ film_id: filmId, ...payload })
      .select()
      .single()
    return { data, error }
  },

  async bulkCreate(filmId, parts) {
    const rows = parts.map((p) => ({ film_id: filmId, ...p }))
    const { data, error } = await supabase
      .from('filma_parts')
      .insert(rows)
      .select()
    return { data, error }
  },

  async update(partId, payload) {
    const { data, error } = await supabase
      .from('filma_parts')
      .update(payload)
      .eq('id', partId)
      .select()
      .single()
    return { data, error }
  },

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

  async getByPart(partId) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .select('*')
      .eq('part_id', partId)
      .order('scene_number', { ascending: true })
    return { data, error }
  },

  async getByFilm(filmId) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .select('*, filma_parts(label, part_number, season_number)')
      .eq('film_id', filmId)
      .order('scene_number', { ascending: true })
    return { data, error }
  },

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

  async create(filmId, partId, sceneNumber) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .insert({ film_id: filmId, part_id: partId, scene_number: sceneNumber, title: null })
      .select()
      .single()
    return { data, error }
  },

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

  async update(sceneId, payload) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .update(payload)
      .eq('id', sceneId)
      .select()
      .single()
    return { data, error }
  },

  async delete(sceneId) {
    const { error } = await supabase
      .from('filma_scenes')
      .delete()
      .eq('id', sceneId)
    return { error }
  },

  async uploadMasterImage(userId, file) {
    return filmaUpload(userId, file, 'scenes/master')
  },

  async saveScript(sceneId, scriptText) {
    const { data, error } = await supabase
      .from('filma_scenes')
      .update({ script_text: scriptText, scaffolded: false })
      .eq('id', sceneId)
      .select()
      .single()
    return { data, error }
  },

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

  async getByScene(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .select(`
        *,
        filma_actors (id, name, thumbnail_url, face_reference_url, gender, role_description,
          photo_face_front, photo_face_three_quarter, photo_face_side_90,
          photo_body_front, photo_body_side, photo_body_back, body_reference_url)
      `)
      .eq('scene_id', sceneId)
    return { data, error }
  },

  async add(filmId, sceneId, actorId) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .insert({ film_id: filmId, scene_id: sceneId, actor_id: actorId })
      .select()
      .single()
    return { data, error }
  },

  async remove(sceneId, actorId) {
    const { error } = await supabase
      .from('filma_scene_actors')
      .delete()
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
    return { error }
  },

  async uploadOutfit(userId, file) {
    return filmaUpload(userId, file, 'scenes/outfits')
  },

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
//
// Each scene has a spatial map of angles:
//   is_master = true  → wide establishing shot (used as fallback)
//   direction         → compass direction the camera faces: master|N|S|E|W
//   camera_facing     → plain English: "Camera faces North wall, window on left"
//   spatial_notes     → layout of the space: "Door is E wall, sofa runs N-S"
//
// The generation pipeline uses direction + camera_facing + spatial_notes to:
//   1. Match the start frame to a known angle (via Claude vision)
//   2. Determine where characters are looking relative to camera
//   3. Pick the correct environment asset for the next shot's composition
// ─────────────────────────────────────────────────────────────────────────────

export const filmaSceneEnvironments = {

  /** Get all environment slots for a scene, ordered by sort_order */
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

  /** Get a specific directional slot by direction enum value */
  async getByDirection(sceneId, direction) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .select('*')
      .eq('scene_id', sceneId)
      .eq('direction', direction)
      .single()
    return { data, error }
  },

  /**
   * Create an environment slot.
   * payload should include: label, direction?, camera_facing?, spatial_notes?,
   *   image_url?, prompt_text?, is_master?, sort_order?, locked?
   */
  async create(filmId, sceneId, payload) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .insert({ film_id: filmId, scene_id: sceneId, ...payload })
      .select()
      .single()
    return { data, error }
  },

  /** Update fields */
  async update(envId, payload) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', envId)
      .select()
      .single()
    return { data, error }
  },

  /** Set the compass direction and spatial context for an environment slot */
  async setDirection(envId, { direction, cameraFacing, spatialNotes }) {
    return filmaSceneEnvironments.update(envId, {
      direction,
      camera_facing: cameraFacing || null,
      spatial_notes: spatialNotes || null,
    })
  },

  async lock(envId) {
    return filmaSceneEnvironments.update(envId, { locked: true })
  },

  async unlock(envId) {
    return filmaSceneEnvironments.update(envId, { locked: false })
  },

  async delete(envId) {
    const { error } = await supabase
      .from('filma_scene_environments')
      .delete()
      .eq('id', envId)
    return { error }
  },

  /**
   * Upload an image and save it to an environment slot.
   * If envId is provided, updates existing row.
   * If envId is null, creates a new row.
   *
   * options: { label, direction?, cameraFacing?, spatialNotes?,
   *            isMaster?, sortOrder?, envId? }
   */
  async uploadAndSave(userId, filmId, sceneId, file, {
    label,
    direction    = null,
    cameraFacing = null,
    spatialNotes = null,
    isMaster     = false,
    sortOrder    = 0,
    envId        = null,
  }) {
    const { url, path } = await filmaUpload(userId, file, 'scenes/environments')

    if (envId) {
      const { data, error } = await filmaSceneEnvironments.update(envId, {
        image_url:     url,
        locked:        false,
        ...(direction    ? { direction }              : {}),
        ...(cameraFacing ? { camera_facing: cameraFacing } : {}),
        ...(spatialNotes ? { spatial_notes: spatialNotes } : {}),
      })
      return { data, error, url, path }
    }

    const { data, error } = await filmaSceneEnvironments.create(filmId, sceneId, {
      label,
      direction:     direction    || null,
      camera_facing: cameraFacing || null,
      spatial_notes: spatialNotes || null,
      image_url:     url,
      is_master:     isMaster,
      sort_order:    sortOrder,
      locked:        false,
    })
    return { data, error, url, path }
  },

  async setPrompt(envId, promptText) {
    return filmaSceneEnvironments.update(envId, { prompt_text: promptText })
  },

  /**
   * Check whether all environment slots for a scene are locked.
   * Used as a gate before wardrobe / shot scaffolding.
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

  /**
   * Returns a summary of the scene's spatial map — all directions that have
   * images, with their direction, label, and context notes.
   * Used by the UI to show what angles are covered.
   */
  async getSpatialMap(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .select('id, label, direction, is_master, image_url, camera_facing, spatial_notes, locked')
      .eq('scene_id', sceneId)
      .order('sort_order', { ascending: true })
    if (error) return { data: [], error }
    return {
      data: (data || []).map((e) => ({
        id:           e.id,
        label:        e.label,
        direction:    e.direction,
        isMaster:     e.is_master,
        hasImage:     !!e.image_url,
        cameraFacing: e.camera_facing,
        spatialNotes: e.spatial_notes,
        locked:       e.locked,
      })),
      error: null,
    }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SHOTS
// ─────────────────────────────────────────────────────────────────────────────

export const filmaShots = {

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

  async update(shotId, payload) {
    const { data, error } = await supabase
      .from('filma_shots')
      .update(payload)
      .eq('id', shotId)
      .select()
      .single()
    return { data, error }
  },

  async setStatus(shotId, status) {
    return filmaShots.update(shotId, { status })
  },

  async uploadStartFrame(userId, file) {
    return filmaUpload(userId, file, 'shots/frames')
  },

  async uploadEndFrame(userId, file) {
    return filmaUpload(userId, file, 'shots/frames')
  },

  async uploadAudio(userId, file) {
    return filmaUpload(userId, file, 'shots/audio')
  },

 async setAudio(shotId, { audioUrl, firstWord, lastWord, durationSeconds }) {
    return filmaShots.update(shotId, {
      audio_mode:             'uploaded',
      audio_url:              audioUrl,
      audio_first_word:       firstWord,
      audio_last_word:        lastWord,
      audio_duration_seconds: Math.round(durationSeconds),
      duration_seconds:       Math.round(durationSeconds),
    })
  },

  async clearAudio(shotId) {
    return filmaShots.update(shotId, {
      audio_mode:             'native',
      audio_url:              null,
      audio_first_word:       null,
      audio_last_word:        null,
      audio_duration_seconds: null,
      duration_seconds:       null,
    })
  },

  async setStartFrame(shotId, url) {
    return filmaShots.update(shotId, { start_frame_url: url })
  },

  async setEndFrame(shotId, url) {
    return filmaShots.update(shotId, { end_frame_url: url })
  },

  /**
   * Push end frame from shot N to shot N+1.
   * Extracts the frame as a blob, uploads it, then calls the RPC to link
   * it as the start frame of the next shot.
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

  async setOutput(shotId, { generationId, outputUrl, thumbnailUrl }) {
    return filmaShots.update(shotId, {
      generation_id:        generationId,
      output_url:           outputUrl,
      output_thumbnail_url: thumbnailUrl,
      status:               'completed',
    })
  },

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
   */
  async syncFromGeneration(shotId) {
    const { data: shot } = await supabase
      .from('filma_shots')
      .select('id, status, generation_id, output_url')
      .eq('id', shotId)
      .single()

    if (!shot?.generation_id) return shot
    if (shot.status === 'completed' || shot.status === 'failed') return shot

    await supabase.functions.invoke('video-poll-single', {
      body: { generationId: shot.generation_id },
    }).catch(() => {})

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
   * Each tick drives video-poll-single, then syncs back to filma_shots.
   * Returns a stop function — call on unmount.
   */
  poll(shotId, { onUpdate, onDone, intervalMs = 5000, timeoutMs = 600000 }) {
    let stopped = false

    const interval = setInterval(async () => {
      if (stopped) return

      try {
        const { data: shot, error } = await supabase
          .from('filma_shots')
          .select('id, status, generation_id, output_url, output_thumbnail_url')
          .eq('id', shotId)
          .single()

        if (stopped || error || !shot) return

        onUpdate?.(shot)

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

          const { data: gen } = await supabase
            .from('generations')
            .select('status, output_url, output_thumbnail_url, error_message')
            .eq('id', shot.generation_id)
            .single()

          if (stopped || !gen) return

          if (gen.status === 'completed' && gen.output_url) {
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

  async getByShot(shotId) {
    const { data, error } = await supabase
      .from('filma_shot_refs')
      .select('*')
      .eq('shot_id', shotId)
      .order('sort_order', { ascending: true })
    return { data, error }
  },

  async add(filmId, sceneId, shotId, imageUrl, description, sortOrder = 0) {
    const { data, error } = await supabase
      .from('filma_shot_refs')
      .insert({
        film_id:    filmId,
        scene_id:   sceneId,
        shot_id:    shotId,
        image_url:  imageUrl,
        description,
        sort_order: sortOrder,
      })
      .select()
      .single()
    return { data, error }
  },

  async updateDescription(refId, description) {
    const { data, error } = await supabase
      .from('filma_shot_refs')
      .update({ description })
      .eq('id', refId)
      .select()
      .single()
    return { data, error }
  },

  async delete(refId) {
    const { error } = await supabase
      .from('filma_shot_refs')
      .delete()
      .eq('id', refId)
    return { error }
  },

  async upload(userId, file) {
    return filmaUpload(userId, file, 'shots/refs')
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN CUSTOMS (research log for "Other" entries)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaDropdownCustoms = {

  async log(userId, fieldName, value, filmId = null) {
    const { error } = await supabase
      .from('filma_dropdown_customs')
      .insert({ user_id: userId, field_name: fieldName, value, film_id: filmId })
    if (error) console.warn('[filmaDropdownCustoms.log]', error.message)
  },

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
// SCAFFOLDING
// ─────────────────────────────────────────────────────────────────────────────

export async function filmaScaffoldScene(sceneId) {
  const { data, error } = await supabase.functions.invoke('filma-scaffold', {
    body: { sceneId },
  })

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || body?.message || error.message || 'Scaffold failed')
      } catch {
        // fall through
      }
    }
    throw new Error(error.message || 'Scaffold failed')
  }

  if (!data?.success) throw new Error(data?.error || 'Scaffold returned no data')
  return data
}

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
        // fall through
      }
    }
    throw new Error(error.message || 'Film scaffold failed')
  }

  if (!data?.success) throw new Error(data?.error || 'Scaffold returned no data')
  return data
}

export async function filmaGenerateFirstFrame(shotId) {
  const { data, error } = await supabase.functions.invoke('filma-generate-first-frame', {
    body: { shotId },
  })

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || body?.message || error.message || 'First frame generation failed')
      } catch {
        // fall through
      }
    }
    throw new Error(error.message || 'First frame generation failed')
  }

  if (!data?.success) throw new Error(data?.error || 'First frame generation failed')
  return data
}

export async function filmaSuggestShotProps(shotId) {
  const { data, error } = await supabase.functions.invoke('filma-suggest-shot-props', {
    body: { shotId },
  })

  if (error) {
    if (error.context && typeof error.context.json === 'function') {
      try {
        const body = await error.context.json()
        throw new Error(body?.error || body?.message || error.message || 'Prop suggestion failed')
      } catch {
        // fall through
      }
    }
    throw new Error(error.message || 'Prop suggestion failed')
  }

  if (!data?.success) throw new Error(data?.error || 'No prop suggestions returned')
  return data
}


// ─────────────────────────────────────────────────────────────────────────────
// GENERATE
// ─────────────────────────────────────────────────────────────────────────────

export async function filmaGenerateShot(shotId) {
  const { data, error } = await supabase.functions.invoke('filma-generate', {
    body: { shotId },
  })
  if (error) throw new Error(error.message || 'Generation failed')
  if (!data?.success) throw new Error(data?.error || 'Generation failed')
  return data
}


// ─────────────────────────────────────────────────────────────────────────────
// ASSET GENERATION — scene environments & wardrobe
// ─────────────────────────────────────────────────────────────────────────────

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
  return data
}

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
 * Get scene workspace data — scene + environments + actors + shots.
 * Used for FilmaScenePage and FilmaShotPage.
 * Environments include direction, camera_facing, spatial_notes for the
 * generation pipeline's spatial map.
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
