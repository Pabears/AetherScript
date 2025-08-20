import { LoggingService, LogLevel, LogEntry } from '../services/logging-service';
import { Logger } from '../logging';

/**
 * Concrete implementation of the LoggingService.
 * It uses the original Logger class.
 */
export class LoggingServiceImpl extends LoggingService {
    private logger = Logger.getInstance();

    setLevel(level: LogLevel): void {
        this.logger.setLevel(level);
    }

    error(message: string, context?: string, data?: any): void {
        this.logger.error(message, context, data);
    }

    warn(message: string, context?: string, data?: any): void {
        this.logger.warn(message, context, data);
    }

    info(message: string, context?: string, data?: any): void {
        this.logger.info(message, context, data);
    }

    debug(message: string, context?: string, data?: any): void {
        this.logger.debug(message, context, data);
    }

    verbose(message: string, context?: string, data?: any): void {
        this.logger.verbose(message, context, data);
    }

    getLogs(): LogEntry[] {
        return this.logger.getLogs();
    }

    clearLogs(): void {
        this.logger.clearLogs();
    }

    getLogsSince(timestamp: Date): LogEntry[] {
        return this.logger.getLogsSince(timestamp);
    }
}
