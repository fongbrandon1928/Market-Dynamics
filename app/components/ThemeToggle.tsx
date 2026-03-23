'use client'

import { useAppTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useAppTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        padding: '8px 14px',
        borderRadius: '16px',
        border: '1px solid var(--md-tab-border)',
        backgroundColor: 'var(--md-surface-muted)',
        color: 'var(--md-text)',
        fontWeight: 600,
        fontSize: '13px',
        cursor: 'pointer',
        minWidth: '44px',
      }}
      aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
    >
      {mounted ? (theme === 'dark' ? '☀ Light' : '🌙 Dark') : 'Theme'}
    </button>
  )
}
