/**
 * Enum for log levels.
 */
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    VERBOSE = 4
}

/**
 * Interface for a log entry.
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: string;
    data?: any;
}

/**
 * Abstract class for a logging service.
 * This service is responsible for handling all logging within the application.
 */
export abstract class LoggingService {
    /**
     * Sets the minimum log level to output.
     * @param level The log level to set.
     */
    abstract setLevel(level: LogLevel): void;

    /**
     * Logs an error message.
     * @param message The message to log.
     * @param context Optional context string.
     * @param data Optional additional data.
     */
    abstract error(message: string, context?: string, data?: any): void;

    /**
     * Logs a warning message.
     * @param message The message to log.
     * @param context Optional context string.
     * @param data Optional additional data.
     */
    abstract warn(message: string, context?: string, data?: any): void;

    /**
     * Logs an info message.
     * @param message The message to log.
     * @param context Optional context string.
     * @param data Optional additional data.
     */
    abstract info(message: string, context?: string, data?: any): void;

    /**
     * Logs a debug message.
     * @param message The message to log.
     * @param context Optional context string.
     * @param data Optional additional data.
     */
    abstract debug(message: string, context?: string, data?: any): void;

    /**
     * Logs a verbose message.
     * @param message The message to log.
     * @param context Optional context string.
     * @param data Optional additional data.
     */
    abstract verbose(message: string, context?: string, data?: any): void;

    /**
     * Retrieves all log entries.
     * @returns An array of log entries.
     */
    abstract getLogs(): LogEntry[];

    /**
     * Clears all stored log entries.
     */
    abstract clearLogs(): void;

    /**
     * Retrieves log entries created since a specific timestamp.
     * @param timestamp The timestamp to filter logs by.
     * @returns An array of log entries.
     */
    abstract getLogsSince(timestamp: Date): LogEntry[];
}
