import type { IssueSeverity } from "@/types/analysis.types";

export const SEVERITY_WEIGHTS: Record<IssueSeverity, number> = {
  critical: 15,
  high: 8,
  medium: 4,
  low: 1,
};

export const SEVERITY_ORDER: IssueSeverity[] = ["critical", "high", "medium", "low"];

export const LARGE_FILE_LINE_THRESHOLD = 300;
export const LARGE_FILE_HIGH_SEVERITY_THRESHOLD = 600;
export const COMPLEX_COMPONENT_LINE_THRESHOLD = 200;
export const COMPLEX_COMPONENT_HOOK_THRESHOLD = 8;
export const COMPLEX_COMPONENT_BRANCH_THRESHOLD = 20;
export const COMPLEX_COMPONENT_SCORE_THRESHOLD = 5;
export const DUPLICATE_IMPORT_THRESHOLD = 2;

export const ANALYZABLE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
export const SCANNABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yml",
  ".yaml",
]);
export const MAX_FILE_READ_BYTES = 2_000_000;

export const ENTRY_POINT_BASENAMES = new Set([
  "page",
  "layout",
  "route",
  "middleware",
  "loading",
  "error",
  "not-found",
  "template",
  "default",
  "instrumentation",
  "next.config",
  "tailwind.config",
  "postcss.config",
  "eslint.config",
]);

export const ENV_FILE_ALLOWLIST = new Set([".env.example", ".env.sample", ".env.template"]);

export interface SecretPattern {
  kind: string;
  regex: RegExp;
  severity: IssueSeverity;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { kind: "AWS Access Key ID", regex: /AKIA[0-9A-Z]{16}/g, severity: "critical" },
  {
    kind: "AWS Secret Access Key",
    regex: /(?:aws[_-]?secret[_-]?access[_-]?key|secret[_-]?access[_-]?key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    severity: "critical",
  },
  {
    kind: "Generic API Key",
    regex: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_-]{16,}['"]/gi,
    severity: "high",
  },
  {
    kind: "Private Key Header",
    regex: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: "critical",
  },
  {
    kind: "Hardcoded Password",
    regex: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    severity: "high",
  },
  {
    kind: "Hardcoded Token",
    regex: /(?:token|secret|access[_-]?token)\s*[:=]\s*['"][A-Za-z0-9_.-]{16,}['"]/gi,
    severity: "high",
  },
  { kind: "Slack Token", regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g, severity: "critical" },
  { kind: "GitHub Token", regex: /gh[pousr]_[A-Za-z0-9]{36,}/g, severity: "critical" },
  { kind: "Generic Bearer Token", regex: /Bearer\s+[A-Za-z0-9_.-]{20,}/g, severity: "high" },
];

export interface RiskyPattern {
  name: string;
  regex: RegExp;
  severity: IssueSeverity;
}

export const RISKY_PATTERNS: RiskyPattern[] = [
  { name: "eval() usage", regex: /\beval\s*\(/g, severity: "high" },
  { name: "dangerouslySetInnerHTML", regex: /dangerouslySetInnerHTML/g, severity: "medium" },
  { name: "new Function() usage", regex: /new\s+Function\s*\(/g, severity: "high" },
];
