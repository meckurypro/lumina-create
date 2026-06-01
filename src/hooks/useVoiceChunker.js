import { useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ugcAudioChunks, ugcAudioGenerations } from '@/lib/ugcVoices'

const CHUNK_DURATION_S = 5
const BUCKET           = 'ugc-profiles'

// ── Encode an AudioBuffer slice to a WAV Blob ─────────────────
// Pure PCM/WAV — no codec needed, works in all browsers.
function audioBufferToWav(buffer) {
  const numChannels  = buffer.numberOfChannels
  const sampleRate   = buffer.sampleRate
  const numSamples   = buffer.length
  const bytesPerSample = 2                          // 16-bit PCM
  const dataSize     = numSamples * numChannels * bytesPerSample
  const headerSize   = 44
  const arrayBuffer  = new ArrayBuffer(headerSize + dataSize)
  const view         = new DataView(arrayBuffer)

  // ── RIFF header ──
  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeString(0,  'RIFF')
  view.setUint32(4,  36 + dataSize,             true)
  writeString(8,  'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16,                        true) // PCM chunk size
  view.setUint16(20, 1,                         true) // PCM format
  view.setUint16(22, numChannels,               true)
  view.setUint32(24, sampleRate,                true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true) // byte rate
  view.setUint16(32, numChannels * bytesPerSample, true)              // block align
  view.setUint16(34, 16,                        true)                 // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize,                  true)

  // ── Interleaved PCM samples ──
  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

// ── Slice an AudioBuffer into 5s chunks ──────────────────────
function sliceAudioBuffer(sourceBuffer, startSec, endSec) {
  const sampleRate  = sourceBuffer.sampleRate
  const numChannels = sourceBuffer.numberOfChannels
  const startSample = Math.floor(startSec * sampleRate)
  const endSample   = Math.min(Math.floor(endSec * sampleRate), sourceBuffer.length)
  const frameCount  = endSample - startSample

  if (frameCount <= 0) return null

  // OfflineAudioContext isn't needed here — we just copy the raw PCM data
  const sliced = new AudioContext().createBuffer(numChannels, frameCount, sampleRate)
  for (let ch = 0; ch < numChannels; ch++) {
    sliced.copyToChannel(
      sourceBuffer.getChannelData(ch).slice(startSample, endSample),
      ch,
    )
  }
  return sliced
}

// ─────────────────────────────────────────────────────────────
// useVoiceChunker
//
// Call chunkAndStore(generation, outputUrl, userId) after a
// generation transitions to 'completed'. It will:
//   1. Fetch the MP3 blob from outputUrl
//   2. Decode into AudioBuffer via Web Audio API
//   3. Slice into CHUNK_DURATION_S-second chunks
//   4. Encode each chunk to WAV
//   5. Upload each WAV to ugc-profiles storage
//   6. Batch-insert ugc_audio_chunks rows
//   7. Update chunk_count on ugc_audio_generations
//
// Returns { chunks: [...], error } — caller can use for UI.
// ─────────────────────────────────────────────────────────────
export function useVoiceChunker() {
  const audioCtxRef = useRef(null)

  const getAudioContext = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }

  const chunkAndStore = useCallback(async (generation, outputUrl, userId) => {
    if (!outputUrl || !userId || !generation?.id) {
      return { chunks: [], error: new Error('Missing required params') }
    }

    try {
      // ── 1. Fetch audio blob ──────────────────────────────────
      const res = await fetch(outputUrl)
      if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`)
      const arrayBuffer = await res.arrayBuffer()

      // ── 2. Decode to AudioBuffer ─────────────────────────────
      const ctx         = getAudioContext()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
      const totalSec    = audioBuffer.duration

      // ── 3. Build chunk slices ────────────────────────────────
      const chunkCount = Math.ceil(totalSec / CHUNK_DURATION_S)
      const chunkMeta  = []

      for (let i = 0; i < chunkCount; i++) {
        const startSec   = i * CHUNK_DURATION_S
        const endSec     = Math.min(startSec + CHUNK_DURATION_S, totalSec)
        const sliced     = sliceAudioBuffer(audioBuffer, startSec, endSec)
        if (!sliced) continue

        const wavBlob    = audioBufferToWav(sliced)
        const durationMs = Math.round(sliced.duration * 1000)
        chunkMeta.push({ index: i, wavBlob, durationMs, fileSize: wavBlob.size })
      }

      // ── 4 & 5. Upload all chunks to storage ──────────────────
      const uploadedChunks = await Promise.all(
        chunkMeta.map(async ({ index, wavBlob, durationMs, fileSize }) => {
          const storagePath = `${userId}/audio/${generation.id}/chunk-${index}.wav`

          const { error: uploadError } = await supabase.storage
            .from(BUCKET)
            .upload(storagePath, wavBlob, {
              contentType:  'audio/wav',
              upsert:       true,
              cacheControl: '31536000',
            })

          if (uploadError) throw new Error(`Chunk ${index} upload failed: ${uploadError.message}`)

          const { data: { publicUrl } } = supabase.storage
            .from(BUCKET)
            .getPublicUrl(storagePath)

          return {
            user_id:       userId,
            generation_id: generation.id,
            chunk_index:   index,
            label:         `Part ${index + 1}`,
            storage_path:  storagePath,
            public_url:    publicUrl,
            duration_ms:   durationMs,
            file_size_bytes: fileSize,
            status:        'ready',
          }
        })
      )

      // ── 6. Batch insert DB rows ──────────────────────────────
      const { data: insertedChunks, error: insertError } = await ugcAudioChunks.createMany(uploadedChunks)
      if (insertError) throw new Error(`Chunk DB insert failed: ${insertError.message}`)

      // ── 7. Update chunk_count on parent generation ───────────
      await ugcAudioGenerations.update(generation.id, {
        chunk_count: uploadedChunks.length,
      })

      return { chunks: insertedChunks || uploadedChunks, error: null }

    } catch (err) {
      console.error('[useVoiceChunker] error:', err)
      return { chunks: [], error: err }
    }
  }, [])

  return { chunkAndStore }
}
