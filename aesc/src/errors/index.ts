/**
 * Base error class for AetherScript
 */
export class AescError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AescError'
  }
}

/**
 * Provider related errors
 */
export class ProviderError extends AescError {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderError'
  }
}

/**
 * File operation related errors
 */
export class FileError extends AescError {
  constructor(message: string, public path?: string) {
    super(message)
    this.name = 'FileError'
  }
}

/**
 * Configuration related errors
 */
export class ConfigError extends AescError {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/**
 * Error during code generation
 */
export class GenerationError extends AescError {
  constructor(message: string) {
    super(message)
    this.name = 'GenerationError'
  }
}

/**
 * Type to represent a function that might throw an error
 */
type Fallible<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => ReturnType<T>

/**
 * Type to represent a function that returns a result object with either a value or an error
 */
type Result<T, E> = { value: T; error: null } | { value: null; error: E }

/**
 * Type to represent a function that has been wrapped to handle errors gracefully
 */
type Safe<T extends (...args: any[]) => any> = (
  ...args: Parameters<T>
) => Result<ReturnType<T>, Error>

/**
 * Higher-order function to wrap a fallible function and return a result object
 * @param fn The function to wrap
 * @returns A new function that returns a result object instead of throwing
 */
export function makeSafe<T extends (...args: any[]) => any>(
  fn: Fallible<T>,
): Safe<T> {
  return (...args: Parameters<T>): Result<ReturnType<T>, Error> => {
    try {
      const value = fn(...args)
      return { value, error: null }
    } catch (e: unknown) {
      return { value: null, error: e instanceof Error ? e : new Error(String(e)) }
    }
  }
}

/**
 * Higher-order function to wrap an async fallible function
 * @param fn The async function to wrap
 * @returns A new async function that returns a result object
 */
export function makeSafeAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => Promise<Result<Awaited<ReturnType<T>>, Error>> {
  return async (
    ...args: Parameters<T>
  ): Promise<Result<Awaited<ReturnType<T>>, Error>> => {
    try {
      const value = await fn(...args)
      return { value, error: null }
    } catch (e: unknown) {
      return { value: null, error: e instanceof Error ? e : new Error(String(e)) }
    }
  }
}

/**
 * Higher-order function to add logging and error suppression to a function
 * @param fn The function to wrap
 * @param options Configuration for logging and error handling
 * @returns A new function with added logging and error suppression
 */
export function withLogging<T extends (...args: any[]) => any>(
  fn: T,
  options: {
    verbose?: boolean
    startMessage?: string
    endMessage?: string
    errorMessage?: string
    suppressErrors?: boolean
  },
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  return (...args: Parameters<T>) => {
    if (options.verbose && options.startMessage) {
      console.log(options.startMessage)
    }
    try {
      const result = fn(...args)
      if (options.verbose && options.endMessage) {
        console.log(options.endMessage)
      }
      return result as ReturnType<T>
    } catch (error) {
      const errorMessage =
        options.errorMessage || 'An unexpected error occurred'
      console.error(`${errorMessage}:`, error)
      if (options.suppressErrors) {
        return undefined
      }
      throw error
    }
  }
}
