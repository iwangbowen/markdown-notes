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
  /** Git remote repository URL (reserved for future feature) */
  gitRemote?: string;
  /** Git branch name (reserved for future feature) */
  gitBranch?: string;
  /** Whether sync is enabled (reserved for future feature) */
  syncEnabled?: boolean;
  /** Last sync time (reserved for future feature) */
  lastSyncTime?: number;
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
