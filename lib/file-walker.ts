import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { IGNORED_DIRECTORIES } from "@/lib/ignore-patterns";

export interface WalkedFile {
  absolutePath: string;
  relativePath: string;
  name: string;
  extension: string;
  size: number;
}

export async function walkFiles(
  rootPath: string,
  dirPath: string = rootPath,
): Promise<WalkedFile[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files: WalkedFile[] = [];

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;

    const absolutePath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      const nested = await walkFiles(rootPath, absolutePath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile()) {
      const stats = await stat(absolutePath);
      files.push({
        absolutePath,
        relativePath: path.relative(rootPath, absolutePath),
        name: entry.name,
        extension: path.extname(entry.name),
        size: stats.size,
      });
    }
  }

  return files;
}
