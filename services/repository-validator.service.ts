const GITHUB_URL_PATTERN =
  /^https:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)\/([a-zA-Z0-9._-]+?)(?:\.git)?\/?$/;

export interface ValidatedRepository {
  owner: string;
  repo: string;
  cloneUrl: string;
  defaultBranch: string;
}

export class RepositoryValidationError extends Error {}

export async function validateRepositoryUrl(rawUrl: string): Promise<ValidatedRepository> {
  const trimmed = rawUrl.trim();
  const match = GITHUB_URL_PATTERN.exec(trimmed);

  if (!match) {
    throw new RepositoryValidationError(
      "Only GitHub HTTPS URLs are supported, e.g. https://github.com/owner/repo",
    );
  }

  const [, owner, repo] = match;

  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch {
    throw new RepositoryValidationError(
      "Could not reach GitHub to verify the repository. Check your network connection.",
    );
  }

  if (response.status === 404) {
    throw new RepositoryValidationError(
      "Repository not found. It may be private, misspelled, or deleted.",
    );
  }

  if (!response.ok) {
    throw new RepositoryValidationError(
      `GitHub API returned an unexpected error (status ${response.status}).`,
    );
  }

  const json = (await response.json()) as { default_branch?: string; private?: boolean };

  if (json.private) {
    throw new RepositoryValidationError("Private repositories are not supported yet.");
  }

  return {
    owner,
    repo,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    defaultBranch: json.default_branch ?? "main",
  };
}
