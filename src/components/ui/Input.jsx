// src/components/ui/Input.jsx
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export const Input = ({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon: Icon,
  disabled = false,
  required = false,
  maxLength,
  className = '',
  autoComplete,
  autoFocus = false,
  inputMode,
}) => {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
          {required && <span className="text-orange-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <div
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10"
            style={{ color: 'var(--text-muted)' }}
          >
            <Icon size={16} />
          </div>
        )}

        <input
          type={inputType}
          inputMode={inputMode}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          className={`input-base ${error ? 'border-red-500 focus:border-red-500 focus:shadow-red-500/15' : ''}`}
          style={{
            paddingLeft:  Icon ? '2.75rem' : undefined,
            paddingRight: isPassword ? '3rem' : undefined,
          }}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-1.5 text-sm text-red-500">{error}</p>
      )}

      {hint && !error && (
        <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}

      {maxLength && (
        <p className="mt-1 text-xs text-right" style={{ color: 'var(--text-muted)' }}>
          {value?.length || 0}/{maxLength}
        </p>
      )}
    </div>
  )
}

// OTP Input Component
export const OTPInput = ({ value, onChange, length = 8 }) => {
  const digits = value.split('').slice(0, length)

  const handleChange = (e, index) => {
    const val = e.target.value.replace(/\D/g, '')
    if (!val) return
    const newOTP = digits.slice()
    newOTP[index] = val[val.length - 1]
    if (val.length > 1) {
      val.split('').slice(0, length - index).forEach((char, i) => {
        newOTP[index + i] = char
      })
    }
    onChange(newOTP.join(''))
    const nextIndex = Math.min(index + val.length, length - 1)
    document.getElementById(`otp-${nextIndex}`)?.focus()
  }

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      const newOTP = digits.slice()
      if (newOTP[index]) {
        newOTP[index] = ''
        onChange(newOTP.join(''))
      } else if (index > 0) {
        document.getElementById(`otp-${index - 1}`)?.focus()
      }
    }
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digits[i] || ''}
          onChange={(e) => handleChange(e, i)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          className="w-10 h-12 text-center text-lg font-bold rounded-xl border-2 transition-all outline-none"
          style={{
            background:  'var(--bg-input)',
            borderColor: digits[i] ? 'var(--brand)' : 'var(--border)',
            color:       'var(--text-primary)',
          }}
        />
      ))}
    </div>
  )
}

// Textarea component
export const Textarea = ({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  rows = 4,
  maxLength,
  disabled = false,
  className = '',
}) => {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {label}
        </label>
      )}

      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        disabled={disabled}
        className={`input-base resize-none ${error ? 'border-red-500' : ''}`}
        style={{ minHeight: `${rows * 24 + 28}px` }}
      />

      <div className="flex justify-between mt-1.5">
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : hint ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{hint}</p>
        ) : <span />}

        {maxLength && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {value?.length || 0}/{maxLength}
          </p>
        )}
      </div>
    </div>
  )
}
