// src/pages/admin/RWSellerManager.jsx
import { useState, useEffect, useCallback } from 'react'
import { Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function RWSellerManager() {
  const [sellers,     setSellers]     = useState([])
  const [allUsers,    setAllUsers]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [busyId,      setBusyId]      = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [sellersRes, usersRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, display_name, is_rw_seller')
        .eq('is_rw_seller', true)
        .order('username'),
      supabase
        .from('profiles')
        .select('id, username, display_name')
        .eq('is_rw_seller', false)
        .order('username')
        .limit(50),
    ])
    setSellers(sellersRes.data || [])
    setAllUsers(usersRes.data  || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const grant = async (userId, username) => {
    setBusyId(userId)
    const { error } = await supabase.from('profiles').update({ is_rw_seller: true }).eq('id', userId)
    setBusyId(null)
    if (error) { toast.error('Failed to grant RW Seller'); return }
    toast.success(`@${username} is now an RW Seller`)
    loadData()
  }

  const revoke = async (userId, username) => {
    setBusyId(userId)
    const { error } = await supabase.from('profiles').update({ is_rw_seller: false }).eq('id', userId)
    setBusyId(null)
    if (error) { toast.error('Failed to revoke RW Seller'); return }
    toast.success(`@${username} removed as RW Seller`)
    loadData()
  }

  const filteredUsers = allUsers.filter((u) => u.username?.toLowerCase().includes(searchQuery.toLowerCase()))

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Users size={14} style={{ color: '#f59e0b' }} />
          <p className="text-sm font-bold" style={{ color: '#f59e0b' }}>RW Sellers</p>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          RW Sellers can see and purchase Render Window Team plans. Grant this manually after a WhatsApp conversation.
        </p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
          Current RW Sellers ({sellers.length})
        </p>
        {sellers.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No RW Sellers yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {sellers.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: '#f59e0b', color: 'white' }}>
                  {s.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{s.username}</p>
                </div>
                <button
                  onClick={() => revoke(s.id, s.username)}
                  disabled={busyId === s.id}
                  className="text-xs px-3 py-1.5 rounded-xl font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                >
                  {busyId === s.id ? '…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
          Grant RW Seller Access
        </p>
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by username…" className="input-base text-sm w-full mb-3" />
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar">
          {filteredUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                {u.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{u.username}</p>
              </div>
              <button onClick={() => grant(u.id, u.username)} disabled={busyId === u.id} className="text-xs px-3 py-1.5 rounded-xl font-bold" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                {busyId === u.id ? '…' : 'Grant'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
