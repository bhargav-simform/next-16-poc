"use server";

import { cloneRepository, GitCloneError } from "@/services/git-clone.service";
import { readRepositoryMetadata } from "@/services/repository-metadata.service";
import {
  RepositoryValidationError,
  validateRepositoryUrl,
} from "@/services/repository-validator.service";
import { createWorkspace, removeWorkspace } from "@/services/workspace.service";
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

  try {
    await cloneRepository(validated.cloneUrl, workspacePath);
    const data = await readRepositoryMetadata(
      workspacePath,
      validated.owner,
      validated.repo,
      validated.defaultBranch,
    );
    return { status: "success", workspacePath, data };
  } catch (error) {
    await removeWorkspace(workspacePath);
    if (error instanceof GitCloneError) {
      return { status: "error", message: error.message };
    }
    return { status: "error", message: "Unexpected error while ingesting the repository." };
  }
}
