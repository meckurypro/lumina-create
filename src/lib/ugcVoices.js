import { supabase } from '@/lib/supabase'

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

// ─── Credit cost constants ───────────────────────────────────
export const VOICE_CREDITS = {
  CLONE:              0,
  TTS_PER_100_CHARS:  1,
}

export const STT_CREDITS = {
  TRANSCRIBE_PER_SECOND: 4, // ~240 credits/min — covers ElevenLabs Scribe v2 cost at 30% margin
}

export function calcTTSCredits(text) {
  return Math.ceil(text.length / 100) * VOICE_CREDITS.TTS_PER_100_CHARS
}

export function calcTranscriptionCredits(durationSeconds) {
  if (!durationSeconds || durationSeconds <= 0) return 0
  return Math.ceil(durationSeconds * STT_CREDITS.TRANSCRIBE_PER_SECOND)
}

// ─── Supabase CRUD ───────────────────────────────────────────
export const ugcVoices = {
  getAll: (userId) =>
    supabase
      .from('ugc_voices')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),

  getById: (id) =>
    supabase
      .from('ugc_voices')
      .select('*')
      .eq('id', id)
      .single(),

  save: (userId, payload) =>
    supabase
      .from('ugc_voices')
      .insert({ user_id: userId, ...payload })
      .select()
      .single(),

  archive: (id) =>
    supabase
      .from('ugc_voices')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', id),

  incrementUsage: (id) =>
    supabase.rpc('increment_voice_usage', { voice_id: id }),
}

export const ugcAudioGenerations = {
  // source_type: optional filter — 'tts' | 'stt' | undefined (all)
  getByVoice: (voiceId, { limit = 20, offset = 0, sourceType } = {}) => {
    let q = supabase
      .from('ugc_audio_generations')
      .select('*, voice:ugc_voices(name, elevenlabs_voice_id)', { count: 'exact' })
      .eq('voice_id', voiceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (sourceType) q = q.eq('source_type', sourceType)
    return q
  },

  getAll: (userId, { limit = 20, offset = 0, sourceType } = {}) => {
    let q = supabase
      .from('ugc_audio_generations')
      .select('*, voice:ugc_voices(name, elevenlabs_voice_id)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (sourceType) q = q.eq('source_type', sourceType)
    return q
  },

  // Convenience for the STT library list — only this user's STT recordings
  getSttRecordings: (userId, { limit = 20, offset = 0 } = {}) =>
    supabase
      .from('ugc_audio_generations')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('source_type', 'stt')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),

  create: (payload) =>
    supabase
      .from('ugc_audio_generations')
      .insert(payload)
      .select()
      .single(),

  update: (id, payload) =>
    supabase
      .from('ugc_audio_generations')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id),

  delete: (id) =>
    supabase
      .from('ugc_audio_generations')
      .delete()
      .eq('id', id),
}

// ─── Audio chunks CRUD ───────────────────────────────────────
// Chunks are 5-second slices of a completed ugc_audio_generation
// (TTS output or STT recording — same pipeline, same shape).
// Storage path pattern: {userId}/audio/{generationId}/chunk-{index}.wav
// in the ugc-profiles bucket.
export const ugcAudioChunks = {
  // Fetch all chunks for a generation, ordered by index
  getByGeneration: (generationId) =>
    supabase
      .from('ugc_audio_chunks')
      .select('*')
      .eq('generation_id', generationId)
      .order('chunk_index', { ascending: true }),

  // Insert a single chunk row
  create: (payload) =>
    supabase
      .from('ugc_audio_chunks')
      .insert(payload)
      .select()
      .single(),

  // Batch insert all chunks for a generation in one round-trip
  createMany: (chunks) =>
    supabase
      .from('ugc_audio_chunks')
      .insert(chunks)
      .select(),

  // Delete all chunks for a generation (called on generation delete)
  deleteByGeneration: (generationId) =>
    supabase
      .from('ugc_audio_chunks')
      .delete()
      .eq('generation_id', generationId),
}

// ─── ElevenLabs API calls (called from edge function only) ───
// These are kept here as reference for the edge function.
// Never call ElevenLabs directly from the client.
export const ELEVENLABS_MODELS = [
  {
    id:       'eleven_multilingual_v2',
    label:    'Multilingual v2',
    sublabel: 'Best quality · 29+ languages',
    cost:     1,
  },
  {
    id:       'eleven_flash_v2_5',
    label:    'Flash v2.5',
    sublabel: 'Fast · Lower latency',
    cost:     0.5,
  },
]

// Reference only — actual STT call happens in the speech-to-text edge function.
export const ELEVENLABS_STT_MODEL = 'scribe_v2'
