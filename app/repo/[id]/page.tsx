import { notFound } from "next/navigation";
import { AiInsights, ExplainIssueButton } from "@/components/ai-insights";
import { RefreshAnalysisButton } from "@/components/refresh-analysis-button";
import { RepoChat } from "@/components/repo-chat";
import { ScoreBadge } from "@/components/score-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCachedRepositoryReport } from "@/services/db.service";

export default async function RepoDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: repositoryId } = await params;

  // Next.js 16: Server Component — reads the persisted report directly at render time,
  // no client-side fetch/useEffect needed.
  const row = await getCachedRepositoryReport(repositoryId);
  if (!row) notFound();

  const { report, workspacePath, owner, repo } = row;
  const topIssues = report.issues.slice(0, 10);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Repository
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {owner}
            <span className="text-muted-foreground">/</span>
            {repo}
          </h1>
        </div>
        <RefreshAnalysisButton repositoryId={repositoryId} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ScoreBadge score={report.score} />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{report.framework ?? "Unknown framework"}</Badge>
              <span className="text-sm text-muted-foreground">
                {report.summary.totalIssues} issue{report.summary.totalIssues === 1 ? "" : "s"}{" "}
                found
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Last analyzed {new Date(report.analyzedAt).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {topIssues.length === 0 ? (
            <p className="text-sm text-muted-foreground">No issues found. Nice work.</p>
          ) : (
            <ul className="flex flex-col">
              {topIssues.map((issue, index) => (
                <li key={index}>
                  {index > 0 && <Separator />}
                  <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-1 flex-wrap items-center gap-2">
                      <SeverityBadge severity={issue.severity} />
                      <span className="text-sm">{issue.message}</span>
                      {issue.file && (
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {issue.file}
                        </code>
                      )}
                    </div>
                    <ExplainIssueButton report={report} issue={issue} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Streaming UI for AI responses — existing Route Handler + reader pattern, unchanged */}
      <AiInsights report={report} />
      <RepoChat workspacePath={workspacePath} />
    </div>
  );
}
