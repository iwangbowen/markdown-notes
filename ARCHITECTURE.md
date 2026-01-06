# Markdown Notes - 存储和同步架构

## 概述

本扩展使用**双层存储架构**，结合 VS Code 的 `globalState` 和 `globalStorageUri` 来实现配置同步和文件存储。

## 一、存储架构详解

### 1.1 双层存储设计

```
┌─────────────────────────────────────────────────────────────┐
│                     Markdown Notes 扩展                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────┐       ┌──────────────────────┐   │
│  │   globalState       │       │  globalStorageUri     │   │
│  │  (配置元数据)        │       │   (Markdown 文件)     │   │
│  ├─────────────────────┤       ├──────────────────────┤   │
│  │ ✓ 笔记本列表         │       │ notebooks/           │   │
│  │ ✓ 笔记本ID、名称     │       │ ├── notebook-1/      │   │
│  │ ✓ Git配置           │       │ │   ├── note1.md      │   │
│  │ ✓ 作者信息          │       │ │   ├── note2.md      │   │
│  │ ✓ 远程仓库URL       │       │ │   └── .git/         │   │
│  │ ✓ 分支名称          │       │ └── notebook-2/      │   │
│  │                     │       │     └── note3.md      │   │
│  │ 跨设备同步: ✓       │       │  跨设备同步: ✗        │   │
│  └─────────────────────┘       └──────────────────────┘   │
│           ▲                              ▲                  │
│           │                              │                  │
│    VS Code Settings Sync         本地文件系统              │
│    (自动同步到云端)               (不自动同步)              │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 globalState (配置数据)

**存储内容**:

```typescript
{
  "notebooks": [
    {
      "id": "uuid-1",
      "name": "工作笔记",
      "createdAt": 1704528000000,
      "gitConfig": {
        "remoteUrl": "https://github.com/user/work-notes.git",
        "branch": "main",
        "author": {
          "name": "John Doe",
          "email": "john@example.com"
        },
        "lastSync": 1704531600000,
        "initialized": true
      }
    },
    {
      "id": "uuid-2",
      "name": "学习笔记",
      "createdAt": 1704614400000
    }
  ],
  "activeNotebook": "uuid-1",
  "version": "1.0.0"
}
```

**特点**:

- ✅ **自动跨设备同步**: 通过 VS Code Settings Sync 自动同步
- ✅ **轻量级数据**: 只存储配置和元数据，不存储文件内容
- ✅ **JSON 格式**: 易于备份和迁移
- ⚠️ **存储位置**: VS Code 内部数据库 (不可直接访问)

### 1.3 globalStorageUri (文件数据)

**存储路径**:

- **Windows**: `%APPDATA%/Code/User/globalStorage/markdown-notes.markdown-notes/`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/markdown-notes.markdown-notes/`
- **Linux**: `~/.config/Code/User/globalStorage/markdown-notes.markdown-notes/`

**目录结构**:

```
globalStorage/markdown-notes.markdown-notes/
└── notebooks/
    ├── uuid-1/                          # 笔记本 ID
    │   ├── .git/                        # Git 仓库 (如果启用 Git)
    │   ├── note1.md                     # Markdown 文件
    │   ├── note2.md
    │   └── folder1/                     # 文件夹
    │       └── note3.md
    └── uuid-2/
        └── note4.md
```

**特点**:

- ✗ **不自动同步**: VS Code Settings Sync 不同步此目录
- ✓ **真实文件**: 可以通过文件管理器直接访问
- ✓ **支持 Git**: 每个笔记本可以独立初始化 Git 仓库
- ✓ **自动清理**: 扩展卸载时自动删除

## 二、同步关系详解

### 2.1 VS Code Settings Sync 的作用

VS Code Settings Sync 会自动同步 `globalState` 中的数据：

```
设备 A                                     设备 B
─────────────────────                     ─────────────────────
globalState:                              globalState:
{                                         {
  notebooks: [                              notebooks: [
    {id: "uuid-1", name: "工作"}    ──►      {id: "uuid-1", name: "工作"}
  ]                                         ]
}                                         }
          │                                       │
          │                                       │
          ▼                                       ▼
    VS Code 云端 ◄──────────────────────────────►
    (自动同步)
```

**同步的内容**:

- ✅ 笔记本列表 (ID、名称、创建时间)
- ✅ Git 配置 (远程URL、分支、作者信息)
- ✅ 活动笔记本 ID
- ✅ 配置版本号

**不同步的内容**:

- ✗ Markdown 文件内容
- ✗ Git 仓库 (.git 目录)
- ✗ Git 凭据 (存储在 VS Code SecretStorage)

