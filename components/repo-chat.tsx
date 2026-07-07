"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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

export function RepoChat({ workspacePath }: { workspacePath: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send() {
    const question = input.trim();
    if (!question || isStreaming) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);
    setIsStreaming(true);

    try {
      await streamAiResponse("/api/ai/qa", { workspacePath, question }, (chunk) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask about this repository</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {messages.length > 0 && (
          <ScrollArea className="h-72 rounded-lg border border-border">
            <div className="flex flex-col gap-3 p-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={
                    message.role === "user"
                      ? "ml-auto max-w-[85%] rounded-lg rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "mr-auto max-w-[85%] rounded-lg rounded-bl-sm bg-muted px-3 py-2 text-sm whitespace-pre-wrap text-foreground"
                  }
                >
                  {message.content || (message.role === "assistant" && isStreaming ? "…" : "")}
                </div>
              ))}
              <div ref={scrollAnchorRef} />
            </div>
          </ScrollArea>
        )}

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a question about this repository…"
            disabled={isStreaming}
            className="h-10 flex-1"
          />
          <Button type="submit" disabled={isStreaming} className="h-10">
            {isStreaming ? "Thinking…" : "Send"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
