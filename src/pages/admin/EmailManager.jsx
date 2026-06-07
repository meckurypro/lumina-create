// src/pages/admin/EmailManager.jsx
// Full email campaign manager for Meckury AI admin panel
// Sections: SMTP Settings · Compose · Recipients · Schedule · Campaign History

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Settings, Send, Users, Clock, Calendar,
  Plus, X, Search, ChevronDown, ChevronUp, Upload,
  Eye, Trash2, RefreshCw, CheckCircle, AlertCircle,
  Repeat, Paperclip, Save, TestTube, Copy, MoreVertical,
  Zap, Crown, User, Globe, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── Design tokens (matches Meckury admin dark UI) ────────────
const B  = 'var(--brand)'          // orange/pink accent
const BG = 'var(--bg-card)'
const BGE = 'var(--bg-elevated)'
const BC = 'var(--border-color)'
const TP = 'var(--text-primary)'
const TM = 'var(--text-muted)'
const TS = 'var(--text-secondary)'

// ─── Helpers ──────────────────────────────────────────────────
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TIERS = [
  { value: 'all',     label: 'All Users',     icon: Globe,  color: '#06b6d4' },
  { value: 'novice',  label: 'All Novices',   icon: User,   color: '#8b5cf6' },
  { value: 'master',  label: 'All Masters',   icon: Crown,  color: '#eab308' },
  { value: 'custom',  label: 'Custom List',   icon: Users,  color: B         },
]

const SEND_MODES = [
  { value: 'now',       label: 'Send Now'    },
  { value: 'scheduled', label: 'Schedule'    },
  { value: 'recurring', label: 'Recurring'   },
]

// ─── Sub-components ───────────────────────────────────────────

const Label = ({ children, required }) => (
  <p className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: TM }}>
    {children}{required && <span style={{ color: B }}> *</span>}
  </p>
)

const Field = ({ label, required, children, hint }) => (
  <div className="mb-4">
    {label && <Label required={required}>{label}</Label>}
    {children}
    {hint && <p className="text-xs mt-1" style={{ color: TM }}>{hint}</p>}
  </div>
)

const Input = ({ ...props }) => (
  <input
    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
    style={{ background: BGE, border: `1px solid ${BC}`, color: TP, fontFamily: 'inherit' }}
    {...props}
  />
)

const Toggle = ({ value, onChange, label }) => (
  <button
    onClick={() => onChange(!value)}
    className="flex items-center gap-2 text-sm font-medium"
    style={{ color: value ? B : TM }}
  >
    {value
      ? <ToggleRight size={22} style={{ color: B }} />
      : <ToggleLeft  size={22} style={{ color: TM }} />
    }
    {label}
  </button>
)

const Badge = ({ children, color = B }) => (
  <span
    className="text-xs px-2 py-0.5 rounded-full font-semibold"
    style={{ background: `${color}20`, color }}
  >
    {children}
  </span>
)

