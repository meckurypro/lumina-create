// src/pages/MusePage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, History, ArrowUp, Paperclip } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import ChatMessage        from '@/components/muse/ChatMessage'
import AttachmentPicker   from '@/components/muse/AttachmentPicker'
import MuseHistoryDrawer  from '@/components/muse/MuseHistoryDrawer'
import {
  getActiveSessionId,
  setActiveSessionId,
  clearActiveSessionId,
  sendMuseMessage,
  loadSessionMessages,
} from '@/lib/museChat'

const STARTER_PROMPTS = [
  'Turn a photo into a short video',
  'Make my product photo look cinematic',
  'Create a talking-head clip',
  'Copy the motion from a video onto my photo',
]

const MAX_TEXTAREA_HEIGHT = 200 // px — stops growing, scrolls internally past this

export default function MusePage() {
  const navigate                      = useNavigate()
  const { sessionId: routeSessionId } = useParams()
  const { user }                      = useAuth()

  const [sessionId, setSessionId]     = useState(null)
  const [messages, setMessages]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [sending, setSending]         = useState(false)
  const [input, setInput]             = useState('')
  const [pendingAttachments, setPendingAttachments] = useState([])
  const [showPicker, setShowPicker]   = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const scrollRef   = useRef(null)
  const textareaRef = useRef(null)

  // ── Resolve session on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    const resolve = async () => {
      setLoading(true)
      const targetId = routeSessionId || getActiveSessionId()

      if (targetId) {
        const { messages: history, error } = await loadSessionMessages(targetId)
        if (!error && history) {
          setSessionId(targetId)
          setActiveSessionId(targetId)
          setMessages(history)
          setLoading(false)
          return
        }
      }

      setSessionId(null)
      clearActiveSessionId()
      setMessages([])
      setLoading(false)
    }

    resolve()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, routeSessionId])

  // ── Auto-scroll on new messages ──────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // ── Auto-expanding textarea ───────────────────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [])

  useEffect(() => { resizeTextarea() }, [input, resizeTextarea])

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    const userMsg = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: trimmed,
      attachments: pendingAttachments,
      generation_id: null,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setPendingAttachments([])
    setSending(true)
    requestAnimationFrame(resizeTextarea)

    try {
      const { sessionId: newSessionId, reply, tool, generationId, error } =
        await sendMuseMessage({ sessionId, message: trimmed, attachments: pendingAttachments })

      if (error) {
        toast.error(error)
        setMessages((prev) => [...prev, {
          id: `err-${Date.now()}`, role: 'assistant',
          content: "Sorry — something went wrong on my end. Mind trying that again?",
          attachments: [], generation_id: null, created_at: new Date().toISOString(),
        }])
        return
      }

      if (!sessionId && newSessionId) {
        setSessionId(newSessionId)
        setActiveSessionId(newSessionId)
        navigate(`/muse/${newSessionId}`, { replace: true })
      }

      setMessages((prev) => [...prev, {
        id: `assist-${Date.now()}`,
        role: 'assistant',
        content: reply,
        attachments: [],
        generation_id: generationId,
        tool,
        created_at: new Date().toISOString(),
      }])
    } catch {
      toast.error('Muse is having trouble responding right now.')
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [input, sending, pendingAttachments, sessionId, navigate, resizeTextarea])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewChat = () => {
    clearActiveSessionId()
    setSessionId(null)
    setMessages([])
    setPendingAttachments([])
    setInput('')
    navigate('/muse', { replace: true })
  }

  const handleAttach = (attachment) => {
    setPendingAttachments((prev) => {
      if (prev.some((a) => a.asset_id === attachment.asset_id)) return prev
      const kind  = attachment.asset_type === 'video' ? 'Video' : 'Image'
      const count = prev.filter((a) => (a.asset_type === 'video' ? 'Video' : 'Image') === kind).length + 1
      return [...prev, { ...attachment, label: `${kind} ${count}` }]
    })
    setShowPicker(false)
  }

  const removeAttachment = (assetId) => {
    setPendingAttachments((prev) => prev.filter((a) => a.asset_id !== assetId))
  }

  const handleSelectSession = (pickedId) => {
    setShowHistory(false)
    navigate(`/muse/${pickedId}`)
  }

  const isEmpty = !loading && messages.length === 0

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Header ── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
      >
        <button
          onClick={() => navigate('/feed')}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-elevated)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-2">
          <img src="/icon.png" alt="" className="w-6 h-6 rounded-lg object-contain logo-icon" />
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Muse</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Chat history"
          >
            <History size={19} />
          </button>
          <button
            onClick={handleNewChat}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="New chat"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      {isEmpty ? (
        // ── EMPTY STATE — centered, no bubble, no fake first message ──────
        <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-10">
          <motion.h1
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-[26px] font-black text-center mb-8"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
          >
            What will we <span className="brand-gradient-text">direct</span> today?
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
            className="w-full max-w-[560px]"
          >
            <Composer
              input={input} setInput={setInput}
              onSend={handleSend} onKeyDown={handleKeyDown}
              sending={sending}
              pendingAttachments={pendingAttachments}
              removeAttachment={removeAttachment}
              onOpenPicker={() => setShowPicker(true)}
              textareaRef={textareaRef}
            />

            <div className="flex flex-col gap-2 mt-5">
              {STARTER_PROMPTS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); requestAnimationFrame(() => textareaRef.current?.focus()) }}
                  className="text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all active:scale-[0.98] hover:border-[var(--brand)]"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      ) : (
        <>
          {/* ── Message list ── */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto w-full flex flex-col gap-5" style={{ maxWidth: 720 }}>
              {loading ? (
                <div className="flex flex-col gap-3 pt-8">
                  {[0, 1].map((i) => (
                    <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
                  ))}
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChatMessage message={msg} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}

              {sending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 px-1">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: 'var(--text-muted)' }}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.15 }}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          </div>

          {/* ── Composer, docked bottom ── */}
          <div
            className="flex-shrink-0 px-4 py-3"
            style={{ borderTop: '1px solid var(--border-color)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
              <Composer
                input={input} setInput={setInput}
                onSend={handleSend} onKeyDown={handleKeyDown}
                sending={sending}
                pendingAttachments={pendingAttachments}
                removeAttachment={removeAttachment}
                onOpenPicker={() => setShowPicker(true)}
                textareaRef={textareaRef}
              />
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {showPicker && (
          <AttachmentPicker onSelect={handleAttach} onClose={() => setShowPicker(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHistory && (
          <MuseHistoryDrawer
            activeSessionId={sessionId}
            onSelect={handleSelectSession}
            onClose={() => setShowHistory(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Composer — shared between empty-state (centered) and docked (bottom)
// placements. Auto-expanding textarea, attachment chips inside the same
// shell, rounded pill that grows into a rounded rect as content grows —
// matches the Claude/ChatGPT/Perplexity composer anatomy: attachment
// button, multiline input, submit button, all in one visually unified card.
// ─────────────────────────────────────────────────────────────────────────
function Composer({
  input, setInput, onSend, onKeyDown, sending,
  pendingAttachments, removeAttachment, onOpenPicker, textareaRef,
}) {
  return (
    <div
      className="rounded-[26px] transition-shadow focus-within:shadow-[0_0_0_3px_var(--brand-light)]"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* Attachment chips */}
      {pendingAttachments.length > 0 && (
        <div className="flex gap-2 flex-wrap px-3 pt-3">
          {pendingAttachments.map((a) => (
            <div
              key={a.asset_id}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            >
              <img src={a.thumbnail_url} alt={a.label} className="w-7 h-7 rounded-lg object-cover" />
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
              <button onClick={() => removeAttachment(a.asset_id)} style={{ color: 'var(--text-muted)' }}>
                <span className="text-sm leading-none">×</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 px-3 py-2.5">
        <button
          onClick={onOpenPicker}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 transition-colors hover:bg-[var(--bg-elevated)]"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Attach"
        >
          <Paperclip size={17} />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tell Muse what you want to make…"
          rows={1}
          className="flex-1 bg-transparent text-[15px] outline-none resize-none leading-relaxed py-1.5"
          style={{ color: 'var(--text-primary)', maxHeight: MAX_TEXTAREA_HEIGHT }}
        />

        <button
          onClick={onSend}
          disabled={!input.trim() || sending}
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 transition-all active:scale-90 disabled:opacity-30"
          style={{ background: input.trim() ? 'var(--gradient-brand)' : 'var(--bg-elevated)', boxShadow: input.trim() ? 'var(--shadow-brand)' : 'none' }}
          aria-label="Send"
        >
          <ArrowUp size={16} color={input.trim() ? '#fff' : 'var(--text-muted)'} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
