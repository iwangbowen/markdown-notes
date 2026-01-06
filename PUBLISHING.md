# 发布指南 | Publishing Guide

本文档详细说明如何打包和发布 Markdown Notes Manager 扩展到 VS Code Marketplace.

---

## 📋 目录

- [前置准备](#前置准备)
- [版本管理](#版本管理)
- [打包流程](#打包流程)
- [发布流程](#发布流程)
- [发布前检查清单](#发布前检查清单)
- [常见问题](#常见问题)
- [版本号规范](#版本号规范)

---

## 前置准备

### 1. 安装依赖

确保已安装 `@vscode/vsce` (VS Code Extension Manager):

```bash
# 已在 package.json 的 devDependencies 中配置
npm install
```

### 2. 获取 Personal Access Token (PAT)

如果是首次发布，需要创建 Azure DevOps Personal Access Token：

1. 访问 [Azure DevOps](https://dev.azure.com/)
2. 使用 Microsoft 账号登录
3. 点击右上角用户图标 → **Personal Access Tokens**
4. 点击 **New Token**
5. 配置 Token:
   - **Name**: `vscode-marketplace-publishing`
   - **Organization**: 选择你的组织（或 All accessible organizations）
   - **Expiration**: 设置过期时间（建议 90 天或自定义）
   - **Scopes**: 选择 **Marketplace** → **Manage** (完全访问权限)
6. 点击 **Create** 并保存 Token（只显示一次！）

### 3. 创建 Publisher

如果已经有 Publisher (`WangBowen`)，可跳过此步骤。

```bash
# 创建 Publisher
npx vsce create-publisher WangBowen
# 会提示输入 PAT 和其他信息
```

### 4. 登录 Publisher

```bash
npx vsce login WangBowen
# 输入你的 Personal Access Token
```

---

## 版本管理

### 语义化版本 (Semantic Versioning)

遵循 `MAJOR.MINOR.PATCH` 格式：

- **MAJOR** (主版本): 不兼容的 API 变更
- **MINOR** (次版本): 向后兼容的功能新增
- **PATCH** (补丁版本): 向后兼容的 Bug 修复

示例:

- `0.1.0` → 初始版本
- `0.1.1` → Bug 修复
- `0.2.0` → 新增功能
- `1.0.0` → 稳定发布

### 更新版本号

**方法 1: 手动修改 `package.json`**

```json
{
  "version": "0.1.1"
}
```

**方法 2: 使用 npm 命令**

```bash
# 补丁版本 (0.1.0 → 0.1.1)
npm version patch

# 次版本 (0.1.1 → 0.2.0)
npm version minor

# 主版本 (0.2.0 → 1.0.0)
npm version major
```

### 更新 CHANGELOG.md

在发布前，更新 `CHANGELOG.md`:

```markdown
## [0.1.1] - 2026-01-10

### Fixed
- 修复 Git 同步时的错误处理
- 优化笔记树刷新性能

### Changed
- 改进 Git 状态显示逻辑
```

---

## 打包流程

### 1. 编译代码

```bash
npm run compile
```

确保没有 TypeScript 编译错误。

### 2. 运行 Linting

```bash
npm run lint
```

修复所有 ESLint 警告和错误。

### 3. 本地测试

1. 在 VS Code 中按 `F5` 启动调试
2. 在 Extension Development Host 中测试所有功能
3. 确认没有运行时错误

### 4. 生成 .vsix 包

```bash
npm run package
```

或直接使用:

```bash
npx vsce package
```

这会生成一个 `.vsix` 文件，例如 `markdown-notes-0.1.0.vsix`。

### 5. 本地安装测试

在 VS Code 中安装打包后的扩展:

```bash
code --install-extension markdown-notes-0.1.0.vsix
```

或通过 VS Code UI:

1. 打开 Extensions 视图 (`Ctrl+Shift+X`)
2. 点击 `...` → `Install from VSIX...`
3. 选择生成的 `.vsix` 文件

---

## 发布流程

### 方式 1: 使用 NPM 脚本（推荐）

```bash
# 确保已登录 Publisher
npx vsce login WangBowen

# 发布（会自动编译、打包、上传）
npm run publish
```

### 方式 2: 使用 vsce 命令

```bash
# 发布
npx vsce publish

# 发布并升级版本号
npx vsce publish patch   # 0.1.0 → 0.1.1
npx vsce publish minor   # 0.1.0 → 0.2.0
npx vsce publish major   # 0.1.0 → 1.0.0
```

### 方式 3: 手动上传到 Marketplace

1. 打包扩展: `npm run package`
2. 访问 [Visual Studio Marketplace Publisher Management](https://marketplace.visualstudio.com/manage/publishers/WangBowen)
3. 点击 **New extension** → **Visual Studio Code**
4. 上传 `.vsix` 文件

---

## 发布前检查清单

使用此清单确保发布质量：

### ✅ 代码质量

- [ ] 所有代码已提交到 Git
- [ ] 没有 TypeScript 编译错误 (`npm run compile`)
- [ ] 没有 ESLint 错误 (`npm run lint`)
- [ ] 所有功能已在本地测试
- [ ] 没有 console.log 等调试代码

### ✅ 文档更新

- [ ] `package.json` 版本号已更新
- [ ] `CHANGELOG.md` 已更新当前版本的变更内容
- [ ] `README.md` 反映了最新功能
- [ ] 所有命令和功能都有文档说明

### ✅ 资源文件

- [ ] `icon.png` 存在且为 128x128 像素
- [ ] `LICENSE` 文件存在
- [ ] `.vscodeignore` 正确排除了不必要的文件

### ✅ Package.json 配置

- [ ] `publisher` 设置为 `WangBowen`
- [ ] `repository` URL 正确
- [ ] `homepage` 和 `bugs` URL 正确
- [ ] `keywords` 包含相关搜索关键词
- [ ] `categories` 正确分类

### ✅ Git 标签

- [ ] 创建版本 Git Tag:

  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

### ✅ 发布后验证

- [ ] 在 [Marketplace](https://marketplace.visualstudio.com/items?itemName=WangBowen.markdown-notes) 上查看扩展
- [ ] 通过 VS Code 搜索并安装扩展
- [ ] 安装后测试核心功能
- [ ] 检查扩展页面的描述、图标、版本号

---

## 常见问题

### ❓ 发布失败: "Publisher 'WangBowen' not found"

**解决方案:**

```bash
# 登录 Publisher
npx vsce login WangBowen
# 输入你的 PAT
```

### ❓ 打包时提示 "Missing publisher name"

**解决方案:**

确保 `package.json` 中有:

```json
{
  "publisher": "WangBowen"
}
```

### ❓ 图标不显示

**解决方案:**

1. 确保 `resources/icon.png` 存在
2. 文件大小为 128x128 像素
3. `package.json` 中正确配置:

   ```json
   {
     "icon": "resources/icon.png"
   }
   ```

### ❓ 扩展包太大

**解决方案:**

1. 检查 `.vscodeignore` 是否正确排除了:
   - `src/**`
   - `node_modules/**`
   - `**/*.ts`
   - 开发文件和文档

2. 查看打包内容:

   ```bash
   npx vsce ls
   ```

### ❓ Personal Access Token 过期

**解决方案:**

1. 在 [Azure DevOps](https://dev.azure.com/) 重新生成 Token
2. 重新登录:

   ```bash
   npx vsce login WangBowen
   ```

### ❓ 发布后更新未生效

**原因:** Marketplace 有缓存延迟（5-10 分钟）

**解决方案:** 等待几分钟后刷新页面

### ❓ 如何撤回已发布的版本？

**不推荐撤回，应发布修复版本。** 如必须撤回:

1. 访问 [Publisher Management](https://marketplace.visualstudio.com/manage/publishers/WangBowen)
2. 找到扩展 → More Actions → Unpublish

---

## 版本号规范

### 开发阶段 (0.x.x)

- `0.1.0` - 初始发布，基础功能
- `0.1.x` - Bug 修复
- `0.x.0` - 新功能添加

### 稳定版本 (1.x.x)

- `1.0.0` - 第一个稳定版本（功能完善、测试充分）
- `1.0.x` - 补丁和小修复
- `1.x.0` - 新功能（向后兼容）
- `x.0.0` - 重大变更（可能不兼容旧版本）

### 预发布版本

使用标签标识预发布:

```bash
# 发布 beta 版本
npx vsce publish --pre-release

# 版本号示例: 0.2.0-beta.1
```

---

## 自动化发布 (可选)

### 使用 GitHub Actions

创建 `.github/workflows/publish.yml`:

```yaml
name: Publish Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm install
      - run: npm run compile
      - run: npx vsce publish -p ${{ secrets.VSCE_PAT }}
```

在 GitHub 仓库设置中添加 Secret:

- **Name**: `VSCE_PAT`
- **Value**: 你的 Personal Access Token

---

## 发布命令速查表

| 命令 | 说明 |
|------|------|
| `npm run compile` | 编译 TypeScript |
| `npm run lint` | 运行 ESLint |
| `npm run package` | 打包为 .vsix 文件 |
| `npm run publish` | 发布到 Marketplace |
| `npx vsce package` | 打包（等同于 npm run package） |
| `npx vsce publish` | 发布（等同于 npm run publish） |
| `npx vsce publish patch` | 发布并升级补丁版本 |
| `npx vsce publish minor` | 发布并升级次版本 |
| `npx vsce publish major` | 发布并升级主版本 |
| `npx vsce ls` | 列出将打包的文件 |
| `npx vsce login WangBowen` | 登录 Publisher |

---

## 相关链接

- [VS Code Extension API](https://code.visualstudio.com/api)
- [vsce Publishing Tool](https://github.com/microsoft/vscode-vsce)
- [VS Code Marketplace](https://marketplace.visualstudio.com/vscode)
- [Publisher Management Portal](https://marketplace.visualstudio.com/manage/publishers/WangBowen)
- [Azure DevOps PAT](https://dev.azure.com/)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)

---

**祝发布顺利！** 🚀

如有问题，请查阅 [常见问题](#常见问题) 或访问 [GitHub Issues](https://github.com/iwangbowen/markdown-notes/issues)。
