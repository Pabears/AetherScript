import { LoggingService } from '../services/logging-service';
import type { LogLevel, LogEntry } from '../types';
import { logger as originalLogger } from '../logging';

/**
 * @class LoggingServiceImpl
 * @description
 * Concrete implementation of the LoggingService.
 * It wraps the original singleton logger instance from `src/logging/index.ts`.
 */
export class LoggingServiceImpl extends LoggingService {
    setLevel(level: LogLevel): void {
        originalLogger.setLevel(level);
    }

    error(message: string, context?: string, data?: any): void {
        originalLogger.error(message, context, data);
    }

    warn(message: string, context?: string, data?: any): void {
        originalLogger.warn(message, context, data);
    }

    info(message: string, context?: string, data?: any): void {
        originalLogger.info(message, context, data);
    }

    debug(message: string, context?: string, data?: any): void {
        originalLogger.debug(message, context, data);
    }

    verbose(message: string, context?: string, data?: any): void {
        originalLogger.verbose(message, context, data);
    }

    getLogs(): LogEntry[] {
        return originalLogger.getLogs();
    }

    clearLogs(): void {
        originalLogger.clearLogs();
    }
}
