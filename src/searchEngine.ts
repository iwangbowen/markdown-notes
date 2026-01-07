import * as vscode from 'vscode';
import { NotebookManager } from './notebookManager';
import { Logger } from './utils/logger';

/**
 * Search options for configuring search behavior
 */
export interface SearchOptions {
    query: string;                    // Search keyword or pattern
    caseSensitive?: boolean;          // Case-sensitive search, default: false
    useRegex?: boolean;               // Use regular expression, default: false
    tags?: string[];                  // Filter by tags (OR logic: match any tag)
    scope?: {                         // Search scope (optional)
        notebookId?: string;           // Limit to specific notebook
        folderPath?: string;           // Limit to specific folder
    };
}

/**
 * Single match within a line
 */
export interface SearchMatch {
    lineNumber: number;               // Line number (1-based)
    lineText: string;                 // Full line text
    matchStart: number;               // Match start position in line
    matchEnd: number;                 // Match end position in line
}

/**
 * Search result for a single note
 */
export interface SearchResult {
    noteUri: vscode.Uri;              // Note file URI
    notebookId: string;               // Parent notebook ID
    notebookName: string;             // Parent notebook name
    noteName: string;                 // Note filename (without .md)
    folderPath: string;               // Folder path (empty string for root)
    tags?: string[];                  // Tags from note front matter
    matches: SearchMatch[];           // All matches in this note
}

/**
 * Search engine for finding text in notes
 */
export class SearchEngine {
    private readonly logger = Logger.getInstance();

    constructor(
        private readonly notebookManager: NotebookManager
    ) { }

    /**
     * Search for text across notes
     * @param options Search configuration
     * @returns Array of search results
     */
    async search(options: SearchOptions): Promise<SearchResult[]> {
        this.logger.info(`Searching for: "${options.query}"`, 'Search');
        const startTime = Date.now();

        const results: SearchResult[] = [];

        try {
            // Get notebooks to search
            const notebooks = await this.getNotebooksToSearch(options);

            // Search each notebook
            for (const notebook of notebooks) {
                // Get all notes recursively
                const notes = await this.getAllNotesRecursively(
                    notebook.id,
                    options.scope?.folderPath || ''
                );

                // Search each note
                for (const note of notes) {
                    // Filter by tags if specified
                    if (options.tags && options.tags.length > 0) {
                        const noteTags = note.tags || [];
                        const hasMatchingTag = options.tags.some(tag =>
                            noteTags.some(noteTag =>
                                noteTag.toLowerCase() === tag.toLowerCase()
                            )
                        );
                        if (!hasMatchingTag) {
                            continue;
                        }
                    }

                    const noteResults = await this.searchNote(note.uri, options);

                    if (noteResults.matches.length > 0) {
                        results.push({
                            ...noteResults,
                            notebookId: notebook.id,
                            notebookName: notebook.name,
                            noteName: note.name,
                            folderPath: note.folderPath,
                            tags: note.tags
                        });
                    }
                }
            }

            const duration = Date.now() - startTime;
            this.logger.info(
                `Search completed: ${results.length} results in ${duration}ms`,
                'Search'
            );

            return results;
        } catch (error) {
            this.logger.error(`Search failed: ${error}`, 'Search');
            throw error;
        }
    }

    /**
     * Get all notes recursively from a folder
     */
    private async getAllNotesRecursively(
        notebookId: string,
        folderPath: string
    ): Promise<Array<{ uri: string; name: string; folderPath: string }>> {
        const allNotes: Array<{ uri: string; name: string; folderPath: string }> = [];
        const notebookUri = this.notebookManager['storageManager'].getNotebookUri(notebookId);
        const startUri = folderPath
            ? vscode.Uri.joinPath(notebookUri, folderPath)
            : notebookUri;

        await this.scanDirectory(startUri, notebookId, folderPath, allNotes);
        return allNotes;
    }

    /**
     * Recursively scan directory for notes
     */
    private async scanDirectory(
        dirUri: vscode.Uri,
        notebookId: string,
        currentPath: string,
        notes: Array<{ uri: string; name: string; folderPath: string }>
    ): Promise<void> {
        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);

            for (const [name, type] of entries) {
                // Skip hidden files and folders
                if (name.startsWith('.')) {
                    continue;
                }

                if (type === vscode.FileType.File && name.endsWith('.md')) {
                    // Found a note
                    const noteUri = vscode.Uri.joinPath(dirUri, name);
                    const fileUri = vscode.Uri.file(noteUri.fsPath);
                    notes.push({
                        uri: fileUri.toString(),
                        name: name.replace(/\.md$/, ''),
                        folderPath: currentPath
                    });
                } else if (type === vscode.FileType.Directory) {
                    // Recursively search subdirectory
                    const subDirPath = currentPath ? `${currentPath}/${name}` : name;
                    const subDirUri = vscode.Uri.joinPath(dirUri, name);
                    await this.scanDirectory(subDirUri, notebookId, subDirPath, notes);
                }
            }
        } catch (error) {
            this.logger.debug(`Failed to scan directory ${dirUri.fsPath}: ${error}`, 'Search');
        }
    }

    /**
     * Get notebooks to search based on scope
     */
    private async getNotebooksToSearch(options: SearchOptions) {
        const allNotebooks = await this.notebookManager.getNotebooks();

        if (options.scope?.notebookId) {
            return allNotebooks.filter(nb => nb.id === options.scope!.notebookId);
        }

        return allNotebooks;
    }

    /**
     * Search within a single note file
     */
    private async searchNote(
        noteUri: string,
        options: SearchOptions
    ): Promise<{ noteUri: vscode.Uri; matches: SearchMatch[] }> {
        const uri = vscode.Uri.parse(noteUri);
        const matches: SearchMatch[] = [];

        try {
            // Read file content
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            const lines = text.split('\n');

            // Prepare search pattern
            const pattern = this.createSearchPattern(options);

            // Search each line
            lines.forEach((line, index) => {
                const lineNumber = index + 1;
                let match: RegExpExecArray | null;

                // Reset regex lastIndex for global search
                pattern.lastIndex = 0;

                while ((match = pattern.exec(line)) !== null) {
                    matches.push({
                        lineNumber,
                        lineText: line,
                        matchStart: match.index,
                        matchEnd: match.index + match[0].length
                    });

                    // Prevent infinite loop for zero-length matches
                    if (match.index === pattern.lastIndex) {
                        pattern.lastIndex++;
                    }

                    // For non-global patterns, break after first match
                    if (!pattern.global) {
                        break;
                    }
                }
            });

            return { noteUri: uri, matches };
        } catch (error) {
            this.logger.debug(`Failed to search note ${uri.fsPath}: ${error}`, 'Search');
            return { noteUri: uri, matches: [] };
        }
    }

    /**
     * Create regex pattern based on search options
     */
    private createSearchPattern(options: SearchOptions): RegExp {
        let pattern = options.query;

        // Escape special regex characters if not using regex mode
        if (!options.useRegex) {
            pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        // Build regex flags
        const flags = 'g' + (options.caseSensitive ? '' : 'i');

        try {
            return new RegExp(pattern, flags);
        } catch (error) {
            // If regex is invalid, treat as literal string
            this.logger.warn(`Invalid regex pattern, treating as literal: ${error}`, 'Search');
            const escaped = options.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return new RegExp(escaped, flags);
        }
    }
}
