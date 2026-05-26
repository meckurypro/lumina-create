// src/templates/_base.js
// Reference only — not imported anywhere. Copy this when creating a new template.

export default {
  // ── Identity ─────────────────────────────────────────────
  slug: '',              // matches DB templates.slug
  promptKey: '',         // matches DB templates.prompt_key

  // ── Model ────────────────────────────────────────────────
  modelSelectable: true, // false = admin sets model, user cannot change
  lockedModel: null,     // ai_model enum value — only used when modelSelectable is false

  // ── System prompt (never goes to DB) ─────────────────────
  systemPrompt: ``,

  // ── User inputs ──────────────────────────────────────────
  inputs: [
    // {
    //   key:      '',               // unique field key
    //   label:    '',               // shown to user
    //   hint:     '',               // sub-label / helper text
    //   type:     'image' | 'text' | 'select',
    //   required: true | false,
    //   options:  [],               // only for type: 'select'
    // }
  ],

  // ── Modes (optional) ─────────────────────────────────────
  // Omit entirely if template has no modes
  modes: [
    // {
    //   key:           '',   // used in buildPrompt()
    //   label:         '',   // shown to user
    //   description:   '',   // sub-label shown to user
    //   prompt_suffix: ``,   // injected into {{mode_suffix}} in DB prompt
    // }
  ],
}
