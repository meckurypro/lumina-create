import { callGenerate } from '@/lib/api'

const run = async (action, payload, outputType, onProgress) => {
  try {
    const result = await callGenerate(action, payload, onProgress)
    return { outputUrl: result.outputUrl, outputType: result.outputType || outputType, error: null }
  } catch (error) {
    return { outputUrl: null, outputType, error: error.message }
  }
}

export const uploadImage = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/upload', { method: 'POST', body: formData })
  if (!response.ok) return { url: null, error: 'Upload failed' }
  const { url } = await response.json()
  return { url, error: null }
}

export const textToImage = ({ prompt, aspectRatio = '9:16', model = 'imagen_3_fast', onProgress }) => run('text_to_image', { prompt, aspectRatio, model }, 'image', onProgress)
export const imageToImage = ({ prompt, imageUrl, strength = 0.8, onProgress }) => run('image_to_image', { prompt, imageUrl, strength }, 'image', onProgress)
export const textToVideo = ({ prompt, aspectRatio = '9:16', duration = '5', model = 'kling_2_5', onProgress }) => run('text_to_video', { prompt, aspectRatio, duration, model }, 'video', onProgress)
export const imageToVideo = ({ prompt, imageUrl, aspectRatio = '9:16', duration = '5', model = 'kling_2_5', onProgress }) => run('image_to_video', { prompt, imageUrl, aspectRatio, duration, model }, 'video', onProgress)
export const startEndFrameToVideo = ({ prompt, startFrameUrl, endFrameUrl, aspectRatio = '9:16', duration = '5', model = 'kling_2_5', onProgress }) => run('start_end_frame', { prompt, startFrameUrl, endFrameUrl, aspectRatio, duration, model }, 'video', onProgress)
export const endFrameToVideo = ({ prompt, endFrameUrl, aspectRatio = '9:16', duration = '5', onProgress }) => run('end_frame_text', { prompt, endFrameUrl, aspectRatio, duration }, 'video', onProgress)
export const officeHandoverTemplate = ({ startFrameUrl, endFrameUrl, aspectRatio = '9:16', duration = '5', model = 'kling_2_5', onProgress }) => run('template_office_handover', { startFrameUrl, endFrameUrl, aspectRatio, duration, model }, 'video', onProgress)
export const memoryLaneTemplate = ({ imageUrls, aspectRatio = '9:16', duration = '5', onProgress }) => run('template_memory_lane', { imageUrls, aspectRatio, duration }, 'video', onProgress)
