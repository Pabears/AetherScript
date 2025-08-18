/**
 * Logging utilities for AetherScript
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: Date
  context?: string
  data?: unknown
}

/**
 * Simple logger for AetherScript
 */
export class Logger {
  private static instance: Logger
  private logLevel: LogLevel = LogLevel.INFO
  private logs: LogEntry[] = []

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level
  }

  private log(
    level: LogLevel,
    message: string,
    context?: string,
    data?: unknown,
  ): void {
    if (level <= this.logLevel) {
      const entry: LogEntry = {
        level,
        message,
        timestamp: new Date(),
        context,
        data,
      }

      this.logs.push(entry)
      this.output(entry)
    }
  }

  private output(entry: LogEntry): void {
    const timestamp = entry.timestamp.toLocaleTimeString()
    const levelName = LogLevel[entry.level]
    const context = entry.context ? `[${entry.context}] ` : ''
    const message = `${timestamp} ${levelName} ${context}${entry.message}`

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(`❌ ${message}`)
        break
      case LogLevel.WARN:
        console.warn(`⚠️  ${message}`)
        break
      case LogLevel.INFO:
        console.log(`ℹ️  ${message}`)
        break
      case LogLevel.DEBUG:
        console.log(`🐛 ${message}`)
        break
      case LogLevel.VERBOSE:
        console.log(`📝 ${message}`)
        break
    }

    if (entry.data) {
      console.log('   Data:', JSON.stringify(entry.data, null, 2))
    }
  }

  error(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, context, data)
  }

  warn(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, context, data)
  }

  info(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, context, data)
  }

    debug(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, context, data)
  }

  verbose(message: string, context?: string, data?: unknown): void {
    this.log(LogLevel.VERBOSE, message, context, data)
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  clearLogs(): void {
    this.logs = []
  }

  getLogsSince(timestamp: Date): LogEntry[] {
    return this.logs.filter((log) => log.timestamp >= timestamp)
  }
}

// Export singleton instance
export const logger = Logger.getInstance()

// Convenience functions
export const log = {
  error: (message: string, context?: string, data?: unknown) =>
    logger.error(message, context, data),
  warn: (message: string, context?: string, data?: unknown) =>
    logger.warn(message, context, data),
  info: (message: string, context?: string, data?: unknown) =>
    logger.info(message, context, data),
    debug: (message: string, context?: string, data?: unknown) =>
    logger.debug(message, context, data),
  verbose: (message: string, context?: string, data?: unknown) =>
    logger.verbose(message, context, data),
}