### 2.2 Git 仓库的作用

Git 用于同步 **Markdown 文件内容**，与 VS Code Settings Sync 互补：

```
                    Markdown 文件内容
                           │
                           ▼
        ┌─────────────────────────────────────┐
        │     globalStorageUri/notebooks/     │
        │           uuid-1/                    │
        │         ├── note1.md                 │
        │         ├── note2.md                 │
        │         └── .git/                    │
        └─────────────────────────────────────┘
                           │
                    Git Push/Pull
                           │
                           ▼
        ┌─────────────────────────────────────┐
        │      GitHub/GitLab/Bitbucket        │
        │    https://github.com/user/repo.git │
        └─────────────────────────────────────┘
                           │
                    Git Pull/Push
                           │
                           ▼
        ┌─────────────────────────────────────┐
        │       另一台设备的 globalStorageUri    │
        └─────────────────────────────────────┘
```

## 三、跨设备工作流程

### 3.1 第一次在新设备上使用

**场景**: 你在设备 A 创建了笔记本，现在在设备 B 上打开 VS Code

```
设备 A                        VS Code 云端                      设备 B
─────────────────────        ──────────────                   ─────────────────────
1. 创建笔记本 "工作"
   globalState: {
     notebooks: [{
       id: "uuid-1",
       name: "工作",
       gitConfig: {...}
     }]
   }
            │
            ├──► Settings Sync ──►                    ──►  2. 同步配置
            │                                                globalState: {
            │                                                  notebooks: [{
            │                                                    id: "uuid-1",
            │                                                    name: "工作"
            │                                                  }]
            │                                                }
            │                                                      │
3. 配置 Git                                                       │
   Push 到 GitHub                                                 │
            │                                                      │
            ├──► GitHub ──────────────────────────────►  4. Git Clone
                                                            下载 Markdown 文件
                                                            到 globalStorageUri
```

**详细步骤**:

1. **设备 A** (已有数据):
   - globalState 中有笔记本配置
   - globalStorageUri 中有 Markdown 文件
   - 如果配置了 Git，文件已推送到远程仓库

2. **VS Code Settings Sync**:
   - 自动同步 globalState 到设备 B
   - 设备 B 现在知道有哪些笔记本，以及 Git 配置

3. **设备 B** (新设备):
   - ✅ globalState 已同步 (知道笔记本存在)
   - ✗ globalStorageUri 是空的 (没有文件)
   - **需要手动操作**:
     - 在扩展中看到笔记本 "工作"
     - 右键 → Git: Pull (或自动触发 Clone)
     - Git 会下载所有 Markdown 文件到本地

### 3.2 日常工作流程

**设备 A 修改笔记 → 设备 B 同步**:

```
设备 A                                                设备 B
─────────────────────                                ─────────────────────
1. 修改 note1.md
   globalStorageUri/uuid-1/note1.md

2. Git Commit + Push
   ├─► GitHub ────────────────────────────►  3. Git Pull
                                                下载最新的 note1.md
                                                到 globalStorageUri

4. 添加新笔记本 "学习"
   globalState.notebooks.push({...})
            │
   Settings Sync ──────────────────────►  5. 自动同步
                                             globalState 更新
                                             看到新笔记本 "学习"

6. 配置 Git for "学习"
   Git Clone
            │
   ├─► GitHub ────────────────────────────►  7. Git Clone
                                                下载 "学习" 笔记本文件
```

## 四、数据流向图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户操作                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┴───────────────┐
         │                               │
    创建/删除笔记本                   创建/编辑笔记
    配置 Git                          修改 Markdown 文件
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌──────────────────┐
│  globalState    │            │ globalStorageUri │
│  (配置元数据)    │            │  (文件内容)      │
└────────┬────────┘            └────────┬─────────┘
         │                               │
         │ VS Code                       │ Git
         │ Settings Sync                 │ Push/Pull
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌──────────────────┐
│  VS Code 云端   │            │  Git 远程仓库    │
│  (Microsoft)    │            │  (GitHub等)      │
└────────┬────────┘            └────────┬─────────┘
         │                               │
         │ 自动同步                      │ 手动同步
         │                               │
         ▼                               ▼
┌─────────────────┐            ┌──────────────────┐
│  其他设备        │            │  其他设备        │
│  globalState    │            │ globalStorageUri │
└─────────────────┘            └──────────────────┘
```

## 五、关联关系总结

### 5.1 globalState 和 globalStorageUri 的关联

```typescript
// globalState 中存储笔记本元数据
{
  "notebooks": [
    {
      "id": "uuid-1",  // ← 这个 ID 用于定位文件存储路径
      "name": "工作笔记"
    }
  ]
}

