import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { IGNORED_DIRECTORIES } from "@/lib/ignore-patterns";
import type { Issue, StructureAnalysisResult } from "@/types/analysis.types";

const ROUTER_ENTRY_BASENAMES = new Set(["layout", "page"]);
const PAGES_ENTRY_BASENAMES = new Set(["_app", "_document"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);

async function listDirNames(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

async function listFiles(dirPath: string): Promise<{ name: string; ext: string }[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => ({ name: entry.name, ext: path.extname(entry.name) }));
  } catch {
    return [];
  }
}

async function hasRouterEntryFiles(dirPath: string): Promise<boolean> {
  const files = await listFiles(dirPath);
  return files.some((file) => ROUTER_ENTRY_BASENAMES.has(path.basename(file.name, file.ext)));
}

async function hasPagesRouterFiles(dirPath: string): Promise<boolean> {
  const files = await listFiles(dirPath);
  if (files.some((file) => PAGES_ENTRY_BASENAMES.has(path.basename(file.name, file.ext)))) {
    return true;
  }
  return files.some((file) => SOURCE_EXTENSIONS.has(file.ext));
}

async function resolveRouterDir(
  rootPath: string,
  dirName: string,
): Promise<string | null> {
  const candidates = [path.join(rootPath, dirName), path.join(rootPath, "src", dirName)];
  for (const candidate of candidates) {
    const files = await listFiles(candidate);
    if (files.length > 0) return candidate;
  }
  return null;
}

async function packageJsonHasNext(rootPath: string): Promise<boolean> {
  try {
    const raw = await readFile(path.join(rootPath, "package.json"), "utf-8");
    const parsed = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return "next" in (parsed.dependencies ?? {}) || "next" in (parsed.devDependencies ?? {});
  } catch {
    return false;
  }
}

export async function analyzeStructure(workspacePath: string): Promise<StructureAnalysisResult> {
  const issues: Issue[] = [];

  const appDir = await resolveRouterDir(workspacePath, "app");
  const pagesDir = await resolveRouterDir(workspacePath, "pages");

  const isAppRouter = appDir ? await hasRouterEntryFiles(appDir) : false;
  const isPagesRouter = pagesDir ? await hasPagesRouterFiles(pagesDir) : false;

  let architecturePattern: StructureAnalysisResult["architecturePattern"];
  let routingApproach: string;

  if (isAppRouter && isPagesRouter) {
    architecturePattern = "hybrid";
    routingApproach = "Next.js App Router and Pages Router used together";
  } else if (isAppRouter) {
    architecturePattern = "app-router";
    routingApproach = "Next.js App Router (file-based routing under app/)";
  } else if (isPagesRouter) {
    architecturePattern = "pages-router";
    routingApproach = "Next.js Pages Router (file-based routing under pages/)";
  } else {
    architecturePattern = "generic";
    routingApproach = "No recognized Next.js routing convention detected";
  }

  const topLevelDirs = (await listDirNames(workspacePath)).filter(
    (name) => !IGNORED_DIRECTORIES.has(name),
  );
  const srcDirs = topLevelDirs.includes("src")
    ? await listDirNames(path.join(workspacePath, "src"))
    : [];
  const allTopLevelDirs = [...new Set([...topLevelDirs, ...srcDirs])];

  const folderOrganization = {
    topLevelDirs: allTopLevelDirs,
    hasServicesLayer: allTopLevelDirs.includes("services"),
    hasComponentsLayer: allTopLevelDirs.includes("components"),
    hasTypesLayer: allTopLevelDirs.includes("types"),
  };

  if (architecturePattern === "hybrid") {
    issues.push({
      type: "architecture",
      severity: "medium",
      file: "",
      message: "Mixing App Router and Pages Router increases maintenance complexity",
      analyzer: "structure",
    });
  }

  if (architecturePattern === "generic" && (await packageJsonHasNext(workspacePath))) {
    issues.push({
      type: "architecture",
      severity: "high",
      file: "package.json",
      message: "Next.js dependency detected but no recognized routing structure found",
      analyzer: "structure",
    });
  }

  const rootFiles = await listFiles(workspacePath);
  const rootSourceFileCount = rootFiles.filter((file) => SOURCE_EXTENSIONS.has(file.ext)).length;
  if (rootSourceFileCount > 30 && !folderOrganization.hasServicesLayer && !folderOrganization.hasComponentsLayer) {
    issues.push({
      type: "architecture",
      severity: "low",
      file: "",
      message: "Flat file organization may hinder maintainability",
      analyzer: "structure",
    });
  }

  return { architecturePattern, routingApproach, folderOrganization, issues };
}
