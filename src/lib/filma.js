// src/lib/filma.js
//
// Supabase helpers for Filma — Africa's first AI filmmaking machine.
// Storage bucket: 'filma-uploads' (private, signed URLs)
// Tables: filma_films, filma_actors, filma_parts, filma_scenes,
//         filma_scene_actors, filma_shots, filma_shot_refs,
//         filma_dropdown_customs

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

  /** Hard delete a scene row */
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
// SCENE ACTORS
// ─────────────────────────────────────────────────────────────────────────────

export const filmaSceneActors = {

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
      audio_duration_seconds: durationSeconds,
      duration_seconds:       durationSeconds,
    })
  },

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

  async setStartFrame(shotId, url) {
    return filmaShots.update(shotId, { start_frame_url: url })
  },

  async setEndFrame(shotId, url) {
    return filmaShots.update(shotId, { end_frame_url: url })
  },

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
   * Poll a shot's status until completed/failed or timeout.
   * Returns a cleanup function — call it to stop polling early.
   * onUpdate(shotData) called on each poll tick with fresh data.
   * onDone({ success, data, error }) called when polling ends.
   */
  poll(shotId, { onUpdate, onDone, intervalMs = 5000, timeoutMs = 600000 }) {
    let stopped = false

    const interval = setInterval(async () => {
      if (stopped) return
      try {
        const { data, error } = await supabase
          .from('filma_shots')
          .select('status, output_url, output_thumbnail_url')
          .eq('id', shotId)
          .single()

        if (stopped) return
        if (error) return

        onUpdate?.(data)

        if (data?.status === 'completed' || data?.output_url) {
          stop()
          onDone?.({ success: true, data })
        } else if (data?.status === 'failed') {
          stop()
          onDone?.({ success: false, error: 'Generation failed' })
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

    return stop  // caller can invoke to cancel early (e.g. on unmount)
  },
}


// ─────────────────────────────────────────────────────────────────────────────
// SHOT REFS
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
// DROPDOWN CUSTOMS
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
// SCAFFOLD
// ─────────────────────────────────────────────────────────────────────────────

export async function filmaScaffoldScene(sceneId) {
  const { data, error } = await supabase.functions.invoke('filma-scaffold', {
    body: { sceneId },
  })
  if (error) throw new Error(error.message || 'Scaffold failed')
  if (!data?.success) throw new Error(data?.error || 'Scaffold returned no data')
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
// COMPOSITE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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

export async function filmaGetSceneWorkspace(sceneId) {
  const [sceneRes, shotsRes] = await Promise.all([
    filmaScenes.getById(sceneId),
    filmaShots.getByScene(sceneId),
  ])

  if (sceneRes.error) throw new Error(sceneRes.error.message)

  return {
    scene: sceneRes.data,
    shots: shotsRes.data || [],
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
