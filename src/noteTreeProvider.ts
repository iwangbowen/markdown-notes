import * as vscode from 'vscode';
import { Notebook, Note, Folder } from './types';
import { NotebookManager } from './notebookManager';

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
 * Notebook tree item
 */
export class NotebookTreeItem extends TreeItem {
  constructor(
    public readonly notebook: Notebook
  ) {
    super(notebook.name, vscode.TreeItemCollapsibleState.Collapsed, 'notebook');

    this.contextValue = 'notebookItem';
    this.iconPath = new vscode.ThemeIcon('notebook');
    this.tooltip = `Notebook: ${notebook.name}`;
    this.id = `notebook-${notebook.id}`;
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

  constructor(
    private notebookManager: NotebookManager
  ) { }

  /**
   * Refresh tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get tree item
   */
  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get children nodes
   */
  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // Root level: return all notebooks
      return this.getNotebookItems();
    }

    if (element instanceof NotebookTreeItem) {
      // Notebook level: return folders and notes under this notebook
      return this.getFolderAndNoteItems(element.notebook.id, '');
    }

    if (element instanceof FolderTreeItem) {
      // Folder level: return folders and notes under this folder
      return this.getFolderAndNoteItems(element.folder.notebookId, element.folder.path);
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

    return notebooks.map(notebook => new NotebookTreeItem(notebook));
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
      const uri = vscode.Uri.parse(folder.uri);
      items.push(new FolderTreeItem(folder, uri));
    }

    // Then add notes
    for (const note of notes) {
      const uri = vscode.Uri.parse(note.uri);
      items.push(new NoteTreeItem(note, uri));
    }

    return items;
  }
}
