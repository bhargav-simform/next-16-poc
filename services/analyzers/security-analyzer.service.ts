import { readFile } from "node:fs/promises";
import {
  ENV_FILE_ALLOWLIST,
  MAX_FILE_READ_BYTES,
  RISKY_PATTERNS,
  SCANNABLE_EXTENSIONS,
  SECRET_PATTERNS,
} from "@/lib/analysis-constants";
import { walkFiles } from "@/lib/file-walker";
import type { Issue, SecurityAnalysisResult } from "@/types/analysis.types";

const ENV_FILENAME_REGEX = /^\.env(\..+)?$/;
const USE_CLIENT_REGEX = /^\s*["']use client["'];?\s*$/;
const NON_PUBLIC_PROCESS_ENV_REGEX = /process\.env\.([A-Z0-9_]+)/g;

function isClientComponent(content: string): boolean {
  const firstLines = content.split("\n").slice(0, 5);
  return firstLines.some((line) => USE_CLIENT_REGEX.test(line));
}

export async function analyzeSecurity(workspacePath: string): Promise<SecurityAnalysisResult> {
  const issues: Issue[] = [];
  const secretsFound: SecurityAnalysisResult["secretsFound"] = [];
  const committedEnvFiles: string[] = [];
  const riskyPatterns: SecurityAnalysisResult["riskyPatterns"] = [];

  const allFiles = await walkFiles(workspacePath);

  for (const file of allFiles) {
    if (ENV_FILENAME_REGEX.test(file.name) && !ENV_FILE_ALLOWLIST.has(file.name)) {
      committedEnvFiles.push(file.relativePath);
      issues.push({
        type: "security",
        severity: "critical",
        file: file.relativePath,
        message: "Committed .env file may contain secrets",
        analyzer: "security",
      });
    }
  }

  const scannableFiles = allFiles.filter(
    (file) =>
      (SCANNABLE_EXTENSIONS.has(file.extension) || ENV_FILENAME_REGEX.test(file.name)) &&
      file.size <= MAX_FILE_READ_BYTES,
  );

  for (const file of scannableFiles) {
    let content: string;
    try {
      content = await readFile(file.absolutePath, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split("\n");

    lines.forEach((line, index) => {
      for (const pattern of SECRET_PATTERNS) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(line)) {
          secretsFound.push({ file: file.relativePath, line: index + 1, kind: pattern.kind });
          issues.push({
            type: "security",
            severity: pattern.severity,
            file: file.relativePath,
            line: index + 1,
            message: `Potential secret detected: ${pattern.kind}`,
            analyzer: "security",
          });
        }
      }

      for (const pattern of RISKY_PATTERNS) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(line)) {
          riskyPatterns.push({ file: file.relativePath, line: index + 1, pattern: pattern.name });
          issues.push({
            type: "security",
            severity: pattern.severity,
            file: file.relativePath,
            line: index + 1,
            message: `Risky pattern detected: ${pattern.name}`,
            analyzer: "security",
          });
        }
      }
    });

    if (isClientComponent(content)) {
      lines.forEach((line, index) => {
        NON_PUBLIC_PROCESS_ENV_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = NON_PUBLIC_PROCESS_ENV_REGEX.exec(line)) !== null) {
          if (!match[1].startsWith("NEXT_PUBLIC_")) {
            riskyPatterns.push({
              file: file.relativePath,
              line: index + 1,
              pattern: `process.env.${match[1]} in client component`,
            });
            issues.push({
              type: "security",
              severity: "high",
              file: file.relativePath,
              line: index + 1,
              message: `Non-public env var 'process.env.${match[1]}' referenced in client component`,
              analyzer: "security",
            });
          }
        }
      });
    }
  }

  return { secretsFound, committedEnvFiles, riskyPatterns, issues };
}
