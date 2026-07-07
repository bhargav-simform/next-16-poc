// Next.js 16: Suspense — this file auto-wraps the sibling page.tsx in a Suspense boundary,
// shown while the cached repository report is being read/computed (guaranteed on first load
// right after ingestion redirects here, since that's always a cache miss).
export default function RepoDashboardLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-7 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-border p-4">
        <div className="size-16 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex flex-1 flex-col gap-2">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-3 w-56 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-5 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
