import { QA_TOP_K } from "@/lib/qa-constants";
import { findSimilarChunks, type SimilarChunk } from "@/services/db.service";
import { deriveRepositoryId } from "@/services/indexing-orchestrator.service";
import { answerFromContext, generateEmbedding, type OllamaStreamOptions } from "@/services/ollama.service";

function buildQaPrompt(question: string, chunks: SimilarChunk[]): string {
  const context = chunks
    .map((chunk) => `File: ${chunk.filePath} (lines ${chunk.startLine}-${chunk.endLine})\n\`\`\`\n${chunk.content}\n\`\`\``)
    .join("\n\n");

  return `You are answering a question about a specific codebase using only the retrieved code excerpts below. If the excerpts don't contain enough information, say so rather than guessing.

${context}

Question: ${question}

Answer:`;
}

async function* streamAnswer(
  workspacePath: string,
  question: string,
  options?: OllamaStreamOptions,
): AsyncGenerator<string> {
  const repositoryId = deriveRepositoryId(workspacePath);
  const questionEmbedding = await generateEmbedding(question, options);
  const chunks = await findSimilarChunks(repositoryId, questionEmbedding, QA_TOP_K);
  const prompt = buildQaPrompt(question, chunks);
  yield* answerFromContext(prompt, options);
}

export function answerQuestion(
  workspacePath: string,
  question: string,
  options?: OllamaStreamOptions,
): AsyncGenerator<string> {
  return streamAnswer(workspacePath, question, options);
}
