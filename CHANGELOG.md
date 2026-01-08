# Changelog

All notable changes to the "Markdown Notes Manager" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.3] - 2026-01-08

### Fixed

- **Compare with HEAD** - Now uses custom Git implementation instead of VS Code Git extension (notebooks are hidden from Source Control)
- **Reset to HEAD Dialog** - Removed duplicate Cancel button

### Changed

- **Git Decoration Refresh** - Optimized refresh interval from 5s to 60s (91.7% CPU reduction), unified refresh logic in TreeProvider

## [0.3.2] - 2026-01-07

### Added

- **Custom Git Decorations** - TreeView files now show Git status badges (M/A/D/R/U/I) independently from Source Control
- **Auto Source Control Hiding** - Notebooks automatically excluded from Source Control view to reduce clutter

## [0.3.0] - 2026-01-07

### Added

- **Tag System** - Organize notes with YAML front matter tags
  - Manual tag management via front matter editing
  - Tag-based search with OR logic
  - Search results display tags
- **Tag Search** - Filter notes by tags, supports tag-only searches

## [0.2.7] - 2026-01-07

### Changed

- **Command Palette Cleanup** - Reduced visible commands to 5 core ones, moved 15 context-specific commands to TreeView menus

## [0.2.6] - 2026-01-07

### Added

- **Note Templates** - 6 built-in templates (Blank, Daily Note, Travel Journal, Meeting Notes, Reading Notes, Project Plan)
  - Template variables: `{{date}}`, `{{time}}`, `{{datetime}}`, `{{title}}`
  - Custom templates with cross-device sync
  - Read-only preview system
- **Search Functionality** - Global and scoped search with QuickPick results and jump-to-line support

### Changed

- **Time Display** - All timestamps now use local timezone (`YYYY-MM-DD HH:MM:SS`)
- **Enhanced Tooltips** - Folders and notes show detailed metadata

## [0.2.5] - 2026-01-07

### Added

- **Rename Operations** - Rename notebooks, folders, and notes with validation
- **Auto Git Status Refresh** - Configurable background refresh (10-300 seconds, default 30)

### Fixed

- **Git Status Accuracy** - Improved detection and display of uncommitted/unpushed changes

## [0.2.2] - 2026-01-07

### Fixed

- **Git Staging Logic** - Correctly handle deleted files with `git.remove()`

## [0.2.1] - 2026-01-06

### Added

- **Read-only History** - Historical files from commits open as read-only

### Fixed

- **File History** - Fixed "View File History" command implementation

## [0.2.0] - 2026-01-06

### Added

- **Git Decorations** - TreeView displays VS Code native Git status badges
- **File Git Operations** - View history, compare with HEAD, reset to HEAD
- **Custom Folder Icons** - Consistent appearance across themes

### Fixed

- **URI Scheme** - Fixed decorations by using `file://` instead of `vscode-userdata://`

## [0.1.4] - 2026-01-06

### Changed

- **Build Optimization** - esbuild bundling (11 files, 223 KB vs 549 files, 1.35 MB)

## [0.1.3] - 2026-01-06

### Fixed

- **Critical Module Error** - Included production dependencies in .vsix package

## [0.1.2] - 2026-01-06

### Fixed

- **Activity Bar Icon** - Fixed icon display with theme-compatible monochrome SVG

## [0.1.1] - 2026-01-06

### Added

- **Donation Support** - Added WeChat Pay QR code in README

## [0.1.0] - 2026-01-06

### Added

- **Multi-notebook Management** - Create and manage multiple notebooks
- **Tree View** - Hierarchical display of notebooks, folders, and notes
- **Markdown Editor** - Native VS Code editor with preview
- **Folder Support** - Organize notes into folders
- **Git Integration** - Configure, init, clone, commit, pull, push, sync
- **Secure Credentials** - SecretStorage for Git authentication
- **Cross-device Sync** - globalState configuration sync
- **Activity Bar Icon** - Quick access sidebar
- **Context Menus** - Right-click operations
- **Output Logs** - Dedicated channel with timestamps
- **Commands** - 18 core commands for notebook/note management

### Technical

- Pure JS Git via isomorphic-git (no system Git required)
- Cross-platform (Windows, macOS, Linux)
- HTTPS Git support (GitHub, GitLab, Bitbucket)
