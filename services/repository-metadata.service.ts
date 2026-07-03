import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import simpleGit from "simple-git";
import { IGNORED_DIRECTORIES } from "@/lib/ignore-patterns";
import type { RepositoryMetadata } from "@/types/ingestion.types";

interface WalkResult {
  fileCount: number;
  directoryCount: number;
  languageCounts: Map<string, number>;
}

async function walk(dirPath: string): Promise<WalkResult> {
  const result: WalkResult = { fileCount: 0, directoryCount: 0, languageCounts: new Map() };
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;

    if (entry.isDirectory()) {
      result.directoryCount += 1;
      const nested = await walk(path.join(dirPath, entry.name));
      result.fileCount += nested.fileCount;
      result.directoryCount += nested.directoryCount;
      for (const [ext, count] of nested.languageCounts) {
        result.languageCounts.set(ext, (result.languageCounts.get(ext) ?? 0) + count);
      }
      continue;
    }

    if (entry.isFile()) {
      result.fileCount += 1;
      const ext = path.extname(entry.name);
      if (ext) {
        result.languageCounts.set(ext, (result.languageCounts.get(ext) ?? 0) + 1);
      }
    }
  }

  return result;
}

async function readPackageJson(
  repoPath: string,
): Promise<RepositoryMetadata["packageJson"]> {
  try {
    const raw = await readFile(path.join(repoPath, "package.json"), "utf-8");
    const parsed = JSON.parse(raw) as {
      name?: string;
      description?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      name: parsed.name ?? "unknown",
      description: parsed.description ?? null,
      dependencyCount:
        Object.keys(parsed.dependencies ?? {}).length +
        Object.keys(parsed.devDependencies ?? {}).length,
    };
  } catch {
    return null;
  }
}

function detectPrimaryLanguage(languageCounts: Map<string, number>): string | null {
  let topExt: string | null = null;
  let topCount = 0;
  for (const [ext, count] of languageCounts) {
    if (count > topCount) {
      topCount = count;
      topExt = ext;
    }
  }
  return topExt;
}

export async function readRepositoryMetadata(
  repoPath: string,
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<RepositoryMetadata> {
  const git = simpleGit(repoPath);
  const log = await git.log({ maxCount: 1 });
  const latest = log.latest;

  const { fileCount, directoryCount, languageCounts } = await walk(repoPath);
  const packageJson = await readPackageJson(repoPath);

  return {
    owner,
    repo,
    defaultBranch,
    latestCommit: {
      hash: latest?.hash ?? "unknown",
      message: latest?.message ?? "",
      date: latest?.date ?? "",
    },
    fileCount,
    directoryCount,
    primaryLanguage: detectPrimaryLanguage(languageCounts),
    packageJson,
  };
}
