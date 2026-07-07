import { analyze, OllamaError } from "@/services/ollama.service";
import type { AnalysisReport } from "@/types/analysis.types";

// Next.js 16: Streaming UI — Route Handler returns a ReadableStream, consumed via
// fetch + reader in components/ai-insights.tsx (see streamAiResponse there). The 3 sibling
// AI route handlers (explain/recommend/qa) all follow this same pattern.
export const maxDuration = 120;

export async function POST(request: Request) {
  const { report } = (await request.json()) as { report: AnalysisReport };
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of analyze(report, { signal: request.signal })) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (error) {
        const message =
          error instanceof OllamaError ? error.message : "AI generation failed unexpectedly.";
        controller.enqueue(encoder.encode(`\n\n[error] ${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
