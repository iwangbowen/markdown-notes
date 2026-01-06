import * as vscode from 'vscode';
import * as path from 'path';
import { Notebook, Note } from './types';
import { StorageManager } from './utils/storage';

/**
 * 笔记本管理器
 * 负责笔记本和笔记的CRUD操作
 */
export class NotebookManager {
  constructor(
    private storageManager: StorageManager
  ) {}

  /**
   * 创建新笔记本
   */
  async createNotebook(name: string): Promise<Notebook> {
    // 生成唯一ID（时间戳 + 随机数）
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    const notebook: Notebook = {
      id,
      name,
      createdAt: Date.now()
    };

    // 创建笔记本目录
    const notebookUri = this.storageManager.getNotebookUri(id);
    await vscode.workspace.fs.createDirectory(notebookUri);

    // 保存到配置
    await this.storageManager.addNotebook(notebook);

    return notebook;
  }

  /**
   * 删除笔记本
   */
  async deleteNotebook(notebookId: string): Promise<void> {
    // 删除文件系统中的目录
    const notebookUri = this.storageManager.getNotebookUri(notebookId);
    try {
      await vscode.workspace.fs.delete(notebookUri, { recursive: true });
    } catch (error) {
      console.error('删除笔记本目录失败:', error);
    }

    // 从配置中删除
    await this.storageManager.removeNotebook(notebookId);
  }

  /**
   * 获取所有笔记本
   */
  async getNotebooks(): Promise<Notebook[]> {
    const config = await this.storageManager.getConfig();
    return config.notebooks;
  }

  /**
   * 创建笔记
   */
  async createNote(notebookId: string, name: string): Promise<Note> {
    // 确保文件名有.md后缀
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const notebookUri = this.storageManager.getNotebookUri(notebookId);
    const noteUri = vscode.Uri.joinPath(notebookUri, fileName);

    // 初始内容
    const content = `# ${name.replace(/\.md$/, '')}\n\n`;
    const buffer = Buffer.from(content, 'utf8');

    // 写入文件
    await vscode.workspace.fs.writeFile(noteUri, buffer);

    return {
      name: name.replace(/\.md$/, ''),
      notebookId,
      uri: noteUri.toString(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * 删除笔记
   */
  async deleteNote(noteUri: vscode.Uri): Promise<void> {
    await vscode.workspace.fs.delete(noteUri);
  }

  /**
   * 获取笔记本下的所有笔记
   */
  async getNotes(notebookId: string): Promise<Note[]> {
    const notebookUri = this.storageManager.getNotebookUri(notebookId);

    try {
      const entries = await vscode.workspace.fs.readDirectory(notebookUri);
      const notes: Note[] = [];

      for (const [name, type] of entries) {
        if (type === vscode.FileType.File && name.endsWith('.md')) {
          const noteUri = vscode.Uri.joinPath(notebookUri, name);
          const stat = await vscode.workspace.fs.stat(noteUri);

          notes.push({
            name: name.replace(/\.md$/, ''),
            notebookId,
            uri: noteUri.toString(),
            createdAt: stat.ctime,
            updatedAt: stat.mtime
          });
        }
      }

      // 按修改时间倒序排列
      notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      return notes;
    } catch (error) {
      // 目录不存在或为空
      return [];
    }
  }

  /**
   * 打开笔记
   */
  async openNote(noteUri: vscode.Uri): Promise<void> {
    const document = await vscode.workspace.openTextDocument(noteUri);
    await vscode.window.showTextDocument(document);
  }

  /**
   * 验证笔记本名称
   */
  async validateNotebookName(name: string): Promise<string | null> {
    if (!name.trim()) {
      return '笔记本名称不能为空';
    }

    const notebooks = await this.getNotebooks();
    if (notebooks.some(n => n.name === name.trim())) {
      return '笔记本名称已存在';
    }

    return null;
  }
}
