import * as React from 'react'
import { Switch } from './ui/switch'

export function ThemeToggle() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() =>
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  )

  React.useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  return (
    <Switch
      checked={theme === 'dark'}
      onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')}
      aria-label='Toggle theme'
    />
  )
}
