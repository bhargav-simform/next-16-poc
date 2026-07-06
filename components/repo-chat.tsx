"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className="mt-2 flex flex-col gap-3 border-t pt-2">
      <p className="font-medium">Ask about this repository</p>

      <div className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {messages.map((message, index) => (
          <p
            key={index}
            className={
              message.role === "user"
                ? "font-medium"
                : "whitespace-pre-wrap text-muted-foreground"
            }
          >
            {message.role === "user" ? "You: " : "AI: "}
            {message.content}
          </p>
        ))}
      </div>

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
          placeholder="Ask a question about this repository..."
          disabled={isStreaming}
        />
        <Button type="submit" size="sm" disabled={isStreaming}>
          {isStreaming ? "Thinking..." : "Send"}
        </Button>
      </form>
    </div>
  );
}
