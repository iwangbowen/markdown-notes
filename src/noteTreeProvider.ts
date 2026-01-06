import * as vscode from 'vscode';
import { Notebook, Note } from './types';
import { NotebookManager } from './notebookManager';

/**
 * TreeView节点基类
 */
export class TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'notebook' | 'note'
  ) {
    super(label, collapsibleState);
  }
}

/**
 * 笔记本节点
 */
export class NotebookTreeItem extends TreeItem {
  constructor(
    public readonly notebook: Notebook
  ) {
    super(notebook.name, vscode.TreeItemCollapsibleState.Collapsed, 'notebook');

    this.contextValue = 'notebookItem';
    this.iconPath = new vscode.ThemeIcon('notebook');
    this.tooltip = `笔记本: ${notebook.name}`;
    this.id = `notebook-${notebook.id}`;
  }
}

/**
 * 笔记节点
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

    // 点击时打开笔记
    this.command = {
      command: 'vscode.open',
      arguments: [noteUri],
      title: '打开笔记'
    };

    // 显示最后修改时间
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
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  }
}

/**
 * 树形视图数据提供者
 */
export class NoteTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private notebookManager: NotebookManager
  ) {}

  /**
   * 刷新树形视图
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * 获取树节点
   */
  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * 获取子节点
   */
  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (!element) {
      // 根级别：返回所有笔记本
      return this.getNotebookItems();
    }

    if (element instanceof NotebookTreeItem) {
      // 笔记本级别：返回该笔记本下的所有笔记
      return this.getNoteItems(element.notebook.id);
    }

    return [];
  }

  /**
   * 获取笔记本节点列表
   */
  private async getNotebookItems(): Promise<NotebookTreeItem[]> {
    const notebooks = await this.notebookManager.getNotebooks();

    if (notebooks.length === 0) {
      return [];
    }

    return notebooks.map(notebook => new NotebookTreeItem(notebook));
  }

  /**
   * 获取笔记节点列表
   */
  private async getNoteItems(notebookId: string): Promise<NoteTreeItem[]> {
    const notes = await this.notebookManager.getNotes(notebookId);

    return notes.map(note => {
      const uri = vscode.Uri.parse(note.uri);
      return new NoteTreeItem(note, uri);
    });
  }
}
