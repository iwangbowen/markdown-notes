import * as vscode from 'vscode';
import { StorageManager } from './utils/storage';
import { NotebookManager } from './notebookManager';
import { NoteTreeProvider, NotebookTreeItem, NoteTreeItem } from './noteTreeProvider';

/**
 * Extension activation function
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Markdown Notes extension activated');

  // Initialize storage manager
  const storageManager = new StorageManager(context);
  await storageManager.initializeStorage();

  // Initialize notebook manager
  const notebookManager = new NotebookManager(storageManager);

  // Initialize TreeView
  const treeProvider = new NoteTreeProvider(notebookManager);
  const treeView = vscode.window.createTreeView('markdownNotesView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

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
    vscode.commands.registerCommand('markdownNotes.createNote', async (item?: NotebookTreeItem) => {
      let notebookId: string | undefined;

      // If called from context menu, use that notebook directly
      if (item instanceof NotebookTreeItem) {
        notebookId = item.notebook.id;
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
          const note = await notebookManager.createNote(notebookId, name.trim());
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
}

/**
 * Extension deactivation function
 */
export function deactivate() {
  console.log('Markdown Notes extension deactivated');
}
