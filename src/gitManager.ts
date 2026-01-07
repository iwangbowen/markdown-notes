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
     * Check if credentials are stored for a notebook
     */
    async hasCredentials(notebookId: string): Promise<boolean> {
        const credentials = await this.getCredentials(notebookId);
        return credentials !== undefined;
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
            // Get status matrix to differentiate between added/modified/deleted files
            const statusMatrix = await git.statusMatrix({ fs, dir });

            // Filter files that have changes
            const changedFiles = statusMatrix.filter(
                ([_, head, workdir, stage]) => head !== workdir || head !== stage
            );

            this.logger.debug(`Found ${changedFiles.length} changed files`, 'Git');

            for (const [filepath, , workdir] of changedFiles) {
                if (workdir === 0) {
                    // File deleted (workdir=0 means absent in working directory)
                    this.logger.debug(`Removing file: ${filepath}`, 'Git');
                    await git.remove({ fs, dir, filepath });
                } else {
                    // File added or modified (workdir=1 or 2)
                    this.logger.debug(`Adding file: ${filepath}`, 'Git');
                    await git.add({ fs, dir, filepath });
                }
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
                console.error('No branch found, using default: main', error);
                branch = 'main';
            }

            // Calculate unpushed commits and behind commits by comparing with remote
            let unpushedCommits = 0;
            let behindCommits = 0;
            try {
                // Get local and remote commit IDs
                const localOid = await git.resolveRef({ fs, dir, ref: branch });

                // Try to get remote commits
                try {
                    const remoteOid = await git.resolveRef({ fs, dir, ref: `origin/${branch}` });

                    // If local and remote are different, count unpushed and behind commits
                    if (localOid !== remoteOid) {
                        // Get all local and remote commits
                        const localCommits = await git.log({ fs, dir, ref: branch });
                        const remoteCommits = await git.log({ fs, dir, ref: `origin/${branch}` });

                        // Create sets for fast lookup
                        const localOids = new Set(localCommits.map(c => c.oid));
                        const remoteOids = new Set(remoteCommits.map(c => c.oid));

                        // Count commits in local that are not in remote (unpushed)
                        for (const commit of localCommits) {
                            if (remoteOids.has(commit.oid)) {
                                // Found common ancestor, stop counting
                                break;
                            }
                            unpushedCommits++;
                        }

                        // Count commits in remote that are not in local (behind)
                        for (const commit of remoteCommits) {
                            if (localOids.has(commit.oid)) {
                                // Found common ancestor, stop counting
                                break;
                            }
                            behindCommits++;
                        }
                    }
                } catch {
                    // No remote branch yet (fresh clone or new branch)
                    // All local commits are unpushed
                    const localCommits = await git.log({ fs, dir, ref: branch });
                    unpushedCommits = localCommits.length;
                }
            } catch (error) {
                // No commits yet (empty repo)
                console.debug('No commits found (empty repository)', error);
            }

            this.logger.info(`Status: ${uncommittedChanges} uncommitted, ${unpushedCommits} unpushed, ${behindCommits} behind, branch: ${branch}`, 'Git');

            return {
                uncommittedChanges,
                unpushedCommits,
                behindCommits,
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
            this.logger.error(`Failed to get changed files: ${error}`, 'Git');
            return [];
        }
    }

    /**
     * Get list of changed files with full paths (public method)
     */
    async getChangedFilesWithPaths(notebookId: string): Promise<{ relativePath: string; fullPath: string }[]> {
        const dir = this.getNotebookDir(notebookId);

        try {
            const status = await git.statusMatrix({ fs, dir });

            // Filter files that have changes and map to full paths
            return status
                .filter(([_, head, workdir, stage]) => head !== workdir || head !== stage)
                .map(([filepath]) => ({
                    relativePath: filepath,
                    fullPath: path.join(dir, filepath)
                }));
        } catch (error) {
            this.logger.error(`Failed to get changed files: ${error}`, 'Git');
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

    /**
     * Get Git status for a specific file
     */
    async getFileStatus(notebookId: string, filePath: string): Promise<string | undefined> {
        const dir = this.getNotebookDir(notebookId);

        try {
            // Normalize file path to relative path from notebook root
            const relativePath = path.relative(dir, filePath).split('\\').join('/');

            // Get status for this file
            const status = await git.status({
                fs,
                dir,
                filepath: relativePath
            });

            // Map isomorphic-git status to our status strings
            // status can be: "unmodified", "modified", "added", "deleted", etc.
            return status;
        } catch (error) {
            this.logger.debug(`Failed to get file status for ${filePath}: ${error}`, 'Git');
            return undefined;
        }
    }

    /**
     * Get commit history for a specific file
     */
    async getFileHistory(notebookId: string, filePath: string): Promise<Array<{
        oid: string;
        message: string;
        author: string;
        timestamp: number;
    }>> {
        const dir = this.getNotebookDir(notebookId);

        try {
            // Normalize file path to relative path from notebook root
            const relativePath = path.relative(dir, filePath).split('\\').join('/');

            this.logger.debug(`Getting history for file: ${relativePath}`, 'Git');

            // Get all commits
            const commits = await git.log({
                fs,
                dir,
                depth: 100 // Get last 100 commits
            });

            // Filter commits that touched this file
            const fileCommits = [];
            for (const commit of commits) {
                try {
                    // Walk the tree to find the file
                    const entries = await git.walk({
                        fs,
                        dir,
                        trees: [git.TREE({ ref: commit.oid })],
                        map: async (filepath, [entry]) => {
                            if (filepath === relativePath) {
                                return entry?.oid();
                            }
                            return undefined;
                        }
                    });

                    // If file exists in this commit, include it
                    const fileExists = entries.some((oid: any) => oid !== undefined);
                    if (fileExists) {
                        fileCommits.push({
                            oid: commit.oid,
                            message: commit.commit.message,
                            author: `${commit.commit.author.name} <${commit.commit.author.email}>`,
                            timestamp: commit.commit.author.timestamp * 1000 // Convert to ms
                        });
                    }
                } catch (err) {
                    // Commit might not have this file, skip it
                    this.logger.debug(`Skipping commit ${commit.oid.substring(0, 7)}: ${err}`, 'Git');
                }
            }

            this.logger.info(`Found ${fileCommits.length} commits for file`, 'Git');
            return fileCommits;
        } catch (error) {
            this.logger.error(`Failed to get file history: ${error}`, 'Git');
            throw new Error(`Failed to get file history: ${error}`);
        }
    }

    /**
     * Get file content at a specific commit
     */
    async getFileAtCommit(notebookId: string, filePath: string, commitOid: string): Promise<Uint8Array> {
        const dir = this.getNotebookDir(notebookId);

        try {
            const relativePath = path.relative(dir, filePath).split('\\').join('/');

            this.logger.debug(`Reading file ${relativePath} at commit ${commitOid.substring(0, 7)}`, 'Git');

            // Read object using walk
            const result = await git.walk({
                fs,
                dir,
                trees: [git.TREE({ ref: commitOid })],
                map: async (filepath, [entry]) => {
                    if (filepath === relativePath && entry) {
                        const oid = await entry.oid();
                        const { blob } = await git.readBlob({ fs, dir, oid });
                        return blob;
                    }
                    return undefined;
                }
            });

            const blob = result.find((b: any) => b !== undefined);
            if (!blob) {
                throw new Error('File not found in commit');
            }

            return blob;
        } catch (error) {
            this.logger.error(`Failed to read file at commit: ${error}`, 'Git');
            throw new Error(`Failed to read file at commit: ${error}`);
        }
    }

    /**
     * Reset a file to HEAD version (discard local changes)
     */
    async resetFileToHEAD(notebookId: string, filePath: string): Promise<void> {
        const dir = this.getNotebookDir(notebookId);

        try {
            const relativePath = path.relative(dir, filePath).split('\\').join('/');

            this.logger.info(`Resetting file ${relativePath} to HEAD`, 'Git');

            // Get HEAD commit
            const headOid = await git.resolveRef({ fs, dir, ref: 'HEAD' });

            // Read file content from HEAD
            const result = await git.walk({
                fs,
                dir,
                trees: [git.TREE({ ref: headOid })],
                map: async (filepath, [entry]) => {
                    if (filepath === relativePath && entry) {
                        const oid = await entry.oid();
                        const { blob } = await git.readBlob({ fs, dir, oid });
                        return blob;
                    }
                    return undefined;
                }
            });

            const blob = result.find((b: any) => b !== undefined);
            if (!blob) {
                throw new Error('File not found in HEAD commit');
            }

            // Write the HEAD version back to disk
            await fs.promises.writeFile(filePath, blob);

            this.logger.info(`File ${relativePath} reset to HEAD successfully`, 'Git');
        } catch (error) {
            this.logger.error(`Failed to reset file: ${error}`, 'Git');
            throw new Error(`Failed to reset file: ${error}`);
        }
    }
}
