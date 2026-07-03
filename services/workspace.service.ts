import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const WORKSPACES_ROOT = path.join(process.cwd(), ".workspaces");

export async function createWorkspace(): Promise<string> {
  const workspacePath = path.join(WORKSPACES_ROOT, randomUUID());
  await mkdir(workspacePath, { recursive: true });
  return workspacePath;
}

export async function removeWorkspace(workspacePath: string): Promise<void> {
  await rm(workspacePath, { recursive: true, force: true });
}
