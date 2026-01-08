import * as vscode from 'vscode';
import * as path from 'path';
import { StorageManager } from './utils/storage';
import { Logger } from './utils/logger';
import { formatDateTime } from './utils/dateFormatter';
import { NotebookManager } from './notebookManager';
import { NoteTreeProvider, NotebookTreeItem, NoteTreeItem, FolderTreeItem } from './noteTreeProvider';
import { GitManager } from './gitManager';
import { GitStatusRefresher } from './gitStatusRefresher';
import { GitDecorationProvider } from './gitDecorationProvider';
import { SearchEngine, SearchResult } from './searchEngine';
import { TemplateManager } from './templateManager';
import { generateFrontMatter } from './utils/yamlFrontMatter';
import { TemplatePreviewProvider } from './templatePreviewProvider';
import { GitConfig } from './types';

/**
 * Check for uninitialized notebooks (cross-device sync scenario)
 */
async function checkUninitializedNotebooks(
  notebookManager: NotebookManager,
  gitManager: GitManager,
  treeProvider: NoteTreeProvider,
  treeView: vscode.TreeView<any>
): Promise<void> {
  const logger = Logger.getInstance();
  logger.debug('Checking for uninitialized notebooks...', 'Core');

  const notebooks = await notebookManager.getNotebooks();
  const uninitializedNotebooks = [];

  for (const notebook of notebooks) {
    const hasConfig = !!notebook.gitConfig;
    const isInitialized = await gitManager.isInitialized(notebook.id);

    // Scenario 1: Has config but not initialized (cross-device sync)
    if (hasConfig && !isInitialized) {
      uninitializedNotebooks.push(notebook);
      logger.info(`Found uninitialized notebook: ${notebook.name} (synced from another device)`, 'Core');
    }

    // Scenario 2: Has config and initialized, but flag is wrong
    if (hasConfig && isInitialized && !notebook.gitConfig!.initialized) {
      logger.info(`Fixing initialized flag for notebook: ${notebook.name}`, 'Core');
      notebook.gitConfig!.initialized = true;
      await notebookManager.updateNotebook(notebook);
    }
  }

  // Prompt user to clone if there are uninitialized notebooks
  if (uninitializedNotebooks.length > 0) {
    const notebookNames = uninitializedNotebooks.map(n => n.name).join(', ');
    const message = uninitializedNotebooks.length === 1
      ? `Notebook "${notebookNames}" is synced from another device. Clone to download files?`
      : `${uninitializedNotebooks.length} notebooks (${notebookNames}) are synced from other devices. Clone them?`;

    const action = await vscode.window.showInformationMessage(
      message,
      'Clone Now',
      'Later'
    );

    if (action === 'Clone Now') {
      // Clone all uninitialized notebooks
      for (const notebook of uninitializedNotebooks) {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Cloning notebook: ${notebook.name}...`,
            cancellable: false
          }, async () => {
            await gitManager.cloneRepository(notebook.id, notebook.gitConfig!);
            notebook.gitConfig!.initialized = true;
            await notebookManager.updateNotebook(notebook);
          });

          logger.info(`Successfully cloned notebook: ${notebook.name}`, 'Core');
        } catch (error) {
          logger.error(`Failed to clone notebook ${notebook.name}: ${error}`, 'Core');
          vscode.window.showErrorMessage(`Failed to clone "${notebook.name}": ${error}`);
        }
      }

      // Refresh tree view
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Cloned ${uninitializedNotebooks.length} notebook(s) successfully`);
    }
  }
}

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext) {
  // Initialize logger
  const logger = Logger.getInstance();
  logger.info('Extension activated', 'Core');

  // Initialize storage manager
  const storageManager = new StorageManager(context);
  await storageManager.initializeStorage();

  // Initialize notebook manager (needed to get notebook list)
  const notebookManager = new NotebookManager(storageManager);

  // Exclude notebook repositories from Source Control view
  // This prevents notebook Git repos from appearing in the Source Control panel
  const excludeNotebookRepos = async () => {
    const notebooks = await notebookManager.getNotebooks();
    const config = vscode.workspace.getConfiguration('git');
    const currentIgnored = config.get<string[]>('ignoredRepositories', []);
    const newPaths: string[] = [];

    for (const notebook of notebooks) {
      const notebookPath = vscode.Uri.joinPath(storageManager.getStorageUri(), 'notebooks', notebook.id).fsPath;
      if (!currentIgnored.includes(notebookPath)) {
        newPaths.push(notebookPath);
      }
    }

    if (newPaths.length > 0) {
      const updatedIgnored = [...currentIgnored, ...newPaths];
      await config.update('ignoredRepositories', updatedIgnored, vscode.ConfigurationTarget.Global);
      logger.info(`Added ${newPaths.length} notebook(s) to git.ignoredRepositories`, 'Core');
    }
  };

  // Run on activation
  await excludeNotebookRepos();

  // Initialize git manager
  const gitManager = new GitManager(context, storageManager.getStorageUri());

  // Initialize template manager
  const templateManager = new TemplateManager(storageManager, context.extensionPath);

  // Register template preview provider
  const templatePreviewProvider = new TemplatePreviewProvider(templateManager);
  context.subscriptions.push(
    vscode.workspace.registerTextDocumentContentProvider('markdown-notes-template', templatePreviewProvider)
  );

  // Initialize TreeView
  const treeProvider = new NoteTreeProvider(context, notebookManager, gitManager);
  const treeView = vscode.window.createTreeView('markdownNotesView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

  // Initialize Git decoration provider
  // This provides custom Git file decorations (M/A/D badges) even when repos are hidden from Source Control
  const gitDecorationProvider = new GitDecorationProvider(notebookManager, storageManager.getStorageUri());
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(gitDecorationProvider)
  );
  logger.info('Git decoration provider registered', 'Core');

  // Link tree provider and decoration provider
  // This allows tree refresh to automatically refresh decorations
  treeProvider.setGitDecorationProvider(gitDecorationProvider);

  // Watch for file system changes in notebooks directory
  const notebooksUri = vscode.Uri.joinPath(storageManager.getStorageUri(), 'notebooks');
  const fileWatcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(notebooksUri, '**/*.md')
  );

  // Refresh tree when files are created, changed, or deleted
  fileWatcher.onDidCreate(() => {
    logger.debug('File created, refreshing tree view', 'Core');
    treeProvider.refresh();
  });

  fileWatcher.onDidChange(() => {
    logger.debug('File changed, refreshing tree view', 'Core');
    treeProvider.refresh();
  });

  fileWatcher.onDidDelete(() => {
    logger.debug('File deleted, refreshing tree view', 'Core');
    treeProvider.refresh();
  });

  context.subscriptions.push(fileWatcher);

  // Auto-detect uninitialized notebooks (for cross-device sync)
  await checkUninitializedNotebooks(notebookManager, gitManager, treeProvider, treeView);

  // Initialize Git status auto refresher
  const gitRefresher = new GitStatusRefresher(context, treeProvider);
  gitRefresher.start();

  // Initialize search engine
  const searchEngine = new SearchEngine(notebookManager);

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('markdownNotes.git')) {
        logger.info('Git configuration changed, restarting auto refresh', 'Core');
        gitRefresher.restart();
      }
    })
  );

  // Register command: search notes
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.searchNotes', async (item?: NotebookTreeItem | FolderTreeItem) => {
      const searchQuery = await vscode.window.showInputBox({
        prompt: 'Search in notes (leave empty to search by tags only)',
        placeHolder: 'Enter search keyword or leave empty',
      });

      if (searchQuery === undefined) {
        return;
      }

      // Ask for tags filter (optional)
      const tagsInput = await vscode.window.showInputBox({
        prompt: 'Filter by tags (optional, comma-separated, OR logic)',
        placeHolder: 'e.g., work, meeting',
      });

      const tags = tagsInput
        ? tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag)
        : undefined;

      // Skip if both query and tags are empty
      if (!searchQuery && (!tags || tags.length === 0)) {
        vscode.window.showWarningMessage('Please enter a search keyword or select tags');
        return;
      }

      // Determine search scope
      let notebookId: string | undefined;
      let folderPath: string | undefined;

      if (item instanceof NotebookTreeItem) {
        notebookId = item.notebook.id;
      } else if (item instanceof FolderTreeItem) {
        notebookId = item.folder.notebookId;
        folderPath = item.folder.path;
      }

      // Perform search
      try {
        const results = await searchEngine.search({
          query: searchQuery || '',
          caseSensitive: false,
          useRegex: false,
          tags,
          scope: notebookId ? { notebookId, folderPath } : undefined,
        });

        if (results.length === 0) {
          const searchDesc = searchQuery ? `"${searchQuery}"` : 'specified tags';
          vscode.window.showInformationMessage(`No results found for ${searchDesc}`);
          return;
        }

        // Flatten matches for QuickPick display
        interface QuickPickItem extends vscode.QuickPickItem {
          noteUri: vscode.Uri;
          lineNumber: number;
          matchStart: number;
        }

        const items: QuickPickItem[] = [];
        for (const result of results) {
          // Add tags info to description if available
          const tagsInfo = result.tags && result.tags.length > 0
            ? ` [${result.tags.join(', ')}]`
            : '';

          for (const match of result.matches) {
            items.push({
              label: `$(file-text) ${result.noteName}`,
              description: `Line ${match.lineNumber} · ${result.notebookName}${tagsInfo}`,
              detail: match.lineText.trim(),
              noteUri: result.noteUri,
              lineNumber: match.lineNumber,
              matchStart: match.matchStart,
            });
          }
        }

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Found ${items.length} match(es) in ${results.length} note(s) for "${searchQuery}"`,
          matchOnDescription: true,
          matchOnDetail: true,
        });

        if (selected) {
          // Open note and navigate to match
          const document = await vscode.workspace.openTextDocument(selected.noteUri);
          const editor = await vscode.window.showTextDocument(document);

          // Navigate to line and reveal
          const line = selected.lineNumber - 1; // Convert to 0-based
          const position = new vscode.Position(line, selected.matchStart);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
      } catch (error) {
        logger.error(`Search failed: ${error}`, 'Search');
        vscode.window.showErrorMessage(`Search failed: ${error}`);
      }
    })
  );

  // Register command: search by tags
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.searchByTags', async (item?: NotebookTreeItem | FolderTreeItem) => {
      // Get all unique tags from notes
      let notebookId: string | undefined;
      let folderPath: string | undefined;

      if (item instanceof NotebookTreeItem) {
        notebookId = item.notebook.id;
      } else if (item instanceof FolderTreeItem) {
        notebookId = item.folder.notebookId;
        folderPath = item.folder.path;
      }

      // Collect all tags from all notes
      const notebooks = notebookId
        ? [await notebookManager.getNotebooks().then(nbs => nbs.find(n => n.id === notebookId)!)]
        : await notebookManager.getNotebooks();

      const allTags = new Set<string>();
      for (const notebook of notebooks.filter(Boolean)) {
        const getAllNotesRecursively = async (nbId: string, path: string): Promise<void> => {
          const notes = await notebookManager.getNotes(nbId, path);
          for (const note of notes) {
            if (note.tags) {
              note.tags.forEach(tag => allTags.add(tag));
            }
          }

          const folders = await notebookManager.getFolders(nbId, path);
          for (const folder of folders) {
            await getAllNotesRecursively(nbId, folder.path);
          }
        };

        await getAllNotesRecursively(notebook.id, folderPath || '');
      }

      if (allTags.size === 0) {
        vscode.window.showInformationMessage('No tags found in notes');
        return;
      }

      // Show tags in QuickPick
      const tagItems = Array.from(allTags).sort((a, b) => a.localeCompare(b)).map(tag => ({
        label: `$(tag) ${tag}`,
        tag
      }));

      const selectedTags = await vscode.window.showQuickPick(tagItems, {
        placeHolder: 'Select tags to search (select multiple with Ctrl/Cmd)',
        canPickMany: true,
        title: 'Search by Tags'
      });

      if (!selectedTags || selectedTags.length === 0) {
        return;
      }

      const tags = selectedTags.map(item => item.tag);

      // Perform search with selected tags
      try {
        const results = await searchEngine.search({
          query: '',
          caseSensitive: false,
          useRegex: false,
          tags,
          scope: notebookId ? { notebookId, folderPath } : undefined,
        });

        if (results.length === 0) {
          vscode.window.showInformationMessage(`No notes found with tags: ${tags.join(', ')}`);
          return;
        }

        // Show results - group by note
        const noteGroups = new Map<string, SearchResult>();
        for (const result of results) {
          const key = result.noteUri.toString();
          if (!noteGroups.has(key)) {
            noteGroups.set(key, result);
          }
        }

        interface QuickPickItem extends vscode.QuickPickItem {
          noteUri: vscode.Uri;
        }

        const items: QuickPickItem[] = Array.from(noteGroups.values()).map(result => {
          const tagsInfo = result.tags && result.tags.length > 0
            ? ` [${result.tags.join(', ')}]`
            : '';

          return {
            label: `$(file) ${result.noteName}`,
            description: `${result.notebookName}${tagsInfo}`,
            detail: result.folderPath || '(Root)',
            noteUri: result.noteUri
          };
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `${items.length} note(s) found with tags: ${tags.join(', ')}`,
          title: 'Search Results'
        });

        if (selected) {
          // Open note
          const document = await vscode.workspace.openTextDocument(selected.noteUri);
          await vscode.window.showTextDocument(document);
        }
      } catch (error) {
        logger.error(`Tag search failed: ${error}`, 'Search');
        vscode.window.showErrorMessage(`Tag search failed: ${error}`);
      }
    })
  );

  // Register command: create notebook
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.createNotebook', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter notebook name',
        placeHolder: 'e.g., Work Notes',
        validateInput: async (value) => {
          return await notebookManager.validateNotebookName(value);
        }
      });

      if (name) {
        try {
          await notebookManager.createNotebook(name.trim());
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Notebook "${name}" created successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to create notebook: ${error}`);
        }
      }
    })
  );

  // Register command: create note
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.createNote', async (item?: NotebookTreeItem | FolderTreeItem) => {
      let notebookId: string | undefined;
      let folderPath: string = '';

      // If called from context menu
      if (item instanceof NotebookTreeItem) {
        notebookId = item.notebook.id;
        folderPath = '';
      } else if (item instanceof FolderTreeItem) {
        notebookId = item.folder.notebookId;
        folderPath = item.folder.path;
      } else {
        // Otherwise, let user select notebook
        const notebooks = await notebookManager.getNotebooks();

        if (notebooks.length === 0) {
          vscode.window.showWarningMessage('Please create a notebook first');
          return;
        }

        const selected = await vscode.window.showQuickPick(
          notebooks.map(n => ({ label: n.name, id: n.id })),
          { placeHolder: 'Select notebook' }
        );

        if (!selected) {
          return;
        }

        notebookId = selected.id;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter note name',
        placeHolder: 'e.g., Meeting Notes',
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Note name cannot be empty';
          }
          return null;
        }
      });

      if (!name || !notebookId) {
        return;
      }

      // Let user choose template
      const templates = await templateManager.getAllTemplates();
      const templateItems = templates.map(t => ({
        label: t.name,
        description: t.isBuiltIn ? '(Built-in)' : '(Custom)',
        detail: t.content.substring(0, 100) + (t.content.length > 100 ? '...' : ''),
        template: t
      }));

      const selectedTemplate = await vscode.window.showQuickPick(templateItems, {
        placeHolder: 'Select a template (press ESC to create blank note)',
        title: `Create note: ${name.trim()}`,
      });

      try {
        // Create note file with empty tags (user can edit front matter manually)
        const note = await notebookManager.createNote(notebookId, name.trim(), folderPath);

        // Apply template if selected
        if (selectedTemplate) {
          const templateContent = await templateManager.applyTemplate(
            selectedTemplate.template.id,
            { title: name.trim() }
          );

          // Generate front matter and prepend to template content
          const now = Date.now();
          const frontMatter = generateFrontMatter({
            title: name.trim(),
            created: formatDateTime(now),
            tags: []
          });

          const content = frontMatter + templateContent;

          // Write combined content to note
          const uri = vscode.Uri.parse(note.uri);
          await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
        }

        treeProvider.refresh();

        // Auto open the newly created note
        const uri = vscode.Uri.parse(note.uri);
        await notebookManager.openNote(uri);

        vscode.window.showInformationMessage(`Note "${name}" created successfully`);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to create note: ${error}`);
      }
    })
  );

  // Register command: create folder
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.createFolder', async (item?: NotebookTreeItem | FolderTreeItem) => {
      let notebookId: string | undefined;
      let parentPath: string = '';

      // If called from context menu
      if (item instanceof NotebookTreeItem) {
        notebookId = item.notebook.id;
        parentPath = '';
      } else if (item instanceof FolderTreeItem) {
        notebookId = item.folder.notebookId;
        parentPath = item.folder.path;
      } else {
        // Otherwise, let user select notebook
        const notebooks = await notebookManager.getNotebooks();

        if (notebooks.length === 0) {
          vscode.window.showWarningMessage('Please create a notebook first');
          return;
        }

        const selected = await vscode.window.showQuickPick(
          notebooks.map(n => ({ label: n.name, id: n.id })),
          { placeHolder: 'Select notebook' }
        );

        if (!selected) {
          return;
        }

        notebookId = selected.id;
      }

      const name = await vscode.window.showInputBox({
        prompt: 'Enter folder name',
        placeHolder: 'e.g., Projects',
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Folder name cannot be empty';
          }
          return null;
        }
      });

      if (name && notebookId) {
        try {
          await notebookManager.createFolder(notebookId, name.trim(), parentPath);
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Folder "${name}" created successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to create folder: ${error}`);
        }
      }
    })
  );

  // Register command: rename note
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.renameNote', async (item: NoteTreeItem) => {
      const currentName = item.note.name;
      const newName = await vscode.window.showInputBox({
        prompt: 'Enter new note name (without .md extension)',
        value: currentName,
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Note name cannot be empty';
          }
          // Check for invalid characters
          if (/[/\\<>:"|?*]/.test(value)) {
            return 'Note name contains invalid characters';
          }
          return null;
        }
      });

      if (newName && newName !== currentName) {
        try {
          const newUri = await notebookManager.renameNote(item.noteUri, newName.trim());

          // Refresh tree to show new name
          treeProvider.refresh();

          // If the file is open, close old and open new
          const openDoc = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === item.noteUri.toString());
          if (openDoc) {
            await vscode.window.showTextDocument(newUri);
            await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          }

          vscode.window.showInformationMessage(`Note renamed to "${newName}"`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to rename note: ${error}`);
        }
      }
    })
  );

  // Register command: delete note
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.deleteNote', async (item: NoteTreeItem) => {
      const answer = await vscode.window.showWarningMessage(
        `Are you sure you want to delete note "${item.note.name}"?`,
        { modal: true },
        'Delete'
      );

      if (answer === 'Delete') {
        try {
          await notebookManager.deleteNote(item.noteUri);
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Note "${item.note.name}" deleted`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete note: ${error}`);
        }
      }
    })
  );

  // Register command: rename folder
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.renameFolder', async (item: FolderTreeItem) => {
      const newName = await vscode.window.showInputBox({
        prompt: 'Enter new folder name',
        value: item.folder.name,
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Folder name cannot be empty';
          }
          // Check for invalid characters
          if (/[/\\<>:"|?*]/.test(value)) {
            return 'Folder name contains invalid characters';
          }
          return null;
        }
      });

      if (newName && newName !== item.folder.name) {
        try {
          await notebookManager.renameFolder(item.folder.notebookId, item.folder.path, newName.trim());
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Folder renamed to "${newName}"`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to rename folder: ${error}`);
        }
      }
    })
  );

  // Register command: delete folder
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.deleteFolder', async (item: FolderTreeItem) => {
      const answer = await vscode.window.showWarningMessage(
        `Are you sure you want to delete folder "${item.folder.name}" and all its contents?`,
        { modal: true },
        'Delete'
      );

      if (answer === 'Delete') {
        try {
          await notebookManager.deleteFolder(item.folderUri);
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Folder "${item.folder.name}" deleted`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete folder: ${error}`);
        }
      }
    })
  );

  // Register command: rename notebook
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.renameNotebook', async (item: NotebookTreeItem) => {
      const newName = await vscode.window.showInputBox({
        prompt: 'Enter new notebook name',
        value: item.notebook.name,
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Notebook name cannot be empty';
          }
          return null;
        }
      });

      if (newName && newName !== item.notebook.name) {
        try {
          await notebookManager.renameNotebook(item.notebook.id, newName.trim());
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Notebook renamed to "${newName}"`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to rename notebook: ${error}`);
        }
      }
    })
  );

  // Register command: delete notebook
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.deleteNotebook', async (item: NotebookTreeItem) => {
      const notes = await notebookManager.getNotes(item.notebook.id);
      const noteCount = notes.length;

      const message = noteCount > 0
        ? `Are you sure you want to delete notebook "${item.notebook.name}" and its ${noteCount} note(s)?`
        : `Are you sure you want to delete notebook "${item.notebook.name}"?`;

      const answer = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        'Delete'
      );

      if (answer === 'Delete') {
        try {
          await notebookManager.deleteNotebook(item.notebook.id);
          treeProvider.refresh();
          vscode.window.showInformationMessage(`Notebook "${item.notebook.name}" deleted`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete notebook: ${error}`);
        }
      }
    })
  );

  // Register command: manage templates
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.manageTemplates', async () => {
      const templates = await templateManager.getAllTemplates();

      const items = templates.map(t => ({
        label: t.name,
        description: t.isBuiltIn ? '(Built-in)' : '(Custom)',
        detail: `Created: ${new Date(t.createdAt).toLocaleDateString()}`,
        template: t,
        buttons: t.isBuiltIn
          ? [] // Built-in templates have no action buttons
          : [
            { iconPath: new vscode.ThemeIcon('edit'), tooltip: 'Edit' },
            { iconPath: new vscode.ThemeIcon('trash'), tooltip: 'Delete' }
          ]
      }));

      const quickPick = vscode.window.createQuickPick();
      quickPick.items = items;
      quickPick.placeholder = 'Select a template to manage';
      quickPick.title = 'Template Manager';
      quickPick.buttons = [{ iconPath: new vscode.ThemeIcon('add'), tooltip: 'Create New Template' }];

      quickPick.onDidTriggerButton(async (button) => {
        if (button.tooltip === 'Create New Template') {
          quickPick.hide();
          await vscode.commands.executeCommand('markdownNotes.createTemplate');
        }
      });

      quickPick.onDidTriggerItemButton(async (e) => {
        const item = e.item as typeof items[0];
        if (e.button.tooltip === 'Edit') {
          quickPick.hide();
          await vscode.commands.executeCommand('markdownNotes.editTemplate', item.template.id);
        } else if (e.button.tooltip === 'Delete') {
          quickPick.hide();
          await vscode.commands.executeCommand('markdownNotes.deleteTemplate', item.template.id);
        }
      });

      quickPick.onDidAccept(async () => {
        const selected = quickPick.selectedItems[0] as typeof items[0];
        if (selected) {
          quickPick.hide();
          // Show template preview using read-only provider
          await templatePreviewProvider.openPreview(selected.template.id, selected.template.name);
        }
      });

      quickPick.show();
    })
  );

  // Register command: create template
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.createTemplate', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter template name',
        placeHolder: 'e.g., Weekly Report',
        validateInput: (value) => {
          if (!value.trim()) {
            return 'Template name cannot be empty';
          }
          return null;
        }
      });

      if (!name) {
        return;
      }

      // Open a new document for template content
      const doc = await vscode.workspace.openTextDocument({
        content: `# ${name.trim()}\n\nEnter your template content here...\n\nSupported variables:\n- {{date}} - Current date\n- {{time}} - Current time\n- {{datetime}} - Current date and time\n- {{title}} - Note title\n`,
        language: 'markdown',
      });

      const editor = await vscode.window.showTextDocument(doc);

      // Wait for user to finish editing
      const answer = await vscode.window.showInformationMessage(
        'Edit the template content, then click "Save Template"',
        'Save Template',
        'Cancel'
      );

      if (answer === 'Save Template') {
        const content = editor.document.getText();
        try {
          await templateManager.createTemplate({
            name: name.trim(),
            content,
            isBuiltIn: false,
          });
          vscode.window.showInformationMessage(`Template "${name}" created successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to create template: ${error}`);
        }
      }
    })
  );

  // Register command: edit template
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.editTemplate', async (templateId?: string) => {
      let id = templateId;

      if (!id) {
        const templates = await templateManager.getAllTemplates();
        const customTemplates = templates.filter(t => !t.isBuiltIn);

        if (customTemplates.length === 0) {
          vscode.window.showInformationMessage('No custom templates to edit. Built-in templates cannot be edited.');
          return;
        }

        const items = customTemplates.map(t => ({
          label: t.name,
          description: '(Custom)',
          id: t.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a custom template to edit',
        });

        if (!selected) {
          return;
        }

        id = selected.id;
      }

      const template = await templateManager.getTemplate(id);
      if (!template) {
        vscode.window.showErrorMessage('Template not found');
        return;
      }

      if (template.isBuiltIn) {
        vscode.window.showErrorMessage('Cannot edit built-in template. Create a custom template instead.');
        return;
      }

      // Open template content for editing
      const doc = await vscode.workspace.openTextDocument({
        content: template.content,
        language: 'markdown',
      });

      const editor = await vscode.window.showTextDocument(doc);

      // Wait for user to finish editing
      const answer = await vscode.window.showInformationMessage(
        `Edit template "${template.name}", then click "Save Changes"`,
        'Save Changes',
        'Cancel'
      );

      if (answer === 'Save Changes') {
        const newContent = editor.document.getText();
        try {
          await templateManager.updateTemplate(id, { content: newContent });
          vscode.window.showInformationMessage(`Template "${template.name}" updated successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to update template: ${error}`);
        }
      }
    })
  );

  // Register command: delete template
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.deleteTemplate', async (templateId?: string) => {
      let id = templateId;

      if (!id) {
        const templates = await templateManager.getAllTemplates();
        const customTemplates = templates.filter(t => !t.isBuiltIn);

        if (customTemplates.length === 0) {
          vscode.window.showInformationMessage('No custom templates to delete');
          return;
        }

        const items = customTemplates.map(t => ({
          label: t.name,
          id: t.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a template to delete',
        });

        if (!selected) {
          return;
        }

        id = selected.id;
      }

      const template = await templateManager.getTemplate(id);
      if (!template) {
        vscode.window.showErrorMessage('Template not found');
        return;
      }

      if (template.isBuiltIn) {
        vscode.window.showErrorMessage('Cannot delete built-in template');
        return;
      }

      const answer = await vscode.window.showWarningMessage(
        `Are you sure you want to delete template "${template.name}"?`,
        { modal: true },
        'Delete'
      );

      if (answer === 'Delete') {
        try {
          await templateManager.deleteTemplate(id);
          vscode.window.showInformationMessage(`Template "${template.name}" deleted successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to delete template: ${error}`);
        }
      }
    })
  );

  // Register command: refresh tree view
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.refreshTree', () => {
      treeProvider.refresh();
      vscode.window.showInformationMessage('Notes list refreshed');
    })
  );

  // Register command: expand all notebooks
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.expandAll', async () => {
      const notebooks = await notebookManager.getNotebooks();
      for (const notebook of notebooks) {
        const notebookItem = new NotebookTreeItem(notebook);
        // Expand with level 3 to show notebooks -> folders -> notes
        await treeView.reveal(notebookItem, { expand: 3, select: false, focus: false });
      }
    })
  );

  // Register command: reveal notebook in file explorer
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.revealInExplorer', async (item: NotebookTreeItem) => {
      if (!item || !item.notebook) {
        vscode.window.showWarningMessage('Please select a notebook');
        return;
      }

      try {
        const notebookUri = storageManager.getNotebookUri(item.notebook.id);
        const logger = Logger.getInstance();
        logger.info(`Revealing notebook in file explorer: ${notebookUri.fsPath}`, 'Core');

        // Open the folder in file explorer
        await vscode.commands.executeCommand('revealFileInOS', notebookUri);
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to reveal in explorer: ${error}`);
      }
    })
  );

  // Register command: view file history
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.viewFileHistory', async (item: NoteTreeItem) => {
      if (!item?.noteUri) {
        vscode.window.showWarningMessage('Please select a note');
        return;
      }

      try {
        const notebookId = item.notebookId;

        // Get file history using isomorphic-git
        logger.info(`Getting file history for: ${item.noteUri.fsPath}`, 'Git');
        const history = await gitManager.getFileHistory(notebookId, item.noteUri.fsPath);

        if (history.length === 0) {
          vscode.window.showInformationMessage('No commit history found for this file');
          return;
        }

        // Show history in QuickPick
        interface CommitQuickPickItem extends vscode.QuickPickItem {
          commit: typeof history[0];
        }

        const items: CommitQuickPickItem[] = history.map(commit => {
          const date = new Date(commit.timestamp);
          const dateStr = formatDateTime(date);

          return {
            label: `$(git-commit) ${commit.message.split('\n')[0]}`,
            description: commit.oid.substring(0, 7),
            detail: `${commit.author} • ${dateStr}`,
            commit
          };
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select a commit to view file content',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          // Get file content at this commit
          const content = await gitManager.getFileAtCommit(
            notebookId,
            item.noteUri.fsPath,
            selected.commit.oid
          );

          // Create a read-only document with custom URI scheme
          const historicalUri = vscode.Uri.parse(
            `markdown-notes-history:${path.basename(item.noteUri.fsPath)}?` +
            `commit=${selected.commit.oid}&path=${encodeURIComponent(item.noteUri.fsPath)}`
          );

          // Register a text document content provider for the historical file
          const contentProvider = new class implements vscode.TextDocumentContentProvider {
            provideTextDocumentContent(uri: vscode.Uri): string {
              return Buffer.from(content).toString('utf-8');
            }
          };

          const registration = vscode.workspace.registerTextDocumentContentProvider(
            'markdown-notes-history',
            contentProvider
          );

          // Open the document (it will be read-only because it's from a content provider)
          const doc = await vscode.workspace.openTextDocument(historicalUri);

          await vscode.window.showTextDocument(doc, {
            preview: true,
            viewColumn: vscode.ViewColumn.Beside
          });

          // Show info with short commit hash
          const shortHash = selected.commit.oid.substring(0, 7);
          const fileName = path.basename(item.noteUri.fsPath);
          vscode.window.showInformationMessage(
            `Viewing ${fileName} at commit ${shortHash} (read-only)`
          );

          // Dispose the provider after document is closed
          const disposable = vscode.workspace.onDidCloseTextDocument(closedDoc => {
            if (closedDoc.uri.toString() === historicalUri.toString()) {
              registration.dispose();
              disposable.dispose();
            }
          });
        }
      } catch (error) {
        logger.error(`Failed to view file history: ${error}`, 'Git');
        vscode.window.showErrorMessage(`Failed to view file history: ${error}`);
      }
    })
  );

  // Register command: compare with HEAD (use our own Git implementation)
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.compareWithHEAD', async (item: NoteTreeItem) => {
      if (!item || !item.noteUri) {
        vscode.window.showWarningMessage('Please select a note');
        return;
      }

      const notebookId = item.notebookId;
      const notebook = (await notebookManager.getNotebooks()).find(n => n.id === notebookId);

      if (!notebook || !notebook.gitConfig || !notebook.gitConfig.initialized) {
        vscode.window.showWarningMessage('Git repository not initialized for this notebook');
        return;
      }

      try {
        logger.info(`Comparing with HEAD: ${item.noteUri.fsPath}`, 'Git');

        // Get the file content from HEAD
        const headContent = await gitManager.getFileAtCommit(
          notebookId,
          item.noteUri.fsPath,
          'HEAD'
        );

        // Create a unique URI for the HEAD version
        const fileName = path.basename(item.noteUri.fsPath);
        const headUri = vscode.Uri.parse(
          `markdown-notes-git-head:${fileName}?` +
          `commit=HEAD&path=${encodeURIComponent(item.noteUri.fsPath)}`
        );

        // Register a text document content provider for the HEAD version
        const contentProvider = new class implements vscode.TextDocumentContentProvider {
          provideTextDocumentContent(uri: vscode.Uri): string {
            return Buffer.from(headContent).toString('utf-8');
          }
        };

        const registration = vscode.workspace.registerTextDocumentContentProvider(
          'markdown-notes-git-head',
          contentProvider
        );

        // Open diff view: HEAD (left) vs Working Copy (right)
        await vscode.commands.executeCommand(
          'vscode.diff',
          headUri,
          item.noteUri,
          `${fileName} (HEAD ↔ Working Copy)`
        );

        // Dispose the provider after document is closed
        const disposable = vscode.workspace.onDidCloseTextDocument(closedDoc => {
          if (closedDoc.uri.toString() === headUri.toString()) {
            registration.dispose();
            disposable.dispose();
          }
        });
      } catch (error) {
        logger.error(`Failed to compare with HEAD: ${error}`, 'Git');
        vscode.window.showErrorMessage(
          `Failed to compare with HEAD: ${error}`
        );
      }
    })
  );

  // Register command: reset note to HEAD (discard local changes)
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.resetToHEAD', async (item: NoteTreeItem) => {
      if (!item || !item.noteUri) {
        vscode.window.showWarningMessage('Please select a note');
        return;
      }

      const notebookId = item.note.notebookId;
      const notebook = (await notebookManager.getNotebooks()).find(n => n.id === notebookId);

      if (!notebook || !notebook.gitConfig || !notebook.gitConfig.initialized) {
        vscode.window.showWarningMessage('Git repository not initialized for this notebook');
        return;
      }

      // Confirm action
      const fileName = path.basename(item.noteUri.fsPath);
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to reset "${fileName}" to the last committed version? All local changes will be lost.`,
        { modal: true },
        'Reset'
      );

      if (confirm !== 'Reset') {
        return;
      }

      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Resetting ${fileName}...`,
          cancellable: false
        }, async () => {
          await gitManager.resetFileToHEAD(notebookId, item.noteUri.fsPath);
        });

        // Refresh the currently open editor if this file is open
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.uri.toString() === item.noteUri.toString()) {
          // Close and reopen to refresh content
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
          await vscode.window.showTextDocument(item.noteUri);
        }

        vscode.window.showInformationMessage(`"${fileName}" has been reset to HEAD`);
      } catch (error) {
        logger.error(`Failed to reset file to HEAD: ${error}`, 'Git');
        vscode.window.showErrorMessage(`Failed to reset file: ${error}`);
      }
    })
  );

  // Register command: view all changes in notebook
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.viewAllChanges', async (item: NotebookTreeItem) => {
      if (!item || !item.notebook) {
        vscode.window.showWarningMessage('Please select a notebook');
        return;
      }

      const notebook = item.notebook;

      if (!notebook.gitConfig || !notebook.gitConfig.initialized) {
        vscode.window.showWarningMessage('Git repository not initialized for this notebook');
        return;
      }

      try {
        const changedFiles = await gitManager.getChangedFilesWithPaths(notebook.id);

        if (changedFiles.length === 0) {
          vscode.window.showInformationMessage('No uncommitted changes in this notebook');
          return;
        }

        // Filter only markdown files
        const mdFiles = changedFiles.filter(file => file.relativePath.endsWith('.md'));

        if (mdFiles.length === 0) {
          vscode.window.showInformationMessage('No markdown file changes in this notebook');
          return;
        }

        // Prepare resource list for vscode.changes API
        // Format: array of [label, original, modified] tuples
        const resourceList: [vscode.Uri, vscode.Uri, vscode.Uri][] = mdFiles.map(file => {
          const modifiedUri = vscode.Uri.file(file.fullPath);

          // Use git scheme for HEAD version
          const originalUri = modifiedUri.with({
            scheme: 'git',
            path: modifiedUri.path,
            query: JSON.stringify({
              path: modifiedUri.fsPath,
              ref: 'HEAD'
            })
          });

          // Label URI (used for display name)
          const labelUri = modifiedUri;

          return [labelUri, originalUri, modifiedUri];
        });

        // Call vscode.changes with title and resource list
        await vscode.commands.executeCommand(
          'vscode.changes',
          `Changes in ${notebook.name} (${mdFiles.length} file${mdFiles.length > 1 ? 's' : ''})`,
          resourceList
        );
      } catch (error) {
        logger.error(`Failed to view changes: ${error}`, 'Git');
        vscode.window.showErrorMessage(`Failed to view changes: ${error}`);
      }
    })
  );

  // Register Git commands
  const { registerGitCommands } = await import('./gitCommands');
  registerGitCommands(context, gitManager, notebookManager, () => treeProvider.refresh());

  // Register command: toggle auto refresh
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.toggleAutoRefresh', async () => {
      const config = vscode.workspace.getConfiguration('markdownNotes.git');
      const currentInterval = config.get<number>('autoRefreshInterval', 30);

      if (currentInterval <= 0) {
        // Currently disabled, enable with default
        await config.update('autoRefreshInterval', 30, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Git auto refresh enabled (30s interval)');
      } else {
        // Currently enabled, disable
        await config.update('autoRefreshInterval', 0, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('Git auto refresh disabled');
      }
    })
  );
}

/**
 * Extension deactivation function
 */
export function deactivate() {
  const logger = Logger.getInstance();
  logger.info('Extension deactivated', 'Core');
}
