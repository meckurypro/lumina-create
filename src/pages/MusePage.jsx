// src/pages/MusePage.jsx
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, History, Send, Paperclip, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
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

const GREETING = "Hey! I'm Muse. Tell me what you want to make — an image, a video, someone talking, whatever's in your head — and I'll help you get there. What are we creating today?"

export default function MusePage() {
  const navigate                    = useNavigate()
  const { sessionId: routeSessionId } = useParams()
  const { user }                    = useAuth()

  const [sessionId, setSessionId]   = useState(null)
  const [messages, setMessages]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [sending, setSending]       = useState(false)
  const [input, setInput]           = useState('')
  const [pendingAttachments, setPendingAttachments] = useState([]) // [{asset_id, label, thumbnail_url}]
  const [showPicker, setShowPicker] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const scrollRef  = useRef(null)
  const inputRef   = useRef(null)

  // ── Resolve session on mount ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    const resolve = async () => {
      setLoading(true)

      // Route param wins (deep link / history pick) — else fall back to
      // the active session in sessionStorage, else start fresh.
      const targetId = routeSessionId || getActiveSessionId()

      if (targetId) {
        const { messages: history, error } = await loadSessionMessages(targetId)
        if (!error && history) {
          setSessionId(targetId)
          setActiveSessionId(targetId)
          setMessages(history.length > 0 ? history : [greetingMessage()])
          setLoading(false)
          return
        }
      }

      // Nothing to resume — brand new session, greet immediately.
      // Session row itself gets created lazily on first real send.
      setSessionId(null)
      clearActiveSessionId()
      setMessages([greetingMessage()])
      setLoading(false)
    }

    resolve()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, routeSessionId])

  const greetingMessage = () => ({
    id: 'greeting',
    role: 'assistant',
    content: GREETING,
    attachments: [],
    generation_id: null,
    created_at: new Date().toISOString(),
  })

  // ── Auto-scroll on new messages ──────────────────────────────────────────
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

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
        // Reflect the real session in the URL without a full navigation
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
    } catch (err) {
      toast.error('Muse is having trouble responding right now.')
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }, [input, sending, pendingAttachments, sessionId, navigate])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── New chat ──────────────────────────────────────────────────────────────
  const handleNewChat = () => {
    clearActiveSessionId()
    setSessionId(null)
    setMessages([greetingMessage()])
    setPendingAttachments([])
    setInput('')
    navigate('/muse', { replace: true })
  }

  // ── Attachment handling ──────────────────────────────────────────────────
  const handleAttach = (attachment) => {
    setPendingAttachments((prev) => {
      if (prev.some((a) => a.asset_id === attachment.asset_id)) return prev
      const label = `Image ${prev.length + 1}`
      return [...prev, { ...attachment, label }]
    })
    setShowPicker(false)
  }

  const removeAttachment = (assetId) => {
    setPendingAttachments((prev) =>
      prev.filter((a) => a.asset_id !== assetId).map((a, i) => ({ ...a, label: `Image ${i + 1}` })),
    )
  }

  // ── History pick ──────────────────────────────────────────────────────────
  const handleSelectSession = (pickedId) => {
    setShowHistory(false)
    navigate(`/muse/${pickedId}`)
  }

  return (
    <div className="h-dvh w-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Header — minimal, no BottomNav/TopBar, matches Filma's full-screen pattern ── */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-primary)' }}
      >
        <button
          onClick={() => navigate('/feed')}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--brand-light)' }}
          >
            <Sparkles size={14} style={{ color: 'var(--brand)' }} />
          </div>
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Muse</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowHistory(true)}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Chat history"
          >
            <History size={19} />
          </button>
          <button
            onClick={handleNewChat}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="New chat"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      {/* ── Message list ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-xl flex flex-col gap-4">
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-1">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'var(--text-muted)' }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1.1, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── Pending attachment chips ── */}
      {pendingAttachments.length > 0 && (
        <div className="flex-shrink-0 px-4 pb-2">
          <div className="mx-auto w-full max-w-xl flex gap-2 overflow-x-auto no-scrollbar">
            {pendingAttachments.map((a) => (
              <div
                key={a.asset_id}
                className="flex-shrink-0 flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
              >
                <img
                  src={a.thumbnail_url}
                  alt={a.label}
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{a.label}</span>
                <button onClick={() => removeAttachment(a.asset_id)} style={{ color: 'var(--text-muted)' }}>
                  <span className="text-sm leading-none">×</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: '1px solid var(--border-color)', paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto w-full max-w-xl flex items-end gap-2">
          <button
            onClick={() => setShowPicker(true)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            aria-label="Attach"
          >
            <Paperclip size={18} />
          </button>

          <div
            className="flex-1 rounded-2xl px-4 py-2.5 flex items-center"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tell Muse what you want to make…"
              rows={1}
              className="flex-1 bg-transparent text-sm outline-none resize-none max-h-24"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
            style={{ background: 'var(--brand)' }}
            aria-label="Send"
          >
            <Send size={16} color="#fff" />
          </button>
        </div>
      </div>

      {/* ── Attachment picker (upload or browse Assets) ── */}
      <AnimatePresence>
        {showPicker && (
          <AttachmentPicker
            onSelect={handleAttach}
            onClose={() => setShowPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* ── History drawer ── */}
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
