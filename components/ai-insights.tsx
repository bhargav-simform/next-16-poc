"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalysisReport, Issue } from "@/types/analysis.types";

// Next.js 16: Streaming UI — reads the Route Handler's ReadableStream chunk-by-chunk
// and hands each decoded piece to the caller for incremental rendering.
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
  size = "default",
}: {
  label: string;
  streamingLabel: string;
  url: string;
  body: unknown;
  size?: "default" | "sm";
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
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        size={size === "sm" ? "sm" : "default"}
        variant="outline"
        onClick={run}
        disabled={isStreaming}
      >
        {isStreaming ? streamingLabel : label}
      </Button>
      {text && (
        <div className="rounded-lg bg-muted/60 p-3 text-sm whitespace-pre-wrap text-foreground">
          {text}
        </div>
      )}
    </div>
  );
}

export function AiInsights({ report }: { report: AnalysisReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI insights</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <StreamingAction
          label="AI summary"
          streamingLabel="Analyzing…"
          url="/api/ai/analyze"
          body={{ report }}
        />
        <StreamingAction
          label="Recommendations"
          streamingLabel="Generating…"
          url="/api/ai/recommend"
          body={{ report }}
        />
      </CardContent>
    </Card>
  );
}

export function ExplainIssueButton({ report, issue }: { report: AnalysisReport; issue: Issue }) {
  return (
    <StreamingAction
      label="Explain"
      streamingLabel="Explaining…"
      url="/api/ai/explain"
      body={{ report, issue }}
      size="sm"
    />
  );
}
