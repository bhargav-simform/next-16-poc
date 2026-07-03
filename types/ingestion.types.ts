export interface RepositoryMetadata {
  owner: string;
  repo: string;
  defaultBranch: string;
  latestCommit: {
    hash: string;
    message: string;
    date: string;
  };
  fileCount: number;
  directoryCount: number;
  primaryLanguage: string | null;
  packageJson: {
    name: string;
    description: string | null;
    dependencyCount: number;
  } | null;
}

export interface IngestionSuccess {
  status: "success";
  workspacePath: string;
  data: RepositoryMetadata;
}

export interface IngestionError {
  status: "error";
  message: string;
}

export interface IngestionIdle {
  status: "idle";
}

export type IngestionActionState = IngestionIdle | IngestionSuccess | IngestionError;
