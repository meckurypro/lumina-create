import { supabase } from '@/lib/supabase'

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'

// ─── Credit cost constants ───────────────────────────────────
export const VOICE_CREDITS = {
  CLONE:              800,
  TTS_PER_100_CHARS:  1,
}

export function calcTTSCredits(text) {
  return Math.ceil(text.length / 100) * VOICE_CREDITS.TTS_PER_100_CHARS
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
  getByVoice: (voiceId, { limit = 20, offset = 0 } = {}) =>
    supabase
      .from('ugc_audio_generations')
      .select('*, voice:ugc_voices(name, elevenlabs_voice_id)', { count: 'exact' })
      .eq('voice_id', voiceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),

  getAll: (userId, { limit = 20, offset = 0 } = {}) =>
    supabase
      .from('ugc_audio_generations')
      .select('*, voice:ugc_voices(name, elevenlabs_voice_id)', { count: 'exact' })
      .eq('user_id', userId)
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
// Chunks are 5-second slices of a completed ugc_audio_generation.
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
