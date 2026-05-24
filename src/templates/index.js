import officeHandover from './office-handover'
import memoryLane from './memory-lane'

const REGISTRY = {
  [officeHandover.slug]: officeHandover,
  [memoryLane.slug]: memoryLane,
}

export const getTemplate = (slug) => REGISTRY[slug] ?? null
export const getAllTemplates = () => Object.values(REGISTRY)
export const getTemplatesByVisibility = (visibility) => Object.values(REGISTRY).filter((t) => t.visibility === visibility)
export default REGISTRY
