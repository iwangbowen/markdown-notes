import * as vscode from 'vscode';
import { Notebook, Note, Folder } from './types';
import { NotebookManager } from './notebookManager';
import { GitManager } from './gitManager';
import { formatDateTime, formatRelativeDate } from './utils/dateFormatter';

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
    private readonly gitManager?: GitManager
  ) {
    super(notebook.name, vscode.TreeItemCollapsibleState.Collapsed, 'notebook');

    this.contextValue = 'notebookItem';
    this.id = `notebook-${notebook.id}`;

    // Set initial icon based on config (synchronous)
    this.updateGitStatusSync();
  }

  /**
   * Initialize async status check
   * Called by TreeProvider after construction
   */
  async initializeGitStatus(): Promise<void> {
    if (!this.gitManager || !this.notebook.gitConfig) {
      return;
    }

    try {
      const actuallyInitialized = await this.gitManager.isInitialized(this.notebook.id);
      const configSaysInitialized = this.notebook.gitConfig.initialized;
      const hasCredentials = await this.gitManager.hasCredentials(this.notebook.id);

      // If config says initialized but actually not, show warning state
      if (configSaysInitialized && !actuallyInitialized) {
        const gitConfig = this.notebook.gitConfig;

        // Build detailed missing info message
        const missingInfo: string[] = [];
        if (!hasCredentials) {
          missingInfo.push('❌ Authentication credentials not configured');
        }
        missingInfo.push('❌ Local repository not initialized');

        const missingInfoText = missingInfo.length > 0
          ? '\n\n' + missingInfo.join('\n')
          : '';

        const nextSteps = hasCredentials
          ? 'Right-click → "Clone Git Repository"'
          : '1. Right-click → "Configure Git" to set credentials\n2. Right-click → "Clone Git Repository"';

        this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('charts.yellow'));
        this.tooltip = `${this.notebook.name}\n⚠️ Git configured but not initialized locally\nRemote: ${gitConfig.remoteUrl}\nBranch: ${gitConfig.branch}${missingInfoText}\n\n💡 Next steps:\n${nextSteps}`;
        this.description = 'Not initialized';
        return;
      }

      // If actually initialized, update with real Git status
      if (actuallyInitialized) {
        await this.updateGitStatusAsync();
      }
    } catch (error) {
      // Silently keep the synchronous status on error
      console.error(`Failed to verify Git status for ${this.notebook.name}:`, error);
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
      ? `Last sync: ${formatDateTime(gitConfig.lastSync)}`
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
        ? `Last sync: ${formatDateTime(gitConfig.lastSync)}`
        : 'Not synced yet';

      // Build status indicators
      const statusIndicators: string[] = [];

      if (status.uncommittedChanges > 0) {
        statusIndicators.push(`● ${status.uncommittedChanges}`);
      }

      if (status.unpushedCommits > 0) {
        statusIndicators.push(`↑ ${status.unpushedCommits}`);
      }

      if (status.behindCommits > 0) {
        statusIndicators.push(`↓ ${status.behindCommits}`);
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
      const tooltipLines = [
        this.notebook.name,
        '✓ Git initialized',
        `Remote: ${gitConfig.remoteUrl}`,
        `Branch: ${gitConfig.branch}`,
        `Uncommitted changes: ${status.uncommittedChanges}`,
        `Unpushed commits: ${status.unpushedCommits}`
      ];

      if (status.behindCommits > 0) {
        tooltipLines.push(`Behind commits: ${status.behindCommits}`);
      }

      tooltipLines.push(lastSyncText);

      this.tooltip = tooltipLines.join('\n');

    } catch (error) {
      // Keep the synchronous status on error
      console.error(`Failed to update Git status for ${this.notebook.name}:`, error);
    }
  }
}

/**
 * Folder tree item
 */
