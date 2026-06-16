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
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invoke a Supabase edge function and unwrap its error consistently.
 * Extracts the JSON body from the error context when available, so callers
 * always receive a plain Error with a human-readable message.
 */
async function invoke(fnName, body) {
  const { data, error } = await supabase.functions.invoke(fnName, { body })

  if (error) {
    let message = error.message
    if (error.context?.json) {
      try {
        const parsed = await error.context.json()
        message = parsed?.error || parsed?.message || message
      } catch { /* fall through to original message */ }
    }
    throw new Error(message || `${fnName} failed`)
  }

  if (!data?.success) throw new Error(data?.error || `${fnName} returned no data`)
  return data
}

/**
 * Generic single-row update helper.
 * Keeps each domain object's update() method to a one-liner.
 */
function updateRow(table, id, payload) {
  return supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select()
    .single()
    .then(({ data, error }) => ({ data, error }))
}


// ─────────────────────────────────────────────────────────────────────────────
// STORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function filmaUpload(userId, file, subfolder = 'misc') {
  const ext      = file.name.split('.').pop().toLowerCase()
  const filePath = `${userId}/${subfolder}/${crypto.randomUUID()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (upErr) throw new Error(upErr.message || 'Upload failed')

  const { data, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, SIGNED_SECS)
  if (signErr) throw new Error(signErr.message || 'Could not sign URL')

  return { url: data.signedUrl, path: filePath }
}

export async function filmaUploadBlob(userId, blob, filename, subfolder = 'frames') {
  return filmaUpload(userId, new File([blob], filename, { type: blob.type }), subfolder)
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
    return supabase
      .from('filma_films')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
  },

  async getById(filmId) {
    return supabase
      .from('filma_films')
      .select('*')
      .eq('id', filmId)
      .single()
  },

  async create(userId, payload) {
    return supabase
      .from('filma_films')
      .insert({ user_id: userId, ...payload })
      .select()
      .single()
  },

  async update(filmId, payload) {
    return updateRow('filma_films', filmId, payload)
  },

  async delete(filmId) {
    const { error } = await supabase.from('filma_films').delete().eq('id', filmId)
    return { error }
  },

  async setStatus(filmId, status) {
    return filmaFilms.update(filmId, { status })
  },

  async uploadThumbnail(userId, filmId, file) {
    const { url } = await filmaUpload(userId, file, 'thumbnails')
    const { error } = await filmaFilms.update(filmId, { thumbnail_url: url })
    if (error) throw new Error(error.message)
    return url
  },

  async saveStorySummary(filmId, storySummary) {
    return filmaFilms.update(filmId, { story_summary: storySummary, scaffolded: false })
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
    return supabase
      .from('filma_actors')
      .select('*')
      .eq('film_id', filmId)
      .order('sort_order', { ascending: true })
  },

  async create(userId, filmId, payload) {
    return supabase
      .from('filma_actors')
      .insert({ user_id: userId, film_id: filmId, ...payload })
      .select()
      .single()
  },

  /**
   * Import from a UGC profile — copies face + body photos into filma_actors.
   * Face photos are the identity source of truth.
   * Body photos are the physique source of truth — never altered by AI.
   */
  async importFromUGC(userId, filmId, ugcProfile, characterName, roleDescription) {
    return filmaActors.create(userId, filmId, {
      name:                     characterName || ugcProfile.name,
      role_description:         roleDescription,
      gender:                   ugcProfile.gender                   || null,
      nationality:              ugcProfile.nationality               || null,
      ethnic_background:        ugcProfile.ethnic_background         || null,
      ugc_profile_id:           ugcProfile.id,
      // Face — identity source of truth
      face_reference_url:       ugcProfile.photo_face_front          || null,
      photo_face_front:         ugcProfile.photo_face_front          || null,
      photo_face_three_quarter: ugcProfile.photo_face_three_quarter  || null,
      photo_face_side_90:       ugcProfile.photo_face_side_90        || null,
      // Body — physique source of truth (do not alter)
      body_reference_url:       ugcProfile.photo_body_front          || null,
      photo_body_front:         ugcProfile.photo_body_front          || null,
      photo_body_side:          ugcProfile.photo_body_side           || null,
      photo_body_back:          ugcProfile.photo_body_back           || null,
      thumbnail_url:            ugcProfile.thumbnail_url             || null,
    })
  },

  async update(actorId, payload) {
    return updateRow('filma_actors', actorId, payload)
  },

  async delete(actorId) {
    const { error } = await supabase.from('filma_actors').delete().eq('id', actorId)
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

  /** Returns true when all 3 face photos are present (gate for generation readiness). */
  isComplete: (actor) => !!(
    actor?.photo_face_front &&
    actor?.photo_face_three_quarter &&
    actor?.photo_face_side_90
  ),

  /** Returns true when at least a front body photo is present. */
  hasBodyReference: (actor) => !!(actor?.photo_body_front || actor?.body_reference_url),
}


// ─────────────────────────────────────────────────────────────────────────────
// PARTS (episodes / parts / chapters)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaParts = {

  async getByFilm(filmId) {
    return supabase
      .from('filma_parts')
      .select('*')
      .eq('film_id', filmId)
      .order('season_number', { ascending: true })
      .order('part_number',   { ascending: true })
  },

  async create(filmId, payload) {
    return supabase
      .from('filma_parts')
      .insert({ film_id: filmId, ...payload })
      .select()
      .single()
  },

  async bulkCreate(filmId, parts) {
    return supabase
      .from('filma_parts')
      .insert(parts.map((p) => ({ film_id: filmId, ...p })))
      .select()
  },

  async update(partId, payload) {
    return updateRow('filma_parts', partId, payload)
  },

  async delete(partId) {
    const { error } = await supabase.from('filma_parts').delete().eq('id', partId)
    return { error }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SCENES
// ─────────────────────────────────────────────────────────────────────────────

export const filmaScenes = {

  async getByPart(partId) {
    return supabase
      .from('filma_scenes')
      .select('*')
      .eq('part_id', partId)
      .order('scene_number', { ascending: true })
  },

  async getByFilm(filmId) {
    return supabase
      .from('filma_scenes')
      .select('*, filma_parts(label, part_number, season_number)')
      .eq('film_id', filmId)
      .order('scene_number', { ascending: true })
  },

  async getById(sceneId) {
    return supabase
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
  },

  async create(filmId, partId, sceneNumber) {
    return supabase
      .from('filma_scenes')
      .insert({ film_id: filmId, part_id: partId, scene_number: sceneNumber, title: null })
      .select()
      .single()
  },

  async bulkCreate(filmId, partId, totalScenes) {
    return supabase
      .from('filma_scenes')
      .insert(
        Array.from({ length: totalScenes }, (_, i) => ({
          film_id:      filmId,
          part_id:      partId,
          scene_number: i + 1,
          title:        null,
        }))
      )
      .select()
  },

  async update(sceneId, payload) {
    return updateRow('filma_scenes', sceneId, payload)
  },

  async delete(sceneId) {
    const { error } = await supabase.from('filma_scenes').delete().eq('id', sceneId)
    return { error }
  },

  async uploadMasterImage(userId, file) {
    return filmaUpload(userId, file, 'scenes/master')
  },

  async saveScript(sceneId, scriptText) {
    return filmaScenes.update(sceneId, { script_text: scriptText, scaffolded: false })
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
// SCENE ACTORS  (junction: actors in a scene + wardrobe)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaSceneActors = {

  async getByScene(sceneId) {
    return supabase
      .from('filma_scene_actors')
      .select(`
        *,
        filma_actors (
          id, name, thumbnail_url, face_reference_url, gender, role_description,
          photo_face_front, photo_face_three_quarter, photo_face_side_90,
          photo_body_front, photo_body_side, photo_body_back, body_reference_url
        )
      `)
      .eq('scene_id', sceneId)
  },

  async add(filmId, sceneId, actorId) {
    return supabase
      .from('filma_scene_actors')
      .insert({ film_id: filmId, scene_id: sceneId, actor_id: actorId })
      .select()
      .single()
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
    return supabase
      .from('filma_scene_actors')
      .update({ outfit_image_url: outfitImageUrl })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
  },

  async setWardrobePrompt(sceneId, actorId, promptText) {
    return supabase
      .from('filma_scene_actors')
      .update({ wardrobe_prompt: promptText, wardrobe_locked: false })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
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
    return supabase
      .from('filma_scene_actors')
      .update({ wardrobe_locked: true })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
  },

  async unlockWardrobe(sceneId, actorId) {
    return supabase
      .from('filma_scene_actors')
      .update({ wardrobe_locked: false })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
  },

  /** Returns { ready, total, locked, error }. All actors must be locked to proceed. */
  async checkWardrobeReady(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_actors')
      .select('actor_id, wardrobe_locked')
      .eq('scene_id', sceneId)
    if (error) return { ready: false, total: 0, locked: 0, error }
    const total  = (data || []).length
    const locked = (data || []).filter((sa) => sa.wardrobe_locked).length
    return { ready: total > 0 && locked === total, total, locked, error: null }
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SCENE ENVIRONMENTS
//
// Each scene maps a spatial grid of camera angles:
//   is_master  = true  → wide establishing shot (fallback for all angles)
//   direction         → 'master' | 'N' | 'E' | 'S' | 'W'
//   camera_facing     → plain English: "Camera faces North wall, window on left"
//   spatial_notes     → room layout: "Door is E wall, sofa runs N-S"
//
// The generation pipeline uses direction + camera_facing + spatial_notes to:
//   1. Match a start frame to a known angle (via Claude vision)
//   2. Determine where characters look relative to camera
//   3. Pick the right environment asset for the next shot's composition
// ─────────────────────────────────────────────────────────────────────────────

export const filmaSceneEnvironments = {

  async getByScene(sceneId) {
    return supabase
      .from('filma_scene_environments')
      .select('*')
      .eq('scene_id', sceneId)
      .order('sort_order', { ascending: true })
  },

  async getMaster(sceneId) {
    return supabase
      .from('filma_scene_environments')
      .select('*')
      .eq('scene_id', sceneId)
      .eq('is_master', true)
      .single()
  },

  async getByDirection(sceneId, direction) {
    return supabase
      .from('filma_scene_environments')
      .select('*')
      .eq('scene_id', sceneId)
      .eq('direction', direction)
      .single()
  },

async create(filmId, sceneId, payload) {
  return supabase
    .from('filma_scene_environments')
    .insert({ film_id: filmId, scene_id: sceneId, ...payload })
    .select()
    .single()
},

  async update(envId, payload) {
    return updateRow('filma_scene_environments', envId, {
      ...payload,
      updated_at: new Date().toISOString(),
    })
  },

  async setDirection(envId, { direction, cameraFacing, spatialNotes }) {
    return filmaSceneEnvironments.update(envId, {
      direction,
      camera_facing: cameraFacing || null,
      spatial_notes: spatialNotes || null,
    })
  },

  async setPrompt(envId, promptText) {
    return filmaSceneEnvironments.update(envId, { prompt_text: promptText })
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
   * Upload an environment image and persist to the DB.
   * Upserts by envId when provided, creates a new row otherwise.
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
        image_url: url,
        locked:    false,
        ...(direction    && { direction }),
        ...(cameraFacing && { camera_facing: cameraFacing }),
        ...(spatialNotes && { spatial_notes: spatialNotes }),
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

  /** Returns { ready, total, locked, error }. All slots must be locked to proceed. */
  async checkReady(sceneId) {
    const { data, error } = await supabase
      .from('filma_scene_environments')
      .select('id, locked')
      .eq('scene_id', sceneId)
    if (error) return { ready: false, total: 0, locked: 0, error }
    const total  = (data || []).length
    const locked = (data || []).filter((e) => e.locked).length
    return { ready: total > 0 && locked === total, total, locked, error: null }
  },

  /**
   * Returns all angles that have images, with their spatial context.
   * Used by the UI to show angle coverage and by the pipeline for spatial mapping.
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
    return supabase
      .from('filma_shots')
      .select(`
        *,
        filma_shot_refs (id, image_url, description, sort_order),
        filma_actors!filma_shots_speaking_actor_id_fkey (id, name, thumbnail_url)
      `)
      .eq('scene_id', sceneId)
      .order('shot_number', { ascending: true })
  },

  async getById(shotId) {
    return supabase
      .from('filma_shots')
      .select(`
        *,
        filma_shot_refs (id, image_url, description, sort_order),
        filma_actors!filma_shots_speaking_actor_id_fkey (id, name, thumbnail_url, face_reference_url)
      `)
      .eq('id', shotId)
      .single()
  },

  async update(shotId, payload) {
    return updateRow('filma_shots', shotId, payload)
  },

  async setStatus(shotId, status) {
    return filmaShots.update(shotId, { status })
  },

  async delete(shotId) {
    const { error } = await supabase.from('filma_shots').delete().eq('id', shotId)
    return { error }
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
    const secs = Math.round(durationSeconds)
    return filmaShots.update(shotId, {
      audio_mode:             'uploaded',
      audio_url:              audioUrl,
      audio_first_word:       firstWord,
      audio_last_word:        lastWord,
      audio_duration_seconds: secs,
      duration_seconds:       secs,
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

  async setOutput(shotId, { generationId, outputUrl, thumbnailUrl }) {
    return filmaShots.update(shotId, {
      generation_id:        generationId,
      output_url:           outputUrl,
      output_thumbnail_url: thumbnailUrl,
      status:               'completed',
    })
  },

  /**
   * Extract a frame blob from shot N, upload it, then call the RPC to link it
   * as the start frame of shot N+1.
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

    await Promise.all([
      filmaShots.setStartFrame(fnData.next_shot_id, url),
      filmaShots.setStatus(currentShotId, 'completed'),
    ])

    return { nextShotId: fnData.next_shot_id, frameUrl: url }
  },

  /**
   * One-shot sync: checks the linked generation row and writes back to
   * filma_shots if it has resolved. Call on load when status is 'generating'
   * or 'processing' to pick up results from while the user was away.
   */
  async syncFromGeneration(shotId) {
    const { data: shot } = await supabase
      .from('filma_shots')
      .select('id, status, generation_id, output_url')
      .eq('id', shotId)
      .single()

    if (!shot?.generation_id) return shot
    if (shot.status === 'completed' || shot.status === 'failed') return shot

    // Drive the poll edge function (fire-and-forget is fine here)
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
      return updated ?? shot
    }

    if (gen.status === 'failed') {
      await supabase.from('filma_shots').update({ status: 'failed' }).eq('id', shotId)
      return { ...shot, status: 'failed' }
    }

    return shot
  },

  /**
   * Poll a shot's status until completed/failed or timeout.
   * Each tick drives video-poll-single, then syncs back to filma_shots.
   * Returns a stop function — call on component unmount.
   *
   * @param {string}   shotId
   * @param {object}   opts
   * @param {function} opts.onUpdate       - called with each updated shot row
   * @param {function} opts.onDone         - called with { success, data|error }
   * @param {number}   [opts.intervalMs=5000]
   * @param {number}   [opts.timeoutMs=600000]
   * @returns {function} stop
   */
  poll(shotId, { onUpdate, onDone, intervalMs = 5000, timeoutMs = 600_000 }) {
    let stopped = false

    async function tick() {
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

        if (!shot.generation_id) return

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

          const resolved = {
            ...shot,
            status:               'completed',
            output_url:           gen.output_url,
            output_thumbnail_url: gen.output_thumbnail_url || gen.output_url,
          }
          onUpdate?.(resolved)
          stop()
          onDone?.({ success: true, data: resolved })
          return
        }

        if (gen.status === 'failed') {
          await supabase.from('filma_shots').update({ status: 'failed' }).eq('id', shotId)
          stop()
          onDone?.({ success: false, error: gen.error_message || 'Generation failed' })
          return
        }

        onUpdate?.(shot)

      } catch (err) {
        if (!stopped) console.warn('[filmaShots.poll]', err)
      }
    }

    tick()
    const interval = setInterval(tick, intervalMs)
    const timeout  = setTimeout(() => {
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
// SHOT REFS  (extra reference images per shot)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaShotRefs = {

  async getByShot(shotId) {
    return supabase
      .from('filma_shot_refs')
      .select('*')
      .eq('shot_id', shotId)
      .order('sort_order', { ascending: true })
  },

  async add(filmId, sceneId, shotId, imageUrl, description, sortOrder = 0) {
    return supabase
      .from('filma_shot_refs')
      .insert({ film_id: filmId, scene_id: sceneId, shot_id: shotId, image_url: imageUrl, description, sort_order: sortOrder })
      .select()
      .single()
  },

  async updateDescription(refId, description) {
    return updateRow('filma_shot_refs', refId, { description })
  },

  async delete(refId) {
    const { error } = await supabase.from('filma_shot_refs').delete().eq('id', refId)
    return { error }
  },

  async upload(userId, file) {
    return filmaUpload(userId, file, 'shots/refs')
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// DROPDOWN CUSTOMS  (research log for "Other" entries)
// ─────────────────────────────────────────────────────────────────────────────

export const filmaDropdownCustoms = {

  async log(userId, fieldName, value, filmId = null) {
    const { error } = await supabase
      .from('filma_dropdown_customs')
      .insert({ user_id: userId, field_name: fieldName, value, film_id: filmId })
    if (error) console.warn('[filmaDropdownCustoms.log]', error.message)
  },

  async getByField(fieldName) {
    return supabase
      .from('filma_dropdown_customs')
      .select('*')
      .eq('field_name', fieldName)
      .order('created_at', { ascending: false })
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SCAFFOLDING
// ─────────────────────────────────────────────────────────────────────────────

export const filmaScaffoldScene  = (sceneId) => invoke('filma-scaffold',      { sceneId })
export const filmaScaffoldFilm   = (filmId)  => invoke('filma-scaffold-film', { filmId  })


// ─────────────────────────────────────────────────────────────────────────────
// SHOT GENERATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const filmaGenerateShot         = (shotId)         => invoke('filma-generate',           { shotId         })
export const filmaGenerateFirstFrame   = (shotId)         => invoke('filma-generate-first-frame',{ shotId         })
export const filmaSuggestShotProps     = (shotId)         => invoke('filma-suggest-shot-props',  { shotId         })
export const filmaSuggestScenePrompts  = (sceneId)        => invoke('filma-suggest-scene-prompts',{ sceneId       })
export const filmaSuggestWardrobePrompt = (sceneId, actorId) =>
  invoke('filma-suggest-wardrobe-prompt', { sceneId, actorId })


// ─────────────────────────────────────────────────────────────────────────────
// ASSET GENERATION  (environments, wardrobe, cardinal angles)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a scene environment or wardrobe asset.
 * assetType: 'scene_environment' | 'wardrobe'
 */
export const filmaGenerateAsset = ({ assetType, sceneId, actorId, envId, prompt }) =>
  invoke('filma-generate-asset', { assetType, sceneId, actorId, envId, prompt })

/**
 * Generate a cardinal angle (N/E/S/W) environment image using the locked
 * master shot as image-to-image input. Folds into the existing asset
 * generation edge function via assetType: 'scene_angle'.
 *
 * Returns { success, imageUrl, creditsCharged, generationId }
 */
export const filmaGenerateAngleAsset = ({
  sceneId,
  filmId,
  direction,       // 'N' | 'E' | 'S' | 'W'
  masterImageUrl,  // locked master shot URL — required
  modelId,         // WaveSpeed model ID e.g. 'flux-kontext-dev-ultra-fast'
  envId = null,    // existing filma_scene_environments.id if the row already exists
}) =>
  invoke('filma-generate-asset', {
    assetType:     'scene_angle',
    sceneId,
    filmId,
    direction,
    masterImageUrl,
    modelId,
    envId,
    prompt:        '',  // edge fn builds its own cinematic prompt from the angle brief
  })


// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full film structure: film + parts + scenes (no shots — too heavy).
 * Used for the structure overview page.
 */
export async function filmaGetFilmStructure(filmId) {
  const [filmRes, partsRes, actorsRes] = await Promise.all([
    filmaFilms.getById(filmId),
    filmaParts.getByFilm(filmId),
    filmaActors.getByFilm(filmId),
  ])

  if (filmRes.error) throw new Error(filmRes.error.message)

  const partsWithScenes = await Promise.all(
    (partsRes.data || []).map(async (part) => {
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
 * Scene workspace: scene + environments + actors + shots.
 * Used by FilmaScenePage and FilmaShotPage.
 * Environments carry direction, camera_facing, and spatial_notes for the
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
// AUDIO DURATION HELPER  (client-side)
// ─────────────────────────────────────────────────────────────────────────────

export function getAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const url   = URL.createObjectURL(file)
    const audio = document.createElement('audio')
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(audio.duration) }
    audio.onerror          = () => { URL.revokeObjectURL(url); reject(new Error('Could not read audio file')) }
    audio.src = url
  })
}
