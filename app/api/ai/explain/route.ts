import { explain, OllamaError } from "@/services/ollama.service";
import type { AnalysisReport, Issue } from "@/types/analysis.types";

export const maxDuration = 120;

export async function POST(request: Request) {
  const { report, issue } = (await request.json()) as { report: AnalysisReport; issue: Issue };
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of explain(report, issue, { signal: request.signal })) {
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
