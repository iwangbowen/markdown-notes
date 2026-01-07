import * as vscode from 'vscode';
import { TemplateManager } from './templateManager';

/**
 * Template preview provider for read-only template viewing
 */
export class TemplatePreviewProvider implements vscode.TextDocumentContentProvider {
    private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    public readonly onDidChange = this._onDidChange.event;

    constructor(
        private readonly templateManager: TemplateManager
    ) { }

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        // Parse template ID from URI (remove leading '/' if present and .md extension)
        let templateId = uri.path.startsWith('/') ? uri.path.substring(1) : uri.path;
        if (templateId.endsWith('.md')) {
            templateId = templateId.substring(0, templateId.length - 3);
        }

        try {
            const template = await this.templateManager.getTemplate(templateId);
            if (!template) {
                return '# Template Not Found\n\nThe requested template could not be found.';
            }

            // Apply template with preview title
            const content = await this.templateManager.applyTemplate(templateId, {
                title: template.name
            });

            // Add header comment
            const header = `<!-- Template Preview: ${template.name} (Read-Only) -->\n` +
                `<!-- This is a read-only preview. To use this template, create a new note and select it. -->\n\n`;

            return header + content;
        } catch (error) {
            return `# Error\n\nFailed to load template: ${error}`;
        }
    }

    /**
     * Open template preview in read-only mode
     */
    async openPreview(templateId: string, templateName: string): Promise<void> {
        // Use template name as URI path (without leading slash for clean tab title)
        const uri = vscode.Uri.parse(`markdown-notes-template:${templateId}.md`);
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, {
            preview: true,
            viewColumn: vscode.ViewColumn.Active
        });
    }

    refresh(uri: vscode.Uri): void {
        this._onDidChange.fire(uri);
    }
}
