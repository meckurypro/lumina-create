// src/templates/index.js

import faceSwap from './face-swap'

export const templates = {
  'face-swap': faceSwap,
}

export function getTemplate(promptKey) {
  return templates[promptKey] || null
}
