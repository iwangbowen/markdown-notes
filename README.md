# Markdown Notes

> 一个功能完善的 VS Code 笔记管理插件，支持多笔记本、树形视图和原生 Markdown 编辑器

## ✨ 特性

- 📚 **多笔记本管理** - 支持创建多个笔记本，独立组织笔记内容
- 🌲 **树形视图** - 在侧边栏以树形结构展示所有笔记本和笔记
- ✏️ **原生编辑器** - 使用 VS Code 原生 Markdown 编辑器，完整支持预览、搜索等功能
- 💾 **自动存储** - 使用 `globalStorageUri` 自动管理存储位置，无需手动配置
- 🔄 **配置同步** - 笔记本配置通过 `globalState` 支持跨设备同步
- 🎯 **零配置** - 开箱即用，无需任何配置

## 🚀 快速开始

### 安装

1. 在 VS Code 扩展市场搜索 "Markdown Notes"
2. 点击安装
3. 首次启动会引导您创建第一个笔记本

### 使用

#### 创建笔记本

- 点击侧边栏 "Markdown Notes" 视图中的 ➕ 按钮
- 输入笔记本名称（如：工作笔记、个人随想）

#### 创建笔记

- 右键点击笔记本
- 选择"创建笔记"
- 输入笔记名称
- 自动打开 Markdown 编辑器

#### 编辑笔记

- 点击笔记即可在编辑器中打开
- 使用 VS Code 原生 Markdown 编辑器的所有功能
- 支持预览、撤销、搜索、替换等

#### 删除操作

- 右键笔记 → 删除笔记
- 右键笔记本 → 删除笔记本（会提示笔记数量）

## 📁 数据存储

### 存储架构

本插件采用双层存储架构，兼顾配置同步和文件管理：

| 存储方式 | 内容 | 位置 | 跨设备同步 |
|---------|------|------|-----------|
| `globalState` | 笔记本配置、元数据 | VS Code 设置 | ✅ 是 |
| `globalStorageUri` | Markdown 文件 | 扩展数据目录 | ❌ 否 |

### 存储位置

笔记文件自动存储在 VS Code 管理的目录中：

- **Windows**: `%APPDATA%/Code/User/globalStorage/markdown-notes.markdown-notes/`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/markdown-notes.markdown-notes/`
- **Linux**: `~/.config/Code/User/globalStorage/markdown-notes.markdown-notes/`

> 💡 无需手动配置，VS Code 会自动管理这些目录

### 目录结构

```
{globalStorageUri}/
└── notebooks/
    ├── {notebook-id-1}/
    │   ├── 会议记录.md
    │   └── 项目计划.md
    └── {notebook-id-2}/
        └── 读书笔记.md
```

## 🎯 设计理念

### 笔记即文件（File-first）

- 每条笔记 = 一个 `.md` 文件
- 不自研编辑器，完全复用 VS Code 原生能力
- 保证数据的可移植性和可读性

### 零配置理念

- 使用 VS Code 官方推荐的存储方案
- 自动处理跨平台路径差异
- 自动随扩展卸载清理

### 未来扩展

- 🔄 Git 同步支持（每个笔记本关联独立仓库）
- 🏷️ 标签和分类
- 🔍 全文搜索
- 📊 统计分析

## 🛠️ 开发

### 本地开发

```bash
# 安装依赖
npm install

# 编译
npm run compile

# 监听模式
npm run watch

# 在 VS Code 中按 F5 启动调试
```

### 打包发布

```bash
npm install -g @vscode/vsce
vsce package
```

## 📝 命令列表

| 命令 | 描述 |
|------|------|
| `markdownNotes.createNotebook` | 创建笔记本 |
| `markdownNotes.createNote` | 创建笔记 |
| `markdownNotes.deleteNote` | 删除笔记 |
| `markdownNotes.deleteNotebook` | 删除笔记本 |
| `markdownNotes.refreshTree` | 刷新树视图 |

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

感谢 VS Code 团队提供优秀的扩展 API。
