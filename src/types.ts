/**
 * 笔记本接口
 */
export interface Notebook {
  /** 唯一标识符 */
  id: string;
  /** 笔记本名称 */
  name: string;
  /** 创建时间戳 */
  createdAt: number;
  /** Git远程仓库地址（预留，未来功能） */
  gitRemote?: string;
  /** Git分支名（预留，未来功能） */
  gitBranch?: string;
  /** 是否启用同步（预留，未来功能） */
  syncEnabled?: boolean;
  /** 最后同步时间（预留，未来功能） */
  lastSyncTime?: number;
}

/**
 * 笔记接口
 */
export interface Note {
  /** 笔记名称（不含.md后缀） */
  name: string;
  /** 所属笔记本ID */
  notebookId: string;
  /** 文件URI路径 */
  uri: string;
  /** 创建时间戳 */
  createdAt?: number;
  /** 最后修改时间戳 */
  updatedAt?: number;
}

/**
 * 全局配置接口（存储在globalState中，支持跨设备同步）
 */
export interface GlobalConfig {
  /** 笔记本列表 */
  notebooks: Notebook[];
  /** 当前活动的笔记本ID */
  activeNotebook?: string;
  /** 配置版本号（用于未来迁移） */
  version?: string;
}
