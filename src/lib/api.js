export async function callGenerate(action, payload = {}, onProgress) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
