import { useEffect, useState } from 'react'

const query = (q) => typeof window !== 'undefined' && window.matchMedia(q).matches

// Device-aware flags for JS-level decisions (layout is mostly CSS-driven).
export function useDevice() {
  const read = () => ({
    isDesktop: query('(min-width: 1024px)'),
    isWide:    query('(min-width: 1280px)'),
    isTouch:   query('(pointer: coarse)'),
  })
  const [device, setDevice] = useState(read)
  useEffect(() => {
    const qs = ['(min-width: 1024px)', '(min-width: 1280px)', '(pointer: coarse)'].map((q) => window.matchMedia(q))
    const on = () => setDevice(read())
    qs.forEach((m) => m.addEventListener('change', on))
    return () => qs.forEach((m) => m.removeEventListener('change', on))
  }, [])
  return device
}
