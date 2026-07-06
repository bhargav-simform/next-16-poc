export type IssueSeverity = "critical" | "high" | "medium" | "low";

export type IssueType =
  | "dependency"
  | "architecture"
  | "performance"
  | "maintainability"
  | "security";

export interface Issue {
  type: IssueType;
  severity: IssueSeverity;
  file: string;
  message: string;
  line?: number;
  analyzer: "dependency" | "structure" | "code-quality" | "security";
}

export interface DependencyAnalysisResult {
  framework: string | null;
  frameworkVersion: string | null;
  libraries: { name: string; version: string; isDev: boolean }[];
  scripts: Record<string, string>;
  issues: Issue[];
}

export interface StructureAnalysisResult {
  architecturePattern: "app-router" | "pages-router" | "hybrid" | "generic";
  routingApproach: string;
  folderOrganization: {
    topLevelDirs: string[];
    hasServicesLayer: boolean;
    hasComponentsLayer: boolean;
    hasTypesLayer: boolean;
  };
  issues: Issue[];
}

export interface CodeQualityAnalysisResult {
  largeFiles: { file: string; lines: number }[];
  complexComponents: { file: string; score: number; reasons: string[] }[];
  duplicateImports: { file: string; module: string; count: number }[];
  consoleStatements: { file: string; line: number }[];
  todoComments: { file: string; line: number; text: string }[];
  unusedFiles: string[];
  issues: Issue[];
}

export interface SecurityAnalysisResult {
  secretsFound: { file: string; line: number; kind: string }[];
  committedEnvFiles: string[];
  riskyPatterns: { file: string; line: number; pattern: string }[];
  issues: Issue[];
}

export interface AnalysisReport {
  framework: string | null;
  score: number;
  issues: Issue[];
  summary: {
    totalIssues: number;
    bySeverity: Record<IssueSeverity, number>;
  };
  dependency: DependencyAnalysisResult;
  structure: StructureAnalysisResult;
  codeQuality: CodeQualityAnalysisResult;
  security: SecurityAnalysisResult;
  analyzedAt: string;
}
