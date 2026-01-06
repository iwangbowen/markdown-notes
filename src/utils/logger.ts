import * as vscode from 'vscode';

/**
 * 日志级别
 */
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

/**
 * 统一的日志管理器
 */
export class Logger {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Markdown Notes');
    }

    /**
     * 获取单例实例
     */
    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * 格式化时间戳为24小时制本地时间
     */
    private formatTimestamp(): string {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    /**
     * 记录日志
     */
    log(message: string, level: LogLevel = LogLevel.INFO, category?: string): void {
        const timestamp = this.formatTimestamp();
        const categoryPrefix = category ? `[${category}] ` : '';
        const logMessage = `[${timestamp}] [${level}] ${categoryPrefix}${message}`;
        this.outputChannel.appendLine(logMessage);
    }

    /**
     * DEBUG 级别日志
     */
    debug(message: string, category?: string): void {
        this.log(message, LogLevel.DEBUG, category);
    }

    /**
     * INFO 级别日志
     */
    info(message: string, category?: string): void {
        this.log(message, LogLevel.INFO, category);
    }

    /**
     * WARN 级别日志
     */
    warn(message: string, category?: string): void {
        this.log(message, LogLevel.WARN, category);
    }

    /**
     * ERROR 级别日志
     */
    error(message: string, category?: string): void {
        this.log(message, LogLevel.ERROR, category);
        this.show(); // 错误时自动显示
    }

    /**
     * 显示 Output Channel
     */
    show(): void {
        this.outputChannel.show();
    }

    /**
     * 清空日志
     */
    clear(): void {
        this.outputChannel.clear();
    }
}
