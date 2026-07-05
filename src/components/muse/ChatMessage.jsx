// src/components/muse/ChatMessage.jsx
import GenerationCard from './GenerationCard'

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>

        {/* Attachment chips — shown on user messages that included assets */}
        {message.attachments?.length > 0 && (
          <div className="flex gap-2 flex-wrap justify-end">
            {message.attachments.map((a) => (
              <div
                key={a.asset_id}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
              >
                <img src={a.thumbnail_url} alt={a.label} className="w-7 h-7 rounded-lg object-cover" />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  {a.label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Text bubble */}
        {message.content && (
          <div
            className="rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              background: isUser ? 'var(--brand)' : 'var(--bg-card)',
              color:      isUser ? '#fff' : 'var(--text-primary)',
              border:     isUser ? 'none' : '1px solid var(--border-color)',
            }}
          >
            {message.content}
          </div>
        )}

        {/* Proposal card — Muse proposed a generation, awaiting confirmation */}
        {message.tool?.kind === 'proposal' && (
          <div
            className="rounded-2xl px-4 py-3 flex flex-col gap-1.5 max-w-full"
            style={{ background: 'var(--brand-light)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand)' }}>
              Ready when you are
            </p>
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              {message.tool.summary}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              ~{message.tool.estimated_credits} credits · {message.tool.model_value}
            </p>
          </div>
        )}

        {/* Generation in progress — bound to the actual generations row */}
        {message.generation_id && (
          <GenerationCard generationId={message.generation_id} />
        )}

        {/* Execution error surfaced inline instead of just a toast */}
        {message.tool?.kind === 'executing' && message.tool.error && (
          <div
            className="rounded-2xl px-4 py-2.5 text-sm"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            {message.tool.error}
          </div>
        )}
      </div>
    </div>
  )
}
