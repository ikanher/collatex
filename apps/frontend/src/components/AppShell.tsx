import { ThemeToggle } from './ThemeToggle'

export default function AppShell({children}:{children:React.ReactNode}) {
  return (
    <div className='min-h-screen bg-surface dark:bg-surface-dark text-neutral-900 dark:text-neutral-100 noise'>
      <header className='sticky top-0 z-50 border-b border-black/5 dark:border-white/5 bg-white/70 dark:bg-black/30 backdrop-blur supports-[backdrop-filter]:bg-white/60'>
        <div className='max-w-screen-2xl mx-auto flex items-center gap-3 px-4 py-3'>
          <div className='font-semibold tracking-tight'>CollaTeX</div>
          <div className='ml-auto flex items-center gap-2'><ThemeToggle/></div>
        </div>
        <div className='h-px bg-gradient-to-r from-brand-400 via-brand-500 to-brand-400 animate-[pulse_6s_ease-in-out_infinite]' />
      </header>
      <main className='max-w-screen-2xl mx-auto p-4'>{children}</main>
    </div>
  )
}
