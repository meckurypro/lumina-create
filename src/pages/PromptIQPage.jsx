export default function PromptIQPage({ onClose }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <h1 className="text-2xl font-bold mb-2">PromptIQ</h1>
      <p className="opacity-60 mb-4">Coming soon.</p>
      <button onClick={onClose} className="rounded-xl px-4 py-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>Close</button>
    </div>
  )
}
