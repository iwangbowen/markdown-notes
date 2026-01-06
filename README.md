# Markdown Notes

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

## Quick Start

### Installation

1. Search for "Markdown Notes" in the VS Code Extensions Marketplace
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

1. **Configure Git Repository**:
   - Right-click on a notebook
   - Select "Configure Git Repository"
   - Enter repository URL (HTTPS)
   - Set branch name (default: main)
   - Enter author name and email
   - Choose authentication method:
     - Personal Access Token (recommended)
     - Username + Password
   - Choose initialization method:
     - Clone from remote
     - Initialize local repository

2. **Commit Changes**:
   - Right-click on a notebook
   - Select "Commit Changes"
   - Enter commit message
   - Changes are committed locally

3. **Pull from Remote**:
   - Right-click on a notebook
   - Select "Pull from Remote"
   - Latest changes are pulled from remote repository

4. **Push to Remote**:
   - Right-click on a notebook
   - Select "Push to Remote"
   - Local commits are pushed to remote repository

5. **Sync (Pull + Push)**:
   - Right-click on a notebook
   - Select "Sync with Remote"
   - Automatically pulls and pushes changes

6. **View Git Status**:
   - Right-click on a notebook
   - Select "View Git Status"
   - Shows uncommitted changes, unpushed commits, and last sync time

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
| `markdownNotes.configureGit` | Configure Git Repository |
| `markdownNotes.gitCommit` | Commit Changes |
| `markdownNotes.gitPull` | Pull from Remote |
| `markdownNotes.gitPush` | Push to Remote |
| `markdownNotes.gitSync` | Sync with Remote |
| `markdownNotes.gitStatus` | View Git Status |

## Contributing

Issues and Pull Requests are welcome!

## Technical Details

### Git Integration

This extension uses **isomorphic-git** for Git operations:

- **Pure JavaScript implementation** - No dependency on system Git installation
- **Cross-platform compatibility** - Works seamlessly on Windows, macOS, and Linux
- **HTTP(S) support** - Communicates with remote repositories via HTTPS
- **Secure credential storage** - Uses VS Code's SecretStorage API to store tokens/passwords
- **Private repository support** - Supports Personal Access Tokens and username/password authentication

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
