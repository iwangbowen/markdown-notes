import * as vscode from 'vscode';
import { GlobalConfig, Notebook } from '../types';

/**
 * Storage Manager
 * Manages read/write operations for globalState and globalStorageUri
 */
export class StorageManager {
  private static readonly CONFIG_KEY = 'markdownNotes.config';
  private static readonly CONFIG_VERSION = '1.0.0';

  constructor(
    private context: vscode.ExtensionContext
  ) { }

  /**
   * 获取全局配置
   */
  async getConfig(): Promise<GlobalConfig> {
    const config = this.context.globalState.get<GlobalConfig>(StorageManager.CONFIG_KEY);

    if (!config) {
      // 初始化默认配置
      const defaultConfig: GlobalConfig = {
        notebooks: [],
        version: StorageManager.CONFIG_VERSION
      };
      await this.saveConfig(defaultConfig);
      return defaultConfig;
    }

    return config;
  }

  /**
   * 保存全局配置
   */
  async saveConfig(config: GlobalConfig): Promise<void> {
    config.version = StorageManager.CONFIG_VERSION;
    await this.context.globalState.update(StorageManager.CONFIG_KEY, config);
  }

  /**
   * 添加笔记本到配置
   */
  async addNotebook(notebook: Notebook): Promise<void> {
    const config = await this.getConfig();
    config.notebooks.push(notebook);
    await this.saveConfig(config);
  }

  /**
   * 删除笔记本从配置
   */
  async removeNotebook(notebookId: string): Promise<void> {
    const config = await this.getConfig();
    config.notebooks = config.notebooks.filter(n => n.id !== notebookId);
    if (config.activeNotebook === notebookId) {
      config.activeNotebook = undefined;
    }
    await this.saveConfig(config);
  }

  /**
   * 更新笔记本信息
   */
  async updateNotebook(notebookId: string, updates: Partial<Notebook>): Promise<void> {
    const config = await this.getConfig();
    const index = config.notebooks.findIndex(n => n.id === notebookId);
    if (index !== -1) {
      config.notebooks[index] = { ...config.notebooks[index], ...updates };
      await this.saveConfig(config);
    }
  }

  /**
   * 获取存储根目录URI
   */
  getStorageUri(): vscode.Uri {
    return this.context.globalStorageUri;
  }

  /**
   * 获取笔记本目录URI
   */
  getNotebookUri(notebookId: string): vscode.Uri {
    return vscode.Uri.joinPath(this.getStorageUri(), 'notebooks', notebookId);
  }

  /**
   * 初始化存储目录
   */
  async initializeStorage(): Promise<void> {
    const storageUri = this.getStorageUri();
    const notebooksUri = vscode.Uri.joinPath(storageUri, 'notebooks');

    try {
      await vscode.workspace.fs.stat(notebooksUri);
    } catch {
      // 目录不存在，创建它
      await vscode.workspace.fs.createDirectory(notebooksUri);
    }
  }
}
