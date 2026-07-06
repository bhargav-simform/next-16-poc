import {
  OLLAMA_BASE_URL,
  OLLAMA_CONNECT_TIMEOUT_MS,
  OLLAMA_EMBEDDING_MODEL,
  OLLAMA_MAX_RETRIES,
  OLLAMA_MODEL,
  OLLAMA_RETRY_BACKOFF_MS,
  OLLAMA_TEMPERATURE,
} from "@/lib/ollama-constants";
import type { AnalysisReport, Issue } from "@/types/analysis.types";

export type OllamaErrorCause = "unreachable" | "model-not-found" | "timeout" | "aborted" | "unknown";

export class OllamaError extends Error {
  constructor(
    message: string,
    public readonly cause?: OllamaErrorCause,
  ) {
    super(message);
    this.name = "OllamaError";
  }
}

export interface OllamaStreamOptions {
  signal?: AbortSignal;
}

interface OllamaGenerateChunk {
  response?: string;
  done: boolean;
  error?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown, aborted: boolean): OllamaError {
  if (error instanceof OllamaError) return error;

  if (aborted) {
    return new OllamaError("Ollama did not respond in time.", "timeout");
  }

  if (error instanceof Error && error.name === "AbortError") {
    return new OllamaError("Ollama did not respond in time.", "timeout");
  }

  const message = error instanceof Error ? error.message : String(error);
  return new OllamaError(
    `Could not reach Ollama at ${OLLAMA_BASE_URL} (${message}). Is 'ollama serve' running?`,
    "unreachable",
  );
}

function summarizeReportForPrompt(report: AnalysisReport) {
  return {
    framework: report.framework,
    score: report.score,
    totalIssues: report.summary.totalIssues,
    bySeverity: report.summary.bySeverity,
    topIssues: report.issues.slice(0, 20).map((issue) => ({
      type: issue.type,
      severity: issue.severity,
      file: issue.file,
      message: issue.message,
    })),
  };
}

function buildAnalyzePrompt(report: AnalysisReport): string {
  const summary = JSON.stringify(summarizeReportForPrompt(report), null, 2);
  return `You are a senior software architect reviewing a static analysis report for a codebase. Given the following JSON summary, write a concise narrative (3-5 paragraphs) covering: overall health, the most significant risk areas, and one sentence per analyzer category (dependency, structure, code-quality, security). Do not repeat the raw JSON back.

\`\`\`json
${summary}
\`\`\``;
}

function buildExplainPrompt(report: AnalysisReport, issue: Issue): string {
  const issueJson = JSON.stringify(issue, null, 2);
  return `You are explaining one specific issue found during static analysis to a developer. Given the issue below and the overall report context (framework: ${report.framework ?? "unknown"}, score: ${report.score}/100), explain in plain English: what the issue means, why it matters, and what could go wrong if ignored. Keep it to 2-3 short paragraphs.

\`\`\`json
${issueJson}
\`\`\``;
}

function buildRecommendationPrompt(report: AnalysisReport): string {
  const summary = JSON.stringify(summarizeReportForPrompt(report), null, 2);
  return `You are producing a prioritized action plan from a static analysis report. Given the JSON summary below, list concrete fix recommendations ordered by severity (critical first), each as a short actionable bullet: what to do, which file(s), and expected impact. Synthesize related issues into single action items where they overlap rather than repeating the raw issue text verbatim.

\`\`\`json
${summary}
\`\`\``;
}

