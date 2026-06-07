// src/pages/CreateUGCPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, User, Building2, Zap, Sparkles,
  MoreVertical, Archive, Pencil, Lock, Crown,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcProfiles } from '@/lib/ugc'
import { ugcBrandProfiles, BRAND_CREDIT_COST } from '@/lib/ugcBrands'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const CHARACTER_CREDIT_COST = 200

// ── Skeleton card ─────────────────────────────────────────────
const SkeletonCard = () => (
  <div
    className="rounded-2xl overflow-hidden animate-pulse"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)' }} />
    <div className="p-3 flex flex-col gap-2">
      <div className="h-3 rounded-full w-2/3" style={{ background: 'var(--bg-elevated)' }} />
      <div className="h-2.5 rounded-full w-1/2" style={{ background: 'var(--bg-elevated)' }} />
    </div>
  </div>
)

// ── Character profile card ────────────────────────────────────
const ProfileCard = ({ profile, index, onSelect, onArchive, onEdit, muted, onMutedClick }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <button
        onClick={() => (muted ? onMutedClick?.() : onSelect(profile))}
        className="w-full relative overflow-hidden flex-shrink-0"
        style={{ aspectRatio: '3/4' }}
      >
        {profile.thumbnail_url ? (
          <img
            src={profile.thumbnail_url}
            alt={profile.name}
            className="w-full h-full object-cover"
            style={{ filter: muted ? 'grayscale(1) brightness(0.55)' : 'none' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center" style={{ background: ACCENT_SUB }}>
            <User size={32} style={{ color: ACCENT, opacity: 0.5 }} />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 50%)' }}
        />
        {muted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
               style={{ background: 'rgba(0,0,0,0.45)' }}>
            <Lock size={20} style={{ color: '#fff' }} />
            <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#fff' }}>
              <Crown size={10} /> Master only
            </span>
          </div>
        )}
        {profile.generation_count > 0 && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            <Sparkles size={9} />
            {profile.generation_count}
          </div>
        )}
        {profile.status === 'draft' && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)' }}
          >
            Draft
          </div>
        )}
      </button>

      <div className="px-3 py-2.5 flex items-center justify-between">
        <button onClick={() => onSelect(profile)} className="flex flex-col min-w-0 flex-1 text-left">
          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {profile.name}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {profile.age} · {profile.nationality}
          </p>
        </button>

        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            <MoreVertical size={13} />
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
                  style={{
                    background: 'var(--bg-card)',
                    border:     '1px solid var(--border-color)',
                    boxShadow:  '0 8px 24px rgba(0,0,0,0.3)',
                    minWidth:   120,
                  }}
                >
                  <button
                    onClick={() => { onEdit(profile); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 8px' }} />
                  <button
                    onClick={() => { onArchive(profile); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Archive size={12} />
                    Archive
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ── Brand card ────────────────────────────────────────────────
const BrandCard = ({ brand, index, onSelect, onArchive, onEdit }) => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative rounded-2xl overflow-hidden flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <button
        onClick={() => onSelect(brand)}
        className="w-full relative overflow-hidden flex-shrink-0 flex items-center justify-center"
        style={{ aspectRatio: '3/4', background: ACCENT_SUB }}
      >
        {brand.logo_url ? (
          <img
            src={brand.logo_url}
            alt={brand.brand_name}
            className="w-full h-full object-contain p-6"
          />
        ) : (
          <Building2 size={36} style={{ color: ACCENT, opacity: 0.5 }} />
        )}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)' }}
        />
        {brand.generation_count > 0 && (
          <div
            className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
          >
            <Sparkles size={9} />
            {brand.generation_count}
          </div>
        )}
        {brand.status === 'draft' && (
          <div
            className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.8)' }}
          >
            Draft
          </div>
        )}
      </button>

      <div className="px-3 py-2.5 flex items-center justify-between">
        <button onClick={() => onSelect(brand)} className="flex flex-col min-w-0 flex-1 text-left">
          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {brand.brand_name}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
            {brand.tagline}
          </p>
        </button>

        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
          >
            <MoreVertical size={13} />
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
                  style={{
                    background: 'var(--bg-card)',
                    border:     '1px solid var(--border-color)',
                    boxShadow:  '0 8px 24px rgba(0,0,0,0.3)',
                    minWidth:   120,
                  }}
                >
                  <button
                    onClick={() => { onEdit(brand); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 8px' }} />
                  <button
                    onClick={() => { onArchive(brand); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-left"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Archive size={12} />
                    Archive
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

// ── Create new card ───────────────────────────────────────────
const CreateCard = ({ onClick, index, label = 'New Character', Icon = User }) => (
  <motion.button
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.06 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-3 transition-all"
    style={{
      aspectRatio: '3/4',
      border:      `1.5px dashed ${ACCENT_BDR}`,
      background:  ACCENT_SUB,
    }}
  >
    <div
      className="w-10 h-10 rounded-2xl flex items-center justify-center"
      style={{ background: ACCENT_BDR }}
    >
      <Plus size={20} style={{ color: ACCENT }} />
    </div>
    <span className="text-xs font-semibold" style={{ color: ACCENT }}>
      {label}
    </span>
  </motion.button>
)

// ── Main page ─────────────────────────────────────────────────
export default function CreateUGCPage() {
  const navigate          = useNavigate()
  const { user, credits, profile } = useAuth()

  // Characters state
  const [charProfiles,    setCharProfiles]    = useState([])
  const [charLoading,     setCharLoading]     = useState(true)
  const [archivingChar,   setArchivingChar]   = useState(null)

  // Brands state
  const [brandProfiles,   setBrandProfiles]   = useState([])
  const [brandLoading,    setBrandLoading]    = useState(true)
  const [archivingBrand,  setArchivingBrand]  = useState(null)

  const [ugcTab, setUgcTab] = useState('characters')

  const isMaster      = profile?.user_tier === 'master'
  const canCreateChar = credits >= CHARACTER_CREDIT_COST
  const canCreateBrand = credits >= BRAND_CREDIT_COST

  useEffect(() => {
    if (!user) return
    loadCharProfiles()
    loadBrandProfiles()
  }, [user])

  const loadCharProfiles = async () => {
    setCharLoading(true)
    const { data, error } = await ugcProfiles.getAll(user.id)
    if (!error) setCharProfiles(data || [])
    setCharLoading(false)
  }

  const loadBrandProfiles = async () => {
    setBrandLoading(true)
    const { data, error } = await ugcBrandProfiles.getAll(user.id)
    if (!error) setBrandProfiles(data || [])
    setBrandLoading(false)
  }

  // ── Character handlers ────────────────────────────────────

  const handleSelectProfile = (p) => {
    if (p.status === 'draft') {
      navigate('/create/ugc/new', { state: { resumeProfileId: p.id } })
    } else {
      navigate(`/create/ugc/${p.id}`)
    }
  }

  const handleArchiveChar = async (p) => {
    setArchivingChar(p.id)
    const { error } = await ugcProfiles.archive(p.id)
    if (error) {
      toast.error('Could not archive profile')
    } else {
      setCharProfiles((prev) => prev.filter((c) => c.id !== p.id))
      toast.success(`${p.name} archived`)
    }
    setArchivingChar(null)
  }

  const handleEditChar = (p) => {
    navigate('/create/ugc/new', { state: { editProfileId: p.id } })
  }

  const oldestActiveId = charProfiles
    .filter((p) => p.status === 'active')
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]?.id

  const isProfileMuted = (p) =>
    !isMaster && p.status === 'active' && p.id !== oldestActiveId

  const noviceAtCharLimit = !isMaster && charProfiles.some((p) => p.status === 'active' || p.status === 'draft')

  const handleMutedClick = () => {
    toast.error('Upgrade to Master to use additional characters.', { duration: 4000 })
    navigate('/profile')
  }

  const handleCreateNewChar = () => {
    if (noviceAtCharLimit) {
      toast.error('Novice users can only have one UGC character. Upgrade to Master for more.', { duration: 4500 })
      return
    }
    if (!canCreateChar) {
      toast.error(`You need at least ${CHARACTER_CREDIT_COST} credits to create a UGC character.`, { duration: 4000 })
      return
    }
    navigate('/create/ugc/new')
  }

  // ── Brand handlers ────────────────────────────────────────

  const handleSelectBrand = (b) => {
    if (b.status === 'draft') {
      navigate('/create/ugc/brand/new', { state: { resumeBrandId: b.id } })
    } else {
      navigate(`/create/ugc/brand/${b.id}`)
    }
  }

  const handleArchiveBrand = async (b) => {
    setArchivingBrand(b.id)
    const { error } = await ugcBrandProfiles.archive(b.id)
    if (error) {
      toast.error('Could not archive brand')
    } else {
      setBrandProfiles((prev) => prev.filter((br) => br.id !== b.id))
      toast.success(`${b.brand_name} archived`)
    }
    setArchivingBrand(null)
  }

  const handleEditBrand = (b) => {
    navigate('/create/ugc/brand/new', { state: { editBrandId: b.id } })
  }

  const handleCreateNewBrand = () => {
    if (!canCreateBrand) {
      toast.error(`You need at least ${BRAND_CREDIT_COST} credits to create a brand profile.`, { duration: 4000 })
      return
    }
    navigate('/create/ugc/brand/new')
  }

  // ── Derived ───────────────────────────────────────────────

  const activeCharProfiles = charProfiles.filter((p) => p.status === 'active')
  const draftCharProfiles  = charProfiles.filter((p) => p.status === 'draft')
  const activeBrandProfiles = brandProfiles.filter((b) => b.status === 'active')
  const draftBrandProfiles  = brandProfiles.filter((b) => b.status === 'draft')

  const currentTabLabel = {
    characters: 'Your Characters',
    voices:     'Voice Studio',
    brands:     'Your Brands',
  }[ugcTab] || ''

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button onClick={() => navigate('/create')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>UGC</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>{currentTabLabel}</span>
        </div>
        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
          {Math.floor(credits)}
        </div>
      </div>

      {/* Characters | Voices | Brands tab switcher */}
      <div className="flex-shrink-0 flex gap-1 mx-4 lg:mx-8 p-1 rounded-2xl mt-3 mb-1" style={{ background: 'var(--bg-elevated)' }}>
        {[
          { value: 'characters', label: 'Characters' },
          { value: 'voices',     label: 'Voices'     },
          { value: 'brands',     label: 'Brands'     },
        ].map((t) => (
          <button
            key={t.value}
            onClick={() => {
              setUgcTab(t.value)
              if (t.value === 'voices') navigate('/create/ugc/voices')
            }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all duration-200"
            style={{
              background: ugcTab === t.value ? 'var(--bg-card)'      : 'transparent',
              color:      ugcTab === t.value ? 'var(--text-primary)'  : 'var(--text-muted)',
              boxShadow:  ugcTab === t.value ? 'var(--shadow)'        : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6">

          {/* ── Characters Tab ───────────────────────────────── */}
          {ugcTab === 'characters' && (
            <>
              {/* Low credits notice */}
              {!canCreateChar && !charLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-2xl mb-5"
                  style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                >
                  <Zap size={16} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} fill="currentColor" />
                  <div>
                    <p className="text-xs font-bold" style={{ color: ACCENT }}>{CHARACTER_CREDIT_COST} credits required</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      You need at least {CHARACTER_CREDIT_COST} credits to create a new UGC character.{' '}
                      <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>
                        Top up
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}

              {charLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : (
                <>
                  {activeCharProfiles.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                        Characters
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {activeCharProfiles.map((p, i) => (
                          <ProfileCard
                            key={p.id}
                            profile={p}
                            index={i}
                            onSelect={handleSelectProfile}
                            onArchive={handleArchiveChar}
                            onEdit={handleEditChar}
                            muted={isProfileMuted(p)}
                            onMutedClick={handleMutedClick}
                          />
                        ))}
                        {(isMaster || activeCharProfiles.length === 0) && (
                          <CreateCard onClick={handleCreateNewChar} index={activeCharProfiles.length} label="New Character" Icon={User} />
                        )}
                      </div>
                      {!isMaster && activeCharProfiles.length >= 1 && (
                        <div
                          className="mt-4 flex items-start gap-3 p-3 rounded-2xl"
                          style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                        >
                          <Crown size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            Novice plan supports 1 active character.{' '}
                            <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>
                              Upgrade to Master
                            </button>{' '}
                            to create and use more.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {draftCharProfiles.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                        Drafts
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {draftCharProfiles.map((p, i) => (
                          <ProfileCard
                            key={p.id}
                            profile={p}
                            index={i}
                            onSelect={handleSelectProfile}
                            onArchive={handleArchiveChar}
                            onEdit={handleEditChar}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {charProfiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-5">
                      <div
                        className="w-20 h-20 rounded-3xl flex items-center justify-center"
                        style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                      >
                        <User size={36} style={{ color: ACCENT, opacity: 0.6 }} />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No characters yet</p>
                        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                          Create your first UGC character to start generating hyper-realistic content.
                        </p>
                      </div>
                      <button
                        onClick={handleCreateNewChar}
                        disabled={!canCreateChar}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                        style={{
                          background: canCreateChar ? ACCENT              : 'var(--bg-elevated)',
                          color:      canCreateChar ? '#ffffff'           : 'var(--text-muted)',
                          border:     canCreateChar ? 'none'              : '1px solid var(--border-color)',
                        }}
                      >
                        <Plus size={16} />
                        Create Character
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── Brands Tab ───────────────────────────────────── */}
          {ugcTab === 'brands' && (
            <>
              {/* Low credits notice */}
              {!canCreateBrand && !brandLoading && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-2xl mb-5"
                  style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                >
                  <Zap size={16} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} fill="currentColor" />
                  <div>
                    <p className="text-xs font-bold" style={{ color: ACCENT }}>{BRAND_CREDIT_COST} credits required</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      You need at least {BRAND_CREDIT_COST} credits to create a brand profile.{' '}
                      <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>
                        Top up
                      </button>
                    </p>
                  </div>
                </motion.div>
              )}

              {brandLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : (
                <>
                  {activeBrandProfiles.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                        Brands
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {activeBrandProfiles.map((b, i) => (
                          <BrandCard
                            key={b.id}
                            brand={b}
                            index={i}
                            onSelect={handleSelectBrand}
                            onArchive={handleArchiveBrand}
                            onEdit={handleEditBrand}
                          />
                        ))}
                        <CreateCard
                          onClick={handleCreateNewBrand}
                          index={activeBrandProfiles.length}
                          label="New Brand"
                          Icon={Building2}
                        />
                      </div>
                    </div>
                  )}

                  {draftBrandProfiles.length > 0 && (
                    <div className="mb-6">
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                        Brand Drafts
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        {draftBrandProfiles.map((b, i) => (
                          <BrandCard
                            key={b.id}
                            brand={b}
                            index={i}
                            onSelect={handleSelectBrand}
                            onArchive={handleArchiveBrand}
                            onEdit={handleEditBrand}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {brandProfiles.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 gap-5">
                      <div
                        className="w-20 h-20 rounded-3xl flex items-center justify-center"
                        style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                      >
                        <Building2 size={36} style={{ color: ACCENT, opacity: 0.6 }} />
                      </div>
                      <div className="text-center">
                        <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No brands yet</p>
                        <p className="text-sm mt-1 max-w-xs" style={{ color: 'var(--text-muted)' }}>
                          Set up your brand profile and let the AI generate premium, on-brand content for you.
                        </p>
                      </div>
                      <button
                        onClick={handleCreateNewBrand}
                        disabled={!canCreateBrand}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                        style={{
                          background: canCreateBrand ? ACCENT              : 'var(--bg-elevated)',
                          color:      canCreateBrand ? '#ffffff'           : 'var(--text-muted)',
                          border:     canCreateBrand ? 'none'              : '1px solid var(--border-color)',
                        }}
                      >
                        <Plus size={16} />
                        Create Brand
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
