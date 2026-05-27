export default {
  slug:            'face-swap',
  promptKey:       'face-swap',
  modelSelectable: false,
  lockedModel:     'face_swap',
  creditCost:      22,
  inputs: [
    {
      key:      'reference_image',
      label:    'Reference Image',
      hint:     'The photo whose scene, outfit, and pose you want to keep',
      type:     'image',
      required: true,
    },
    {
      key:      'face_image',
      label:    'Face Image',
      hint:     'Clear front-facing photo of the face to transplant',
      type:     'image',
      required: true,
    },
  ],
}
