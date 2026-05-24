// REPLACE WITH YOUR FULL src/templates/index.js
// Stub registry so the build doesn't break.
const templates = {}
export const getTemplate = (slug) => templates[slug]
export const listTemplates = () => Object.values(templates)
export default templates
