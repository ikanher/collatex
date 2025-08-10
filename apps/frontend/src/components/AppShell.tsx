import { ThemeToggle } from './ThemeToggle'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className='min-h-screen-dvh grid grid-rows-[auto,1fr,auto] bg-neutral-50 dark:bg-[#0b0d12] text-neutral-900 dark:text-neutral-100 noise'>
      <header className='sticky top-0 z-50 border-b border-black/5 dark:border-white/5 bg-white/70 dark:bg-black/30 backdrop-blur supports-[backdrop-filter]:bg-white/60'>
        <div className='max-w-screen-2xl mx-auto h-[var(--header-h)] flex items-center gap-3 px-4'>
          <div className='text-lg font-semibold tracking-tight'>CollaTeX</div>
          <div className='ml-auto flex items-center gap-2'><ThemeToggle /></div>
        </div>
        <div className='h-1 bg-gradient-to-r from-brand-400 via-brand-500 to-brand-400 animate-[pulse_6s_ease-in-out_infinite]' />
      </header>
      <main className='min-h-0 max-w-screen-2xl w-full mx-auto p-4'>{children}</main>
      <footer className='border-t border-black/5 dark:border-white/5 text-xs text-neutral-500 dark:text-neutral-400 px-4 py-2'>
        © {new Date().getFullYear()} CollaTeX
      </footer>
    </div>
  )
}
