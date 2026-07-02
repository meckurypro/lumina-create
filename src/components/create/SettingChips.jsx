// src/components/create/SettingChips.jsx

/**
 * Shared chip-row control for aspect ratio / duration / quality / sound
 * settings — identical implementation was copy-pasted in every Create page.
 */
export function SettingChips({ label, options, value, onChange, accent = 'var(--brand)' }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
        {label}
      </p>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => !opt.disabled && onChange(opt.value)}
            disabled={opt.disabled}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: value === opt.value ? accent : 'var(--bg-elevated)',
              color: value === opt.value ? '#ffffff' : 'var(--text-secondary)',
              opacity: opt.disabled ? 0.3 : 1,
              cursor: opt.disabled ? 'not-allowed' : 'pointer',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}
