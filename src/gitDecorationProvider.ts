import * as vscode from 'vscode';
import * as git from 'isomorphic-git';
import * as fs from 'fs';
import { Logger } from './utils/logger';
import type { NotebookManager } from './notebookManager';

type GitFileStatus =
    | 'ignored'
    | 'unmodified'
    | '*modified'
    | '*deleted'
    | '*added'
    | 'absent'
    | 'modified'
    | 'deleted'
    | 'added'
    | '*unmodified'
    | '*absent'
    | '*undeleted'
    | '*undeletemodified';

export class GitDecorationProvider implements vscode.FileDecorationProvider {
    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    private readonly logger = Logger.getInstance();
    private readonly fileStatusCache = new Map<string, GitFileStatus>();

    constructor(
        private readonly notebookManager: NotebookManager,
        private readonly storageUri: vscode.Uri
    ) { }

    async provideFileDecoration(
        uri: vscode.Uri
    ): Promise<vscode.FileDecoration | undefined> {
        try {
            const storagePath = this.storageUri.fsPath;
            if (!uri.fsPath.startsWith(storagePath) || !uri.fsPath.endsWith('.md')) {
                return undefined;
            }

            const status = await this.getFileStatus(uri);
            if (!status) {
                return undefined;
            }

            return this.createDecoration(status);
        } catch (error) {
            return undefined;
        }
    }

    private async getFileStatus(uri: vscode.Uri): Promise<GitFileStatus | undefined> {
        const cached = this.fileStatusCache.get(uri.fsPath);
        if (cached) {
            return cached;
        }

        const notebookId = this.getNotebookIdFromUri(uri);
        if (!notebookId) {
            return undefined;
        }

        const notebookUri = vscode.Uri.joinPath(this.storageUri, 'notebooks', notebookId);
        const dir = notebookUri.fsPath;
        const gitDir = vscode.Uri.joinPath(notebookUri, '.git').fsPath;

        if (!fs.existsSync(gitDir)) {
            return undefined;
        }

        try {
            const relativePath = uri.fsPath
                .replace(dir + '\\', '')
                .replace(dir + '/', '')
                .replace(/\\/g, '/');

            const status = await git.status({
                fs,
                dir,
                filepath: relativePath
            }) as GitFileStatus;

            this.fileStatusCache.set(uri.fsPath, status);
            return status;
        } catch (error) {
            return undefined;
        }
    }

    private getNotebookIdFromUri(uri: vscode.Uri): string | undefined {
        const pattern = /notebooks[\\/]([^\\/]+)/;
        const match = pattern.exec(uri.fsPath);
        return match ? match[1] : undefined;
    }

    private createDecoration(status: GitFileStatus): vscode.FileDecoration | undefined {
        switch (status) {
            case 'modified':
            case '*modified':
                return {
                    badge: 'M',
                    color: new vscode.ThemeColor('gitDecoration.modifiedResourceForeground'),
                    tooltip: 'Modified'
                };
            case '*added':
                return {
                    badge: 'A',
                    color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
                    tooltip: 'Added'
                };
            case 'absent':
            case '*deleted':
                return {
                    badge: 'D',
                    color: new vscode.ThemeColor('gitDecoration.deletedResourceForeground'),
                    tooltip: 'Deleted'
                };
            case '*undeleted':
            case '*undeletemodified':
                return {
                    badge: 'U',
                    color: new vscode.ThemeColor('gitDecoration.addedResourceForeground'),
                    tooltip: 'Undeleted'
                };
            case 'ignored':
                return {
                    badge: 'I',
                    color: new vscode.ThemeColor('gitDecoration.ignoredResourceForeground'),
                    tooltip: 'Ignored'
                };
            default:
                return undefined;
        }
    }

    public refresh(): void {
        this.fileStatusCache.clear();
        this._onDidChangeFileDecorations.fire(undefined as any);
    }

    dispose(): void {
        this._onDidChangeFileDecorations.dispose();
        this.fileStatusCache.clear();
    }
}
