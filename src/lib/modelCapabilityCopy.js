// src/lib/modelCapabilityCopy.js
//
// Plain-language capability chips + one-line blurbs for render-window
// models, shown on the private booking page so users understand what a
// model actually DOES rather than reading a raw label or feature slug.
// Some models (e.g. Meckury I2V Max) do more than one thing depending on
// how they're used — this surfaces every relevant capability, not just
// the primary one.

// Curated entries for known Meckury self-hosted models — most precise,
// least jargon-y option when we know exactly what a model does.
const KNOWN_MODEL_COPY = {
  meckury_t2v: {
    blurb: 'Creates a video straight from your description — no photo needed.',
    chips: ['Text → video'],
  },
  meckury_i2v: {
    blurb: 'Brings a photo to life as a short cinematic video.',
    chips: ['Photo → video'],
  },
  meckury_i2v_pro: {
    blurb: 'Turns a photo into video and syncs it to a voice or sound clip you provide.',
    chips: ['Photo → video', 'Syncs to audio'],
  },
  meckury_i2v_max: {
    blurb: 'Our top-tier photo-to-video model — can also make the subject speak from a script you type, no recording needed.',
    chips: ['Photo → video', 'Can talk from a script'],
  },
}

// Generic inference for any other render-window model, so a newly added
// self-hosted model still gets sensible chips without a code change.
function inferChips(model) {
  const chips = []

  if (model.requires_image || model.supports_image) chips.push('Uses a photo')
  if (model.feature === 'text_to_video' && !model.requires_image) chips.push('Text → video')
  if ((model.feature || '').includes('video') || model.type === 'video') {
    if (model.requires_image || model.supports_image) chips.push('Photo → video')
  }
  if (model.requires_audio) chips.push('Syncs to audio')
  if (model.supports_text_script || model.requires_voice_id) chips.push('Can talk from a script')
  if (model.supports_video_input) chips.push('Can restyle a video')
  if (model.type === 'image' && !chips.length) chips.push('Creates images')

  return chips.length ? [...new Set(chips)] : ['Render-window model']
}

function inferBlurb(model, chips) {
  if (chips.includes('Can talk from a script') && chips.includes('Photo → video')) {
    return 'Turns a photo into video — can also make the subject speak from a script you type.'
  }
  if (chips.includes('Photo → video') && chips.includes('Syncs to audio')) {
    return 'Turns a photo into video and syncs it to audio you provide.'
  }
  if (chips.includes('Photo → video')) {
    return 'Brings a photo to life as a short video.'
  }
  if (chips.includes('Text → video')) {
    return 'Creates a video straight from your description.'
  }
  if (chips.includes('Can restyle a video')) {
    return 'Applies a new look to an existing video.'
  }
  if (model.type === 'image') {
    return model.description || 'Generates images from your prompt.'
  }
  return model.description || 'A render-window model available for private booking.'
}

/**
 * Returns { blurb, chips } for a model row (expects at least: value,
 * feature, type, requires_image, supports_image, requires_audio,
 * supports_text_script, requires_voice_id, supports_video_input,
 * description).
 */
export function getModelCapabilityCopy(model) {
  const known = KNOWN_MODEL_COPY[model.value]
  if (known) return known

  const chips = inferChips(model)
  const blurb = inferBlurb(model, chips)
  return { blurb, chips }
}
