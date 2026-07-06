export const QA_INDEXABLE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
  ".php",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".md",
  ".mdx",
  ".json",
  ".yml",
  ".yaml",
  ".css",
  ".scss",
  ".sql",
  ".sh",
]);

export const QA_MAX_FILE_BYTES = 500_000;
export const QA_MAX_TOTAL_CHUNKS = 3000;
export const QA_CHUNK_WINDOW_LINES = 50;
export const QA_CHUNK_OVERLAP_LINES = 10;
export const QA_TOP_K = 6;
export const QA_EMBED_BATCH_SIZE = 4;
