import * as vscode from 'vscode';
import * as git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import * as fs from 'fs';
import * as path from 'path';
import { Logger, LogLevel } from './utils/logger';
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
    private readonly logger: Logger;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly globalStorageUri: vscode.Uri
    ) {
        this.logger = Logger.getInstance();
    }

    /**
     * Show output channel
     */
    showOutput(): void {
        this.logger.show();
    }

    /**
     * Get git credentials from secret storage
     */
    private async getCredentials(notebookId: string): Promise<GitCredentials | undefined> {
        this.logger.debug(`Retrieving credentials for notebook: ${notebookId}`, 'Git');
        const key = `git-auth-${notebookId}`;
        const stored = await this.context.secrets.get(key);

        if (stored) {
            try {
                this.logger.debug('Credentials found', 'Git');
                return JSON.parse(stored);
            } catch {
                this.logger.error('Failed to parse stored credentials', 'Git');
                return undefined;
            }
        }

        this.logger.warn('No credentials found', 'Git');
        return undefined;
    }

    /**
     * Store git credentials in secret storage
     */
    async storeCredentials(notebookId: string, credentials: GitCredentials): Promise<void> {
        this.logger.debug(`Storing credentials for notebook: ${notebookId}`, 'Git');
        const key = `git-auth-${notebookId}`;
        await this.context.secrets.store(key, JSON.stringify(credentials));
        this.logger.info('Credentials stored successfully', 'Git');
    }

    /**
     * Delete git credentials from secret storage
     */
    async deleteCredentials(notebookId: string): Promise<void> {
        this.logger.debug(`Deleting credentials for notebook: ${notebookId}`, 'Git');
        const key = `git-auth-${notebookId}`;
        await this.context.secrets.delete(key);
        this.logger.info('Credentials deleted', 'Git');
    }

    /**
     * Get notebook directory path
     */
    private getNotebookDir(notebookId: string): string {
        return path.join(this.globalStorageUri.fsPath, 'notebooks', notebookId);
    }

    /**
     * Initialize git repository
     */
    async initRepository(notebookId: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        this.logger.info(`Initializing git repository at: ${dir}`, 'Git');
        this.logger.info(`Branch: ${config.branch}, Remote: ${config.remoteUrl}`, 'Git');

        try {
            // Initialize git
            this.logger.debug('Running: git init', 'Git');
            await git.init({ fs, dir, defaultBranch: config.branch });

            // Configure author
            this.logger.debug(`Setting user.name: ${config.author.name}`, 'Git');
            await git.setConfig({
                fs,
                dir,
                path: 'user.name',
                value: config.author.name
            });

            this.logger.debug(`Setting user.email: ${config.author.email}`, 'Git');
            await git.setConfig({
                fs,
                dir,
                path: 'user.email',
                value: config.author.email
            });

            // Add remote if provided
            if (config.remoteUrl) {
                this.logger.debug(`Adding remote origin: ${config.remoteUrl}`, 'Git');
                await git.addRemote({
                    fs,
                    dir,
                    remote: 'origin',
                    url: config.remoteUrl
                });
            }

            this.logger.info('Repository initialized successfully', 'Git');
            vscode.window.showInformationMessage(`Git repository initialized for notebook`);
        } catch (error) {
            this.logger.error(`Failed to initialize repository: ${error}`, 'Git');
            throw new Error(`Failed to initialize git: ${error}`);
        }
    }

    /**
     * Clone remote repository
     */
    async cloneRepository(notebookId: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

        this.logger.info(`Cloning repository: ${config.remoteUrl}`, 'Git');
        this.logger.debug(`Target directory: ${dir}`, 'Git');
        this.logger.debug(`Branch: ${config.branch}`, 'Git');

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
                    this.logger.debug(`Clone progress: ${progress.phase} - ${percent}% (${progress.loaded}/${progress.total})`, 'Git');
                }
            });

            this.logger.info('Repository cloned successfully', 'Git');
            vscode.window.showInformationMessage(`Repository cloned successfully`);
        } catch (error) {
            this.logger.error(`Clone failed: ${error}`, 'Git');
            throw new Error(`Failed to clone repository: ${error}`);
        }
    }

    /**
     * Commit changes
     */
    async commit(notebookId: string, message: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);

        this.logger.info(`Committing changes in: ${dir}`, 'Git');
        this.logger.debug(`Commit message: "${message}"`, 'Git');

        try {
            // Add all changes
            const files = await this.getChangedFiles(notebookId);
            this.logger.debug(`Found ${files.length} changed files`, 'Git');

            for (const file of files) {
                this.logger.debug(`Adding file: ${file}`, 'Git');
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

            this.logger.info(`Committed successfully: ${sha.substring(0, 7)}`, 'Git');
            vscode.window.showInformationMessage(`Changes committed: ${sha.substring(0, 7)}`);
        } catch (error) {
            this.logger.error(`Commit failed: ${error}`, 'Git');
            throw new Error(`Failed to commit: ${error}`);
        }
    }

    /**
     * Pull from remote
     */
    async pull(notebookId: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

        this.logger.info(`Pulling from remote: ${config.remoteUrl}`, 'Git');
        this.logger.debug(`Branch: ${config.branch}`, 'Git');

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

            this.logger.info('Pull completed successfully', 'Git');
            vscode.window.showInformationMessage(`Pulled latest changes from remote`);
        } catch (error) {
            this.logger.error(`Pull failed: ${error}`, 'Git');
            throw new Error(`Failed to pull: ${error}`);
        }
    }

    /**
     * Push to remote
     */
    async push(notebookId: string): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

        this.logger.info(`Pushing to remote`, 'Git');

        try {
            await git.push({
                fs,
                http,
                dir,
                remote: 'origin',
                onAuth: () => credentials || {}
            });

            this.logger.info('Push completed successfully', 'Git');
            vscode.window.showInformationMessage(`Pushed changes to remote`);
        } catch (error) {
            this.logger.error(`Push failed: ${error}`, 'Git');
            throw new Error(`Failed to push: ${error}`);
        }
    }

    /**
     * Sync (pull + push)
     */
    async sync(notebookId: string, config: GitConfig): Promise<void> {
        this.logger.info('Starting sync operation', 'Git');
        try {
            await this.pull(notebookId, config);
            await this.push(notebookId);
            this.logger.info('Sync completed successfully', 'Git');
            vscode.window.showInformationMessage(`Sync completed successfully`);
        } catch (error) {
            this.logger.error(`Sync failed: ${error}`, 'Git');
            throw new Error(`Failed to sync: ${error}`);
        }
    }

    /**
     * Get git status
     */
    async getStatus(notebookId: string): Promise<GitStatus> {
        const dir = this.getNotebookDir(notebookId);

        this.logger.debug(`Getting git status for: ${dir}`, 'Git');

        try {
            // Get status matrix
            const status = await git.statusMatrix({ fs, dir });

            // Count uncommitted changes
            const uncommittedChanges = status.filter(
                ([_, head, workdir, stage]) => head !== workdir || head !== stage
            ).length;

            // Get current branch
            let branch: string;
            try {
                branch = await git.currentBranch({ fs, dir, fullname: false }) || 'main';
            } catch (error) {
                // Branch doesn't exist yet (empty repo)
                this.logger.warn('No branch found, using default: main', 'Git');
                branch = 'main';
            }

            // Get log to check unpushed commits
            let commits: any[] = [];
            try {
                commits = await git.log({ fs, dir, depth: 10 });
            } catch (error) {
                // No commits yet (empty repo)
                this.logger.debug('No commits found (empty repository)', 'Git');
                commits = [];
            }

            this.logger.info(`Status: ${uncommittedChanges} uncommitted changes, branch: ${branch}`, 'Git');
            this.logger.debug(`Recent commits: ${commits.length}`, 'Git');

            return {
                uncommittedChanges,
                unpushedCommits: commits.length, // Simplified - should compare with remote
                hasConflicts: false,
                branch
            };
        } catch (error) {
            this.logger.error(`Failed to get status: ${error}`, 'Git');
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
