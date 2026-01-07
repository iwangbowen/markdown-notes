# Changelog

All notable changes to the "Markdown Notes Manager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.5] - 2026-01-08

### Added

- **Rename Operations** - Support for renaming notebooks, folders, and notes
  - **Rename Notebook** - Update notebook name in configuration (syncs across devices)
    - Only modifies `globalState`, file system remains unchanged
    - Right-click notebook → "Rename Notebook"
  - **Rename Folder** - Physically rename folders in file system
    - Uses `vscode.workspace.fs.rename()` API
    - Git automatically tracks folder moves
    - Validates folder name (disallows special characters: `/\<>:"|?*`)
    - Right-click folder → "Rename Folder"
  - **Rename Note** - Physically rename markdown files
    - Uses `vscode.workspace.fs.rename()` API
    - Git automatically tracks file renames
    - Auto-adds `.md` extension if missing
    - Automatically switches to new file if currently open
    - Validates file name (disallows special characters)
    - Right-click note → "Rename Note"

- **Auto Refresh Git Status** - Periodic background Git status updates
  - Configurable interval: `markdownNotes.git.autoRefreshInterval` (10-300 seconds, default 30)
  - Set to 0 or negative to disable auto-refresh
  - Runs silently in background without notifications
  - Command: `markdownNotes.toggleAutoRefresh` to manually enable/disable
  - Configuration changes take effect immediately

### Fixed

- **Git Status Accuracy** - Improved Git status detection and display
  - Verify actual `.git` directory existence vs. config flag
  - Show detailed missing configuration info in tooltips (credentials, local repo)
  - Fixed unpushed commits counting logic (compare local vs remote branches)
  - Support deleted files in Git commits (use `git.remove()` instead of `git.add()`)

## [0.2.2] - 2026-01-07

### Fixed

- **Git Add/Remove Logic** - Correctly handle file additions and deletions in Git staging
  - Use `git.statusMatrix` to differentiate added, modified, and deleted files
  - Call `git.add` for added/modified files and `git.remove` for deleted files
  - Prevents errors when staging deleted files

## [0.2.1] - 2026-01-06

### Added

- **Read-only Historical Files** - Files opened from commit history are now read-only
  - Uses custom URI scheme (`markdown-notes-history:`) for historical content
  - Prevents accidental modifications to historical snapshots
  - Clearly labeled as "(read-only)" in status message

### Fixed

- **File History Implementation** - Fixed "View File History" command
  - Added missing `notebookId` parameter to `NoteTreeItem` constructor
  - Added missing `path` module import
  - Now correctly displays commit history and allows viewing file content at any commit

## [0.2.0] - 2026-01-06

### Added

- **Git Status Decorations** - TreeView now displays native VS Code Git status decorations
  - Modified files show "M" badge
  - Untracked files show "U" badge
  - Added files show "A" badge
  - Deleted files show "D" badge
  - Requires `explorer.decorations.badges` and `git.decorations.enabled` settings (enabled by default)

- **File Git Operations** - Right-click context menu for notes
  - **"View File History"** - Browse commit history and view file content at any commit
    - Uses isomorphic-git to read commit logs
    - Shows commit message, author, and timestamp in QuickPick
    - Opens historical file content in side-by-side editor
    - Works independently of workspace Git repositories
  - **"Compare with HEAD"** - Compare file with latest commit
    - Uses VS Code's built-in diff viewer

- **Custom Folder Icons** - Consistent folder appearance
  - Custom SVG folder icon prevents Icon Theme interference
  - Folders always display the same icon regardless of name

### Fixed

- **URI Scheme Issue** - Fixed TreeView items not showing Git decorations
  - Converted from `vscode-userdata:` to `file:` scheme for proper Git extension recognition
  - See [GIT_DECORATION_FIX.md](GIT_DECORATION_FIX.md) for technical details

- **Icon Display** - Fixed literal "$(warning)" text appearing instead of icon
  - Replaced $() syntax with ThemeIcon for proper rendering

