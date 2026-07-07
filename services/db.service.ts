import { cacheLife, cacheTag } from "next/cache";
import { Pool } from "pg";
import type { AnalysisReport } from "@/types/analysis.types";

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

CREATE TABLE IF NOT EXISTS repository_reports (
  repository_id TEXT PRIMARY KEY,
  workspace_path TEXT NOT NULL,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
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

export interface RepositoryReportRow {
  repositoryId: string;
  workspacePath: string;
  owner: string;
  repo: string;
  report: AnalysisReport;
}

export function repositoryReportTag(repositoryId: string): string {
  return `repo-report-${repositoryId}`;
}

export async function upsertRepositoryReport(row: RepositoryReportRow): Promise<void> {
  await ensureSchema();
  await pool.query(
    `INSERT INTO repository_reports (repository_id, workspace_path, owner, repo, report, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, now())
     ON CONFLICT (repository_id) DO UPDATE SET report = EXCLUDED.report, updated_at = now()`,
    [row.repositoryId, row.workspacePath, row.owner, row.repo, JSON.stringify(row.report)],
  );
}

export async function getRepositoryReport(repositoryId: string): Promise<RepositoryReportRow | null> {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT repository_id, workspace_path, owner, repo, report
     FROM repository_reports
     WHERE repository_id = $1`,
    [repositoryId],
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    repositoryId: row.repository_id,
    workspacePath: row.workspace_path,
    owner: row.owner,
    repo: row.repo,
    report: row.report as AnalysisReport,
  };
}

// Next.js 16: Cache Components — cached repository report read, keyed by repositoryId.
// Invalidated by reanalyzeRepositoryAction via updateTag(repositoryReportTag(repositoryId)).
export async function getCachedRepositoryReport(
  repositoryId: string,
): Promise<RepositoryReportRow | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(repositoryReportTag(repositoryId));
  return getRepositoryReport(repositoryId);
}