async function* callOllama(
  prompt: string,
  options?: OllamaStreamOptions,
): AsyncGenerator<string> {
  const externalSignal = options?.signal;
  let attempt = 0;

  while (true) {
    if (externalSignal?.aborted) {
      throw new OllamaError("Request was cancelled.", "aborted");
    }

    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_CONNECT_TIMEOUT_MS);

    let firstByteReceived = false;
    let timedOut = false;

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          prompt,
          stream: true,
          options: { temperature: OLLAMA_TEMPERATURE, num_ctx: 4096 },
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        if (response.status === 404) {
          throw new OllamaError(
            `Model '${OLLAMA_MODEL}' is not available. Run: ollama pull ${OLLAMA_MODEL}`,
            "model-not-found",
          );
        }
        throw new OllamaError(`Ollama returned HTTP ${response.status}`, "unknown");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = JSON.parse(line) as OllamaGenerateChunk;

          if (parsed.error) {
            const cause = /not found/i.test(parsed.error) ? "model-not-found" : "unknown";
            throw new OllamaError(parsed.error, cause);
          }

          if (parsed.response) {
            if (!firstByteReceived) {
              firstByteReceived = true;
              clearTimeout(timeoutId);
            }
            yield parsed.response;
          }

          if (parsed.done) return;
        }
      }
      return;
    } catch (error) {
      clearTimeout(timeoutId);
      timedOut = controller.signal.aborted && !externalSignal?.aborted;

      if (firstByteReceived) {
        throw normalizeError(error, timedOut);
      }

      if (externalSignal?.aborted) {
        throw new OllamaError("Request was cancelled.", "aborted");
      }

      if (error instanceof OllamaError && error.cause === "model-not-found") {
        throw error;
      }

      attempt++;
      if (attempt > OLLAMA_MAX_RETRIES) {
        throw normalizeError(error, timedOut);
      }

      await sleep(OLLAMA_RETRY_BACKOFF_MS[attempt - 1]);
    } finally {
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }
  }
}

export function analyze(
  report: AnalysisReport,
  options?: OllamaStreamOptions,
): AsyncGenerator<string> {
  return callOllama(buildAnalyzePrompt(report), options);
}

export function explain(
  report: AnalysisReport,
  issue: Issue,
  options?: OllamaStreamOptions,
): AsyncGenerator<string> {
  return callOllama(buildExplainPrompt(report, issue), options);
}

export function generateRecommendation(
  report: AnalysisReport,
  options?: OllamaStreamOptions,
): AsyncGenerator<string> {
  return callOllama(buildRecommendationPrompt(report), options);
}

export function answerFromContext(
  prompt: string,
  options?: OllamaStreamOptions,
): AsyncGenerator<string> {
  return callOllama(prompt, options);
}

interface OllamaEmbeddingResponse {
  embedding?: number[];
  error?: string;
}

export async function generateEmbedding(
  text: string,
  options?: OllamaStreamOptions,
): Promise<number[]> {
  const externalSignal = options?.signal;
  let attempt = 0;

  while (true) {
    if (externalSignal?.aborted) {
      throw new OllamaError("Request was cancelled.", "aborted");
    }

    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_CONNECT_TIMEOUT_MS);

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: OLLAMA_EMBEDDING_MODEL, prompt: text }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new OllamaError(
            `Model '${OLLAMA_EMBEDDING_MODEL}' is not available. Run: ollama pull ${OLLAMA_EMBEDDING_MODEL}`,
            "model-not-found",
          );
        }
        throw new OllamaError(`Ollama returned HTTP ${response.status}`, "unknown");
      }

      const json = (await response.json()) as OllamaEmbeddingResponse;
      if (!json.embedding) {
        throw new OllamaError(json.error ?? "Ollama returned no embedding.", "unknown");
      }
      return json.embedding;
    } catch (error) {
      clearTimeout(timeoutId);

      if (externalSignal?.aborted) {
        throw new OllamaError("Request was cancelled.", "aborted");
      }

      if (error instanceof OllamaError && error.cause === "model-not-found") {
        throw error;
      }

      attempt++;
      if (attempt > OLLAMA_MAX_RETRIES) {
        throw normalizeError(error, controller.signal.aborted);
      }

      await sleep(OLLAMA_RETRY_BACKOFF_MS[attempt - 1]);
    } finally {
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }
  }
}
