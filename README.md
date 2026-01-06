# Markdown Notes Manager

> A full-featured VS Code notes management extension with multi-notebook support, tree view, and native Markdown editor

## Features

- **Multi-notebook Management** - Create multiple notebooks to organize notes independently
- **Hierarchical Structure** - Support for folders and notes in tree structure
- **Git Synchronization** - Sync notebooks with remote Git repositories (GitHub, GitLab, etc.)
- **Tree View** - Display all notebooks, folders, and notes in a tree structure in the sidebar
- **Native Editor** - Use VS Code's native Markdown editor with full preview and search support
- **Automatic Storage** - Use `globalStorageUri` for automatic storage management, no manual configuration needed
- **Secure Credentials** - Store Git credentials securely using VS Code's SecretStorage API
- **Configuration Sync** - Notebook configuration syncs across devices via `globalState`
- **Zero Configuration** - Works out of the box, no setup required

---

## ☕ Support This Project

**If you find this extension helpful, please consider supporting its development!**

Your support helps maintain and improve this project, adding new features and fixing bugs.

### 赞赏 / Donation

<div align="center">
  <img src="resources/wechat-pay.jpg" alt="微信赞赏码" width="200"/>
  <br/>
  <i>微信扫码赞赏 | WeChat Pay</i>
</div>

---

## Quick Start

### Installation

1. Search for "Markdown Notes Manager" in the VS Code Extensions Marketplace
2. Click Install
3. Click the Markdown Notes icon in the activity bar to get started

### Usage

#### Create Notebook

- Click the + button in the "Markdown Notes" view in the sidebar
- Enter notebook name (e.g., Work Notes, Personal Ideas)

#### Create Note

- Right-click on a notebook or folder
- Select "Create Note"
- Enter note name
- Markdown editor opens automatically

#### Create Folder

- Right-click on a notebook or folder
- Select "Create Folder"
- Enter folder name
- Organize notes hierarchically

#### Git Synchronization

> **Cross-Device Workflow**: When you sync VS Code settings to a new device, the extension will automatically detect notebooks that need initialization and prompt you to clone them.

1. **Configure Git Repository**:
   - Right-click on a notebook
   - Select "Configure Git Repository"
   - Enter repository URL (HTTPS)
   - Set branch name (default: main)
   - Enter author name and email
   - Choose authentication method:
     - Personal Access Token (recommended)
     - Username + Password
   - **Note**: This only saves configuration. You need to initialize or clone separately.

2. **Initialize or Clone**:

   **Option A - Initialize Git** (Create new local repository):
   - Right-click on a notebook (that has Git configured)
   - Select "Initialize Git Repository"
   - Creates an empty `.git` repository
   - Use this when starting a new notebook

   **Option B - Clone Git** (Download from remote):
   - Right-click on a notebook (that has Git configured)
   - Select "Clone Git Repository"
   - Downloads all files from remote repository
   - Use this when setting up on a new device

3. **Commit Changes**:
   - Right-click on a notebook
   - Select "Commit Changes"
   - Enter commit message
   - Changes are committed locally

4. **Pull from Remote**:
   - Right-click on a notebook
   - Select "Pull from Remote"
   - Latest changes are pulled from remote repository

5. **Push to Remote**:
   - Right-click on a notebook
   - Select "Push to Remote"
   - Local commits are pushed to remote repository

6. **Sync (Pull + Push)**:
   - Right-click on a notebook
   - Select "Sync with Remote"
   - Automatically pulls and pushes changes

7. **View Git Status**:
   - Right-click on a notebook
   - Select "View Git Status"
   - Shows uncommitted changes, unpushed commits, and last sync time

**Recommended Workflow**:

```
Device A (First time):
1. Create Notebook
2. Configure Git → Save metadata
3. Initialize Git → Create local .git/
4. Create notes → Write content
5. Commit Changes → Commit to local
6. Push to Remote → Upload to GitHub

Device B (New device):
1. Open VS Code → Settings Sync auto-syncs notebook config
2. Extension detects uninitialized notebook → Shows prompt
3. Click "Clone Now" → Downloads all files from GitHub
4. Start working → Edit notes
5. Commit & Push → Sync changes back
```

#### File-Level Git Operations

For individual notes, you can view Git history and changes using VS Code's built-in Git features:

**View File History**:

- Right-click on a note → "View File History"
- Shows all commits that modified this file
- Requires VS Code's Git extension (enabled by default)

**Compare with HEAD**:

- Right-click on a note → "Compare with HEAD"
- Shows diff between current file and latest commit
- Useful for reviewing unsaved changes

**Git Decorations**:

- Modified files show "M" badge in TreeView
- Untracked files show "U" badge
- Requires `explorer.decorations.badges` and `git.decorations.enabled` settings (enabled by default)

#### Edit Note

- Click on a note to open it in the editor
- Use all features of VS Code's native Markdown editor
- Supports preview, undo, search, replace, etc.

#### Delete Operations

- Right-click note → Delete Note
- Right-click notebook → Delete Notebook (will show note count)

## Data Storage

### Storage Architecture

This extension uses a dual-layer storage architecture, balancing configuration sync and file management:

| Storage Type | Content | Location | Cross-device Sync |
|-------------|---------|----------|------------------|
| `globalState` | Notebook config, metadata | VS Code settings | Yes |
| `globalStorageUri` | Markdown files | Extension data directory | No |