// globalStorageUri 中对应的目录
// {globalStorageUri}/notebooks/uuid-1/
//                                 ▲
//                                 └── 使用笔记本 ID 作为目录名
```

### 5.2 VS Code Sync 和 Git 的关联

1. **VS Code Settings Sync** 同步 **配置**:
   - 笔记本 ID、名称、Git 配置
   - 告诉其他设备"有哪些笔记本"

2. **Git** 同步 **内容**:
   - Markdown 文件内容
   - 基于 globalState 中的 `gitConfig.remoteUrl`
   - 实际文件存储在 `globalStorageUri/notebooks/{id}/`

### 5.3 完整的数据关联链

```
globalState.notebooks[0]
├── id: "uuid-1"
│   └──► globalStorageUri/notebooks/uuid-1/  (文件存储位置)
│
├── name: "工作笔记"  (UI 显示)
│
└── gitConfig
    ├── remoteUrl: "https://github.com/user/repo.git"
    │   └──► Git Clone/Push/Pull 的目标仓库
    │
    ├── branch: "main"
    │   └──► Git 操作的默认分支
    │
    └── author
        └──► Git Commit 的作者信息
```

## 六、最佳实践

### 6.1 推荐的工作流程

1. **初始设置**:

   ```
   设备 A:
   1. 创建笔记本 "工作"
   2. 配置 Git (设置远程仓库)
   3. Git Clone (如果远程已有内容) 或 Git Init + Push
   4. VS Code Settings Sync 自动同步配置
   ```

2. **在新设备上**:

   ```
   设备 B:
   1. 打开 VS Code (Settings Sync 自动同步配置)
   2. 看到笔记本列表
   3. 右键笔记本 → Git: Pull (首次为 Clone)
   4. 开始使用
   ```

3. **日常使用**:

   ```
   任何设备:
   1. 编辑笔记
   2. Git: Commit (本地提交)
   3. Git: Push (推送到远程)

   其他设备:
   1. Git: Pull (拉取最新内容)
   ```

### 6.2 数据安全建议

1. **定期 Git Push**: 确保数据备份到远程仓库
2. **使用私有仓库**: 敏感数据使用 Private Repository
3. **凭据安全**: Git 凭据存储在 VS Code SecretStorage (加密存储)
4. **本地备份**: globalStorageUri 目录可以定期备份

## 七、常见问题

### Q1: 为什么不把 Markdown 文件也放到 globalState？

**A**: globalState 有大小限制，且主要用于配置数据。大量的 Markdown 文件会导致：

- 同步速度慢
- 可能超过存储限制
- 无法使用 Git 的版本控制功能

### Q2: 如果我在两台设备同时修改同一个笔记会怎样？

**A**: 会产生 Git 冲突：

- VS Code Settings Sync 会同步配置 (无冲突)
- Git 会检测到文件冲突
- 需要手动解决冲突 (计划中的功能: 冲突解决 UI)

### Q3: 可以不用 Git 吗？

**A**: 可以，但不推荐：

- 不配置 Git: 每台设备的文件独立，不会同步
- 推荐至少为重要笔记本配置 Git，实现内容同步

### Q4: globalStorageUri 的文件会自动同步吗？

**A**: 不会自动同步：

- VS Code Settings Sync 不同步此目录
- 必须通过 Git 手动同步 (Pull/Push)
- 这是设计选择: 给用户完全的控制权

## 八、总结

| 项目 | globalState | globalStorageUri | Git 仓库 |
|------|------------|------------------|---------|
| **存储内容** | 配置元数据 | Markdown 文件 | 文件版本历史 |
| **自动同步** | ✅ (VS Code Sync) | ✗ | ✗ (需手动 Pull/Push) |
| **跨设备** | ✅ | 需要 Git | ✅ |
| **文件大小** | 小 (几 KB) | 大 (所有笔记) | 大 (含历史) |
| **备份** | VS Code 云端 | 本地 + Git 远程 | Git 远程 |
| **作用** | 告知"有什么" | 存储"是什么" | 同步+版本控制 |

**完整工作流**:

```
创建笔记本 → globalState (VS Code 同步配置)
    ↓
写笔记 → globalStorageUri (本地文件)
    ↓
配置 Git → globalState.gitConfig (VS Code 同步配置)
    ↓
Git Push → Git 远程仓库 (备份+同步)
    ↓
其他设备 → Git Pull → globalStorageUri (获取文件)
```
