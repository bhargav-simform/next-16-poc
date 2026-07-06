"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AnalysisReport, Issue } from "@/types/analysis.types";

async function streamAiResponse(
  url: string,
  body: unknown,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

function StreamingAction({
  label,
  streamingLabel,
  url,
  body,
}: {
  label: string;
  streamingLabel: string;
  url: string;
  body: unknown;
}) {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  async function run() {
    setText("");
    setIsStreaming(true);
    try {
      await streamAiResponse(url, body, (chunk) => setText((prev) => prev + chunk));
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" size="sm" variant="outline" onClick={run} disabled={isStreaming}>
        {isStreaming ? streamingLabel : label}
      </Button>
      {text && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{text}</p>}
    </div>
  );
}

export function AiInsights({ report }: { report: AnalysisReport }) {
  return (
    <div className="mt-2 flex flex-col gap-3 border-t pt-2">
      <p className="font-medium">AI Insights (local, via Ollama)</p>
      <StreamingAction
        label="AI Summary"
        streamingLabel="Analyzing..."
        url="/api/ai/analyze"
        body={{ report }}
      />
      <StreamingAction
        label="Recommendations"
        streamingLabel="Generating..."
        url="/api/ai/recommend"
        body={{ report }}
      />
    </div>
  );
}

export function ExplainIssueButton({ report, issue }: { report: AnalysisReport; issue: Issue }) {
  return (
    <StreamingAction
      label="Explain"
      streamingLabel="Explaining..."
      url="/api/ai/explain"
      body={{ report, issue }}
    />
  );
}
