import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS code_chunks (
  id BIGSERIAL PRIMARY KEY,
  repository_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(768) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS code_chunks_repository_id_idx ON code_chunks (repository_id);
CREATE INDEX IF NOT EXISTS code_chunks_embedding_idx ON code_chunks USING hnsw (embedding vector_cosine_ops);
`;

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool.query(SCHEMA_SQL).then(() => undefined);
  }
  return schemaReady;
}

export interface CodeChunkRow {
  repositoryId: string;
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  embedding: number[];
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function replaceChunksForRepository(
  repositoryId: string,
  chunks: CodeChunkRow[],
): Promise<void> {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM code_chunks WHERE repository_id = $1", [repositoryId]);
    for (const chunk of chunks) {
      await client.query(
        `INSERT INTO code_chunks (repository_id, file_path, start_line, end_line, content, embedding)
         VALUES ($1, $2, $3, $4, $5, $6::vector)`,
        [
          chunk.repositoryId,
          chunk.filePath,
          chunk.startLine,
          chunk.endLine,
          chunk.content,
          toVectorLiteral(chunk.embedding),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export interface SimilarChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
  distance: number;
}

export async function findSimilarChunks(
  repositoryId: string,
  queryEmbedding: number[],
  limit: number,
): Promise<SimilarChunk[]> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT file_path, start_line, end_line, content, embedding <=> $2::vector AS distance
     FROM code_chunks
     WHERE repository_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [repositoryId, toVectorLiteral(queryEmbedding), limit],
  );
  return rows.map((row) => ({
    filePath: row.file_path,
    startLine: row.start_line,
    endLine: row.end_line,
    content: row.content,
    distance: row.distance,
  }));
}
