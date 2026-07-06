import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  QA_EMBED_BATCH_SIZE,
  QA_INDEXABLE_EXTENSIONS,
  QA_MAX_FILE_BYTES,
  QA_MAX_TOTAL_CHUNKS,
} from "@/lib/qa-constants";
import { chunkFileContent } from "@/services/chunker.service";
import { replaceChunksForRepository } from "@/services/db.service";
import { walkFiles } from "@/lib/file-walker";
import { generateEmbedding } from "@/services/ollama.service";

export function deriveRepositoryId(workspacePath: string): string {
  return path.basename(workspacePath);
}

interface PendingChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
}

async function embedInBatches(texts: string[], batchSize: number): Promise<number[][]> {
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    results.push(...(await Promise.all(batch.map((text) => generateEmbedding(text)))));
  }
  return results;
}

export async function indexRepository(workspacePath: string): Promise<{ chunkCount: number }> {
  const repositoryId = deriveRepositoryId(workspacePath);
  const files = await walkFiles(workspacePath);
  const candidateFiles = files.filter(
    (file) => QA_INDEXABLE_EXTENSIONS.has(file.extension) && file.size <= QA_MAX_FILE_BYTES,
  );

  const allChunks: PendingChunk[] = [];

  outer: for (const file of candidateFiles) {
    if (allChunks.length >= QA_MAX_TOTAL_CHUNKS) break;

    let content: string;
    try {
      content = await readFile(file.absolutePath, "utf-8");
    } catch {
      continue;
    }

    for (const chunk of chunkFileContent(content)) {
      allChunks.push({ filePath: file.relativePath, ...chunk });
      if (allChunks.length >= QA_MAX_TOTAL_CHUNKS) break outer;
    }
  }

  const embeddings = await embedInBatches(
    allChunks.map((chunk) => chunk.content),
    QA_EMBED_BATCH_SIZE,
  );

  const rows = allChunks.map((chunk, index) => ({
    repositoryId,
    ...chunk,
    embedding: embeddings[index],
  }));

  await replaceChunksForRepository(repositoryId, rows);
  return { chunkCount: rows.length };
}
