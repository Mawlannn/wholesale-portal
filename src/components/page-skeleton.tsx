/** 切换页面时立刻显示的占位骨架（数据回来后替换） */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-4xl animate-pulse" aria-busy="true" aria-live="polite">
      <div className="mb-6 h-9 w-40 rounded-full bg-black/[0.07]" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((k) => <div key={k} className="h-24 rounded-[24px] bg-black/[0.05]" />)}
      </div>
      <div className="space-y-2 rounded-[28px] bg-card p-3 shadow-card">
        {Array.from({ length: rows }).map((_, k) => (
          <div key={k} className="flex items-center gap-3 p-2">
            <div className="h-10 w-10 shrink-0 rounded-full bg-black/[0.06]" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-1/2 rounded-full bg-black/[0.07]" />
              <div className="h-3 w-1/3 rounded-full bg-black/[0.05]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
