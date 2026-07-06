import { QA_CHUNK_OVERLAP_LINES, QA_CHUNK_WINDOW_LINES } from "@/lib/qa-constants";

export interface CodeChunk {
  startLine: number;
  endLine: number;
  content: string;
}

export function chunkFileContent(content: string): CodeChunk[] {
  const lines = content.split("\n");
  if (lines.length === 0) return [];

  const step = QA_CHUNK_WINDOW_LINES - QA_CHUNK_OVERLAP_LINES;
  const chunks: CodeChunk[] = [];
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(start + QA_CHUNK_WINDOW_LINES, lines.length);
    chunks.push({
      startLine: start + 1,
      endLine: end,
      content: lines.slice(start, end).join("\n"),
    });
    if (end === lines.length) break;
    start += step;
  }

  return chunks;
}
