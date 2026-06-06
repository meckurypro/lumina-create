// src/pages/filma/FilmaSetupPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { filmaFilms, filmaDropdownCustoms } from '@/lib/filma'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

// ── Dropdown data ─────────────────────────────────────────────────────────

const FILM_TYPES = [
  { value: 'feature_film', label: 'Feature Film' },
  { value: 'short_film',   label: 'Short Film'   },
  { value: 'epic',         label: 'Epic'          },
  { value: 'mini_series',  label: 'Mini-Series'  },
  { value: 'series',       label: 'Series'        },
  { value: 'documentary',  label: 'Documentary'  },
  { value: 'anthology',    label: 'Anthology'     },
  { value: 'web_series',   label: 'Web Series'   },
  { value: 'other',        label: 'Other…'        },
]

const GENRES = [
  { value: 'action',       label: 'Action'       },
  { value: 'adventure',    label: 'Adventure'    },
  { value: 'comedy',       label: 'Comedy'       },
  { value: 'crime',        label: 'Crime'        },
  { value: 'drama',        label: 'Drama'        },
  { value: 'fantasy',      label: 'Fantasy'      },
  { value: 'horror',       label: 'Horror'       },
  { value: 'musical',      label: 'Musical'      },
  { value: 'mystery',      label: 'Mystery'      },
  { value: 'romance',      label: 'Romance'      },
  { value: 'sci_fi',       label: 'Sci-Fi'       },
  { value: 'thriller',     label: 'Thriller'     },
  { value: 'western',      label: 'Western'      },
  { value: 'war',          label: 'War'          },
  { value: 'historical',   label: 'Historical'   },
  { value: 'animation',    label: 'Animation'    },
  { value: 'film_noir',    label: 'Film Noir'    },
  { value: 'supernatural', label: 'Supernatural' },
  { value: 'biographical', label: 'Biographical' },
  { value: 'sports',       label: 'Sports'       },
  { value: 'other',        label: 'Other…'       },
]

const SETTINGS = [
  { value: 'contemporary',    label: 'Contemporary'    },
  { value: 'historical',      label: 'Historical'      },
  { value: 'futuristic',      label: 'Futuristic'      },
  { value: 'period_drama',    label: 'Period Drama'    },
  { value: 'post_apocalyptic',label: 'Post-Apocalyptic'},
  { value: 'fantasy_world',   label: 'Fantasy World'   },
  { value: 'alternate_reality',label:'Alternate Reality'},
  { value: 'other',           label: 'Other…'          },
]

const VISUAL_STYLES = [
  { value: 'cinematic',           label: 'Cinematic'              },
  { value: 'handheld_documentary',label: 'Handheld / Documentary' },
  { value: 'noir',                label: 'Noir'                   },
  { value: 'avant_garde',         label: 'Avant-Garde'            },
  { value: 'neorealism',          label: 'Neorealism'             },
  { value: 'surrealist',          label: 'Surrealist'             },
  { value: 'other',               label: 'Other…'                 },
]

const COLOR_GRADINGS = [
  { value: 'teal_and_orange',      label: 'Teal & Orange'          },
  { value: 'hollywood_blockbuster',label: 'Hollywood Blockbuster'  },
  { value: 'netflix_dark',         label: 'Netflix Dark'           },
  { value: 'bleach_bypass',        label: 'Bleach Bypass'          },
  { value: 'warm_cinematic',       label: 'Warm Cinematic'         },
  { value: 'cold_thriller',        label: 'Cold Thriller'          },
  { value: 'nollywood_vibrant',    label: 'Nollywood Vibrant'      },
  { value: 'high_contrast_drama',  label: 'High Contrast Drama'    },
  { value: 'desaturated_indie',    label: 'Desaturated Indie'      },
  { value: 'kodak_film_emulation', label: 'Kodak Film Emulation'   },
  { value: 'fuji_film_emulation',  label: 'Fuji Film Emulation'    },
  { value: 'blue_hour_moody',      label: 'Blue Hour / Moody'      },
  { value: 'green_cast_tension',   label: 'Green Cast / Tension'   },
  { value: 'earthy_natural',       label: 'Earthy Natural'         },
  { value: 'airy_and_soft',        label: 'Airy & Soft'            },
  { value: 'other',                label: 'Other…'                 },
]

const ASPECT_RATIOS = [
  { value: '16:9',  label: '16:9',  sub: 'Widescreen / Cinema' },
  { value: '9:16',  label: '9:16',  sub: 'Vertical / Mobile'   },
  { value: '1:1',   label: '1:1',   sub: 'Square'              },
  { value: '4:3',   label: '4:3',   sub: 'Classic'             },
  { value: '21:9',  label: '21:9',  sub: 'Ultra-wide'          },
]

