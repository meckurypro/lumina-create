export default {
  slug: 'memory-lane',
  name: 'Memory Lane',
  category: 'memories',
  visibility: 'public',
  description: 'Turn photos into a warm cinematic memory journey.',
  instructions: `Upload 3–20 photos in the order you want them to appear.

Tips for best results:
• Mix wide and close-up shots
• Use clear, bright photos
• Keep the story chronological`,
  inputs: [{ key: 'photos', type: 'multi-image', label: 'Photos', hint: '3–20 images', required: true }],
  editableFields: [{ key: 'prompt', type: 'textarea', label: 'Memory Prompt', hint: 'Core style instruction.' }],
  defaultPrompt: 'A heartfelt cinematic memory lane video montage with gentle camera movement, soft transitions, warm color grading, emotional pacing, and elegant African storytelling sensibility.',
  creditCostPerImage: 1,
  minImages: 3,
  maxImages: 20,
}
