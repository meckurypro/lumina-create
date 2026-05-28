// src/templates/face-swap.js
export default {
  slug:            'face-swap',
  promptKey:       'face-swap',
  modelSelectable: false,
  // lockedModel is the DEFAULT — TemplateRunner overrides this per selectedMode.
  // face_swap  → akool/image-face-swap  (face only, native skin tone matching)
  // head_swap  → wavespeed-ai/image-head-swap  (face + hair + silhouette)
  lockedModel:     'face_swap',
  creditCost:      22,

  inputs: [
    {
      key:      'reference_image',
      label:    'Your Photo',
      hint:     'The photo whose body, outfit, and pose you want to keep',
      type:     'image',
      required: true,
    },
    {
      key:      'face_image',
      label:    'Face to Use',
      hint:     'Clear, front-facing photo of the face to transplant',
      type:     'image',
      required: true,
    },
  ],

  // Mode drives model selection in TemplateRunner.
  // key must match a valid model key in MODEL_CONFIGS on the backend.
  modes: [
    {
      key:         'face_swap',
      label:       'Face Swap',
      description: 'Transplants the face only. Body, hair, and outfit stay the same.',
      modelKey:    'face_swap',
    },
    {
      key:         'head_swap',
      label:       'Head Swap',
      description: 'Replaces the full head — face, hair, and silhouette.',
      modelKey:    'head_swap',
    },
  ],
}