const STRUCTURE_TYPES = [
  { value: 'single',     label: 'Single Film',  sub: 'One complete film'          },
  { value: 'multi_part', label: 'Multi-Part',   sub: 'Parts, chapters, volumes'   },
  { value: 'series',     label: 'Series',       sub: 'Seasons and episodes'        },
]

// ── Sub-components ────────────────────────────────────────────────────────

const SectionLabel = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-widest mb-3"
    style={{ color: 'var(--text-muted)' }}>{children}</p>
)

// Pill grid selector
const PillGrid = ({ options, value, onChange, cols = 3 }) => (
  <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
    {options.map((opt) => (
      <button key={opt.value} onClick={() => onChange(opt.value)}
        className="px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all duration-150 flex flex-col gap-0.5"
        style={{
          background: value === opt.value ? ACCENT_SUB   : 'var(--bg-elevated)',
          color:      value === opt.value ? ACCENT        : 'var(--text-secondary)',
          border:     `1px solid ${value === opt.value ? ACCENT_BDR : 'var(--border-color)'}`,
        }}>
        <span>{opt.label}</span>
        {opt.sub && (
          <span className="text-xs font-normal" style={{
            color: value === opt.value ? ACCENT : 'var(--text-muted)', opacity: 0.8,
            fontSize: 10,
          }}>{opt.sub}</span>
        )}
      </button>
    ))}
  </div>
)

// Custom "Other" text input (shown when value === 'other')
const OtherInput = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-4 py-3 rounded-xl text-sm outline-none mt-2"
    style={{
      background:  'var(--bg-elevated)',
      border:      `1.5px solid ${ACCENT_BDR}`,
      color:       'var(--text-primary)',
    }}
  />
)

// Number stepper
const Stepper = ({ label, value, onChange, min = 1, max = 50 }) => (
  <div className="flex items-center justify-between px-4 py-3 rounded-xl"
    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
    <div className="flex items-center gap-3">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-lg font-bold transition-all active:scale-90"
        style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)' }}>−</button>
      <span className="text-base font-bold min-w-[2ch] text-center"
        style={{ color: 'var(--text-primary)' }}>{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-lg font-bold transition-all active:scale-90"
        style={{ background: ACCENT, color: '#000', border: 'none' }}>+</button>
    </div>
  </div>
)

