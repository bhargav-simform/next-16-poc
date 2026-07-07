"use server";

import path from "node:path";
import { updateTag } from "next/cache";
import { analyzeRepository } from "@/services/analysis-orchestrator.service";
import {
  getRepositoryReport,
  repositoryReportTag,
  upsertRepositoryReport,
} from "@/services/db.service";

const WORKSPACES_ROOT = path.join(process.cwd(), ".workspaces");

export async function reanalyzeRepositoryAction(repositoryId: string): Promise<void> {
  const existing = await getRepositoryReport(repositoryId);
  if (!existing) return;

  const workspacePath = path.join(WORKSPACES_ROOT, repositoryId);
  const analysis = await analyzeRepository(workspacePath);

  await upsertRepositoryReport({
    repositoryId,
    workspacePath: existing.workspacePath,
    owner: existing.owner,
    repo: existing.repo,
    report: analysis,
  });

  // Next.js 16: Revalidation — read-your-own-writes so Refresh shows the new result immediately,
  // not a stale-while-revalidate window. updateTag is Server-Action-only.
  updateTag(repositoryReportTag(repositoryId));
}
