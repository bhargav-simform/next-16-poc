"use client";

import { useActionState } from "react";
import { ingestRepositoryAction } from "@/actions/ingest-repository.action";
import { AiInsights, ExplainIssueButton } from "@/components/ai-insights";
import { RepoChat } from "@/components/repo-chat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AnalysisReport } from "@/types/analysis.types";
import type { IngestionActionState } from "@/types/ingestion.types";

const initialState: IngestionActionState = { status: "idle" };

export function IngestForm() {
  const [state, formAction, isPending] = useActionState(ingestRepositoryAction, initialState);

  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <form action={formAction} className="flex gap-2">
        <Input
          name="repositoryUrl"
          placeholder="https://github.com/owner/repo"
          required
          disabled={isPending}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Ingesting..." : "Ingest"}
        </Button>
      </form>

      {state.status === "error" && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      {state.status === "success" && (
        <div className="rounded-md border p-4 text-sm">
          <p className="font-medium">
            {state.data.owner}/{state.data.repo}
          </p>
          <p className="text-muted-foreground">Workspace: {state.workspacePath}</p>
          <p className="text-muted-foreground">
            Branch: {state.data.defaultBranch} · Commit: {state.data.latestCommit.hash.slice(0, 7)}
          </p>
          <p className="text-muted-foreground">
            Files: {state.data.fileCount} · Directories: {state.data.directoryCount} · Language:{" "}
            {state.data.primaryLanguage ?? "unknown"}
          </p>
          {state.data.packageJson && (
            <p className="text-muted-foreground">
              package.json: {state.data.packageJson.name} (
              {state.data.packageJson.dependencyCount} deps)
            </p>
          )}

          {state.analysis && (
            <AnalysisSection analysis={state.analysis} />
          )}

          {state.qaIndexed && <RepoChat workspacePath={state.workspacePath} />}
        </div>
      )}
    </div>
  );
}

function AnalysisSection({ analysis }: { analysis: AnalysisReport }) {
  return (
    <div className="mt-2 border-t pt-2">
      <p className="font-medium">
        Score: {analysis.score}/100 · Framework: {analysis.framework ?? "Unknown"}
      </p>
      <ul className="list-disc pl-4 text-muted-foreground">
        {analysis.issues.slice(0, 10).map((issue, index) => (
          <li key={index} className="flex items-center gap-2">
            <span>
              [{issue.severity}] {issue.message}
              {issue.file && ` (${issue.file})`}
            </span>
            <ExplainIssueButton report={analysis} issue={issue} />
          </li>
        ))}
      </ul>

      <AiInsights report={analysis} />
    </div>
  );
}
