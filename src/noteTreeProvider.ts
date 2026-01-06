import * as vscode from 'vscode';
import { Notebook, Note, Folder } from './types';
import { NotebookManager } from './notebookManager';
import { GitManager } from './gitManager';

/**
 * TreeView base node class
 */
export class TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'notebook' | 'folder' | 'note'
  ) {
    super(label, collapsibleState);
  }
}

/**
 * Notebook tree item with Git status
 */
export class NotebookTreeItem extends TreeItem {
  private gitStatusChecked = false;

  constructor(
    public readonly notebook: Notebook,
    private gitManager?: GitManager
  ) {
    super(notebook.name, vscode.TreeItemCollapsibleState.Collapsed, 'notebook');

    this.contextValue = 'notebookItem';
    this.id = `notebook-${notebook.id}`;

    // Set initial icon based on config (synchronous)
    this.updateGitStatusSync();

    // Update with actual Git status (asynchronous)
    if (gitManager && notebook.gitConfig?.initialized) {
      this.updateGitStatusAsync();
    }
  }

  /**
   * Update icon and decoration based on Git configuration (synchronous)
   */
  private updateGitStatusSync(): void {
    const gitConfig = this.notebook.gitConfig;

    if (!gitConfig) {
      // No Git configuration
      this.iconPath = new vscode.ThemeIcon('notebook');
      this.tooltip = `Notebook: ${this.notebook.name}`;
      this.description = '';
      return;
    }

    if (!gitConfig.initialized) {
      // Git configured but not initialized
      this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
      this.tooltip = `${this.notebook.name}\n⚠️ Git configured but not initialized\nRemote: ${gitConfig.remoteUrl}\nBranch: ${gitConfig.branch}`;
      this.description = 'Not initialized';
      return;
    }

    // Git initialized (will be updated by async check)
    const lastSyncText = gitConfig.lastSync
      ? `Last sync: ${new Date(gitConfig.lastSync).toLocaleString()}`
      : 'Not synced yet';

    this.iconPath = new vscode.ThemeIcon('notebook', new vscode.ThemeColor('charts.green'));
    this.tooltip = `${this.notebook.name}\n✓ Git initialized\nRemote: ${gitConfig.remoteUrl}\nBranch: ${gitConfig.branch}\n${lastSyncText}`;
    this.description = `⎇ ${gitConfig.branch}`;
  }

  /**
   * Update icon with actual Git status (asynchronous)
   */
  private async updateGitStatusAsync(): Promise<void> {
    if (!this.gitManager || this.gitStatusChecked) {
      return;
    }

    try {
      const status = await this.gitManager.getStatus(this.notebook.id);
      this.gitStatusChecked = true;

      const gitConfig = this.notebook.gitConfig!;
      const lastSyncText = gitConfig.lastSync
        ? `Last sync: ${new Date(gitConfig.lastSync).toLocaleString()}`
        : 'Not synced yet';

      // Build status indicators
      const statusIndicators: string[] = [];

      if (status.uncommittedChanges > 0) {
        statusIndicators.push(`● ${status.uncommittedChanges}`);
      }

      if (status.unpushedCommits > 0) {
        statusIndicators.push(`↑ ${status.unpushedCommits}`);
      }

      // Update description
      if (statusIndicators.length > 0) {
        this.description = `⎇ ${gitConfig.branch}  ${statusIndicators.join(' ')}`;

        // Use orange color to indicate pending changes
        this.iconPath = new vscode.ThemeIcon('notebook', new vscode.ThemeColor('charts.orange'));
      } else {
        // All synced - green
        this.description = `⎇ ${gitConfig.branch}`;
        this.iconPath = new vscode.ThemeIcon('notebook', new vscode.ThemeColor('charts.green'));
      }

      // Update tooltip with detailed status
      this.tooltip =
        `${this.notebook.name}\n` +
        `✓ Git initialized\n` +
        `Remote: ${gitConfig.remoteUrl}\n` +
        `Branch: ${gitConfig.branch}\n` +
        `Uncommitted changes: ${status.uncommittedChanges}\n` +
        `Unpushed commits: ${status.unpushedCommits}\n` +
        `${lastSyncText}`;

    } catch (error) {
      // Fail silently, keep the synchronous status
    }
  }
}

/**
 * Folder tree item
 */
