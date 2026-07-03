import simpleGit from "simple-git";

const CLONE_TIMEOUT_MS = 60_000;

export class GitCloneError extends Error {}

export async function cloneRepository(cloneUrl: string, targetPath: string): Promise<void> {
  const git = simpleGit({ timeout: { block: CLONE_TIMEOUT_MS } });

  try {
    await git.clone(cloneUrl, targetPath, ["--depth", "1"]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new GitCloneError(`Failed to clone repository: ${message}`);
  }
}
