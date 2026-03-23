'use client'

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { applyThemeToDocument, type MdTheme } from '@/app/theme/cssVars'

const STORAGE_KEY = 'md-theme'

function readStoredTheme(): MdTheme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY) as MdTheme | null
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

type ThemeContextValue = {
  theme: MdTheme
  setTheme: (t: MdTheme) => void
  toggleTheme: () => void
  mounted: boolean
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useAppTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useAppTheme must be used within ThemeProvider')
  }
  return ctx
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<MdTheme>('light')
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    const initial = readStoredTheme()
    setThemeState(initial)
    applyThemeToDocument(initial)
    setMounted(true)
  }, [])

  useLayoutEffect(() => {
    if (!mounted) return
    applyThemeToDocument(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, mounted])

  const setTheme = useCallback((t: MdTheme) => setThemeState(t), [])
  const toggleTheme = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme, mounted }),
    [theme, setTheme, toggleTheme, mounted]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
