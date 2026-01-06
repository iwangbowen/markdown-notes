import * as vscode from 'vscode';
import { StorageManager } from './utils/storage';
import { NotebookManager } from './notebookManager';
import { NoteTreeProvider, NotebookTreeItem, NoteTreeItem } from './noteTreeProvider';

/**
 * 扩展激活函数
 */
export async function activate(context: vscode.ExtensionContext) {
  console.log('Markdown Notes 扩展已激活');

  // 初始化存储管理器
  const storageManager = new StorageManager(context);
  await storageManager.initializeStorage();

  // 初始化笔记本管理器
  const notebookManager = new NotebookManager(storageManager);

  // 初始化TreeView
  const treeProvider = new NoteTreeProvider(notebookManager);
  const treeView = vscode.window.createTreeView('markdownNotesView', {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });

  context.subscriptions.push(treeView);

  // 注册命令：创建笔记本
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.createNotebook', async () => {
      const name = await vscode.window.showInputBox({
        prompt: '输入笔记本名称',
        placeHolder: '例如：工作笔记',
        validateInput: async (value) => {
          return await notebookManager.validateNotebookName(value);
        }
      });

      if (name) {
        try {
          await notebookManager.createNotebook(name.trim());
          treeProvider.refresh();
          vscode.window.showInformationMessage(`笔记本"${name}"创建成功`);
        } catch (error) {
          vscode.window.showErrorMessage(`创建笔记本失败: ${error}`);
        }
      }
    })
  );

  // 注册命令：创建笔记
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.createNote', async (item?: NotebookTreeItem) => {
      let notebookId: string | undefined;

      // 如果从上下文菜单调用，直接使用该笔记本
      if (item instanceof NotebookTreeItem) {
        notebookId = item.notebook.id;
      } else {
        // 否则让用户选择笔记本
        const notebooks = await notebookManager.getNotebooks();

        if (notebooks.length === 0) {
          vscode.window.showWarningMessage('请先创建一个笔记本');
          return;
        }

        const selected = await vscode.window.showQuickPick(
          notebooks.map(n => ({ label: n.name, id: n.id })),
          { placeHolder: '选择笔记本' }
        );

        if (!selected) {
          return;
        }

        notebookId = selected.id;
      }

      const name = await vscode.window.showInputBox({
        prompt: '输入笔记名称',
        placeHolder: '例如：会议记录',
        validateInput: (value) => {
          if (!value.trim()) {
            return '笔记名称不能为空';
          }
          return null;
        }
      });

      if (name && notebookId) {
        try {
          const note = await notebookManager.createNote(notebookId, name.trim());
          treeProvider.refresh();

          // 自动打开新创建的笔记
          const uri = vscode.Uri.parse(note.uri);
          await notebookManager.openNote(uri);

          vscode.window.showInformationMessage(`笔记"${name}"创建成功`);
        } catch (error) {
          vscode.window.showErrorMessage(`创建笔记失败: ${error}`);
        }
      }
    })
  );

  // 注册命令：删除笔记
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.deleteNote', async (item: NoteTreeItem) => {
      const answer = await vscode.window.showWarningMessage(
        `确定删除笔记"${item.note.name}"吗？`,
        { modal: true },
        '删除'
      );

      if (answer === '删除') {
        try {
          await notebookManager.deleteNote(item.noteUri);
          treeProvider.refresh();
          vscode.window.showInformationMessage(`笔记"${item.note.name}"已删除`);
        } catch (error) {
          vscode.window.showErrorMessage(`删除笔记失败: ${error}`);
        }
      }
    })
  );

  // 注册命令：删除笔记本
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.deleteNotebook', async (item: NotebookTreeItem) => {
      const notes = await notebookManager.getNotes(item.notebook.id);
      const noteCount = notes.length;

      const message = noteCount > 0
        ? `确定删除笔记本"${item.notebook.name}"及其中的 ${noteCount} 条笔记吗？`
        : `确定删除笔记本"${item.notebook.name}"吗？`;

      const answer = await vscode.window.showWarningMessage(
        message,
        { modal: true },
        '删除'
      );

      if (answer === '删除') {
        try {
          await notebookManager.deleteNotebook(item.notebook.id);
          treeProvider.refresh();
          vscode.window.showInformationMessage(`笔记本"${item.notebook.name}"已删除`);
        } catch (error) {
          vscode.window.showErrorMessage(`删除笔记本失败: ${error}`);
        }
      }
    })
  );

  // 注册命令：刷新树视图
  context.subscriptions.push(
    vscode.commands.registerCommand('markdownNotes.refreshTree', () => {
      treeProvider.refresh();
      vscode.window.showInformationMessage('笔记列表已刷新');
    })
  );
}

/**
 * 扩展停用函数
 */
export function deactivate() {
  console.log('Markdown Notes 扩展已停用');
}