### Storage Location

Note files are automatically stored in VS Code managed directories:

- **Windows**: `%APPDATA%/Code/User/globalStorage/markdown-notes.markdown-notes/`
- **macOS**: `~/Library/Application Support/Code/User/globalStorage/markdown-notes.markdown-notes/`
- **Linux**: `~/.config/Code/User/globalStorage/markdown-notes.markdown-notes/`

> No manual configuration needed, VS Code manages these directories automatically

### Directory Structure

```
{globalStorageUri}/
└── notebooks/
    ├── {notebook-id-1}/
    │   ├── Meeting Notes.md
    │   └── Project Plan.md
    └── {notebook-id-2}/
        └── Reading Notes.md
```

## Design Philosophy

### File-first Approach

- Each note = one `.md` file
- No custom editor, fully leverage VS Code's native capabilities
- Ensures data portability and readability

### Zero Configuration

- Use VS Code's officially recommended storage solutions
- Automatically handle cross-platform path differences
- Automatically clean up when extension is uninstalled

### Future Enhancements

- ~~Git sync support~~ ✅ Implemented
- Tags and categories
- Full-text search
- Statistics and analytics
- Conflict resolution UI for Git merges

## Development

### Local Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Press F5 in VS Code to start debugging
```

### Package and Publish

```bash
npm install -g @vscode/vsce
vsce package
```

## Command List

| Command | Description |
|---------|-------------|
| `markdownNotes.createNotebook` | Create Notebook |
| `markdownNotes.createNote` | Create Note |
| `markdownNotes.createFolder` | Create Folder |
| `markdownNotes.deleteNote` | Delete Note |
| `markdownNotes.deleteFolder` | Delete Folder |
| `markdownNotes.deleteNotebook` | Delete Notebook |
| `markdownNotes.refreshTree` | Refresh Tree View |
| `markdownNotes.expandAll` | Expand All Notebooks |
| `markdownNotes.configureGit` | Configure Git Repository (metadata only) |
| `markdownNotes.gitInit` | Initialize Git Repository (create local .git) |
| `markdownNotes.gitClone` | Clone Git Repository (download from remote) |
| `markdownNotes.gitCommit` | Commit Changes |
| `markdownNotes.gitPull` | Pull from Remote |
| `markdownNotes.gitPush` | Push to Remote |
| `markdownNotes.gitSync` | Sync with Remote |
| `markdownNotes.gitStatus` | View Git Status |
| `markdownNotes.showOutput` | Show Output Logs |
| `markdownNotes.revealInExplorer` | Reveal Notebook in File Explorer |

## Contributing

Issues and Pull Requests are welcome!

## Configuration

### Git Decorations

The extension displays Git status decorations in the TreeView (M for Modified, U for Untracked, A for Added, etc.). These decorations are provided by VS Code's native Git extension.

**Ensure these settings are enabled** (they are enabled by default):

```json
{
  "explorer.decorations.badges": true,
  "git.decorations.enabled": true
}
```

If you don't see Git decorations:

1. Check that these settings are enabled in your VS Code user settings
2. Verify that the notebook has been initialized or cloned (Git must be configured)
3. Try reloading the VS Code window

## Technical Details

### Git Integration

This extension uses **isomorphic-git** for Git operations:

- **Pure JavaScript implementation** - No dependency on system Git installation
- **Cross-platform compatibility** - Works seamlessly on Windows, macOS, and Linux
- **HTTP(S) support** - Communicates with remote repositories via HTTPS
- **Secure credential storage** - Uses VS Code's SecretStorage API to store tokens/passwords
- **Private repository support** - Supports Personal Access Tokens and username/password authentication
- **Detailed logging** - All Git operations are logged to Output Channel for debugging

#### Logging and Debugging

All Git operations are logged to the **"Markdown Notes - Git"** Output Channel:

**Features**:

- **Timestamps**: Every log entry includes time
- **Log Levels**: Visual indicators ✓ (info), ⚠️ (warn), ❌ (error)
- **Detailed Operation Logs**:
  - Repository initialization steps (init, config, remote)
  - Clone progress with percentages and phases
  - Commit details (changed files, commit SHA)
  - Pull/Push operation status
  - Credential retrieval and storage
  - Status checks with branch and change counts
- **Auto-Show on Error**: Opens automatically when errors occur
- **Manual Access**: Use "Git: Show Output" command anytime

**Example Log Output**:

```
[10:30:15] ✓ Initializing git repository at: /path/to/notebook
[10:30:15] ✓ Branch: main, Remote: https://github.com/user/repo.git
[10:30:15] ✓ Running: git init
[10:30:16] ✓ Repository initialized successfully
[10:30:20] ✓ Clone progress: Receiving objects - 45% (450/1000)
```

### Supported Git Platforms

- GitHub (Personal Access Token recommended)
- GitLab
- Bitbucket
- Any Git server with HTTPS access

### Security

- Git credentials are stored using VS Code's built-in SecretStorage API
- Passwords and tokens are never stored in plain text
- Each notebook's credentials are stored separately
- Credentials are automatically encrypted by VS Code

## License

MIT License

## Acknowledgments

Thanks to the VS Code team for providing excellent extension APIs.