export class FolderTreeItem extends TreeItem {
  constructor(
    public readonly folder: Folder,
    public readonly folderUri: vscode.Uri
  ) {
    super(folder.name, vscode.TreeItemCollapsibleState.Collapsed, 'folder');

    this.contextValue = 'folderItem';
    this.iconPath = new vscode.ThemeIcon('folder');
    this.tooltip = folder.path;
    this.id = `folder-${folder.notebookId}-${folder.path}`;

    // Set resource URI to enable Git decorations from VS Code's Git extension
    this.resourceUri = folderUri;
  }
}

/**
 * Note tree item
 */
export class NoteTreeItem extends TreeItem {
  constructor(
    public readonly note: Note,
    public readonly noteUri: vscode.Uri
  ) {
    super(note.name, vscode.TreeItemCollapsibleState.None, 'note');

    this.contextValue = 'noteItem';
    this.iconPath = new vscode.ThemeIcon('markdown');
    this.tooltip = note.name;
    this.id = `note-${note.notebookId}-${note.name}`;

    // Set resource URI to enable Git decorations from VS Code's Git extension
    this.resourceUri = noteUri;

    // Click to open note
    this.command = {
      command: 'vscode.open',
      arguments: [noteUri],
      title: 'Open Note'
    };

    // Display last modified time
    if (note.updatedAt) {
      const date = new Date(note.updatedAt);
      this.description = this.formatDate(date);
    }
  }

  private formatDate(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days}d ago`;
    } else {
      return date.toLocaleDateString('en-US');
    }
  }
}

/**
 * Tree view data provider
 */
export class NoteTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Cache for parent relationships
  private parentMap = new Map<string, TreeItem>();

  constructor(
    private notebookManager: NotebookManager,
    private gitManager?: GitManager  // Optional: for Git status checking
  ) { }

  /**
   * Refresh tree view
   */
  refresh(): void {
    this.parentMap.clear();
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item
   */
  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get parent of tree item (required for reveal method)
   */
  getParent(element: TreeItem): TreeItem | undefined {
    return this.parentMap.get(element.id || '');
  }

  /**
   * Get children nodes
   */
  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level: return all notebooks
      const items = await this.getNotebookItems();
      // Notebooks have no parent
      return items;
    }

    if (element instanceof NotebookTreeItem) {
      // Notebook level: return folders and notes under this notebook
      const items = await this.getFolderAndNoteItems(element.notebook.id, '');
      // Set parent for all items
      items.forEach(item => {
        if (item.id) {
          this.parentMap.set(item.id, element);
        }
      });
      return items;
    }

    if (element instanceof FolderTreeItem) {
      // Folder level: return folders and notes under this folder
      const items = await this.getFolderAndNoteItems(element.folder.notebookId, element.folder.path);
      // Set parent for all items
      items.forEach(item => {
        if (item.id) {
          this.parentMap.set(item.id, element);
        }
      });
      return items;
    }

    return [];
  }

  /**
   * Get notebook item list
   */
  private async getNotebookItems(): Promise<NotebookTreeItem[]> {
    const notebooks = await this.notebookManager.getNotebooks();

    if (notebooks.length === 0) {
      return [];
    }

    return notebooks.map(notebook => new NotebookTreeItem(notebook, this.gitManager));
  }

  /**
   * Get folders and notes under a notebook or folder
   */
  private async getFolderAndNoteItems(notebookId: string, folderPath: string): Promise<TreeItem[]> {
    const [folders, notes] = await Promise.all([
      this.notebookManager.getFolders(notebookId, folderPath),
      this.notebookManager.getNotes(notebookId, folderPath)
    ]);

    const items: TreeItem[] = [];

    // Add folders first
    for (const folder of folders) {
      // Always use file: scheme URI by reconstructing from the stored URI's fsPath
      const parsedUri = vscode.Uri.parse(folder.uri);
      const fileUri = vscode.Uri.file(parsedUri.fsPath);
      items.push(new FolderTreeItem(folder, fileUri));
    }

    // Then add notes
    for (const note of notes) {
      // Always use file: scheme URI by reconstructing from the stored URI's fsPath
      const parsedUri = vscode.Uri.parse(note.uri);
      const fileUri = vscode.Uri.file(parsedUri.fsPath);
      items.push(new NoteTreeItem(note, fileUri));
    }

    return items;
  }
}
