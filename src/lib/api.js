import { supabase } from './supabase'

export async function callGenerate(action, payload = {}, onProgress) {
  const { data: { session } } = await supabase.auth.getSession()
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID
  const url = `https://${projectId}.supabase.co/functions/v1/generate`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.error || `API error ${response.status}`)
  }
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('text/event-stream') && response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result = null
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      for (const line of decoder.decode(value).split('\n').filter(Boolean)) {
        if (!line.startsWith('data:')) continue
        const parsed = JSON.parse(line.slice(5).trim())
        if (parsed.done) result = parsed.result
        else onProgress?.(parsed)
      }
    }
    return result
  }
  return response.json()
}