export class FolderTreeItem extends TreeItem {
  constructor(
    public readonly folder: Folder,
    public readonly folderUri: vscode.Uri,
    folderIconPath?: vscode.Uri  // Optional custom icon
  ) {
    super(folder.name, vscode.TreeItemCollapsibleState.Collapsed, 'folder');

    this.contextValue = 'folderItem';
    // Use custom icon if provided, otherwise use default ThemeIcon
    this.iconPath = folderIconPath || new vscode.ThemeIcon('folder');

    // Build detailed tooltip
    const tooltipLines = [
      `📁 ${folder.name}`,
      `Path: ${folder.path}`,
    ];

    if (folder.createdAt) {
      tooltipLines.push(`Created: ${formatDateTime(folder.createdAt)}`);
    }

    this.tooltip = tooltipLines.join('\n');
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
    public readonly noteUri: vscode.Uri,
    public readonly notebookId: string
  ) {
    super(note.name, vscode.TreeItemCollapsibleState.None, 'note');

    this.contextValue = 'noteItem';
    this.iconPath = new vscode.ThemeIcon('markdown');

    // Build detailed tooltip
    const tooltipLines = [
      `📝 ${note.name}`,
    ];

    if (note.folderPath) {
      tooltipLines.push(`Folder: ${note.folderPath}`);
    }

    if (note.createdAt) {
      tooltipLines.push(`Created: ${formatDateTime(note.createdAt)}`);
    }

    if (note.updatedAt) {
      tooltipLines.push(`Modified: ${formatDateTime(note.updatedAt)}`);
    }

    this.tooltip = tooltipLines.join('\n');
    this.id = `note-${note.notebookId}-${note.name}`;

    // 双重 URI 策略：
    // 1. resourceUri 使用自定义 scheme (mdnotes://) 用于显示装饰
    // 2. command 使用真实的 file:// URI 用于打开文件
    this.resourceUri = vscode.Uri.parse(`mdnotes:${noteUri.fsPath}`);

    // Click to open note (使用真实的 file:// URI)
    this.command = {
      command: 'vscode.open',
      arguments: [noteUri],  // 真实的 file:// URI
      title: 'Open Note'
    };

    // Display last modified time
    if (note.updatedAt) {
      const date = new Date(note.updatedAt);
      this.description = this.formatDate(date);
    }
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return formatRelativeDate(date);
  }
}

/**
 * Tree view data provider
 */
export class NoteTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Cache for parent relationships
  private readonly parentMap = new Map<string, TreeItem>();
  private readonly folderIconPath: vscode.Uri;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly notebookManager: NotebookManager,
    private readonly gitManager?: GitManager  // Optional: for Git status checking
  ) {
    // Set custom folder icon path
    this.folderIconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'folder.svg');
  }

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

    const items = notebooks.map(notebook => new NotebookTreeItem(notebook, this.gitManager));

    // Initialize Git status asynchronously for all items
    // Don't await - let them update in background
    items.forEach(item => {
      item.initializeGitStatus().then(() => {
        // Refresh the tree item after status is updated
        this._onDidChangeTreeData.fire(item);
      }).catch(() => {
        // Ignore errors - item will keep initial status
      });
    });

    return items;
  }

  /**
   * Refresh Git status for all notebooks (without re-reading file system)
   * Used by auto refresh mechanism
   */
  async refreshGitStatus(): Promise<void> {
    const notebooks = await this.notebookManager.getNotebooks();
    const items: NotebookTreeItem[] = [];

    // Create items for all notebooks with Git config
    for (const notebook of notebooks) {
      if (notebook.gitConfig?.initialized && this.gitManager) {
        const item = new NotebookTreeItem(notebook, this.gitManager);
        items.push(item);
      }
    }

    if (items.length === 0) {
      return; // No notebooks to sync
    }

    // Update all Git statuses in parallel
    await Promise.all(
      items.map(item =>
        item.initializeGitStatus().catch(() => {
          // Silently ignore errors
        })
      )
    );

    this._onDidChangeTreeData.fire(undefined);
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
      items.push(new FolderTreeItem(folder, fileUri, this.folderIconPath));
    }

    // Then add notes
    for (const note of notes) {
      // Always use file: scheme URI by reconstructing from the stored URI's fsPath
      const parsedUri = vscode.Uri.parse(note.uri);
      const fileUri = vscode.Uri.file(parsedUri.fsPath);
      items.push(new NoteTreeItem(note, fileUri, notebookId));
    }

    return items;
  }
}
