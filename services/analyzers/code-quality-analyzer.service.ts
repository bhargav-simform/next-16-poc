import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  ANALYZABLE_EXTENSIONS,
  COMPLEX_COMPONENT_BRANCH_THRESHOLD,
  COMPLEX_COMPONENT_HOOK_THRESHOLD,
  COMPLEX_COMPONENT_LINE_THRESHOLD,
  COMPLEX_COMPONENT_SCORE_THRESHOLD,
  DUPLICATE_IMPORT_THRESHOLD,
  ENTRY_POINT_BASENAMES,
  LARGE_FILE_HIGH_SEVERITY_THRESHOLD,
  LARGE_FILE_LINE_THRESHOLD,
  MAX_FILE_READ_BYTES,
} from "@/lib/analysis-constants";
import { walkFiles } from "@/lib/file-walker";
import type { CodeQualityAnalysisResult, Issue } from "@/types/analysis.types";

const JSX_EXTENSIONS = new Set([".tsx", ".jsx"]);
const HOOK_CALL_REGEX = /\buse[A-Z]\w*\s*\(/g;
const BRANCH_REGEX = /\b(if|else|switch)\b|\?\s*[^:]+:|&&|\|\|/g;
const IMPORT_MODULE_REGEX = /^\s*import\s+.*?from\s+["']([^"']+)["']/;
const CONSOLE_REGEX = /console\.(log|warn|error|debug|info)\s*\(/;
const TODO_REGEX = /\/\/\s*(TODO|FIXME|HACK)\b(.*)/i;

export async function analyzeCodeQuality(
  workspacePath: string,
): Promise<CodeQualityAnalysisResult> {
  const issues: Issue[] = [];
  const largeFiles: CodeQualityAnalysisResult["largeFiles"] = [];
  const complexComponents: CodeQualityAnalysisResult["complexComponents"] = [];
  const duplicateImports: CodeQualityAnalysisResult["duplicateImports"] = [];
  const consoleStatements: CodeQualityAnalysisResult["consoleStatements"] = [];
  const todoComments: CodeQualityAnalysisResult["todoComments"] = [];

  const allFiles = await walkFiles(workspacePath);
  const analyzableFiles = allFiles.filter(
    (file) => ANALYZABLE_EXTENSIONS.has(file.extension) && file.size <= MAX_FILE_READ_BYTES,
  );

  const importedSpecifiers = new Set<string>();
  const fileContents = new Map<string, string>();

  for (const file of analyzableFiles) {
    let content: string;
    try {
      content = await readFile(file.absolutePath, "utf-8");
    } catch {
      continue;
    }
    fileContents.set(file.relativePath, content);

    const lines = content.split("\n");

    for (const line of lines) {
      const importMatch = line.match(IMPORT_MODULE_REGEX);
      if (importMatch) importedSpecifiers.add(importMatch[1]);
    }
  }

  for (const file of analyzableFiles) {
    const content = fileContents.get(file.relativePath);
    if (content === undefined) continue;
    const lines = content.split("\n");

    if (lines.length > LARGE_FILE_LINE_THRESHOLD) {
      largeFiles.push({ file: file.relativePath, lines: lines.length });
      issues.push({
        type: "maintainability",
        severity: lines.length > LARGE_FILE_HIGH_SEVERITY_THRESHOLD ? "high" : "medium",
        file: file.relativePath,
        message: `Large file detected (${lines.length} lines)`,
        analyzer: "code-quality",
      });
    }

    if (JSX_EXTENSIONS.has(file.extension)) {
      const reasons: string[] = [];
      let score = 0;

      if (lines.length > COMPLEX_COMPONENT_LINE_THRESHOLD) {
        score += 1;
        reasons.push(`exceeds ${COMPLEX_COMPONENT_LINE_THRESHOLD} lines`);
      }

      const hookCount = content.match(HOOK_CALL_REGEX)?.length ?? 0;
      if (hookCount > COMPLEX_COMPONENT_HOOK_THRESHOLD) {
        score += 2;
        reasons.push(`${hookCount} hook calls`);
      }

      const branchCount = content.match(BRANCH_REGEX)?.length ?? 0;
      if (branchCount > COMPLEX_COMPONENT_BRANCH_THRESHOLD) {
        score += 2;
        reasons.push(`${branchCount} branching constructs`);
      }

      if (score >= COMPLEX_COMPONENT_SCORE_THRESHOLD) {
        complexComponents.push({ file: file.relativePath, score, reasons });
        issues.push({
          type: "performance",
          severity: "medium",
          file: file.relativePath,
          message: `Large component detected (${reasons.join(", ")})`,
          analyzer: "code-quality",
        });
      }
    }

    const moduleCounts = new Map<string, number>();
    for (const line of lines) {
      const importMatch = line.match(IMPORT_MODULE_REGEX);
      if (importMatch) {
        moduleCounts.set(importMatch[1], (moduleCounts.get(importMatch[1]) ?? 0) + 1);
      }
    }
    for (const [module, count] of moduleCounts) {
      if (count >= DUPLICATE_IMPORT_THRESHOLD) {
        duplicateImports.push({ file: file.relativePath, module, count });
        issues.push({
          type: "maintainability",
          severity: "low",
          file: file.relativePath,
          message: `Duplicate import of '${module}' — consolidate into one statement`,
          analyzer: "code-quality",
        });
      }
    }

    lines.forEach((line, index) => {
      if (CONSOLE_REGEX.test(line)) {
        consoleStatements.push({ file: file.relativePath, line: index + 1 });
        issues.push({
          type: "maintainability",
          severity: "low",
          file: file.relativePath,
          line: index + 1,
          message: "Console statement found",
          analyzer: "code-quality",
        });
      }

      const todoMatch = line.match(TODO_REGEX);
      if (todoMatch) {
        todoComments.push({ file: file.relativePath, line: index + 1, text: todoMatch[0].trim() });
        issues.push({
          type: "maintainability",
          severity: "low",
          file: file.relativePath,
          line: index + 1,
          message: `${todoMatch[1].toUpperCase()} comment found`,
          analyzer: "code-quality",
        });
      }
    });
  }

  const unusedFiles: string[] = [];
  for (const file of analyzableFiles) {
    const basename = path.basename(file.name, file.extension);
    if (ENTRY_POINT_BASENAMES.has(basename)) continue;
    if (/^app[\\/]|^pages[\\/]|^src[\\/]app[\\/]|^src[\\/]pages[\\/]/.test(file.relativePath)) continue;

    const isReferenced = [...importedSpecifiers].some((specifier) =>
      specifier.endsWith(`/${basename}`) || specifier === basename,
    );

    if (!isReferenced) {
      unusedFiles.push(file.relativePath);
      issues.push({
        type: "maintainability",
        severity: "low",
        file: file.relativePath,
        message: "File appears to be unused (no import references found)",
        analyzer: "code-quality",
      });
    }
  }

  return {
    largeFiles,
    complexComponents,
    duplicateImports,
    consoleStatements,
    todoComments,
    unusedFiles,
    issues,
  };
}
