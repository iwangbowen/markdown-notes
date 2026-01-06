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
 * Note interface
 */
export interface Note {
  /** Note name (without .md extension) */
  name: string;
  /** Notebook ID this note belongs to */
  notebookId: string;
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
