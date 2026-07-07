"use server";

import { redirect } from "next/navigation";
import { analyzeRepository } from "@/services/analysis-orchestrator.service";
import { upsertRepositoryReport } from "@/services/db.service";
import { cloneRepository, GitCloneError } from "@/services/git-clone.service";
import { deriveRepositoryId, indexRepository } from "@/services/indexing-orchestrator.service";
import { readRepositoryMetadata } from "@/services/repository-metadata.service";
import {
  RepositoryValidationError,
  validateRepositoryUrl,
} from "@/services/repository-validator.service";
import { createWorkspace, removeWorkspace } from "@/services/workspace.service";
import type { AnalysisReport } from "@/types/analysis.types";
import type { IngestionActionState } from "@/types/ingestion.types";

export async function ingestRepositoryAction(
  _prevState: IngestionActionState,
  formData: FormData,
): Promise<IngestionActionState> {
  const repositoryUrl = String(formData.get("repositoryUrl") ?? "");

  let validated;
  try {
    validated = await validateRepositoryUrl(repositoryUrl);
  } catch (error) {
    if (error instanceof RepositoryValidationError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Unexpected error validating the repository URL." };
  }

  const workspacePath = await createWorkspace();
  let repositoryId: string | null = null;

  try {
    await cloneRepository(validated.cloneUrl, workspacePath);
    const data = await readRepositoryMetadata(
      workspacePath,
      validated.owner,
      validated.repo,
      validated.defaultBranch,
    );

    let analysis: AnalysisReport | null = null;
    try {
      analysis = await analyzeRepository(workspacePath);
    } catch {
      analysis = null;
    }

    try {
      await indexRepository(workspacePath);
    } catch {
      // best-effort QA indexing; the dashboard doesn't gate on this succeeding
    }

    if (analysis) {
      repositoryId = deriveRepositoryId(workspacePath);
      // Next.js 16: persisted so the dashboard Server Component can read it after redirect / across refreshes
      await upsertRepositoryReport({
        repositoryId,
        workspacePath,
        owner: data.owner,
        repo: data.repo,
        report: analysis,
      });
    }
  } catch (error) {
    await removeWorkspace(workspacePath);
    if (error instanceof GitCloneError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Unexpected error while ingesting the repository." };
  }

  if (!repositoryId) {
    return {
      status: "error",
      message: "Repository was cloned but analysis failed. Please try again.",
    };
  }

  // Next.js 16: Server Action redirect — kept outside the try/catch above since redirect()
  // throws internally (NEXT_REDIRECT) and must not be caught and swallowed as a generic error.
  redirect(`/repo/${repositoryId}`);
}
