import * as vscode from 'vscode';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as fs from 'fs';
import * as path from 'path';
import { GitConfig, GitStatus } from './types';

/**
 * Git credentials interface
 */
interface GitCredentials {
    username?: string;
    password?: string; // Can be personal access token
}

/**
 * Git manager for handling git operations
 */
export class GitManager {
    private outputChannel: vscode.OutputChannel;

    constructor(
        private context: vscode.ExtensionContext,
        private globalStorageUri: vscode.Uri
    ) {
        // Create output channel for git logs
        this.outputChannel = vscode.window.createOutputChannel('Markdown Notes - Git');
    }

    /**
     * Log message to output channel
     */
    private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✓';
        this.outputChannel.appendLine(`[${timestamp}] ${prefix} ${message}`);
    }

    /**
     * Show output channel
     */
    showOutput(): void {
        this.outputChannel.show();
    }

    /**
     * Get git credentials from secret storage
     */
    private async getCredentials(notebookId: string): Promise<GitCredentials | undefined> {
        this.log(`Retrieving credentials for notebook: ${notebookId}`);
        const key = `git-auth-${notebookId}`;
        const stored = await this.context.secrets.get(key);

        if (stored) {
            try {
                this.log('Credentials found');
                return JSON.parse(stored);
            } catch {
                this.log('Failed to parse stored credentials', 'error');
                return undefined;
            }
        }

        this.log('No credentials found', 'warn');
        return undefined;
    }

    /**
     * Store git credentials in secret storage
     */
    async storeCredentials(notebookId: string, credentials: GitCredentials): Promise<void> {
        this.log(`Storing credentials for notebook: ${notebookId}`);
        const key = `git-auth-${notebookId}`;
        await this.context.secrets.store(key, JSON.stringify(credentials));
        this.log('Credentials stored successfully');
    }

    /**
     * Delete git credentials from secret storage
     */
    async deleteCredentials(notebookId: string): Promise<void> {
        this.log(`Deleting credentials for notebook: ${notebookId}`);
        const key = `git-auth-${notebookId}`;
        await this.context.secrets.delete(key);
        this.log('Credentials deleted');
    }

    /**
     * Get notebook directory path
     */
    private getNotebookDir(notebookId: string): string {
        return path.join(this.globalStorageUri.fsPath, notebookId);
    }

    /**
     * Initialize git repository
     */
    async initRepository(notebookId: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        this.log(`Initializing git repository at: ${dir}`);
        this.log(`Branch: ${config.branch}, Remote: ${config.remoteUrl}`);

        try {
            // Initialize git
            this.log('Running: git init');
            await git.init({ fs, dir, defaultBranch: config.branch });

            // Configure author
            this.log(`Setting user.name: ${config.author.name}`);
            await git.setConfig({
                fs,
                dir,
                path: 'user.name',
                value: config.author.name
            });

            this.log(`Setting user.email: ${config.author.email}`);
            await git.setConfig({
                fs,
                dir,
                path: 'user.email',
                value: config.author.email
            });

            // Add remote if provided
            if (config.remoteUrl) {
                this.log(`Adding remote origin: ${config.remoteUrl}`);
                await git.addRemote({
                    fs,
                    dir,
                    remote: 'origin',
                    url: config.remoteUrl
                });
            }

            this.log('Repository initialized successfully', 'info');
            vscode.window.showInformationMessage(`Git repository initialized for notebook`);
        } catch (error) {
            this.log(`Failed to initialize repository: ${error}`, 'error');
            throw new Error(`Failed to initialize git: ${error}`);
        }
    }

    /**
     * Clone remote repository
     */
    async cloneRepository(notebookId: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

        this.log(`Cloning repository: ${config.remoteUrl}`);
        this.log(`Target directory: ${dir}`);
        this.log(`Branch: ${config.branch}`);

        try {
            await git.clone({
                fs,
                http,
                dir,
                url: config.remoteUrl,
                ref: config.branch,
                singleBranch: true,
                depth: 1,
                onAuth: () => credentials || {},
                onProgress: (progress) => {
                    const percent = progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;
                    this.log(`Clone progress: ${progress.phase} - ${percent}% (${progress.loaded}/${progress.total})`);
                }
            });

            this.log('Repository cloned successfully', 'info');
            vscode.window.showInformationMessage(`Repository cloned successfully`);
        } catch (error) {
            this.log(`Clone failed: ${error}`, 'error');
            this.showOutput(); // Auto-show output on error
            throw new Error(`Failed to clone repository: ${error}`);
        }
    }

    /**
     * Commit changes
     */
    async commit(notebookId: string, message: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);

        this.log(`Committing changes in: ${dir}`);
        this.log(`Commit message: "${message}"`);

        try {
            // Add all changes
            const files = await this.getChangedFiles(notebookId);
            this.log(`Found ${files.length} changed files`);

            for (const file of files) {
                this.log(`Adding file: ${file}`);
                await git.add({ fs, dir, filepath: file });
            }

            // Commit
            const sha = await git.commit({
                fs,
                dir,
                message,
                author: {
                    name: config.author.name,
                    email: config.author.email
                }
            });

            this.log(`Committed successfully: ${sha.substring(0, 7)}`, 'info');
            vscode.window.showInformationMessage(`Changes committed: ${sha.substring(0, 7)}`);
        } catch (error) {
            this.log(`Commit failed: ${error}`, 'error');
            this.showOutput();
            throw new Error(`Failed to commit: ${error}`);
        }
    }

    /**
     * Pull from remote
     */
    async pull(notebookId: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

        this.log(`Pulling from remote: ${config.remoteUrl}`);
        this.log(`Branch: ${config.branch}`);

        try {
            await git.pull({
                fs,
                http,
                dir,
                ref: config.branch,
                author: {
                    name: config.author.name,
                    email: config.author.email
                },
                onAuth: () => credentials || {},
                singleBranch: true
            });

            this.log('Pull completed successfully', 'info');
            vscode.window.showInformationMessage(`Pulled latest changes from remote`);
        } catch (error) {
            this.log(`Pull failed: ${error}`, 'error');
            this.showOutput();
            throw new Error(`Failed to pull: ${error}`);
        }
    }

    /**
     * Push to remote
     */
    async push(notebookId: string): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

        this.log(`Pushing to remote`);

        try {
            await git.push({
                fs,
                http,
                dir,
                remote: 'origin',
                onAuth: () => credentials || {}
            });

            this.log('Push completed successfully', 'info');
            vscode.window.showInformationMessage(`Pushed changes to remote`);
        } catch (error) {
            this.log(`Push failed: ${error}`, 'error');
            this.showOutput();
            throw new Error(`Failed to push: ${error}`);
        }
    }

    /**
     * Sync (pull + push)
     */
    async sync(notebookId: string, config: GitConfig): Promise<void> {
        this.log('Starting sync operation');
        try {
            await this.pull(notebookId, config);
            await this.push(notebookId);
            this.log('Sync completed successfully', 'info');
            vscode.window.showInformationMessage(`Sync completed successfully`);
        } catch (error) {
            this.log(`Sync failed: ${error}`, 'error');
            this.showOutput();
            throw new Error(`Failed to sync: ${error}`);
        }
    }

    /**
     * Get git status
     */
    async getStatus(notebookId: string): Promise<GitStatus> {
        const dir = this.getNotebookDir(notebookId);

        this.log(`Getting git status for: ${dir}`);

        try {
            // Get status matrix
            const status = await git.statusMatrix({ fs, dir });

            // Count uncommitted changes
            const uncommittedChanges = status.filter(
                ([_, head, workdir, stage]) => head !== workdir || head !== stage
            ).length;

            // Get current branch
            const branch = await git.currentBranch({ fs, dir, fullname: false }) || 'main';

            // Get log to check unpushed commits
            const commits = await git.log({ fs, dir, depth: 10 });

            this.log(`Status: ${uncommittedChanges} uncommitted changes, branch: ${branch}`);
            this.log(`Recent commits: ${commits.length}`);

            return {
                uncommittedChanges,
                unpushedCommits: commits.length, // Simplified - should compare with remote
                hasConflicts: false,
                branch
            };
        } catch (error) {
            this.log(`Failed to get status: ${error}`, 'error');
            throw new Error(`Failed to get status: ${error}`);
        }
    }

    /**
     * Get list of changed files
     */
    private async getChangedFiles(notebookId: string): Promise<string[]> {
        const dir = this.getNotebookDir(notebookId);

        try {
            const status = await git.statusMatrix({ fs, dir });

            // Filter files that have changes
            return status
                .filter(([_, head, workdir, stage]) => head !== workdir || head !== stage)
                .map(([filepath]) => filepath);
        } catch (error) {
            return [];
        }
    }

    /**
     * Check if git is initialized for a notebook
     */
    async isInitialized(notebookId: string): Promise<boolean> {
        const dir = this.getNotebookDir(notebookId);
        const gitDir = path.join(dir, '.git');

        try {
            const stat = await fs.promises.stat(gitDir);
            return stat.isDirectory();
        } catch {
            return false;
        }
    }
}
