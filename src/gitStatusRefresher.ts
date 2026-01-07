import * as vscode from 'vscode';
import { NoteTreeProvider } from './noteTreeProvider';
import { Logger } from './utils/logger';

/**
 * Git status auto refresher
 * Manages periodic Git status updates with user-configurable interval
 */
export class GitStatusRefresher {
    private interval: NodeJS.Timeout | undefined;
    private readonly logger = Logger.getInstance();

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly treeProvider: NoteTreeProvider
    ) { }

    /**
     * Start auto refresh based on user settings
     */
    start(): void {
        const config = vscode.workspace.getConfiguration('markdownNotes.git');
        let intervalSeconds = config.get<number>('autoRefreshInterval', 30);

        // Validate and normalize interval value
        if (intervalSeconds <= 0) {
            this.logger.info('Auto refresh disabled (interval <= 0)', 'GitRefresh');
            return;
        }

        if (intervalSeconds < 10) {
            this.logger.warn(`Refresh interval ${intervalSeconds}s is too small, using minimum: 10s`, 'GitRefresh');
            intervalSeconds = 10;
            void vscode.window.showWarningMessage(
                'Git auto refresh interval is too small. Using minimum value: 10 seconds.'
            );
        } else if (intervalSeconds > 300) {
            this.logger.warn(`Refresh interval ${intervalSeconds}s is too large, using maximum: 300s`, 'GitRefresh');
            intervalSeconds = 300;
            void vscode.window.showWarningMessage(
                'Git auto refresh interval is too large. Using maximum value: 300 seconds (5 minutes).'
            );
        }

        this.stop(); // Clear existing interval if any

        const intervalMs = intervalSeconds * 1000;
        this.logger.info(`Starting auto refresh (interval: ${intervalSeconds}s)`, 'GitRefresh');

        this.interval = setInterval(() => {
            this.refreshGitStatus().catch(error => {
                this.logger.error(`Auto refresh failed: ${error}`, 'GitRefresh');
            });
        }, intervalMs);

        this.context.subscriptions.push({
            dispose: () => this.stop()
        });
    }

    /**
     * Stop auto refresh
     */
    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = undefined;
            this.logger.debug('Auto refresh stopped', 'GitRefresh');
        }
    }

    /**
     * Refresh Git status for all notebooks
     */
    private async refreshGitStatus(): Promise<void> {
        const config = vscode.workspace.getConfiguration('markdownNotes.git');
        const showIndicator = config.get<boolean>('showSyncIndicator', true);

        this.logger.debug('Auto refreshing Git status...', 'GitRefresh');

        try {
            if (showIndicator) {
                // Show non-intrusive status bar indicator
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Window,  // Status bar location
                    title: '$(sync~spin) Syncing Git status...',
                    cancellable: false
                }, async () => {
                    await this.treeProvider.refreshGitStatus();

                    // Brief delay to show completion state
                    await new Promise(resolve => setTimeout(resolve, 500));
                });
            } else {
                // Silent refresh
                await this.treeProvider.refreshGitStatus();
            }

            this.logger.debug('Git status refreshed successfully', 'GitRefresh');
        } catch (error) {
            this.logger.error(`Failed to refresh Git status: ${error}`, 'GitRefresh');
        }
    }

    /**
     * Restart with new settings
     */
    restart(): void {
        this.logger.info('Restarting auto refresh with new settings', 'GitRefresh');
        this.start();
    }

    /**
     * Check if auto refresh is currently enabled
     */
    isEnabled(): boolean {
        return this.interval !== undefined;
    }
}
