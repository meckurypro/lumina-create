// src/hooks/usePromptTagging.js
import { useState, useRef, useCallback } from 'react'
import { getMentionMatch } from '@/lib/ugcMentions'

/**
 * Shared prompt-tagging behaviour for CreateImagePage / CreateVideoPage:
 *  - cursor-accurate manual tag insertion (insertAtCursor) for the [imgN]
 *    buttons under each reference thumbnail
 *  - "@" mention trigger → uploaded reference images
 *  - "/" mention trigger → saved UGC characters/brands, with brand drill-down
 *
 * Requires the page's Textarea to actually forward its ref (see the
 * Input.jsx forwardRef fix) — without that, textareaRef.current is null
 * and every insertion falls back to appending at the end of the prompt.
 */
export function usePromptTagging({ textareaRef, getPrompt, setPrompt }) {
  const lastSelectionRef = useRef({ start: 0, end: 0 })

  // { trigger: '@'|'/', query, start, view: 'root'|'brand', activeBrand }
  const [mention, setMention] = useState(null)

  const trackSelection = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    lastSelectionRef.current = { start: el.selectionStart, end: el.selectionEnd }
  }, [textareaRef])

  /** Used by the manual per-thumbnail [imgN] buttons. */
  const insertAtCursor = useCallback((text) => {
    const el = textareaRef.current
    const { start, end } = lastSelectionRef.current
    const prompt = getPrompt()
    const before = prompt.slice(0, start)
    const after  = prompt.slice(end)
    const needsSpace = before.length > 0 && !before.endsWith(' ')
    const inserted = `${needsSpace ? ' ' : ''}${text} `
    setPrompt(before + inserted + after)

    const cursor = start + inserted.length
    lastSelectionRef.current = { start: cursor, end: cursor }

    requestAnimationFrame(() => {
      if (el) { el.focus(); el.setSelectionRange(cursor, cursor) }
    })
  }, [textareaRef, getPrompt, setPrompt])

  /** Wire onto the textarea's onChange. */
  const handlePromptChange = useCallback((e) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart
    setPrompt(val)
    lastSelectionRef.current = { start: cursor, end: cursor }

    const match = getMentionMatch(val, cursor)
    if (!match) { setMention(null); return }
    setMention((prev) => ({
      trigger: match.trigger,
      query:   match.query,
      start:   match.start,
      view:        prev?.view === 'brand' && prev.trigger === match.trigger ? 'brand' : 'root',
      activeBrand: prev?.view === 'brand' && prev.trigger === match.trigger ? prev.activeBrand : null,
    }))
  }, [setPrompt])

  /** Replace the live "@query"/"/query" text with a final tag. */
  const resolveMention = useCallback((tag) => {
    const el = textareaRef.current
    if (!mention) return
    const prompt = getPrompt()
    const cursor = el ? el.selectionStart : prompt.length
    const before = prompt.slice(0, mention.start)
    const after  = prompt.slice(cursor)
    const needsSpace = before.length > 0 && !before.endsWith(' ')
    const inserted = `${needsSpace ? ' ' : ''}${tag} `
    setPrompt(before + inserted + after)
    setMention(null)

    const pos = before.length + inserted.length
    lastSelectionRef.current = { start: pos, end: pos }
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }, [mention, textareaRef, getPrompt, setPrompt])

  const drillIntoBrand = useCallback((brand) => {
    setMention((prev) => prev ? { ...prev, view: 'brand', activeBrand: brand } : prev)
  }, [])

  const backToRoot = useCallback(() => {
    setMention((prev) => prev ? { ...prev, view: 'root', activeBrand: null } : prev)
  }, [])

  const closeMention = useCallback(() => setMention(null), [])

  return {
    trackSelection, insertAtCursor, handlePromptChange,
    mention, resolveMention, drillIntoBrand, backToRoot, closeMention,
  }
}
