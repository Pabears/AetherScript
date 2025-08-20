import type { LogLevel, LogEntry } from '../types';

/**
 * @abstract
 * @class LoggingService
 * @description
 * Service for handling all logging within the application.
 * It supports different log levels and provides methods to retrieve log history.
 */
export abstract class LoggingService {
    /**
     * @abstract
     * @method setLevel
     * @description Sets the minimum log level to be recorded.
     * @param {LogLevel} level - The minimum log level.
     */
    abstract setLevel(level: LogLevel): void;

    /**
     * @abstract
     * @method error
     * @description Logs an error message.
     * @param {string} message - The message to log.
     * @param {string} [context] - Optional context information.
     * @param {any} [data] - Optional additional data to log.
     */
    abstract error(message: string, context?: string, data?: any): void;

    /**
     * @abstract
     * @method warn
     * @description Logs a warning message.
     * @param {string} message - The message to log.
     * @param {string} [context] - Optional context information.
     * @param {any} [data] - Optional additional data to log.
     */
    abstract warn(message: string, context?: string, data?: any): void;

    /**
     * @abstract
     * @method info
     * @description Logs an informational message.
     * @param {string} message - The message to log.
     * @param {string} [context] - Optional context information.
     * @param {any} [data] - Optional additional data to log.
     */
    abstract info(message: string, context?: string, data?: any): void;

    /**
     * @abstract
     * @method debug
     * @description Logs a debug message.
     * @param {string} message - The message to log.
     * @param {string} [context] - Optional context information.
     * @param {any} [data] - Optional additional data to log.
     */
    abstract debug(message: string, context?: string, data?: any): void;

    /**
     * @abstract
     * @method verbose
     * @description Logs a verbose message.
     * @param {string} message - The message to log.
     * @param {string} [context] - Optional context information.
     * @param {any} [data] - Optional additional data to log.
     */
    abstract verbose(message: string, context?: string, data?: any): void;

    /**
     * @abstract
     * @method getLogs
     * @description Retrieves all recorded log entries.
     * @returns {LogEntry[]} An array of all log entries.
     */
    abstract getLogs(): LogEntry[];

    /**
     * @abstract
     * @method clearLogs
     * @description Clears all recorded log entries from memory.
     */
    abstract clearLogs(): void;
}
