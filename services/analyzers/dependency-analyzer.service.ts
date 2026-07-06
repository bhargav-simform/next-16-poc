import { readFile } from "node:fs/promises";
import path from "node:path";
import type { DependencyAnalysisResult, Issue } from "@/types/analysis.types";

interface PackageJsonShape {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const FRAMEWORK_DETECTORS: { deps: string[]; name: string; versionDep: string }[] = [
  { deps: ["next"], name: "Next.js", versionDep: "next" },
  { deps: ["react-scripts"], name: "Create React App", versionDep: "react-scripts" },
  { deps: ["vite", "react"], name: "Vite + React", versionDep: "vite" },
  { deps: ["vue"], name: "Vue", versionDep: "vue" },
  { deps: ["@angular/core"], name: "Angular", versionDep: "@angular/core" },
  { deps: ["express"], name: "Express", versionDep: "express" },
  { deps: ["react"], name: "React", versionDep: "react" },
];

function stripVersionPrefix(version: string): string {
  return version.replace(/^[\^~]/, "");
}

function detectFramework(
  allDeps: Record<string, string>,
): { framework: string | null; frameworkVersion: string | null } {
  for (const detector of FRAMEWORK_DETECTORS) {
    if (detector.deps.every((dep) => dep in allDeps)) {
      return {
        framework: detector.name,
        frameworkVersion: stripVersionPrefix(allDeps[detector.versionDep] ?? ""),
      };
    }
  }
  return { framework: null, frameworkVersion: null };
}

export async function analyzeDependencies(
  workspacePath: string,
): Promise<DependencyAnalysisResult> {
  const issues: Issue[] = [];
  let parsed: PackageJsonShape | null = null;

  try {
    const raw = await readFile(path.join(workspacePath, "package.json"), "utf-8");
    parsed = JSON.parse(raw) as PackageJsonShape;
  } catch {
    parsed = null;
  }

  if (!parsed) {
    issues.push({
      type: "dependency",
      severity: "high",
      file: "package.json",
      message: "No package.json found at the repository root",
      analyzer: "dependency",
    });
    return {
      framework: null,
      frameworkVersion: null,
      libraries: [],
      scripts: {},
      issues,
    };
  }

  const dependencies = parsed.dependencies ?? {};
  const devDependencies = parsed.devDependencies ?? {};
  const allDeps = { ...dependencies, ...devDependencies };
  const scripts = parsed.scripts ?? {};

  const { framework, frameworkVersion } = detectFramework(allDeps);

  const libraries = [
    ...Object.entries(dependencies).map(([name, version]) => ({ name, version, isDev: false })),
    ...Object.entries(devDependencies).map(([name, version]) => ({ name, version, isDev: true })),
  ];

  const hasBuildScript = "build" in scripts;
  const hasStartOrDevScript = "start" in scripts || "dev" in scripts;

  if (!hasBuildScript) {
    issues.push({
      type: "dependency",
      severity: "medium",
      file: "package.json",
      message: "Missing standard 'build' script",
      analyzer: "dependency",
    });
  }

  if (!hasStartOrDevScript) {
    issues.push({
      type: "dependency",
      severity: "medium",
      file: "package.json",
      message: "Missing standard 'start' or 'dev' script",
      analyzer: "dependency",
    });
  }

  return {
    framework,
    frameworkVersion,
    libraries,
    scripts,
    issues,
  };
}