### Changed

- Removed custom FileDecorationProvider (no longer needed with native Git decorations)
- Removed Timeline API implementation (was Proposed API, cannot use in published extensions)

## [0.1.4] - 2026-01-06

### Changed

- **Build System Optimization** - Published with esbuild bundling improvements
- Package now properly optimized (11 files, 223 KB vs previous 549 files, 1.35 MB)

## [0.1.3] - 2026-01-06

### Fixed

- **Critical: Module Not Found** - Fixed "Cannot find module 'isomorphic-git'" error in packaged extension
  - Included production dependencies (`isomorphic-git`, `http-client`) in .vsix package
  - Extension now works correctly after installation from .vsix

## [0.1.2] - 2026-01-06

### Fixed

- **Activity Bar Icon** - Fixed sidebar icon not displaying in packaged extension
  - Changed to monochrome SVG using `currentColor` for theme compatibility
  - Icon now properly adapts to VS Code light/dark themes
  - Reduced SVG file size from 1.2 KB to 0.74 KB

## [0.1.1] - 2026-01-06

### Added

- **Support This Project Section** - Added donation support with WeChat Pay QR code in README

## [0.1.0] - 2026-01-06

### Added

#### Core Features

- **Multi-notebook Management** - Create and manage multiple independent notebooks
- **Tree View** - Display all notebooks, folders, and notes in a hierarchical tree structure
- **Markdown Editor** - Use VS Code's native Markdown editor with full preview support
- **Folder Support** - Organize notes into folders within notebooks

#### Git Integration

- **Git Configuration** - Configure Git repositories for each notebook independently
- **Git Initialize** - Create new local Git repositories for notebooks
- **Git Clone** - Download notebooks from remote Git repositories
- **Git Commit** - Commit changes to local repository with custom messages
- **Git Pull** - Pull latest changes from remote repository
- **Git Push** - Push local commits to remote repository
- **Git Sync** - One-click sync (pull + push) with remote
- **Git Status** - View uncommitted changes, unpushed commits, and last sync time
- **Secure Credentials** - Store Git credentials securely using VS Code's SecretStorage API
- **Private Repository Support** - Support for Personal Access Tokens and username/password authentication
- **Detailed Logging** - All Git operations logged to Output Channel for debugging

#### Storage & Sync

- **Automatic Storage** - Use `globalStorageUri` for automatic file management
- **Configuration Sync** - Notebook configurations sync across devices via `globalState`
- **Cross-device Detection** - Auto-detect notebooks that need initialization on new devices
- **Zero Configuration** - Works out of the box with no manual setup required

#### User Interface

- **Activity Bar Icon** - Quick access from VS Code activity bar
- **Context Menus** - Right-click menus for all operations
- **Visual Git Status** - Color-coded indicators for Git configuration status
  - Gray: No Git config
  - Yellow + warning: Configured but not initialized
  - Green + branch: Initialized and ready
- **Output Logs** - Dedicated Output Channel with timestamps and log levels
- **Reveal in Explorer** - Open notebook folder in system file explorer

#### Commands

- Create Notebook
- Create Note
- Create Folder
- Delete Note
- Delete Folder
- Delete Notebook
- Refresh Tree View
- Expand All Notebooks
- Configure Git Repository
- Initialize Git Repository
- Clone Git Repository
- Commit Changes
- Pull from Remote
- Push to Remote
- Sync with Remote
- View Git Status
- Show Output Logs
- Reveal in File Explorer

### Technical Details

- Pure JavaScript Git implementation using `isomorphic-git` (no system Git required)
- Cross-platform compatibility (Windows, macOS, Linux)
- Support for GitHub, GitLab, Bitbucket, and any Git server with HTTPS
- Encrypted credential storage
- Comprehensive error handling and user feedback

### Known Limitations

- HTTPS only (SSH not supported yet)
- Git conflict resolution requires manual intervention
- No built-in merge conflict UI
