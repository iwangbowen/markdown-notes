import * as vscode from 'vscode';
import { GitManager } from './gitManager';
import { NotebookManager } from './notebookManager';
import { NotebookTreeItem } from './noteTreeProvider';
import { GitConfig } from './types';

/**
 * Register all git-related commands
 */
export function registerGitCommands(
    context: vscode.ExtensionContext,
    gitManager: GitManager,
    notebookManager: NotebookManager,
    refreshTree: () => void
): void {

    // Command: Configure Git Repository
    context.subscriptions.push(
        vscode.commands.registerCommand('markdownNotes.configureGit', async (item: NotebookTreeItem) => {
            if (!item) {
                vscode.window.showWarningMessage('Please select a notebook');
                return;
            }

            const notebook = item.notebook;

            // Step 1: Ask for repository URL
            const remoteUrl = await vscode.window.showInputBox({
                prompt: 'Enter Git repository URL (HTTPS)',
                placeHolder: 'https://github.com/username/repo.git',
                value: notebook.gitConfig?.remoteUrl || '',
                validateInput: (value) => {
                    if (!value.trim()) {
                        return 'Repository URL cannot be empty';
                    }
                    if (!value.startsWith('http://') && !value.startsWith('https://')) {
                        return 'Please use HTTPS URL';
                    }
                    return null;
                }
            });

            if (!remoteUrl) { return; }

            // Step 2: Ask for branch
            const branch = await vscode.window.showInputBox({
                prompt: 'Enter branch name',
                placeHolder: 'main',
                value: notebook.gitConfig?.branch || 'main'
            });

            if (!branch) { return; }

            // Step 3: Ask for author name
            const authorName = await vscode.window.showInputBox({
                prompt: 'Enter your name (for commits)',
                placeHolder: 'John Doe',
                value: notebook.gitConfig?.author?.name || ''
            });

            if (!authorName) { return; }

            // Step 4: Ask for author email
            const authorEmail = await vscode.window.showInputBox({
                prompt: 'Enter your email (for commits)',
                placeHolder: 'john@example.com',
                value: notebook.gitConfig?.author?.email || '',
                validateInput: (value) => {
                    if (!value.includes('@')) {
                        return 'Please enter a valid email';
                    }
                    return null;
                }
            });

            if (!authorEmail) { return; }

            // Step 5: Ask for credentials
            const authType = await vscode.window.showQuickPick(
                ['Personal Access Token', 'Username + Password'],
                { placeHolder: 'Select authentication method' }
            );

            if (!authType) { return; }

            let credentials: any = {};

            if (authType === 'Personal Access Token') {
                const token = await vscode.window.showInputBox({
                    prompt: 'Enter your Personal Access Token',
                    placeHolder: 'ghp_xxxxxxxxxxxx',
                    password: true
                });

                if (!token) { return; }

                credentials = {
                    username: 'oauth2',
                    password: token
                };
            } else {
                const username = await vscode.window.showInputBox({
                    prompt: 'Enter your username',
                    placeHolder: 'username'
                });

                if (!username) { return; }

                const password = await vscode.window.showInputBox({
                    prompt: 'Enter your password',
                    password: true
                });

                if (!password) { return; }

                credentials = { username, password };
            }

            // Save credentials
            await gitManager.storeCredentials(notebook.id, credentials);

            // Create git config
            const gitConfig: GitConfig = {
                remoteUrl,
                branch,
                author: {
                    name: authorName,
                    email: authorEmail
                },
                initialized: false
            };

            // Update notebook with git config
            notebook.gitConfig = gitConfig;
            await notebookManager.updateNotebook(notebook);

            // Initialize or clone repository
            const isInitialized = await gitManager.isInitialized(notebook.id);

            if (!isInitialized) {
                const choice = await vscode.window.showQuickPick(
                    ['Clone from remote', 'Initialize local repository'],
                    { placeHolder: 'Choose initialization method' }
                );

                if (choice === 'Clone from remote') {
                    try {
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: 'Cloning repository...',
                            cancellable: false
                        }, async () => {
                            await gitManager.cloneRepository(notebook.id, gitConfig);
                        });

                        gitConfig.initialized = true;
                        notebook.gitConfig = gitConfig;
                        await notebookManager.updateNotebook(notebook);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to clone: ${error}`);
                    }
                } else if (choice === 'Initialize local repository') {
                    try {
                        await gitManager.initRepository(notebook.id, gitConfig);
                        gitConfig.initialized = true;
                        notebook.gitConfig = gitConfig;
                        await notebookManager.updateNotebook(notebook);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to initialize: ${error}`);
                    }
                }
            }

            refreshTree();
            vscode.window.showInformationMessage('Git configuration saved');
        })
    );

    // Command: Commit changes
    context.subscriptions.push(
        vscode.commands.registerCommand('markdownNotes.gitCommit', async (item: NotebookTreeItem) => {
            if (!item || !item.notebook.gitConfig) {
                vscode.window.showWarningMessage('Please configure Git first');
                return;
            }

            const notebook = item.notebook;
            const message = await vscode.window.showInputBox({
                prompt: 'Enter commit message',
                placeHolder: 'Update notes'
            });

            if (!message) { return; }

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Committing changes...',
                    cancellable: false
                }, async () => {
                    await gitManager.commit(notebook.id, message, notebook.gitConfig!);
                });

                if (notebook.gitConfig) {
                    notebook.gitConfig.lastSync = Date.now();
                    await notebookManager.updateNotebook(notebook);
                }
                refreshTree();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to commit: ${error}`);
            }
        })
    );

    // Command: Pull from remote
    context.subscriptions.push(
        vscode.commands.registerCommand('markdownNotes.gitPull', async (item: NotebookTreeItem) => {
            if (!item || !item.notebook.gitConfig) {
                vscode.window.showWarningMessage('Please configure Git first');
                return;
            }

            const notebook = item.notebook;

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Pulling from remote...',
                    cancellable: false
                }, async () => {
                    await gitManager.pull(notebook.id, notebook.gitConfig!);
                });

                if (notebook.gitConfig) {
                    notebook.gitConfig.lastSync = Date.now();
                    await notebookManager.updateNotebook(notebook);
                }
                refreshTree();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to pull: ${error}`);
            }
        })
    );

    // Command: Push to remote
    context.subscriptions.push(
        vscode.commands.registerCommand('markdownNotes.gitPush', async (item: NotebookTreeItem) => {
            if (!item || !item.notebook.gitConfig) {
                vscode.window.showWarningMessage('Please configure Git first');
                return;
            }

            const notebook = item.notebook;

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Pushing to remote...',
                    cancellable: false
                }, async () => {
                    await gitManager.push(notebook.id);
                });

                if (notebook.gitConfig) {
                    notebook.gitConfig.lastSync = Date.now();
                    await notebookManager.updateNotebook(notebook);
                }
                refreshTree();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to push: ${error}`);
            }
        })
    );

    // Command: Sync (pull + push)
    context.subscriptions.push(
        vscode.commands.registerCommand('markdownNotes.gitSync', async (item: NotebookTreeItem) => {
            if (!item || !item.notebook.gitConfig) {
                vscode.window.showWarningMessage('Please configure Git first');
                return;
            }

            const notebook = item.notebook;

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Syncing with remote...',
                    cancellable: false
                }, async () => {
                    await gitManager.sync(notebook.id, notebook.gitConfig!);
                });

                if (notebook.gitConfig) {
                    notebook.gitConfig.lastSync = Date.now();
                    await notebookManager.updateNotebook(notebook);
                }
                refreshTree();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to sync: ${error}`);
            }
        })
    );

    // Command: View git status
    context.subscriptions.push(
        vscode.commands.registerCommand('markdownNotes.gitStatus', async (item: NotebookTreeItem) => {
            if (!item || !item.notebook.gitConfig) {
                vscode.window.showWarningMessage('Please configure Git first');
                return;
            }

            const notebook = item.notebook;

            try {
                const status = await gitManager.getStatus(notebook.id);

                const lastSync = notebook.gitConfig?.lastSync
                    ? new Date(notebook.gitConfig.lastSync).toLocaleString()
                    : 'Never';

                vscode.window.showInformationMessage(
                    `Git Status for "${notebook.name}":\n` +
                    `Branch: ${status.branch}\n` +
                    `Uncommitted changes: ${status.uncommittedChanges}\n` +
                    `Unpushed commits: ${status.unpushedCommits}\n` +
                    `Last sync: ${lastSync}`,
                    { modal: true }
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to get status: ${error}`);
            }
        })
    );
}
