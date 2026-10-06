import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)
const CHROME = { dark: '#07070b', light: '#fbfaf8' }

const getInitialTheme = () => localStorage.getItem('meckury-theme') || 'dark'
const resolveTheme = (theme) =>
  theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme)

  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(theme)
      const root = document.documentElement
      root.dataset.theme = resolved
      root.classList.toggle('dark', resolved === 'dark')
      root.style.colorScheme = resolved
      document.querySelectorAll('meta[name="theme-color"]')
        .forEach((m) => m.setAttribute('content', CHROME[resolved]))
    }
    apply()
    localStorage.setItem('meckury-theme', theme)
    if (theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme: setThemeState }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a <ThemeProvider>')
  return ctx
}
