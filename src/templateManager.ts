import * as vscode from 'vscode';
import * as path from 'path';
import { Template } from './types';
import { StorageManager } from './utils/storage';
import { formatDate, formatDateTime } from './utils/dateFormatter';

/**
 * Built-in template metadata
 */
const BUILTIN_TEMPLATE_FILES: Array<{ id: string; name: string; file: string }> = [
    {
        id: 'daily-note',
        name: '📅 Daily Note',
        file: 'daily-note.md',
    },
    {
        id: 'travel-journal',
        name: '✈️ Travel Journal',
        file: 'travel-journal.md',
    },
    {
        id: 'meeting-notes',
        name: '📋 Meeting Notes',
        file: 'meeting-notes.md',
    },
    {
        id: 'reading-notes',
        name: '📚 Reading Notes',
        file: 'reading-notes.md',
    },
    {
        id: 'project-plan',
        name: '📊 Project Plan',
        file: 'project-plan.md',
    },
    {
        id: 'blank',
        name: '📄 Blank',
        file: 'blank.md',
    },
];

/**
 * Template manager for managing note templates
 */
export class TemplateManager {
    private readonly templatesDir: string;

    constructor(
        private readonly storageManager: StorageManager,
        extensionPath: string
    ) {
        this.templatesDir = path.join(extensionPath, 'templates');
        this.ensureBuiltInTemplates();
    }

    /**
     * Ensure built-in templates are initialized
     */
    private async ensureBuiltInTemplates(): Promise<void> {
        const existing = await this.getAllTemplates();
        const existingIds = new Set(existing.map(t => t.id));

        const now = Date.now();
        for (const templateMeta of BUILTIN_TEMPLATE_FILES) {
            if (!existingIds.has(templateMeta.id)) {
                // Load template content from file
                const templatePath = path.join(this.templatesDir, templateMeta.file);
                try {
                    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(templatePath));
                    await this.createTemplate({
                        id: templateMeta.id,
                        name: templateMeta.name,
                        content: Buffer.from(content).toString('utf-8'),
                        isBuiltIn: true,
                        createdAt: now,
                    });
                } catch (error) {
                    console.error(`Failed to load built-in template ${templateMeta.id}:`, error);
                }
            }
        }
    }

    /**
     * Get all templates (built-in + custom)
     */
    async getAllTemplates(): Promise<Template[]> {
        const templates = await this.storageManager.getTemplates();
        return templates.sort((a, b) => {
            // Built-in templates first
            if (a.isBuiltIn !== b.isBuiltIn) {
                return a.isBuiltIn ? -1 : 1;
            }
            // Within built-in templates, blank comes first
            if (a.isBuiltIn && b.isBuiltIn) {
                if (a.id === 'blank') return -1;
                if (b.id === 'blank') return 1;
            }
            // Then sort by creation time
            return a.createdAt - b.createdAt;
        });
    }

    /**
     * Get template by ID
     */
    async getTemplate(id: string): Promise<Template | undefined> {
        const templates = await this.getAllTemplates();
        return templates.find(t => t.id === id);
    }

    /**
     * Create a new template
     */
    async createTemplate(template: Omit<Template, 'id' | 'createdAt'> & Partial<Pick<Template, 'id' | 'createdAt'>>): Promise<Template> {
        const now = Date.now();
        const newTemplate: Template = {
            id: template.id || `template-${now}`,
            name: template.name,
            content: template.content,
            isBuiltIn: template.isBuiltIn || false,
            createdAt: template.createdAt || now,
            updatedAt: now,
        };

        await this.storageManager.addTemplate(newTemplate);
        return newTemplate;
    }

    /**
     * Update an existing template
     */
    async updateTemplate(id: string, updates: Partial<Pick<Template, 'name' | 'content'>>): Promise<void> {
        const template = await this.getTemplate(id);
        if (!template) {
            throw new Error(`Template not found: ${id}`);
        }

        if (template.isBuiltIn) {
            throw new Error('Cannot edit built-in template');
        }

        const updatedTemplate: Template = {
            ...template,
            ...updates,
            updatedAt: Date.now(),
        };

        await this.storageManager.updateTemplate(updatedTemplate);
    }

    /**
     * Delete a template (cannot delete built-in templates)
     */
    async deleteTemplate(id: string): Promise<void> {
        const template = await this.getTemplate(id);
        if (!template) {
            throw new Error(`Template not found: ${id}`);
        }

        if (template.isBuiltIn) {
            throw new Error('Cannot delete built-in template');
        }

        await this.storageManager.deleteTemplate(id);
    }

    /**
     * Apply template to create note content with variable substitution
     */
    async applyTemplate(templateId: string, variables?: Record<string, string>): Promise<string> {
        const template = await this.getTemplate(templateId);
        if (!template) {
            throw new Error(`Template not found: ${templateId}`);
        }

        let content = template.content;

        // Apply built-in variables
        const now = Date.now();
        const builtInVars: Record<string, string> = {
            'date': formatDate(now),
            'time': formatDateTime(now).split(' ')[1], // Extract time part
            'datetime': formatDateTime(now),
            'title': variables?.title || 'Untitled',
        };

        // Replace built-in variables
        for (const [key, value] of Object.entries(builtInVars)) {
            content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
        }

        // Replace custom variables
        if (variables) {
            for (const [key, value] of Object.entries(variables)) {
                if (!builtInVars[key]) {
                    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
                }
            }
        }

        return content;
    }
}
