export default function EditorLayout() {
  return (
    <div className='grid grid-cols-12 gap-4 h-[calc(100dvh-var(--header-h)-2rem)] min-h-0'>
      <aside className='col-span-3 xl:col-span-2 min-h-0 h-full rounded-sm border border-border bg-card shadow-soft overflow-auto p-3'>
        {/* Project tree + actions */}
      </aside>
      <section className='col-span-9 xl:col-span-10 grid grid-cols-12 gap-4 min-h-0'>
        <div className='col-span-6 flex flex-col rounded-sm border border-border bg-card shadow-soft overflow-hidden min-h-0'>
          <div className='bg-card/80 backdrop-blur border-b border-border px-2 py-1 flex items-center gap-1'>
            {/* Editor toolbar */}
          </div>
          <div className='flex-1 min-h-0'>
            {/* CodeMirror editor */}
          </div>
        </div>
        <div className='col-span-6 flex flex-col rounded-sm border border-border bg-card shadow-soft overflow-hidden min-h-0'>
          <div className='bg-card/80 backdrop-blur border-b border-border px-2 py-1 flex items-center gap-1'>
            {/* Preview toolbar */}
          </div>
          <div className='flex-1 min-h-0 overflow-auto'>
            {/* Preview content */}
          </div>
        </div>
      </section>
    </div>
  )
}
