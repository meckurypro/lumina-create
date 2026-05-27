import { useState, useEffect, useCallback } from 'react'
import { Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function StaffManager() {
  const { user }                        = useAuth()
  const [staffList,   setStaffList]     = useState([])
  const [allUsers,    setAllUsers]      = useState([])
  const [poolBalance, setPoolBalance]   = useState(null)
  const [loading,     setLoading]       = useState(true)
  const [searchQuery, setSearchQuery]   = useState('')
  const [promoting,   setPromoting]     = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [staffRes, usersRes] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, avatar_url, credits, total_generations').eq('is_staff', true).order('username'),
      supabase.from('profiles').select('id, username, display_name, credits').eq('is_staff', false).neq('role', 'admin').order('username').limit(50),
    ])
    setStaffList(staffRes.data || [])
    setAllUsers(usersRes.data  || [])
    const { data: poolSetting } = await supabase.from('app_settings').select('value').eq('key', 'staff_pool_user_id').single()
    if (poolSetting?.value) {
      const { data: poolProfile } = await supabase.from('profiles').select('credits, username').eq('id', poolSetting.value).single()
      setPoolBalance(poolProfile?.credits ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handlePromote = async (userId, username) => {
    setPromoting(userId)
    const { data, error } = await supabase.rpc('promote_to_staff', { p_admin_id: user.id, p_user_id: userId, p_note: 'Promoted via Admin Panel' })
    setPromoting(null)
    if (error || !data?.success) { toast.error('Failed to promote user'); return }
    toast.success(`@${username} is now staff!`)
    loadData()
  }

  const handleDemote = async (userId, username) => {
    const { data, error } = await supabase.rpc('demote_from_staff', { p_admin_id: user.id, p_user_id: userId })
    if (error || !data?.success) { toast.error('Failed to demote user'); return }
    toast.success(`@${username} removed from staff`)
    loadData()
  }

  const filteredUsers = allUsers.filter((u) => u.username?.toLowerCase().includes(searchQuery.toLowerCase()))

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} fill="var(--brand)" style={{ color: 'var(--brand)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>Staff Credit Pool</p>
        </div>
        <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
          {poolBalance !== null ? `⚡ ${Math.floor(poolBalance)} credits` : 'Not configured'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Set staff_pool_user_id in app_settings to configure a dedicated pool account.</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Current Staff ({staffList.length})</p>
        {staffList.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No staff members yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {staffList.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'var(--brand)', color: 'white' }}>
                  {s.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{s.username}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>⚡ {s.credits?.toFixed(1)} credits · {s.total_generations} gens</p>
                </div>
                <button onClick={() => handleDemote(s.id, s.username)} className="text-xs px-3 py-1.5 rounded-xl font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>Promote User to Staff</p>
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by username…" className="input-base text-sm w-full mb-3" />
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar">
          {filteredUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                {u.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{u.username}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>⚡ {u.credits?.toFixed(1)} credits</p>
              </div>
              <button onClick={() => handlePromote(u.id, u.username)} disabled={promoting === u.id} className="text-xs px-3 py-1.5 rounded-xl font-bold" style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand)' }}>
                {promoting === u.id ? '…' : 'Promote'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
