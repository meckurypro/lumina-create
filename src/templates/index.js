// src/templates/index.js

import faceSwap from './face-swap'

export const templates = {
  'face-swap': faceSwap,
}

/**
 * Look up a template by its prompt_key
 */
export function getTemplate(promptKey) {
  return templates[promptKey] || null
}

/**
 * Assemble the final generation prompt from DB prompt + mode
 */
export function buildPrompt(dbPromptText, template, modeKey) {
  if (!template.modes || template.modes.length === 0) {
    return dbPromptText
  }
  const mode = template.modes.find((m) => m.key === modeKey)
  if (!mode) return dbPromptText
  return dbPromptText.replace('{{mode_suffix}}', mode.prompt_suffix)
}
