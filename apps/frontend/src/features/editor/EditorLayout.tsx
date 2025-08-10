export default function EditorLayout() {
  return (
    <div className='grid grid-cols-12 gap-4 h-[calc(100dvh-var(--header-h)-2rem)] min-h-0'>
      <aside className='col-span-3 xl:col-span-2 min-h-0 h-full rounded-xl border shadow-sm overflow-auto bg-gradient-to-b from-white to-neutral-50 dark:from-[#10131a] dark:to-[#0c0f14] p-3'>
        {/* Project tree + actions */}
      </aside>
      <section className='col-span-9 xl:col-span-10 grid grid-cols-12 gap-4 min-h-0'>
        <div className='col-span-6 flex flex-col rounded-xl border shadow-sm overflow-hidden bg-gradient-to-b from-white to-neutral-50 dark:from-[#10131a] dark:to-[#0c0f14] min-h-0'>
          <div className='bg-white/60 dark:bg-white/10 border-b border-black/5 dark:border-white/10 backdrop-blur px-2 py-1 flex items-center gap-1'>
            {/* Editor toolbar */}
          </div>
          <div className='flex-1 min-h-0'>
            {/* CodeMirror editor */}
          </div>
        </div>
        <div className='col-span-6 flex flex-col rounded-xl border shadow-sm overflow-hidden bg-gradient-to-b from-white to-neutral-50 dark:from-[#10131a] dark:to-[#0c0f14] min-h-0'>
          <div className='bg-white/60 dark:bg-white/10 border-b border-black/5 dark:border-white/10 backdrop-blur px-2 py-1 flex items-center gap-1'>
            {/* Preview toolbar */}
          </div>
          <div className='flex-1 min-h-0 overflow-auto'>
            {/* PDF header + iframe + log drawer */}
          </div>
        </div>
      </section>
    </div>
  )
}
