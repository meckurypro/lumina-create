// src/lib/museChat.js
import { supabase } from '@/lib/supabase'

const ACTIVE_SESSION_KEY = 'meckury_muse_active_session'

// ── sessionStorage helpers ──────────────────────────────────────────────────
// sessionStorage (not localStorage) is deliberate: it survives in-tab
// navigation and refresh, but clears when the tab/PWA actually closes —
// which is exactly the "resume if still open, fresh if reopened" behavior
// ChatGPT/Gemini use.

export function getActiveSessionId() {
  try { return sessionStorage.getItem(ACTIVE_SESSION_KEY) } catch { return null }
}

export function setActiveSessionId(id) {
  try { sessionStorage.setItem(ACTIVE_SESSION_KEY, id) } catch {}
}

export function clearActiveSessionId() {
  try { sessionStorage.removeItem(ACTIVE_SESSION_KEY) } catch {}
}

// ── Load a session's message history ────────────────────────────────────────
export async function loadSessionMessages(sessionId) {
  const { data, error } = await supabase
    .from('ai_chat_messages')
    .select('id, role, content, attachments, generation_id, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return { messages: null, error: error.message }
  return { messages: data || [], error: null }
}

// ── List past sessions (for the history drawer) ─────────────────────────────
export async function listMuseSessions() {
  const { data, error } = await supabase
    .from('ai_chat_sessions')
    .select('id, title, last_message_at, created_at')
    .order('last_message_at', { ascending: false })
    .limit(50)

  if (error) return { sessions: [], error: error.message }
  return { sessions: data || [], error: null }
}

// ── Send a message to Muse ───────────────────────────────────────────────────
export async function sendMuseMessage({ sessionId, message, attachments = [] }) {
  try {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        sessionId: sessionId || undefined,
        message,
        attachments: attachments.map((a) => ({
          asset_id:      a.asset_id,
          label:         a.label,
          thumbnail_url: a.thumbnail_url,
        })),
      },
    })

    if (error) {
      // Edge function returned non-2xx — try to surface its message body
      const msg = error.context?.body
        ? (await tryParseErrorBody(error.context.body))
        : error.message
      return { sessionId: null, reply: null, tool: null, generationId: null, error: msg }
    }

    if (data?.error) {
      return { sessionId: data.sessionId ?? null, reply: null, tool: null, generationId: null, error: data.error }
    }

    return {
      sessionId:    data.sessionId,
      reply:        data.reply,
      tool:         data.tool,
      generationId: data.generationId,
      error:        null,
    }
  } catch (err) {
    return { sessionId: null, reply: null, tool: null, generationId: null, error: err.message || 'Muse is unavailable right now' }
  }
}

async function tryParseErrorBody(body) {
  try {
    const text = typeof body === 'string' ? body : await new Response(body).text()
    const parsed = JSON.parse(text)
    return parsed?.error || 'Something went wrong'
  } catch {
    return 'Something went wrong'
  }
}
