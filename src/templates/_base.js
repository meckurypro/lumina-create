// src/templates/_base.js
// Reference only — not imported anywhere

export default {
  slug: '',           // matches DB slug
  promptKey: '',      // matches DB prompt_key

  systemPrompt: ``,   // engineering logic — never goes to DB

  inputs: [
    // { key, label, hint, type: 'image' | 'text' | 'select', required, options? }
  ],

  modes: [
    // { key, label, description, prompt_suffix }
    // optional — omit if template has no modes
  ],
}
