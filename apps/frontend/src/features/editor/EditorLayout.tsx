export default function EditorLayout() {
  return (
    <div className='grid grid-cols-12 gap-4'>
      <aside className='col-span-3 xl:col-span-2'>
        <div className='rounded-xl border shadow-soft bg-surface dark:bg-[#111319] p-3 h-[calc(100vh-140px)] overflow-auto'>
          {/* Project tree + actions */}
        </div>
      </aside>
      <section className='col-span-9 xl:col-span-10 grid grid-cols-12 gap-4'>
        <div className='col-span-6 rounded-xl border overflow-hidden bg-surface dark:bg-[#0c0f14]'>
          {/* CodeMirror editor */}
        </div>
        <div className='col-span-6 rounded-xl border bg-surface dark:bg-[#0c0f14] flex flex-col'>
          {/* PDF header + iframe + log drawer */}
        </div>
      </section>
    </div>
  )
}
