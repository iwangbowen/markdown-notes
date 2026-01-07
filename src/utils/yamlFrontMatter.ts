/**
 * YAML Front Matter Utilities
 * Parse and generate YAML front matter for Markdown notes
 */

/**
 * Front matter metadata interface
 */
export interface FrontMatter {
    title?: string;
    tags?: string[];
    created?: string;
    updated?: string;
    [key: string]: any;
}

/**
 * Extract YAML front matter from markdown content
 * @param content Markdown file content
 * @returns Parsed front matter object and remaining content
 */
export function parseFrontMatter(content: string): { frontMatter: FrontMatter | null; content: string } {
    const frontMatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontMatterRegex);

    if (!match) {
        return { frontMatter: null, content };
    }

    const yamlContent = match[1];
    const remainingContent = content.slice(match[0].length);

    try {
        const frontMatter = parseYaml(yamlContent);
        return { frontMatter, content: remainingContent };
    } catch (error) {
        // If parsing fails, return null front matter
        return { frontMatter: null, content };
    }
}

/**
 * Simple YAML parser (supports basic key-value and arrays)
 * @param yaml YAML string
 * @returns Parsed object
 */
function parseYaml(yaml: string): FrontMatter {
    const result: FrontMatter = {};
    const lines = yaml.split('\n');
    let currentKey: string | null = null;
    const arrayValues: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        // Skip empty lines
        if (!trimmed) {
            continue;
        }

        // Array item
        if (trimmed.startsWith('- ')) {
            if (currentKey) {
                arrayValues.push(trimmed.slice(2).trim());
            }
            continue;
        }

        // Flush array if we have one
        if (currentKey && arrayValues.length > 0) {
            result[currentKey] = [...arrayValues];
            arrayValues.length = 0;
        }

        // Key-value pair
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex !== -1) {
            const key = trimmed.slice(0, colonIndex).trim();
            const value = trimmed.slice(colonIndex + 1).trim();

            currentKey = key;

            // Check if value is an inline array [tag1, tag2]
            if (value.startsWith('[') && value.endsWith(']')) {
                const items = value
                    .slice(1, -1)
                    .split(',')
                    .map(item => item.trim())
                    .filter(item => item);
                result[key] = items;
                currentKey = null;
            } else if (value) {
                // Single value
                result[key] = value;
                currentKey = null;
            }
            // If value is empty, expect array items on next lines
        }
    }

    // Flush remaining array
    if (currentKey && arrayValues.length > 0) {
        result[currentKey] = [...arrayValues];
    }

    return result;
}

/**
 * Generate YAML front matter string
 * @param frontMatter Front matter object
 * @returns YAML string with delimiters
 */
export function generateFrontMatter(frontMatter: FrontMatter): string {
    if (!frontMatter || Object.keys(frontMatter).length === 0) {
        return '';
    }

    const lines: string[] = ['---'];

    for (const [key, value] of Object.entries(frontMatter)) {
        if (value === undefined || value === null) {
            continue;
        }

        if (Array.isArray(value)) {
            if (value.length === 0) {
                lines.push(`${key}: []`);
            } else if (value.length === 1) {
                lines.push(`${key}: [${value[0]}]`);
            } else {
                // Multi-line array for better readability
                lines.push(`${key}:`);
                for (const item of value) {
                    lines.push(`  - ${item}`);
                }
            }
        } else {
            lines.push(`${key}: ${value}`);
        }
    }

    lines.push('---');
    lines.push(''); // Add blank line after front matter

    return lines.join('\n');
}

/**
 * Update or add front matter to markdown content
 * @param content Original markdown content
 * @param updates Front matter updates
 * @returns Updated content
 */
export function updateFrontMatter(content: string, updates: Partial<FrontMatter>): string {
    const { frontMatter, content: remainingContent } = parseFrontMatter(content);

    const newFrontMatter: FrontMatter = {
        ...frontMatter,
        ...updates
    };

    return generateFrontMatter(newFrontMatter) + remainingContent;
}

/**
 * Extract tags from front matter
 * @param content Markdown content
 * @returns Array of tags
 */
export function extractTags(content: string): string[] {
    const { frontMatter } = parseFrontMatter(content);

    if (!frontMatter || !frontMatter.tags) {
        return [];
    }

    const tags = frontMatter.tags;

    if (Array.isArray(tags)) {
        return tags.filter(tag => typeof tag === 'string');
    } else if (typeof tags === 'string') {
        // Handle comma-separated tags
        return tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    return [];
}
