import { LoggingService, LogLevel } from '../services/LoggingService';
import type { LogEntry } from '../services/LoggingService';

/**
 * Concrete implementation of the LoggingService.
 * This class handles all logging within the application.
 */
export class LoggingServiceImpl implements LoggingService {
    private logLevel: LogLevel = LogLevel.INFO;
    private logs: LogEntry[] = [];

    constructor() {}

    public setLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    private log(level: LogLevel, message: string, context?: string, data?: any): void {
        if (level <= this.logLevel) {
            const entry: LogEntry = {
                level,
                message,
                timestamp: new Date(),
                context,
                data
            };

            this.logs.push(entry);
            this.output(entry);
        }
    }

    private output(entry: LogEntry): void {
        const timestamp = entry.timestamp.toLocaleTimeString();
        const levelName = LogLevel[entry.level];
        const context = entry.context ? `[${entry.context}] ` : '';
        const message = `${timestamp} ${levelName} ${context}${entry.message}`;

        switch (entry.level) {
            case LogLevel.ERROR:
                console.error(`❌ ${message}`);
                break;
            case LogLevel.WARN:
                console.warn(`⚠️  ${message}`);
                break;
            case LogLevel.INFO:
                console.log(`ℹ️  ${message}`);
                break;
            case LogLevel.DEBUG:
                console.log(`🐛 ${message}`);
                break;
            case LogLevel.VERBOSE:
                console.log(`📝 ${message}`);
                break;
        }

        if (entry.data) {
            console.log('   Data:', JSON.stringify(entry.data, null, 2));
        }
    }

    public error(message: string, context?: string, data?: any): void {
        this.log(LogLevel.ERROR, message, context, data);
    }

    public warn(message: string, context?: string, data?: any): void {
        this.log(LogLevel.WARN, message, context, data);
    }

    public info(message: string, context?: string, data?: any): void {
        this.log(LogLevel.INFO, message, context, data);
    }

    public debug(message: string, context?: string, data?: any): void {
        this.log(LogLevel.DEBUG, message, context, data);
    }

    public verbose(message: string, context?: string, data?: any): void {
        this.log(LogLevel.VERBOSE, message, context, data);
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public clearLogs(): void {
        this.logs = [];
    }

    public getLogsSince(timestamp: Date): LogEntry[] {
        return this.logs.filter(log => log.timestamp >= timestamp);
    }
}
