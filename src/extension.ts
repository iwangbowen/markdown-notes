import * as vscode from 'vscode';
import * as path from 'path';
import { StorageManager } from './utils/storage';
import { Logger } from './utils/logger';
import { NotebookManager } from './notebookManager';
import { NoteTreeProvider, NotebookTreeItem, NoteTreeItem, FolderTreeItem } from './noteTreeProvider';
import { GitManager } from './gitManager';
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

  // Initialize notebook manager
  const notebookManager = new NotebookManager(storageManager);

  // Initialize git manager
  const gitManager = new GitManager(context, storageManager.getStorageUri());

  // Initialize TreeView
  const treeProvider = new NoteTreeProvider(context, notebookManager, gitManager);
  const treeView = vscode.window.createTreeView('markdownNotesView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

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

      if (name && notebookId) {
        try {
          const note = await notebookManager.createNote(notebookId, name.trim(), folderPath);
          treeProvider.refresh();

          // Auto open the newly created note
          const uri = vscode.Uri.parse(note.uri);
          await notebookManager.openNote(uri);

          vscode.window.showInformationMessage(`Note "${name}" created successfully`);
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to create note: ${error}`);
        }
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
          const dateStr = date.toLocaleString();

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

  // Register command: compare with HEAD (use VS Code built-in Git)
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.compareWithHEAD', async (item: NoteTreeItem) => {
      if (!item || !item.noteUri) {
        vscode.window.showWarningMessage('Please select a note');
        return;
      }

      try {
        // Execute Git Compare command (requires Git extension)
        await vscode.commands.executeCommand('git.openChange', item.noteUri);
      } catch (error) {
        logger.error(`Failed to compare with HEAD: ${error}`, 'Git');
        vscode.window.showErrorMessage(
          `Failed to compare with HEAD. Make sure the Git extension is enabled and the file has changes.`
        );
      }
    })
  );

  // Register Git commands
  const { registerGitCommands } = await import('./gitCommands');
  registerGitCommands(context, gitManager, notebookManager, () => treeProvider.refresh());
}

/**
 * Extension deactivation function
 */
export function deactivate() {
  const logger = Logger.getInstance();
  logger.info('Extension deactivated', 'Core');
}
