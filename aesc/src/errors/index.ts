/**
 * Error handling utilities for AetherScript
 */

/**
 * Base error class for AetherScript
 */
export class AescError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: any
    ) {
        super(message);
        this.name = 'AescError';
    }
}

/**
 * Code generation related errors
 */
export class GenerationError extends AescError {
    constructor(message: string, details?: any) {
        super(message, 'GENERATION_ERROR', details);
        this.name = 'GenerationError';
    }
}

/**
 * Provider related errors
 */
export class ProviderError extends AescError {
    constructor(message: string, details?: any) {
        super(message, 'PROVIDER_ERROR', details);
        this.name = 'ProviderError';
    }
}

/**
 * Configuration related errors
 */
export class ConfigError extends AescError {
    constructor(message: string, details?: any) {
        super(message, 'CONFIG_ERROR', details);
        this.name = 'ConfigError';
    }
}

/**
 * File system related errors
 */
export class FileSystemError extends AescError {
    constructor(message: string, details?: any) {
        super(message, 'FILESYSTEM_ERROR', details);
        this.name = 'FileSystemError';
    }
}

/**
 * Validation related errors
 */
export class ValidationError extends AescError {
    constructor(message: string, details?: any) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
    /**
     * Handle and format errors for user display
     */
    static handle(error: unknown, context?: string): void {
        const prefix = context ? `[${context}] ` : '';
        
        if (error instanceof AescError) {
            console.error(`❌ ${prefix}${error.message}`);
            if (error.details) {
                console.error(`   Details: ${JSON.stringify(error.details, null, 2)}`);
            }
        } else if (error instanceof Error) {
            console.error(`❌ ${prefix}${error.message}`);
            if (process.env.NODE_ENV === 'development') {
                console.error(error.stack);
            }
        } else {
            console.error(`❌ ${prefix}Unknown error:`, error);
        }
    }

    /**
     * Wrap a function with error handling
     */
    static wrap<T extends (...args: any[]) => any>(
        fn: T,
        context?: string
    ): (...args: Parameters<T>) => ReturnType<T> {
        return (...args: Parameters<T>): ReturnType<T> => {
            try {
                const result = fn(...args);
                
                // Handle async functions
                if (result instanceof Promise) {
                    return result.catch((error) => {
                        ErrorHandler.handle(error, context);
                        throw error;
                    }) as ReturnType<T>;
                }
                
                return result;
            } catch (error) {
                ErrorHandler.handle(error, context);
                throw error;
            }
        };
    }

    /**
     * Create a safe version of a function that doesn't throw
     */
    static safe<T extends (...args: any[]) => any>(
        fn: T,
        fallback?: ReturnType<T>
    ): (...args: Parameters<T>) => ReturnType<T> | undefined {
        return (...args: Parameters<T>) => {
            try {
                return fn(...args);
            } catch {
                return fallback;
            }
        };
    }
}