// ── Main ──────────────────────────────────────────────────────────────────
export default function FilmaSetupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [saving, setSaving] = useState(false)

  // Form state
  const [title,              setTitle]             = useState('')
  const [filmType,           setFilmType]          = useState('')
  const [filmTypeCustom,     setFilmTypeCustom]    = useState('')
  const [genre,              setGenre]             = useState('')
  const [genreCustom,        setGenreCustom]       = useState('')
  const [setting,            setSetting]           = useState('')
  const [settingCustom,      setSettingCustom]     = useState('')
  const [visualStyle,        setVisualStyle]       = useState('')
  const [visualStyleCustom,  setVisualStyleCustom] = useState('')
  const [colorGrading,       setColorGrading]      = useState('')
  const [colorGradingCustom, setColorGradingCustom] = useState('')
  const [aspectRatio,        setAspectRatio]       = useState('16:9')
  const [structureType,      setStructureType]     = useState('single')
  const [totalParts,         setTotalParts]        = useState(1)
  const [totalSeasons,       setTotalSeasons]      = useState(1)

  const isValid = title.trim()
    && filmType && (filmType !== 'other' || filmTypeCustom.trim())
    && genre    && (genre    !== 'other' || genreCustom.trim())
    && setting  && (setting  !== 'other' || settingCustom.trim())
    && visualStyle && (visualStyle !== 'other' || visualStyleCustom.trim())
    && colorGrading && (colorGrading !== 'other' || colorGradingCustom.trim())
    && aspectRatio
    && structureType

  const handleSave = async () => {
    if (!isValid || saving) return
    setSaving(true)

    // Log any custom "Other" entries for research
    const logCustom = async (field, val, custom) => {
      if (val === 'other' && custom.trim()) {
        await filmaDropdownCustoms.log(user.id, field, custom.trim())
      }
    }
    await Promise.all([
      logCustom('film_type',    filmType,    filmTypeCustom),
      logCustom('genre',        genre,       genreCustom),
      logCustom('setting',      setting,     settingCustom),
      logCustom('visual_style', visualStyle, visualStyleCustom),
      logCustom('color_grading',colorGrading,colorGradingCustom),
    ])

    const payload = {
      title:               title.trim(),
      film_type:           filmType,
      film_type_custom:    filmType    === 'other' ? filmTypeCustom.trim()    : null,
      genre,
      genre_custom:        genre       === 'other' ? genreCustom.trim()       : null,
      setting,
      setting_custom:      setting     === 'other' ? settingCustom.trim()     : null,
      visual_style:        visualStyle,
      visual_style_custom: visualStyle === 'other' ? visualStyleCustom.trim() : null,
      color_grading:       colorGrading,
      color_grading_custom:colorGrading=== 'other' ? colorGradingCustom.trim(): null,
      aspect_ratio:        aspectRatio,
      structure_type:      structureType,
      total_parts:         structureType === 'series' ? totalSeasons : totalParts,
      total_seasons:       structureType === 'series' ? totalSeasons : 1,
      status:              'draft',
    }

    const { data, error } = await filmaFilms.create(user.id, payload)
    setSaving(false)

    if (error) { toast.error('Could not create film'); return }
    toast.success(`"${title}" created`)
    navigate(`/filma/${data.id}/cast`)
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate('/filma')} className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>New Film</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Project Setup</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-7">

          {/* Title */}
          <div>
            <SectionLabel>Film Title</SectionLabel>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter your film title…"
              className="w-full px-4 py-3.5 rounded-xl text-base font-semibold outline-none"
              style={{ background: 'var(--bg-elevated)', border: `1.5px solid var(--border-color)`,
                color: 'var(--text-primary)' }}
            />
          </div>

          {/* Film Type */}
          <div>
            <SectionLabel>Film Type</SectionLabel>
            <PillGrid options={FILM_TYPES} value={filmType} onChange={setFilmType} cols={3} />
            {filmType === 'other' && (
              <OtherInput value={filmTypeCustom} onChange={setFilmTypeCustom}
                placeholder="Describe the film type…" />
            )}
          </div>

          {/* Genre */}
          <div>
            <SectionLabel>Genre</SectionLabel>
            <PillGrid options={GENRES} value={genre} onChange={setGenre} cols={3} />
            {genre === 'other' && (
              <OtherInput value={genreCustom} onChange={setGenreCustom}
                placeholder="Describe the genre…" />
            )}
          </div>

          {/* Setting */}
          <div>
            <SectionLabel>Setting</SectionLabel>
            <PillGrid options={SETTINGS} value={setting} onChange={setSetting} cols={2} />
            {setting === 'other' && (
              <OtherInput value={settingCustom} onChange={setSettingCustom}
                placeholder="Describe the setting…" />
            )}
          </div>

          {/* Visual Style */}
          <div>
            <SectionLabel>Visual Style</SectionLabel>
            <PillGrid options={VISUAL_STYLES} value={visualStyle} onChange={setVisualStyle} cols={2} />
            {visualStyle === 'other' && (
              <OtherInput value={visualStyleCustom} onChange={setVisualStyleCustom}
                placeholder="Describe the visual style…" />
            )}
          </div>

          {/* Color Grading */}
          <div>
            <SectionLabel>Color Grading</SectionLabel>
            <PillGrid options={COLOR_GRADINGS} value={colorGrading} onChange={setColorGrading} cols={2} />
            {colorGrading === 'other' && (
              <OtherInput value={colorGradingCustom} onChange={setColorGradingCustom}
                placeholder="Describe the color grading…" />
            )}
          </div>

          {/* Aspect Ratio */}
          <div>
            <SectionLabel>Aspect Ratio</SectionLabel>
            <PillGrid options={ASPECT_RATIOS} value={aspectRatio} onChange={setAspectRatio} cols={3} />
          </div>

          {/* Structure */}
          <div>
            <SectionLabel>Film Structure</SectionLabel>
            <PillGrid options={STRUCTURE_TYPES} value={structureType} onChange={setStructureType} cols={3} />

            <div className="mt-3 flex flex-col gap-2">
              {structureType === 'single' && (
                <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                  One complete film. You'll define scenes in the next step.
                </p>
              )}
              {structureType === 'multi_part' && (
                <Stepper label="Number of Parts" value={totalParts}
                  onChange={setTotalParts} min={2} max={20} />
              )}
              {structureType === 'series' && (
                <>
                  <Stepper label="Number of Seasons" value={totalSeasons}
                    onChange={setTotalSeasons} min={1} max={10} />
                  <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                    You'll define episodes per season in the structure step.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Bottom padding */}
          <div style={{ height: 80 }} />
        </div>
      </div>

      {/* Continue button */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4"
        style={{ borderTop: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-primary)' }}>
        <div className="mx-auto w-full max-w-xl">
          <button onClick={handleSave} disabled={!isValid || saving}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: isValid && !saving ? ACCENT : 'var(--bg-elevated)',
              color:      isValid && !saving ? '#000'  : 'var(--text-muted)',
            }}>
            {saving ? 'Creating…' : (
              <><span>Continue to Cast</span><ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
