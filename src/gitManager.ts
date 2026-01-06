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
    constructor(
        private context: vscode.ExtensionContext,
        private globalStorageUri: vscode.Uri
    ) { }

    /**
     * Get git credentials from secret storage
     */
    private async getCredentials(notebookId: string): Promise<GitCredentials | undefined> {
        const key = `git-auth-${notebookId}`;
        const stored = await this.context.secrets.get(key);

        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return undefined;
            }
        }

        return undefined;
    }

    /**
     * Store git credentials in secret storage
     */
    async storeCredentials(notebookId: string, credentials: GitCredentials): Promise<void> {
        const key = `git-auth-${notebookId}`;
        await this.context.secrets.store(key, JSON.stringify(credentials));
    }

    /**
     * Delete git credentials from secret storage
     */
    async deleteCredentials(notebookId: string): Promise<void> {
        const key = `git-auth-${notebookId}`;
        await this.context.secrets.delete(key);
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

        try {
            // Initialize git
            await git.init({ fs, dir, defaultBranch: config.branch });

            // Configure author
            await git.setConfig({
                fs,
                dir,
                path: 'user.name',
                value: config.author.name
            });

            await git.setConfig({
                fs,
                dir,
                path: 'user.email',
                value: config.author.email
            });

            // Add remote if provided
            if (config.remoteUrl) {
                await git.addRemote({
                    fs,
                    dir,
                    remote: 'origin',
                    url: config.remoteUrl
                });
            }

            vscode.window.showInformationMessage(`Git repository initialized for notebook`);
        } catch (error) {
            throw new Error(`Failed to initialize git: ${error}`);
        }
    }

    /**
     * Clone remote repository
     */
    async cloneRepository(notebookId: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

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
                    console.log(`Cloning: ${progress.phase} ${progress.loaded}/${progress.total}`);
                }
            });

            vscode.window.showInformationMessage(`Repository cloned successfully`);
        } catch (error) {
            throw new Error(`Failed to clone repository: ${error}`);
        }
    }

    /**
     * Commit changes
     */
    async commit(notebookId: string, message: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);

        try {
            // Add all changes
            const files = await this.getChangedFiles(notebookId);

            for (const file of files) {
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

            vscode.window.showInformationMessage(`Changes committed: ${sha.substring(0, 7)}`);
        } catch (error) {
            throw new Error(`Failed to commit: ${error}`);
        }
    }

    /**
     * Pull from remote
     */
    async pull(notebookId: string, config: GitConfig): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

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

            vscode.window.showInformationMessage(`Pulled latest changes from remote`);
        } catch (error) {
            throw new Error(`Failed to pull: ${error}`);
        }
    }

    /**
     * Push to remote
     */
    async push(notebookId: string): Promise<void> {
        const dir = this.getNotebookDir(notebookId);
        const credentials = await this.getCredentials(notebookId);

        try {
            await git.push({
                fs,
                http,
                dir,
                remote: 'origin',
                onAuth: () => credentials || {}
            });

            vscode.window.showInformationMessage(`Pushed changes to remote`);
        } catch (error) {
            throw new Error(`Failed to push: ${error}`);
        }
    }

    /**
     * Sync (pull + push)
     */
    async sync(notebookId: string, config: GitConfig): Promise<void> {
        try {
            await this.pull(notebookId, config);
            await this.push(notebookId);
            vscode.window.showInformationMessage(`Sync completed successfully`);
        } catch (error) {
            throw new Error(`Failed to sync: ${error}`);
        }
    }

    /**
     * Get git status
     */
    async getStatus(notebookId: string): Promise<GitStatus> {
        const dir = this.getNotebookDir(notebookId);

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

            return {
                uncommittedChanges,
                unpushedCommits: commits.length, // Simplified - should compare with remote
                hasConflicts: false, // TODO: Implement conflict detection
                branch
            };
        } catch (error) {
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
