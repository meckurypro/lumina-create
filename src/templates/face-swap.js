// src/templates/face-swap.js

export default {
  slug: 'face-swap',
  promptKey: 'face-swap',

  systemPrompt: `You are a photorealistic face transplant engine. Your sole function is to place the identity from the FACE IMAGE onto the REFERENCE IMAGE with surgical precision. You are not a creative tool. You do not invent. You transplant.

FACE IMAGE — extract only: facial bone structure, eye shape and color, nose shape, lip shape, skin tone, skin texture, brow shape. Nothing else leaves this image.

REFERENCE IMAGE — preserve absolutely: scene, environment, lighting direction, lighting color temperature, shadows, background, outfit, fabric texture, accessories, pose, body position, hand placement, camera angle, depth of field, grain, color grading. This image is a container. You fill the face. You touch nothing else.

EXECUTION RULES:
- Remap the extracted face identity onto the head in the REFERENCE IMAGE with anatomical accuracy
- Match facial skin tone to the neck and any exposed skin in the REFERENCE IMAGE using seamless blending
- Preserve the hair from the REFERENCE IMAGE unless it physically occludes the transplanted face, in which case blend minimally and restore
- Lighting on the transplanted face must match the light source direction, intensity, and color temperature of the REFERENCE IMAGE exactly
- No beautification. No smoothing. No creative reinterpretation. Pixel-faithful output
- Output must be indistinguishable from a photograph of the FACE IMAGE person actually present in the REFERENCE IMAGE scene`,

  inputs: [
    {
      key: 'reference_image',
      label: 'Reference Image',
      hint: 'The image you want to copy — scene, outfit, pose, everything',
      type: 'image',
      required: true,
    },
    {
      key: 'face_image',
      label: 'Face Image',
      hint: 'Clear front-facing photo of the face to transplant',
      type: 'image',
      required: true,
    },
  ],

  modes: [
    {
      key: 'precise',
      label: 'Precise',
      description: 'Pixel-perfect copy. Only the face changes.',
      prompt_suffix: `Strict mode. Zero deviation from reference. Face transplant only. Every pixel outside the facial region is untouched.`,
    },
    {
      key: 'enhanced',
      label: 'Enhanced',
      description: 'AI refines and elevates — same scene, better result.',
      prompt_suffix: `Enhancement mode. The face transplant is the primary operation. Secondary: elevate the overall image — tighten composition, enhance lighting coherence, refine fabric and skin detail, improve background sharpness where appropriate. Changes must feel like a better photograph of the same scene, not a different scene. No costume changes. No location changes. Push toward perfection within the frame that exists.`,
    },
  ],
}
