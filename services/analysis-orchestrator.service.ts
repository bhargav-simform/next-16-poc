import { SEVERITY_ORDER, SEVERITY_WEIGHTS } from "@/lib/analysis-constants";
import { analyzeCodeQuality } from "@/services/analyzers/code-quality-analyzer.service";
import { analyzeDependencies } from "@/services/analyzers/dependency-analyzer.service";
import { analyzeSecurity } from "@/services/analyzers/security-analyzer.service";
import { analyzeStructure } from "@/services/analyzers/structure-analyzer.service";
import type {
  AnalysisReport,
  CodeQualityAnalysisResult,
  DependencyAnalysisResult,
  Issue,
  IssueSeverity,
  SecurityAnalysisResult,
  StructureAnalysisResult,
} from "@/types/analysis.types";

async function safeDependencyAnalysis(workspacePath: string): Promise<DependencyAnalysisResult> {
  try {
    return await analyzeDependencies(workspacePath);
  } catch {
    return {
      framework: null,
      frameworkVersion: null,
      libraries: [],
      scripts: {},
      issues: [
        {
          type: "dependency",
          severity: "medium",
          file: "",
          message: "Dependency analyzer failed to run",
          analyzer: "dependency",
        },
      ],
    };
  }
}

async function safeStructureAnalysis(workspacePath: string): Promise<StructureAnalysisResult> {
  try {
    return await analyzeStructure(workspacePath);
  } catch {
    return {
      architecturePattern: "generic",
      routingApproach: "Unable to determine routing approach",
      folderOrganization: {
        topLevelDirs: [],
        hasServicesLayer: false,
        hasComponentsLayer: false,
        hasTypesLayer: false,
      },
      issues: [
        {
          type: "architecture",
          severity: "medium",
          file: "",
          message: "Structure analyzer failed to run",
          analyzer: "structure",
        },
      ],
    };
  }
}

async function safeCodeQualityAnalysis(workspacePath: string): Promise<CodeQualityAnalysisResult> {
  try {
    return await analyzeCodeQuality(workspacePath);
  } catch {
    return {
      largeFiles: [],
      complexComponents: [],
      duplicateImports: [],
      consoleStatements: [],
      todoComments: [],
      unusedFiles: [],
      issues: [
        {
          type: "maintainability",
          severity: "medium",
          file: "",
          message: "Code quality analyzer failed to run",
          analyzer: "code-quality",
        },
      ],
    };
  }
}

async function safeSecurityAnalysis(workspacePath: string): Promise<SecurityAnalysisResult> {
  try {
    return await analyzeSecurity(workspacePath);
  } catch {
    return {
      secretsFound: [],
      committedEnvFiles: [],
      riskyPatterns: [],
      issues: [
        {
          type: "security",
          severity: "medium",
          file: "",
          message: "Security analyzer failed to run",
          analyzer: "security",
        },
      ],
    };
  }
}

function computeScore(issues: Issue[]): number {
  const deduction = issues.reduce((sum, issue) => sum + SEVERITY_WEIGHTS[issue.severity], 0);
  return Math.max(0, 100 - deduction);
}

function tallyBySeverity(issues: Issue[]): Record<IssueSeverity, number> {
  const tally: Record<IssueSeverity, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    tally[issue.severity] += 1;
  }
  return tally;
}

function sortBySeverityDesc(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

export async function analyzeRepository(workspacePath: string): Promise<AnalysisReport> {
  const [dependency, structure, codeQuality, security] = await Promise.all([
    safeDependencyAnalysis(workspacePath),
    safeStructureAnalysis(workspacePath),
    safeCodeQualityAnalysis(workspacePath),
    safeSecurityAnalysis(workspacePath),
  ]);

  const allIssues = [
    ...dependency.issues,
    ...structure.issues,
    ...codeQuality.issues,
    ...security.issues,
  ];

  return {
    framework: dependency.framework,
    score: computeScore(allIssues),
    issues: sortBySeverityDesc(allIssues),
    summary: {
      totalIssues: allIssues.length,
      bySeverity: tallyBySeverity(allIssues),
    },
    dependency,
    structure,
    codeQuality,
    security,
    analyzedAt: new Date().toISOString(),
  };
}
