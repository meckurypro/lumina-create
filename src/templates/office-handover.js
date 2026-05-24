export default {
  slug: 'office-handover',
  name: 'Office Handover',
  category: 'handover',
  visibility: 'promptiq',
  description: 'Cinematic leadership transition — outgoing person hands over to incoming.',
  instructions: `Upload a clear portrait photo of the OUTGOING person as the Start Frame.
Upload a clear portrait photo of the INCOMING person as the End Frame.

Tips for best results:
• Head and shoulders framing
• Neutral or office background
• Good lighting
• Similar framing in both photos`,
  inputs: [
    { key: 'startFrame', type: 'image', label: 'Start Frame', hint: 'The outgoing person', required: true },
    { key: 'endFrame', type: 'image', label: 'End Frame', hint: 'The incoming person', required: true },
  ],
  editableFields: [
    { key: 'prompt', type: 'textarea', label: 'Transition Prompt', hint: 'Core instruction used for generation.' },
    { key: 'bgMusic', type: 'file', label: 'Background Music', hint: 'Optional audio asset.' },
  ],
  defaultPrompt: 'A cinematic office handover scene. The outgoing leader formally hands over authority to the incoming leader in a modern African executive office. Smooth camera movement, respectful tone, warm lighting, premium documentary style.',
  creditCost: 2,
  minImages: 2,
  maxImages: 2,
}
