/**
 * Git configuration interface
 */
export interface GitConfig {
  /** Remote repository URL */
  remoteUrl: string;
  /** Git branch name */
  branch: string;
  /** Git author information */
  author: {
    name: string;
    email: string;
  };
  /** Last sync timestamp */
  lastSync?: number;
  /** Whether git is initialized for this notebook */
  initialized?: boolean;
}

/**
 * Git status interface
 */
export interface GitStatus {
  /** Number of uncommitted changes */
  uncommittedChanges: number;
  /** Number of unpushed commits */
  unpushedCommits: number;
  /** Whether there are conflicts */
  hasConflicts: boolean;
  /** Current branch */
  branch: string;
}

/**
 * Notebook interface
 */
export interface Notebook {
  /** Unique identifier */
  id: string;
  /** Notebook name */
  name: string;
  /** Creation timestamp */
  createdAt: number;
  /** Git configuration (optional) */
  gitConfig?: GitConfig;
}

/**
 * Folder interface
 */
export interface Folder {
  /** Folder name */
  name: string;
  /** Notebook ID this folder belongs to */
  notebookId: string;
  /** Parent folder path (relative to notebook root, empty string for root level) */
  parentPath: string;
  /** Full folder path (relative to notebook root) */
  path: string;
  /** Folder URI */
  uri: string;
  /** Creation timestamp */
  createdAt?: number;
}

/**
 * Note interface
 */
export interface Note {
  /** Note name (without .md extension) */
  name: string;
  /** Notebook ID this note belongs to */
  notebookId: string;
  /** Parent folder path (relative to notebook root, empty string for root level) */
  folderPath: string;
  /** File URI path */
  uri: string;
  /** Creation timestamp */
  createdAt?: number;
  /** Last modified timestamp */
  updatedAt?: number;
}

/**
 * Global configuration interface (stored in globalState, supports cross-device sync)
 */
export interface GlobalConfig {
  /** List of notebooks */
  notebooks: Notebook[];
  /** Currently active notebook ID */
  activeNotebook?: string;
  /** Configuration version (for future migration) */
  version?: string;
}
