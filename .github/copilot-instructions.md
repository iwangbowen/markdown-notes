# Markdown Notes - AI Coding Agent Instructions

## Architecture Overview

This is a VS Code extension for multi-notebook Markdown note management with Git synchronization. The codebase uses a **dual-layer storage architecture**:

```
globalState (VS Code cloud sync)    globalStorageUri (local files)    Git Remote (GitHub)
├─ Notebook metadata                ├─ *.md files                      ├─ File content
├─ Git config                       └─ .git/ repos                     └─ Version history
└─ Auto-syncs ✅                    └─ No auto-sync ✗                 └─ Manual sync
```

**Critical**: `globalState.setKeysForSync()` MUST be called in `StorageManager` constructor to enable cross-device config sync.

## Core Components

### 1. StorageManager (`src/utils/storage.ts`)

Manages all persistence. Key pattern:

```typescript
// CRITICAL: Always call setKeysForSync in constructor
constructor(context: ExtensionContext) {
  this.context.globalState.setKeysForSync(['markdownNotes.config']);
}
```

- `globalState`: Notebook configs (ID, name, gitConfig)
- `globalStorageUri`: Actual `.md` files and `.git/` repos
- Notebook ID is the bridge: `globalStorageUri/notebooks/{id}/`

### 2. GitManager (`src/gitManager.ts`)

Uses **isomorphic-git** (pure JS, no system Git required). All operations use structured logging:

```typescript
this.logger.info(`Initializing git repository at: ${dir}`, 'Git');
// Logs to "Markdown Notes" Output Channel with timestamps
```

**Git workflow separation**:
- `configureGit`: Save config only, set `initialized: false`
- `gitInit`: Create empty repo, set `initialized: true`
- `gitClone`: Download from remote, set `initialized: true`

### 3. NoteTreeProvider (`src/noteTreeProvider.ts`)

TreeView items with **visual Git status**:

```typescript
if (!gitConfig.initialized) {
  this.iconPath = new vscode.ThemeIcon('notebook', new vscode.ThemeColor('charts.yellow'));
  this.description = '$(warning) Not initialized';
}
```

- Gray: No Git config
- Yellow + warning: Configured but not initialized
- Green + branch: Initialized and ready

### 4. Extension Activation (`src/extension.ts`)

**Auto-detect cross-device sync**: On activation, check for notebooks with `gitConfig.initialized: true` but no local `.git/`:

```typescript
async function checkUninitializedNotebooks() {
  if (hasConfig && !isInitialized) {
    // Prompt user to clone
    vscode.window.showInformationMessage("Clone to download files?");
  }
}
```

## Critical Patterns

### Dual-Layer Storage Pattern

When creating notebooks:

```typescript
// 1. Save to globalState (syncs across devices)
await storageManager.addNotebook(notebook);

// 2. Create local directory
const notebookUri = vscode.Uri.joinPath(globalStorageUri, 'notebooks', notebook.id);
await vscode.workspace.fs.createDirectory(notebookUri);
```

### Git Credentials Security

Never store in globalState! Use SecretStorage:

```typescript
// Store
await this.context.secrets.store(`git-auth-${notebookId}`, JSON.stringify(credentials));

// Retrieve
const stored = await this.context.secrets.get(`git-auth-${notebookId}`);
```

SecretStorage auto-syncs across devices (encrypted).

### TreeView Filtering

Hide `.git/` and `.gitkeep` from user:

```typescript
for (const [name, type] of entries) {
  if (name.startsWith('.')) continue;  // Skip hidden files/folders
}
```

### Empty Folder Tracking

Git doesn't track empty folders. Auto-create `.gitkeep`:

```typescript
const gitkeepUri = vscode.Uri.joinPath(folderUri, '.gitkeep');
await vscode.workspace.fs.writeFile(gitkeepUri, Buffer.from('...'));
```

## Development Workflows

### Build & Debug

```bash
npm install              # Install dependencies
npm run compile         # Compile TypeScript
npm run watch           # Watch mode for development
```

Press `F5` in VS Code to launch Extension Development Host.

### Logging & Debugging

All operations log to "Markdown Notes" Output Channel:

```typescript
import { Logger } from './utils/logger';
const logger = Logger.getInstance();

logger.info('Starting operation', 'CategoryName');
logger.debug('Detailed info', 'CategoryName');
logger.error('Error occurred', 'CategoryName');  // Auto-shows output
```

Format: `[YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [Category] Message`

### Testing Cross-Device Sync

1. Device A: Create notebook + Configure Git
2. Wait 5-10 seconds (VS Code syncs globalState)
3. Device B: Open extension, should see notebook with yellow icon
4. Device B: Click auto-prompt to Clone
5. Verify files downloaded to globalStorageUri

## Project-Specific Conventions

### Git Config Flag Management

Three states for Git config:

```typescript
// State 1: No config
notebook.gitConfig = undefined;

// State 2: Configured but not initialized
notebook.gitConfig = { remoteUrl, branch, initialized: false };

// State 3: Initialized and ready
notebook.gitConfig = { remoteUrl, branch, initialized: true };
```

**Critical**: Always check `initialized` flag before Git operations.

### Error Handling Pattern

Show errors to user, log details for debugging:

```typescript
try {
  await gitManager.clone(notebookId, config);
} catch (error) {
  this.logger.error(`Clone failed: ${error}`, 'Git');  // Logs details
  vscode.window.showErrorMessage(`Failed to clone: ${error}`);  // User message
}
```

### File Path Construction

Always use `vscode.Uri.joinPath()` for cross-platform compatibility:

```typescript
// ✅ Correct
const noteUri = vscode.Uri.joinPath(notebookUri, folderPath, fileName);

// ❌ Wrong - doesn't handle Windows paths correctly
const noteUri = `${notebookUri}/${folderPath}/${fileName}`;
```

## External Dependencies

### isomorphic-git

Pure JS Git implementation. Key patterns:

```typescript
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as fs from 'fs';

await git.clone({
  fs,        // Node.js fs module
  http,      // HTTP client for remote operations
  dir,       // Local directory path (string, not Uri)
  url,       // Remote HTTPS URL
  onAuth: () => credentials,  // Callback for authentication
  onProgress: (progress) => { /* update UI */ }
});
```

Always use `dir: string` (fsPath), not `vscode.Uri`.

### VS Code APIs

- `globalState.setKeysForSync()`: Enable config sync (REQUIRED in StorageManager)
- `SecretStorage`: Store Git credentials (auto-syncs, encrypted)
- `globalStorageUri`: Extension-managed file storage (auto-cleaned on uninstall)
- `ThemeIcon + ThemeColor`: Visual status with theme compatibility

## Common Pitfalls

❌ **Forgetting setKeysForSync**: globalState won't sync without it!

❌ **Mixing Uri and string paths**: isomorphic-git needs string paths (`.fsPath`)

❌ **Not checking initialized flag**: Git operations fail if repo not initialized

❌ **Hardcoding paths**: Use `vscode.Uri.joinPath()` for cross-platform support

## Key Files Reference

- `src/utils/storage.ts`: All persistence logic, setKeysForSync setup
- `src/gitManager.ts`: Git operations, credentials, logging
- `src/extension.ts`: Activation, cross-device sync detection
- `src/noteTreeProvider.ts`: TreeView, visual status indicators
- `ARCHITECTURE.md`: Detailed storage architecture
- `CRITICAL_FIX_SYNC.md`: setKeysForSync explanation
