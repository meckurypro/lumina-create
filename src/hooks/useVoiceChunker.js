import { useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { ugcAudioChunks, ugcAudioGenerations } from '@/lib/ugcVoices'

const TARGET_CHUNK_S  = 5    // ideal chunk length
const MIN_CHUNK_S     = 4    // earliest we'll cut after chunk start
const MAX_CHUNK_S     = 12   // latest we'll search for silence
const FORCE_CUT_S     = 10   // force-cut here if no silence found within MAX_CHUNK_S
const RMS_WINDOW_S    = 0.05 // 50ms RMS analysis window
const BUCKET          = 'ugc-profiles'

// ─────────────────────────────────────────────────────────────────────────────
// WAV ENCODER
// ─────────────────────────────────────────────────────────────────────────────

function audioBufferToWav(buffer) {
  const numChannels    = buffer.numberOfChannels
  const sampleRate     = buffer.sampleRate
  const numSamples     = buffer.length
  const bytesPerSample = 2
  const dataSize       = numSamples * numChannels * bytesPerSample
  const ab             = new ArrayBuffer(44 + dataSize)
  const view           = new DataView(ab)

  const ws = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }

  ws(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true); ws(8, 'WAVE')
  ws(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true)
  view.setUint16(32, numChannels * bytesPerSample, true); view.setUint16(34, 16, true)
  ws(36, 'data'); view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]))
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([ab], { type: 'audio/wav' })
}

// ─────────────────────────────────────────────────────────────────────────────
// SLICER — copies raw PCM, no re-encoding
// ─────────────────────────────────────────────────────────────────────────────

function sliceAudioBuffer(sourceBuffer, startSec, endSec) {
  const sampleRate  = sourceBuffer.sampleRate
  const numChannels = sourceBuffer.numberOfChannels
  const startSample = Math.floor(startSec * sampleRate)
  const endSample   = Math.min(Math.floor(endSec * sampleRate), sourceBuffer.length)
  const frameCount  = endSample - startSample

  if (frameCount <= 0) return null

  // Reuse the passed-in context — caller is responsible for providing it
  const sliced = new OfflineAudioContext(numChannels, frameCount, sampleRate)
    .createBuffer(numChannels, frameCount, sampleRate)

  for (let ch = 0; ch < numChannels; ch++) {
    sliced.copyToChannel(
      sourceBuffer.getChannelData(ch).slice(startSample, endSample),
      ch,
    )
  }
  return sliced
}

// ─────────────────────────────────────────────────────────────────────────────
// SILENCE DETECTOR
//
// Scans [searchStartSec, searchEndSec] in RMS_WINDOW_S steps.
// Returns the time (in seconds from the start of the full buffer) of the
// quietest window's midpoint — i.e. the best place to cut.
//
// Mixed-channel strategy: average all channels into one RMS value per window
// so stereo files don't fool the detector with energy on one side only.
// ─────────────────────────────────────────────────────────────────────────────

function findBestCutPoint(audioBuffer, searchStartSec, searchEndSec) {
  const sampleRate     = audioBuffer.sampleRate
  const numChannels    = audioBuffer.numberOfChannels
  const windowSamples  = Math.floor(RMS_WINDOW_S * sampleRate)
  const searchStart    = Math.floor(searchStartSec * sampleRate)
  const searchEnd      = Math.min(Math.floor(searchEndSec * sampleRate), audioBuffer.length)

  // Pre-fetch channel data once — avoids repeated getChannelData calls in the loop
  const channels = []
  for (let ch = 0; ch < numChannels; ch++) channels.push(audioBuffer.getChannelData(ch))

  let bestRms      = Infinity
  let bestMidpoint = searchStartSec  // fallback: cut at search start

  for (let i = searchStart; i + windowSamples <= searchEnd; i += windowSamples) {
    // Average RMS across all channels for this window
    let sumRms = 0
    for (let ch = 0; ch < numChannels; ch++) {
      let sumSq = 0
      for (let j = i; j < i + windowSamples; j++) {
        sumSq += channels[ch][j] * channels[ch][j]
      }
      sumRms += Math.sqrt(sumSq / windowSamples)
    }
    const rms = sumRms / numChannels

    if (rms < bestRms) {
      bestRms      = rms
      bestMidpoint = (i + windowSamples / 2) / sampleRate
    }
  }

  return bestMidpoint
}

// ─────────────────────────────────────────────────────────────────────────────
// CUT POINT BUILDER
//
// Walks through the full audio and builds an array of cut points (in seconds)
// using silence detection within [chunkStart + MIN, chunkStart + MAX].
// Falls back to FORCE_CUT_S if no silence window found in time.
// ─────────────────────────────────────────────────────────────────────────────

function buildCutPoints(audioBuffer) {
  const totalSec = audioBuffer.duration
  const cuts     = [0]  // always start at 0

  while (true) {
    const chunkStart = cuts[cuts.length - 1]
    const remaining  = totalSec - chunkStart

    // Close enough to the end — absorb the tail into the last chunk
    // (avoids a tiny orphan chunk at the end)
    if (remaining <= MAX_CHUNK_S * 1.1) break

    const searchStart = chunkStart + MIN_CHUNK_S
    const searchEnd   = chunkStart + MAX_CHUNK_S

    const bestCut = findBestCutPoint(audioBuffer, searchStart, searchEnd)

    // Sanity-check: if bestCut didn't advance meaningfully, force-cut
    const advance = bestCut - chunkStart
    const cutAt   = advance >= MIN_CHUNK_S ? bestCut : chunkStart + FORCE_CUT_S

    cuts.push(Math.min(cutAt, totalSec))
  }

  cuts.push(totalSec)  // always end at total duration
  return cuts
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

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
      // ── 1. Fetch audio blob ──────────────────────────────────────────────
      const res = await fetch(outputUrl)
      if (!res.ok) throw new Error(`Failed to fetch audio: ${res.status}`)
      const arrayBuffer = await res.arrayBuffer()

      // ── 2. Decode to AudioBuffer ─────────────────────────────────────────
      const ctx         = getAudioContext()   // FIX: shared context, no leak
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0))

      // ── 3. Build silence-aware cut points ───────────────────────────────
      const cuts       = buildCutPoints(audioBuffer)
      const chunkCount = cuts.length - 1

      // ── 4. Slice each chunk and encode to WAV ────────────────────────────
      const chunkMeta = []
      for (let i = 0; i < chunkCount; i++) {
        const startSec = cuts[i]
        const endSec   = cuts[i + 1]
        const sliced   = sliceAudioBuffer(audioBuffer, startSec, endSec)
        if (!sliced) continue

        const wavBlob    = audioBufferToWav(sliced)
        const durationMs = Math.round(sliced.duration * 1000)
        chunkMeta.push({ index: i, wavBlob, durationMs, fileSize: wavBlob.size })
      }

      // ── 5. Upload all chunks to storage ──────────────────────────────────
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
            user_id:         userId,
            generation_id:   generation.id,
            chunk_index:     index,
            label:           `Part ${index + 1}`,
            storage_path:    storagePath,
            public_url:      publicUrl,
            duration_ms:     durationMs,
            file_size_bytes: fileSize,
            status:          'ready',
          }
        })
      )

      // ── 6. Batch insert DB rows ───────────────────────────────────────────
      const { data: insertedChunks, error: insertError } = await ugcAudioChunks.createMany(uploadedChunks)
      if (insertError) throw new Error(`Chunk DB insert failed: ${insertError.message}`)

      // ── 7. Update chunk_count on parent generation ────────────────────────
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
