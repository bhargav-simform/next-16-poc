export const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5-coder:7b";
export const OLLAMA_EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";
export const OLLAMA_CONNECT_TIMEOUT_MS = Number(process.env.OLLAMA_CONNECT_TIMEOUT_MS) || 15_000;
export const OLLAMA_MAX_RETRIES = 2;
export const OLLAMA_RETRY_BACKOFF_MS = [500, 1500] as const;
export const OLLAMA_TEMPERATURE = 0.2;
