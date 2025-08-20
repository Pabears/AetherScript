/**
 * @fileoverview Service for handling logging across the application.
 * This service defines the interface for logging messages at different levels,
 * retrieving logs, and managing log settings.
 */

/**
 * Defines the severity levels for log messages.
 */
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    VERBOSE = 4
}

/**
 * Represents a single log entry.
 */
export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: string;
    data?: any;
}

/**
 * Abstract class defining the contract for a logging service.
 * Implementations of this class will provide concrete logging mechanisms.
 * @service
 */
export abstract class LoggingService {
    /**
     * Sets the minimum log level to be recorded.
     * For example, if the level is set to INFO, only INFO, WARN, and ERROR messages will be logged.
     * @param level The log level to set.
     */
    abstract setLevel(level: LogLevel): void;

    /**
     * Logs an error message.
     * These are critical issues that need immediate attention.
     * @param message The main log message.
     * @param context Optional context identifier, like a module or component name.
     * @param data Optional additional data to include with the log.
     */
    abstract error(message: string, context?: string, data?: any): void;

    /**
     * Logs a warning message.
     * These are potential issues that don't prevent the application from running.
     * @param message The main log message.
     * @param context Optional context identifier.
     * @param data Optional additional data.
     */
    abstract warn(message: string, context?: string, data?: any): void;

    /**
     * Logs an informational message.
     * These are general messages about application progress.
     * @param message The main log message.
     * @param context Optional context identifier.
     * @param data Optional additional data.
     */
    abstract info(message: string, context?: string, data?: any): void;

    /**
     * Logs a debug message.
     * These are detailed messages useful for debugging.
     * @param message The main log message.
     * @param context Optional context identifier.
     * @param data Optional additional data.
     */
    abstract debug(message: string, context?: string, data?: any): void;

    /**
     * Logs a verbose message.
     * These are highly detailed messages, typically for deep debugging or tracing.
     * @param message The main log message.
     * @param context Optional context identifier.
     * @param data Optional additional data.
     */
    abstract verbose(message: string, context?: string, data?: any): void;

    /**
     * Retrieves all recorded log entries.
     * @returns An array of all log entries.
     */
    abstract getLogs(): LogEntry[];

    /**
     * Clears all recorded log entries from memory.
     */
    abstract clearLogs(): void;

    /**
     * Retrieves all log entries recorded since a specific timestamp.
     * @param timestamp The date and time to filter logs from.
     * @returns An array of log entries.
     */
    abstract getLogsSince(timestamp: Date): LogEntry[];
}