const SectionCard = ({ title, icon: Icon, iconColor = B, children, collapsible = false, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ background: BG, border: `1px solid ${BC}` }}>
      <button
        className="w-full flex items-center justify-between px-4 py-3.5"
        onClick={() => collapsible && setOpen(!open)}
        style={{ cursor: collapsible ? 'pointer' : 'default' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${iconColor}18` }}>
            <Icon size={14} style={{ color: iconColor }} />
          </div>
          <span className="text-sm font-bold" style={{ color: TP }}>{title}</span>
        </div>
        {collapsible && (
          open ? <ChevronUp size={15} style={{ color: TM }} /> : <ChevronDown size={15} style={{ color: TM }} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4" style={{ borderTop: `1px solid ${BC}` }}>
              <div className="pt-3">{children}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── SMTP Settings Panel ───────────────────────────────────────
const SmtpSettings = ({ onSaved }) => {
  const [form, setForm] = useState({ host: '', port: '587', user: '', pass: '', from_name: '', from_email: '', secure: false })
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { loadSettings() }, [])

  const loadSettings = async () => {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'smtp_config').single()
    if (data?.value) {
      setForm((prev) => ({ ...prev, ...data.value, pass: '' })) // never show saved pass
    }
    setLoaded(true)
  }

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }))

  const handleSave = async () => {
    if (!form.host || !form.user || !form.from_email) { toast.error('Host, user and from email are required'); return }
    setLoading(true)
    try {
      const payload = { ...form }
      if (!payload.pass) delete payload.pass // don't overwrite saved pass with empty
      const { error } = await supabase.from('app_settings').upsert({ key: 'smtp_config', value: payload }, { onConflict: 'key' })
      if (error) throw error
      toast.success('SMTP settings saved')
      onSaved?.()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTest = async () => {
    setTestLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('email-send', {
        body: { action: 'test_smtp' },
      })
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Test failed')
      toast.success('Test email sent! Check your inbox.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setTestLoading(false)
    }
  }

  if (!loaded) return <div className="py-4 flex justify-center"><RefreshCw size={16} style={{ color: TM }} className="animate-spin" /></div>

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="SMTP Host" required>
          <Input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.resend.com" />
        </Field>
        <Field label="Port">
          <Input value={form.port} onChange={(e) => set('port', e.target.value)} placeholder="587" type="number" />
        </Field>
      </div>
      <Field label="SMTP Username" required>
        <Input value={form.user} onChange={(e) => set('user', e.target.value)} placeholder="apikey" />
      </Field>
      <Field label="SMTP Password" hint="Leave blank to keep the previously saved password">
        <Input value={form.pass} onChange={(e) => set('pass', e.target.value)} type="password" placeholder="••••••••" />
      </Field>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Field label="From Name" required>
          <Input value={form.from_name} onChange={(e) => set('from_name', e.target.value)} placeholder="Meckury AI" />
        </Field>
        <Field label="From Email" required>
          <Input value={form.from_email} onChange={(e) => set('from_email', e.target.value)} placeholder="hello@meckury.ai" />
        </Field>
      </div>
      <div className="mb-4">
        <Toggle value={form.secure} onChange={(v) => set('secure', v)} label="Use TLS/SSL (port 465)" />
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave} disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all"
          style={{ background: B, color: '#fff', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Save Settings
        </button>
        <button
          onClick={handleTest} disabled={testLoading}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{ background: BGE, color: TS, border: `1px solid ${BC}` }}
        >
          {testLoading ? <RefreshCw size={14} className="animate-spin" /> : <TestTube size={14} />}
          Test
        </button>
      </div>
    </div>
  )
}

// ─── Recipient Picker ──────────────────────────────────────────
const RecipientPicker = ({ tier, onTierChange, customList, onCustomListChange }) => {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState([])
  const [searching, setSearching] = useState(false)

  const searchUsers = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, email:id')
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(10)
    // Also search by email via auth.users join — use edge fn
    setResults(data || [])
    setSearching(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchUsers(query), 350)
    return () => clearTimeout(t)
  }, [query])

  const addUser = (u) => {
    if (customList.find((x) => x.id === u.id)) return
    onCustomListChange([...customList, u])
    setQuery('')
    setResults([])
  }

  const removeUser = (id) => onCustomListChange(customList.filter((u) => u.id !== id))

  return (
    <div>
      {/* Tier chips */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {TIERS.map((t) => (
          <button
            key={t.value}
            onClick={() => onTierChange(t.value)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: tier === t.value ? `${t.color}18` : BGE,
              border:     `1.5px solid ${tier === t.value ? t.color : BC}`,
              color:      tier === t.value ? t.color : TM,
            }}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Custom search — only shown when custom tier selected */}
      <AnimatePresence>
        {tier === 'custom' && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2"
              style={{ background: BGE, border: `1px solid ${BC}` }}
            >
              <Search size={13} style={{ color: TM, flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username or name…"
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: TP }}
              />
              {searching && <RefreshCw size={12} style={{ color: TM }} className="animate-spin" />}
            </div>

            {/* Search results */}
            <AnimatePresence>
              {results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="rounded-xl overflow-hidden mb-3"
                  style={{ border: `1px solid ${BC}` }}
                >
                  {results.map((u, i) => (
                    <button
                      key={u.id}
                      onClick={() => addUser(u)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all"
                      style={{
                        background: BGE,
                        borderTop: i > 0 ? `1px solid ${BC}` : 'none',
                      }}
                    >
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${B}20` }}>
                        <User size={12} style={{ color: B }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: TP }}>{u.display_name || u.username}</p>
                        <p className="text-xs truncate" style={{ color: TM }}>@{u.username}</p>
                      </div>
                      <Plus size={13} style={{ color: B }} />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Custom list chips */}
            {customList.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {customList.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold"
                    style={{ background: `${B}18`, color: B }}
                  >
                    {u.display_name || u.username}
                    <button onClick={() => removeUser(u.id)}><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Schedule Panel ────────────────────────────────────────────
const SchedulePanel = ({ sendMode, onSendModeChange, scheduleData, onScheduleChange }) => {
  const set = (k, v) => onScheduleChange({ ...scheduleData, [k]: v })

  return (
    <div>
      {/* Send mode */}
      <div className="flex gap-1.5 p-1 rounded-xl mb-4" style={{ background: BGE }}>
        {SEND_MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => onSendModeChange(m.value)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: sendMode === m.value ? BG : 'transparent',
              color:      sendMode === m.value ? TP : TM,
              boxShadow:  sendMode === m.value ? 'var(--shadow)' : 'none',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {sendMode === 'scheduled' && (
          <motion.div key="scheduled" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date">
                <Input type="date" value={scheduleData.date || ''} onChange={(e) => set('date', e.target.value)} />
              </Field>
              <Field label="Time">
                <Input type="time" value={scheduleData.time || ''} onChange={(e) => set('time', e.target.value)} />
              </Field>
            </div>
            <Field label="Timezone" hint="Server uses UTC. Adjust time accordingly.">
              <Input value={scheduleData.timezone || 'Africa/Lagos'} onChange={(e) => set('timezone', e.target.value)} placeholder="Africa/Lagos" />
            </Field>
          </motion.div>
        )}

        {sendMode === 'recurring' && (
          <motion.div key="recurring" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Field label="Time of day">
              <Input type="time" value={scheduleData.time || '09:00'} onChange={(e) => set('time', e.target.value)} />
            </Field>

            <Field label="Repeat on days">
              <div className="flex gap-1.5 flex-wrap">
                {DAYS.map((d, i) => {
                  const selected = (scheduleData.days || []).includes(i)
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        const days = scheduleData.days || []
                        set('days', selected ? days.filter((x) => x !== i) : [...days, i])
                      }}
                      className="w-9 h-9 rounded-xl text-xs font-bold transition-all"
                      style={{
                        background: selected ? B : BGE,
                        color:      selected ? '#fff' : TM,
                        border:     `1px solid ${selected ? B : BC}`,
                      }}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <Input type="date" value={scheduleData.start_date || ''} onChange={(e) => set('start_date', e.target.value)} />
              </Field>
              <Field label="End date" hint="Leave blank to run forever">
                <Input type="date" value={scheduleData.end_date || ''} onChange={(e) => set('end_date', e.target.value)} />
              </Field>
            </div>

            <Field label="Timezone">
              <Input value={scheduleData.timezone || 'Africa/Lagos'} onChange={(e) => set('timezone', e.target.value)} placeholder="Africa/Lagos" />
            </Field>
          </motion.div>
        )}

        {sendMode === 'now' && (
          <motion.div key="now" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              className="flex items-center gap-2.5 p-3 rounded-xl"
              style={{ background: `${B}12`, border: `1px solid ${B}30` }}
            >
              <Zap size={14} style={{ color: B }} fill="currentColor" />
              <p className="text-xs" style={{ color: TS }}>This email will be sent immediately to all matched recipients.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Attachment Uploader ───────────────────────────────────────
const AttachmentUploader = ({ attachments, onChange }) => {
  const inputRef = useRef()

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || [])
    const valid = files.filter((f) => f.size <= 5 * 1024 * 1024) // 5MB max each
    if (valid.length < files.length) toast.error('Some files exceed 5MB and were skipped')
    onChange([...attachments, ...valid].slice(0, 5)) // max 5
    e.target.value = ''
  }

  const remove = (i) => onChange(attachments.filter((_, idx) => idx !== i))

  return (
    <div>
      <button
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
        style={{ background: BGE, color: TM, border: `1px solid ${BC}` }}
      >
        <Paperclip size={13} />
        Attach files (max 5 · 5MB each)
      </button>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFiles} />

      {attachments.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {attachments.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: BGE }}>
              <Paperclip size={11} style={{ color: TM, flexShrink: 0 }} />
              <p className="flex-1 text-xs truncate" style={{ color: TS }}>{f.name}</p>
              <span className="text-xs flex-shrink-0" style={{ color: TM }}>{(f.size / 1024).toFixed(0)}KB</span>
              <button onClick={() => remove(i)} style={{ color: TM }}><X size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Campaign History Row ──────────────────────────────────────
const CampaignRow = ({ campaign, onDelete, onDuplicate }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  const statusColor = {
    sent:      '#10b981',
    scheduled: '#eab308',
    recurring: '#06b6d4',
    draft:     TM,
    failed:    '#ef4444',
  }[campaign.status] || TM

  const statusLabel = {
    sent:      'Sent',
    scheduled: 'Scheduled',
    recurring: 'Recurring',
    draft:     'Draft',
    failed:    'Failed',
  }[campaign.status] || campaign.status

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: BGE, border: `1px solid ${BC}` }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${statusColor}15` }}>
        {campaign.status === 'recurring'
          ? <Repeat size={14} style={{ color: statusColor }} />
          : campaign.status === 'scheduled'
            ? <Clock size={14} style={{ color: statusColor }} />
            : <Mail size={14} style={{ color: statusColor }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold truncate" style={{ color: TP }}>{campaign.subject}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge color={statusColor}>{statusLabel}</Badge>
          <span className="text-xs" style={{ color: TM }}>
            {campaign.recipient_count > 0 ? `${campaign.recipient_count} recipients` : campaign.tier}
          </span>
          {campaign.sent_at && (
            <span className="text-xs" style={{ color: TM }}>
              · {new Date(campaign.sent_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="relative flex-shrink-0">
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-1.5 rounded-lg" style={{ color: TM }}>
          <MoreVertical size={14} />
        </button>
        <AnimatePresence>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: -4 }}
                animate={{ opacity: 1, scale: 1,    y: 0  }}
                exit={{    opacity: 0, scale: 0.92, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute right-0 bottom-8 z-50 rounded-xl overflow-hidden"
                style={{ background: BG, border: `1px solid ${BC}`, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 140 }}
              >
                <button onClick={() => { onDuplicate(campaign); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left" style={{ color: TS }}>
                  <Copy size={12} /> Duplicate
                </button>
                <div style={{ height: 1, background: BC, margin: '0 8px' }} />
                <button onClick={() => { onDelete(campaign.id); setMenuOpen(false) }} className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left" style={{ color: '#ef4444' }}>
                  <Trash2 size={12} /> Delete
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Body Editor (HTML / Richtext toggle) ─────────────────────
const BodyEditor = ({ value, onChange, mode, onModeChange }) => {
  return (
    <div>
      <div className="flex gap-1 p-0.5 rounded-lg mb-2 w-fit" style={{ background: BGE }}>
        {['html', 'text'].map((m) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
            style={{
              background: mode === m ? BG : 'transparent',
              color:      mode === m ? TP : TM,
            }}
          >
            {m === 'html' ? 'HTML' : 'Plain Text'}
          </button>
        ))}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={14}
        placeholder={mode === 'html'
          ? '<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello {{name}}!</h1>\n  <p>Your message here...</p>\n</body>\n</html>'
          : 'Hello {{name}},\n\nYour message here...\n\n— The Meckury Team'
        }
        className="w-full px-3 py-3 rounded-xl text-xs outline-none resize-none"
        style={{
          background:  BGE,
          border:      `1px solid ${BC}`,
          color:       TP,
          fontFamily:  mode === 'html' ? 'monospace' : 'inherit',
          lineHeight:  1.7,
        }}
      />
      <p className="text-xs mt-1.5" style={{ color: TM }}>
        Use <code style={{ color: B }}>{'{{name}}'}</code>, <code style={{ color: B }}>{'{{email}}'}</code>, <code style={{ color: B }}>{'{{credits}}'}</code> as merge tags.
      </p>
    </div>
  )
}

// ─── Preview Modal ─────────────────────────────────────────────
const PreviewModal = ({ subject, body, mode, onClose }) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="fixed inset-0 z-50 flex items-end justify-center"
    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
      transition={{ type: 'spring', damping: 28, stiffness: 340 }}
      className="w-full rounded-t-3xl flex flex-col"
      style={{ background: BG, maxWidth: 520, maxHeight: '88dvh', border: `1px solid ${BC}` }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3.5 flex-shrink-0" style={{ borderBottom: `1px solid ${BC}` }}>
        <p className="text-sm font-bold" style={{ color: TP }}>Email Preview</p>
        <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: TM }}><X size={16} /></button>
      </div>
      <div className="flex-shrink-0 px-4 py-3" style={{ borderBottom: `1px solid ${BC}` }}>
        <p className="text-xs" style={{ color: TM }}>Subject</p>
        <p className="text-sm font-semibold mt-0.5" style={{ color: TP }}>{subject || '(no subject)'}</p>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {mode === 'html' ? (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: '#fff', minHeight: 200 }}
            dangerouslySetInnerHTML={{ __html: body || '<p style="color:#999;padding:16px">No content yet</p>' }}
          />
        ) : (
          <pre className="text-sm whitespace-pre-wrap" style={{ color: TP, fontFamily: 'inherit', lineHeight: 1.7 }}>
            {body || '(no content)'}
          </pre>
        )}
      </div>
    </motion.div>
  </motion.div>
)

// ─── Main EmailManager Component ───────────────────────────────
export default function EmailManager() {
  // Compose state
  const [subject,      setSubject]      = useState('')
  const [body,         setBody]         = useState('')
  const [bodyMode,     setBodyMode]     = useState('html')
  const [tier,         setTier]         = useState('all')
  const [customList,   setCustomList]   = useState([])
  const [sendMode,     setSendMode]     = useState('now')
  const [schedule,     setSchedule]     = useState({ date: '', time: '', timezone: 'Africa/Lagos', days: [], start_date: '', end_date: '' })
  const [attachments,  setAttachments]  = useState([])
  const [showPreview,  setShowPreview]  = useState(false)

  // Campaign history state
  const [campaigns,    setCampaigns]    = useState([])
  const [campsLoading, setCampsLoading] = useState(true)

  // Sending state
  const [sending,      setSending]      = useState(false)
  const [savingDraft,  setSavingDraft]  = useState(false)

  useEffect(() => { loadCampaigns() }, [])

  const loadCampaigns = async () => {
    setCampsLoading(true)
    const { data } = await supabase
      .from('email_campaigns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30)
    setCampaigns(data || [])
    setCampsLoading(false)
  }

  const buildPayload = () => ({
    subject:     subject.trim(),
    body,
    body_mode:   bodyMode,
    tier,
    custom_user_ids: tier === 'custom' ? customList.map((u) => u.id) : [],
    send_mode:   sendMode,
    schedule,
    has_attachments: attachments.length > 0,
  })

  const validateCompose = () => {
    if (!subject.trim()) { toast.error('Subject is required'); return false }
    if (!body.trim())    { toast.error('Email body is required'); return false }
    if (tier === 'custom' && customList.length === 0) { toast.error('Add at least one recipient'); return false }
    if (sendMode === 'scheduled' && (!schedule.date || !schedule.time)) { toast.error('Set a date and time for scheduled send'); return false }
    if (sendMode === 'recurring' && (!schedule.days?.length || !schedule.time)) { toast.error('Set days and time for recurring send'); return false }
    return true
  }

  const handleSaveDraft = async () => {
    if (!subject.trim()) { toast.error('Add a subject to save draft'); return }
    setSavingDraft(true)
    try {
      const { error } = await supabase.from('email_campaigns').insert({
        ...buildPayload(),
        status: 'draft',
      })
      if (error) throw error
      toast.success('Draft saved')
      loadCampaigns()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSend = async () => {
    if (!validateCompose()) return
    setSending(true)
    try {
      // Upload attachments to storage first
      const attachmentUrls = []
      for (const file of attachments) {
        const path = `email-attachments/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage.from('admin').upload(path, file)
        if (upErr) throw new Error(`Attachment upload failed: ${upErr.message}`)
        const { data: { publicUrl } } = supabase.storage.from('admin').getPublicUrl(path)
        attachmentUrls.push({ name: file.name, url: publicUrl })
      }

      const { data, error } = await supabase.functions.invoke('email-send', {
        body: { action: 'send_campaign', ...buildPayload(), attachment_urls: attachmentUrls },
      })
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Send failed')

      const msg = sendMode === 'now'
        ? `Email sent to ${data.recipient_count} recipients`
        : sendMode === 'scheduled'
          ? 'Email scheduled successfully'
          : 'Recurring email set up'
      toast.success(msg)

      // Reset compose
      setSubject(''); setBody(''); setAttachments([]); setCustomList([])
      setTier('all'); setSendMode('now'); setSchedule({ date: '', time: '', timezone: 'Africa/Lagos', days: [], start_date: '', end_date: '' })
      loadCampaigns()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSending(false)
    }
  }

  const handleDeleteCampaign = async (id) => {
    const { error } = await supabase.from('email_campaigns').delete().eq('id', id)
    if (error) { toast.error('Delete failed'); return }
    setCampaigns((prev) => prev.filter((c) => c.id !== id))
    toast.success('Campaign deleted')
  }

  const handleDuplicateCampaign = (campaign) => {
    setSubject(campaign.subject + ' (copy)')
    setBody(campaign.body || '')
    setBodyMode(campaign.body_mode || 'html')
    setTier(campaign.tier || 'all')
    setSendMode('now')
    toast.success('Campaign duplicated into compose')
  }

  const sendLabel = sendMode === 'now' ? 'Send Now' : sendMode === 'scheduled' ? 'Schedule Send' : 'Save Recurring'

  return (
    <div>

      {/* ── SMTP Settings ─────────────────────────────────── */}
      <SectionCard title="SMTP Settings" icon={Settings} iconColor="#06b6d4" collapsible defaultOpen={false}>
        <SmtpSettings />
      </SectionCard>

      {/* ── Compose ───────────────────────────────────────── */}
      <SectionCard title="Compose Email" icon={Mail} iconColor={B}>
        <Field label="Subject" required>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Your email subject line…"
          />
        </Field>

        <Field label="Body" required>
          <BodyEditor value={body} onChange={setBody} mode={bodyMode} onModeChange={setBodyMode} />
        </Field>

        <Field label="Attachments">
          <AttachmentUploader attachments={attachments} onChange={setAttachments} />
        </Field>

        <button
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-2 text-xs font-semibold mt-1"
          style={{ color: B }}
        >
          <Eye size={13} /> Preview email
        </button>
      </SectionCard>

      {/* ── Recipients ────────────────────────────────────── */}
      <SectionCard title="Recipients" icon={Users} iconColor="#8b5cf6">
        <RecipientPicker
          tier={tier}
          onTierChange={setTier}
          customList={customList}
          onCustomListChange={setCustomList}
        />
      </SectionCard>

      {/* ── Schedule ──────────────────────────────────────── */}
      <SectionCard title="Schedule" icon={Calendar} iconColor="#eab308">
        <SchedulePanel
          sendMode={sendMode}
          onSendModeChange={setSendMode}
          scheduleData={schedule}
          onScheduleChange={setSchedule}
        />
      </SectionCard>

      {/* ── Send Actions ──────────────────────────────────── */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={handleSend}
          disabled={sending}
          className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: B, color: '#fff', opacity: sending ? 0.7 : 1 }}
        >
          {sending
            ? <><RefreshCw size={15} className="animate-spin" /> Sending…</>
            : <><Send size={15} /> {sendLabel}</>
          }
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={savingDraft}
          className="flex items-center gap-2 px-4 py-3.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: BGE, color: TS, border: `1px solid ${BC}` }}
        >
          {savingDraft ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          Draft
        </button>
      </div>

      {/* ── Campaign History ───────────────────────────────── */}
      <SectionCard title="Campaign History" icon={Clock} iconColor="#10b981" collapsible>
        {campsLoading ? (
          <div className="flex justify-center py-4"><RefreshCw size={16} style={{ color: TM }} className="animate-spin" /></div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-8">
            <Mail size={28} className="mx-auto mb-2" style={{ color: TM, opacity: 0.4 }} />
            <p className="text-sm" style={{ color: TM }}>No campaigns yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {campaigns.map((c) => (
              <CampaignRow
                key={c.id}
                campaign={c}
                onDelete={handleDeleteCampaign}
                onDuplicate={handleDuplicateCampaign}
              />
            ))}
          </div>
        )}
        <button
          onClick={loadCampaigns}
          className="flex items-center gap-1.5 mt-3 text-xs font-semibold"
          style={{ color: TM }}
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </SectionCard>

      {/* ── Preview Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showPreview && (
          <PreviewModal
            subject={subject}
            body={body}
            mode={bodyMode}
            onClose={() => setShowPreview(false)}
          />
        )}
      </AnimatePresence>

    </div>
  )
}
