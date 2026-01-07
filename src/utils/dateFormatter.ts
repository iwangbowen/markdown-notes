/**
 * Date formatting utilities
 * Provides consistent date/time formatting across the extension
 * All times are displayed in LOCAL timezone (not UTC)
 */

/**
 * Format timestamp to ISO-like format in LOCAL timezone (not UTC)
 * @param timestamp Unix timestamp (milliseconds) or Date object
 * @returns Formatted string in "YYYY-MM-DD HH:MM:SS" format (local time)
 * @example
 * formatDateTime(1736156196000) // "2026-01-07 17:16:36" (if local is UTC+8)
 * formatDateTime(new Date()) // "2026-01-07 17:16:36" (local time)
 */
export function formatDateTime(timestamp: number | Date): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;

    // Get local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format date only (no time) in ISO format in LOCAL timezone
 * @param timestamp Unix timestamp (milliseconds) or Date object
 * @returns Formatted string in "YYYY-MM-DD" format (local date)
 * @example
 * formatDate(1736156196000) // "2026-01-07" (local date)
 * formatDate(new Date()) // "2026-01-07" (local date)
 */
export function formatDate(timestamp: number | Date): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;

    // Get local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Format relative date for display (e.g., "Today", "Yesterday", "3d ago", or absolute date)
 * Uses LOCAL timezone for all comparisons
 * @param timestamp Unix timestamp (milliseconds) or Date object
 * @returns Human-readable relative or absolute date string
 * @example
 * formatRelativeDate(Date.now()) // "Today"
 * formatRelativeDate(Date.now() - 86400000) // "Yesterday"
 * formatRelativeDate(Date.now() - 259200000) // "3d ago"
 * formatRelativeDate(Date.now() - 864000000) // "2026-01-01" (local date)
 */
export function formatRelativeDate(timestamp: number | Date): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return 'Today';
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return `${days}d ago`;
    } else {
        return formatDate(date);
    }
}
