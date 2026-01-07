import * as vscode from 'vscode';
import * as path from 'path';
import { Notebook, Note, Folder } from './types';
import { StorageManager } from './utils/storage';

/**
 * Notebook Manager
 * Responsible for CRUD operations on notebooks and notes
 */
export class NotebookManager {
  constructor(
    private storageManager: StorageManager
  ) { }

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
      // Throw error for user notification, no console logging needed
      if (error instanceof Error) {
        throw new Error(`Failed to delete notebook directory: ${error.message}`);
      }
      throw error;
    }

    // 从配置中删除
    await this.storageManager.removeNotebook(notebookId);
  }

  /**
   * Get all notebooks
   */
  async getNotebooks(): Promise<Notebook[]> {
    const config = await this.storageManager.getConfig();
    return config.notebooks;
  }

  /**
   * Update notebook configuration
   */
  async updateNotebook(notebook: Notebook): Promise<void> {
    const config = await this.storageManager.getConfig();
    const index = config.notebooks.findIndex(n => n.id === notebook.id);

    if (index !== -1) {
      config.notebooks[index] = notebook;
      await this.storageManager.saveConfig(config);
    }
  }

  /**
   * Rename notebook (只修改 globalState 配置,不影响文件系统)
   */
  async renameNotebook(notebookId: string, newName: string): Promise<void> {
    const config = await this.storageManager.getConfig();
    const notebook = config.notebooks.find(n => n.id === notebookId);

    if (!notebook) {
      throw new Error(`Notebook ${notebookId} not found`);
    }

    notebook.name = newName;
    await this.storageManager.saveConfig(config);
  }

  /**
   * Create note
   */
  async createNote(notebookId: string, name: string, folderPath: string = ''): Promise<Note> {
    // Ensure filename has .md extension
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const notebookUri = this.storageManager.getNotebookUri(notebookId);

    // Build note URI with folder path
    const noteUri = folderPath
      ? vscode.Uri.joinPath(notebookUri, folderPath, fileName)
      : vscode.Uri.joinPath(notebookUri, fileName);

    // Initial content
    const content = `# ${name.replace(/\.md$/, '')}\n\n`;
    const buffer = Buffer.from(content, 'utf8');

    // Write file
    await vscode.workspace.fs.writeFile(noteUri, buffer);

    return {
      name: name.replace(/\.md$/, ''),
      notebookId,
      folderPath,
      uri: noteUri.toString(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Delete note
   */
  async deleteNote(noteUri: vscode.Uri): Promise<void> {
    await vscode.workspace.fs.delete(noteUri);
  }

  /**
   * Get all notes under notebook or folder
   */
  async getNotes(notebookId: string, folderPath: string = ''): Promise<Note[]> {
    const notebookUri = this.storageManager.getNotebookUri(notebookId);
    const targetUri = folderPath
      ? vscode.Uri.joinPath(notebookUri, folderPath)
      : notebookUri;

    try {
      const entries = await vscode.workspace.fs.readDirectory(targetUri);
      const notes: Note[] = [];

      for (const [name, type] of entries) {
        // Skip .git directory and other hidden files starting with .
        if (name.startsWith('.')) {
          continue;
        }

        if (type === vscode.FileType.File && name.endsWith('.md')) {
          const noteUri = vscode.Uri.joinPath(targetUri, name);
          const stat = await vscode.workspace.fs.stat(noteUri);

          // Convert to file: scheme URI for Git decoration support
          const fileUri = vscode.Uri.file(noteUri.fsPath);

          notes.push({
            name: name.replace(/\.md$/, ''),
            notebookId,
            folderPath,
            uri: fileUri.toString(),
            createdAt: stat.ctime,
            updatedAt: stat.mtime
          });
        }
      }

      // Sort by modification time in descending order
      notes.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      return notes;
    } catch (error) {
      // Directory doesn't exist or is empty
      return [];
    }
  }

  /**
   * Create folder
   */
  async createFolder(notebookId: string, name: string, parentPath: string = ''): Promise<Folder> {
    const notebookUri = this.storageManager.getNotebookUri(notebookId);

    // Build folder path
    const folderPath = parentPath ? `${parentPath}/${name}` : name;
    const folderUri = vscode.Uri.joinPath(notebookUri, folderPath);

    // Create directory
    await vscode.workspace.fs.createDirectory(folderUri);

    // Add .gitkeep file to ensure Git tracks empty folders
    const gitkeepUri = vscode.Uri.joinPath(folderUri, '.gitkeep');
    const gitkeepContent = Buffer.from('# This file ensures Git tracks this empty folder\n', 'utf8');
    await vscode.workspace.fs.writeFile(gitkeepUri, gitkeepContent);

    // Convert to file: scheme URI for Git decoration support
    const fileUri = vscode.Uri.file(folderUri.fsPath);

    return {
      name,
      notebookId,
      parentPath,
      path: folderPath,
      uri: fileUri.toString(),
      createdAt: Date.now()
    };
  }

  /**
   * Delete folder
   */
  async deleteFolder(folderUri: vscode.Uri): Promise<void> {
    await vscode.workspace.fs.delete(folderUri, { recursive: true });
  }

  /**
   * Get all folders under notebook or parent folder
   */
  async getFolders(notebookId: string, parentPath: string = ''): Promise<Folder[]> {
    const notebookUri = this.storageManager.getNotebookUri(notebookId);
    const targetUri = parentPath
      ? vscode.Uri.joinPath(notebookUri, parentPath)
      : notebookUri;

    try {
      const entries = await vscode.workspace.fs.readDirectory(targetUri);
      const folders: Folder[] = [];

      for (const [name, type] of entries) {
        // Skip .git directory and other hidden directories starting with .
        if (name.startsWith('.')) {
          continue;
        }

        if (type === vscode.FileType.Directory) {
          const folderPath = parentPath ? `${parentPath}/${name}` : name;
          const folderUri = vscode.Uri.joinPath(notebookUri, folderPath);
          const stat = await vscode.workspace.fs.stat(folderUri);

          folders.push({
            name,
            notebookId,
            parentPath,
            path: folderPath,
            uri: folderUri.toString(),
            createdAt: stat.ctime
          });
        }
      }

      // Sort by name
      folders.sort((a, b) => a.name.localeCompare(b.name));

      return folders;
    } catch (error) {
      // Directory doesn't exist or is empty
      return [];
    }
  }

  /**
   * Open note
   */
  async openNote(noteUri: vscode.Uri): Promise<void> {
    const document = await vscode.workspace.openTextDocument(noteUri);
    await vscode.window.showTextDocument(document);
  }

  /**
   * Validate notebook name
   */
  async validateNotebookName(name: string): Promise<string | null> {
    if (!name.trim()) {
      return 'Notebook name cannot be empty';
    }

    const notebooks = await this.getNotebooks();
    if (notebooks.some(n => n.name === name.trim())) {
      return 'Notebook name already exists';
    }

    return null;
  }

  /**
   * Rename folder (实际移动文件系统中的文件夹,Git 自动跟踪)
   */
  async renameFolder(notebookId: string, folderPath: string, newName: string): Promise<void> {
    const notebookUri = this.storageManager.getNotebookUri(notebookId);
    const oldFolderUri = vscode.Uri.joinPath(notebookUri, folderPath);

    // Build new path: replace last component with newName
    const pathParts = folderPath.split(path.posix.sep).filter(Boolean);
    pathParts[pathParts.length - 1] = newName;
    const newFolderPath = pathParts.join(path.posix.sep);
    const newFolderUri = vscode.Uri.joinPath(notebookUri, newFolderPath);

    // Rename (move) folder
    await vscode.workspace.fs.rename(oldFolderUri, newFolderUri, { overwrite: false });
  }

  /**
   * Rename note (实际重命名文件系统中的文件,Git 自动跟踪)
   */
  async renameNote(noteUri: vscode.Uri, newName: string): Promise<vscode.Uri> {
    // Ensure .md extension
    if (!newName.endsWith('.md')) {
      newName += '.md';
    }

    // Build new URI in same directory
    const oldPath = noteUri.fsPath;
    const dirPath = path.dirname(oldPath);
    const newPath = path.join(dirPath, newName);
    const newUri = vscode.Uri.file(newPath);

    // Rename file
    await vscode.workspace.fs.rename(noteUri, newUri, { overwrite: false });

    return newUri;
  }
}
