# Markdown Notes

> A full-featured VS Code notes management extension with multi-notebook support, tree view, and native Markdown editor

## Features

- **Multi-notebook Management** - Create multiple notebooks to organize notes independently
- **Tree View** - Display all notebooks and notes in a tree structure in the sidebar
- **Native Editor** - Use VS Code's native Markdown editor with full preview and search support
- **Automatic Storage** - Use `globalStorageUri` for automatic storage management, no manual configuration needed
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

- Right-click on a notebook
- Select "Create Note"
- Enter note name
- Markdown editor opens automatically

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

- Git sync support (each notebook associates with independent repository)
- Tags and categories
- Full-text search
- Statistics and analytics

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
| `markdownNotes.deleteNote` | Delete Note |
| `markdownNotes.deleteNotebook` | Delete Notebook |
| `markdownNotes.refreshTree` | Refresh Tree View |

## Contributing

Issues and Pull Requests are welcome!

## License

MIT License

## Acknowledgments

Thanks to the VS Code team for providing excellent extension APIs.
