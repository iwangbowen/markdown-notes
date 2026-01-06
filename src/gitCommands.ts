import * as vscode from 'vscode';
import { GitManager } from './gitManager';
import { NotebookManager } from './notebookManager';
import { NotebookTreeItem } from './noteTreeProvider';
import { GitConfig } from './types';

/**
 * Git configuration collection result
 */
interface GitConfigurationResult {
    remoteUrl: string;
    branch: string;
    authorName: string;
    authorEmail: string;
    credentials: {
        username: string;
        password: string;
    };
}

/**
 * Multi-step input for Git configuration
 */
async function collectGitConfiguration(existingConfig?: GitConfig): Promise<GitConfigurationResult | undefined> {
    const state: Partial<GitConfigurationResult> = {};

    // Step 1: Repository URL
    const remoteUrl = await vscode.window.showInputBox({
        title: 'Git Configuration (Step 1/5)',
        prompt: 'Enter Git repository URL (HTTPS)',
        placeHolder: 'https://github.com/username/repo.git',
        value: existingConfig?.remoteUrl || '',
        ignoreFocusOut: true,  // 防止失去焦点时关闭
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

    if (remoteUrl === undefined) {
        return undefined;  // 用户取消
    }
    state.remoteUrl = remoteUrl;

    // Step 2: Branch
    const branch = await vscode.window.showInputBox({
        title: 'Git Configuration (Step 2/5)',
        prompt: 'Enter branch name',
        placeHolder: 'main',
        value: existingConfig?.branch || 'main',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Branch name cannot be empty';
            }
            return null;
        }
    });

    if (branch === undefined) {
        return undefined;
    }
    state.branch = branch;

    // Step 3: Author name
    const authorName = await vscode.window.showInputBox({
        title: 'Git Configuration (Step 3/5)',
        prompt: 'Enter your name (for commits)',
        placeHolder: 'John Doe',
        value: existingConfig?.author?.name || '',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Name cannot be empty';
            }
            return null;
        }
    });

    if (authorName === undefined) {
        return undefined;
    }
    state.authorName = authorName;

    // Step 4: Author email
    const authorEmail = await vscode.window.showInputBox({
        title: 'Git Configuration (Step 4/5)',
        prompt: 'Enter your email (for commits)',
        placeHolder: 'john@example.com',
        value: existingConfig?.author?.email || '',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value.trim()) {
                return 'Email cannot be empty';
            }
            if (!value.includes('@')) {
                return 'Please enter a valid email';
            }
            return null;
        }
    });

    if (authorEmail === undefined) {
        return undefined;
    }
    state.authorEmail = authorEmail;

    // Step 5: Authentication
    const authType = await vscode.window.showQuickPick(
        [
            { label: '$(key) Personal Access Token', value: 'token', description: 'Recommended for GitHub, GitLab' },
            { label: '$(lock) Username + Password', value: 'password', description: 'Traditional authentication' }
        ],
        {
            title: 'Git Configuration (Step 5/5)',
            placeHolder: 'Select authentication method',
            ignoreFocusOut: true
        }
    );

    if (authType === undefined) {
        return undefined;
    }

    let credentials: { username: string; password: string };

    if (authType.value === 'token') {
        const token = await vscode.window.showInputBox({
            title: 'Git Configuration (Step 5/5) - Token',
            prompt: 'Enter your Personal Access Token',
            placeHolder: 'ghp_xxxxxxxxxxxx (GitHub) or glpat-xxxxxxxxxxxx (GitLab)',
            password: true,
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Token cannot be empty';
                }
                return null;
            }
        });

        if (token === undefined) {
            return undefined;
        }

        credentials = {
            username: 'oauth2',
            password: token
        };
    } else {
        const username = await vscode.window.showInputBox({
            title: 'Git Configuration (Step 5/5) - Username',
            prompt: 'Enter your username',
            placeHolder: 'username'
        });

        if (!username) { return undefined; }

        const password = await vscode.window.showInputBox({
            title: 'Git Configuration (Step 5/5) - Password',
            prompt: 'Enter your password',
            password: true,
            validateInput: (value) => {
                if (!value.trim()) {
                    return 'Password cannot be empty';
                }
                return null;
            }
        });

        if (!password) { return undefined; }

        credentials = { username, password };
    }

    state.credentials = credentials;

    return state as GitConfigurationResult;
}

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
            gitManager.showOutput(); // Show output channel for logs
            if (!item) {
                vscode.window.showWarningMessage('Please select a notebook');
                return;
            }

            const notebook = item.notebook;

            // Use multi-step input for better UX
            const result = await collectGitConfiguration(notebook.gitConfig);
            if (!result) {
                return;
            }

            const { remoteUrl, branch, authorName, authorEmail, credentials } = result;

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
                    [
                        { label: '$(cloud-download) Clone from remote', value: 'clone', description: 'Download existing repository' },
                        { label: '$(repo) Initialize local repository', value: 'init', description: 'Create new local repository' }
                    ],
                    {
                        title: 'Repository Initialization',
                        placeHolder: 'Choose how to initialize the repository'
                    }
                );

                if (choice?.value === 'clone') {
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
                } else if (choice?.value === 'init') {
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
            gitManager.showOutput(); // Show output for status details

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
                gitManager.showOutput(); // Auto-show on error
                vscode.window.showErrorMessage(`Failed to get status: ${error}`);
            }
        })
    );

    // Command: Show Output Logs (new command)
    context.subscriptions.push(
        vscode.commands.registerCommand('markdownNotes.showOutput', () => {
            gitManager.showOutput();
        })
    );
}
