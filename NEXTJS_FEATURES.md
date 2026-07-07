# Next.js 16 Features Demonstrated

| Feature | File | Notes |
|---|---|---|
| Server Components | [`app/repo/[id]/page.tsx`](app/repo/[id]/page.tsx) | Async Server Component reads the persisted repository report directly at render time — no client-side fetch/`useEffect`. |
| Server Actions | [`actions/ingest-repository.action.ts`](actions/ingest-repository.action.ts), [`actions/reanalyze-repository.action.ts`](actions/reanalyze-repository.action.ts) | Repository import (clone + analyze + persist + redirect) and the "Refresh Analysis" trigger. |
| Streaming UI | [`app/api/ai/analyze/route.ts`](app/api/ai/analyze/route.ts) (and sibling `explain`/`recommend`/`qa` routes) | `ReadableStream` responses consumed chunk-by-chunk via `streamAiResponse` in [`components/ai-insights.tsx`](components/ai-insights.tsx) and [`components/repo-chat.tsx`](components/repo-chat.tsx). |
| Suspense | [`app/repo/[id]/loading.tsx`](app/repo/[id]/loading.tsx) | Auto-wraps the dashboard page in a Suspense boundary; shown while the repository report is loading/computing (guaranteed on the first load right after ingestion redirects here). |
| Cache Components (`"use cache"`) | [`services/db.service.ts`](services/db.service.ts) (`getCachedRepositoryReport`) | `cacheLife("minutes")` + `cacheTag(repositoryReportTag(id))`. Requires `cacheComponents: true` in [`next.config.ts`](next.config.ts). |
| Revalidation | [`actions/reanalyze-repository.action.ts`](actions/reanalyze-repository.action.ts) | `updateTag(repositoryReportTag(id))` — read-your-own-writes so "Refresh Analysis" shows the new result immediately, not stale-while-revalidate. |

## How they fit together

1. A user submits a GitHub URL on the ingestion page (`app/page.tsx` / `components/ingest-form.tsx`). The `ingestRepositoryAction` **Server Action** clones the repo, runs static analysis, persists the resulting `AnalysisReport` as JSONB in a new `repository_reports` table, then `redirect()`s to `/repo/[id]`.
2. `/repo/[id]` is a **Server Component**. Its sibling `loading.tsx` provides the **Suspense** fallback while `getCachedRepositoryReport` — a **Cache Components** (`"use cache"`) function — reads the report from Postgres.
3. Clicking "Refresh Analysis" invokes the `reanalyzeRepositoryAction` **Server Action**, which re-runs analysis against the still-on-disk workspace, updates the persisted row, and calls `updateTag` for **Revalidation** — the next read (even in another browser tab) sees the fresh result immediately.
4. The AI Summary/Recommendations/Explain buttons and the repository chat all hit dedicated Route Handlers that return a `ReadableStream`, giving token-by-token **Streaming UI** as Ollama generates its response.
