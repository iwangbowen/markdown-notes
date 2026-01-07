# TODO for v0.3.0 - Virtual File System

## Objective

Implement FileSystemProvider to hide physical file paths from users in breadcrumb and editor tabs.

## Current Issue

When opening notes, breadcrumb shows the full physical path:

```
home > wbw > .vscode-server-insiders > data > User > globalStorage > wangbowen.markdown-notes > notebooks > ... > note.md
```

This exposes internal implementation details to users.

## Solution: Virtual File System

### Implementation Plan

#### 1. Create NotesFileSystemProvider

**File**: `src/notesFileSystemProvider.ts`

Implement `vscode.FileSystemProvider` interface:

- `stat(uri)`: Return file/directory metadata
- `readDirectory(uri)`: List directory contents
- `readFile(uri)`: Read file content from real path
- `writeFile(uri, content)`: Write content to real path
- `delete(uri)`: Delete file/directory
- `rename(oldUri, newUri)`: Rename/move file
- `createDirectory(uri)`: Create directory
- `watch(uri)`: File change watcher

#### 2. URI Mapping System

**Virtual URI Format**: `notes://{notebook-id}/{folder-path}/{file-name}.md`

**Examples**:

- `notes://main/Common%20Notes/Tokens.md`
- `notes://work/2024/Q1/report.md`

**Mapping Logic**:

```typescript
interface URIMapper {
  toVirtual(notebookId: string, relativePath: string): vscode.Uri;
  toReal(virtualUri: vscode.Uri): vscode.Uri;
  parseVirtual(uri: vscode.Uri): { notebookId: string; relativePath: string };
}
```

#### 3. Update All File Operations

**Files to Modify**:

- `src/extension.ts`: Update all `openTextDocument()` calls
- `src/notebookManager.ts`:
  - `openNote()` → use virtual URI
  - `createNote()` → return virtual URI
  - `renameNote()` → handle virtual URI
- `src/noteTreeProvider.ts`:
  - `NoteTreeItem.resourceUri` → virtual URI
  - `openNote` command → use virtual URI
- `src/searchEngine.ts`:
  - Results return virtual URI
  - Search still operates on real files
- `src/gitManager.ts`:
  - Convert virtual URI to real path for Git operations
  - Git commands need real paths

#### 4. File Watcher Integration

Update file watcher to monitor real paths but emit events with virtual URIs:

```typescript
const watcher = vscode.workspace.createFileSystemWatcher(realPattern);
watcher.onDidChange((realUri) => {
  const virtualUri = mapper.toVirtual(notebookId, relativePath);
  notesFS.fireChangeEvent(virtualUri);
});
```

#### 5. TreeView Update

Ensure TreeView uses virtual URIs for `resourceUri`:

```typescript
class NoteTreeItem {
  constructor(notebook, note) {
    this.resourceUri = vscode.Uri.parse(
      `notes://${notebook.id}/${note.path}`
    );
  }
}
```

### Expected Result

**Before** (v0.2.7):

```
Breadcrumb: home > wbw > ... > globalStorage > ... > notebooks > mk2dwrt1lr1uj > Common Notes > Tokens.md
Tab: Tokens.md
```

**After** (v0.3.0):

```
Breadcrumb: notes > mk2dwrt1lr1uj > Common Notes > Tokens.md
Tab: Tokens.md
```

Or even better with custom naming:

```
Breadcrumb: Notes > main > Common Notes > Tokens.md
Tab: Tokens.md
```

### Testing Checklist

- [ ] Open note from TreeView → shows virtual URI in breadcrumb
- [ ] Create note → saves to real path, shows virtual URI
- [ ] Edit note → writes to real path
- [ ] Rename note → updates both real and virtual
- [ ] Delete note → deletes real file
- [ ] Search results → returns virtual URIs, opens correctly
- [ ] Git operations → work with real paths
- [ ] File watcher → detects changes in real files
- [ ] Cross-device sync → works with real globalStorageUri
- [ ] TreeView → shows notes with virtual URIs

### Implementation Steps

1. **Phase 1: Create FileSystemProvider** (1 hour)
   - Implement basic CRUD operations
   - Test with simple file operations

2. **Phase 2: URI Mapping** (30 min)
   - Create URIMapper utility
   - Test bidirectional conversion

3. **Phase 3: Update File Operations** (1.5 hours)
   - Update extension.ts
   - Update notebookManager.ts
   - Update noteTreeProvider.ts
   - Update searchEngine.ts

4. **Phase 4: Git Integration** (1 hour)
   - Ensure Git uses real paths
   - Test commit, push, pull with virtual URIs in editor

5. **Phase 5: Testing** (30 min)
   - Comprehensive testing
   - Fix edge cases

**Total Estimated Time**: 3.5-4 hours

### Breaking Changes

⚠️ **None** - This is an internal change. External API (commands, TreeView) remains the same.

### Additional Benefits

1. **Better UX**: Users see clean, logical paths
2. **Abstraction**: Can change storage location without affecting users
3. **Future-proof**: Easier to add features like notebook renaming in UI
4. **Professional**: Looks like a standalone app, not a VS Code hack

### References

- [VS Code FileSystemProvider API](https://code.visualstudio.com/api/references/vscode-api#FileSystemProvider)
- [Example: MemFS](https://github.com/microsoft/vscode-extension-samples/tree/main/fsprovider-sample)
- Template Preview uses similar approach with `markdown-notes-template:` scheme
