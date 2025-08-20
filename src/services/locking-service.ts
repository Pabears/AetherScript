/**
 * @fileoverview Service for managing file and directory locks to prevent
 * accidental modification of generated or managed code.
 */

/**
 * Abstract class defining the contract for a locking service.
 * Implementations will handle the reading and writing of a lock file.
 * @service
 */
export abstract class LockingService {
    /**
     * Retrieves the list of all currently locked file paths.
     * @returns An array of absolute file paths.
     */
    abstract getLockedFiles(): string[];

    /**
     * Checks if a specific file is locked.
     * @param filePath The path to the file to check.
     * @returns True if the file is locked, false otherwise.
     */
    abstract isLocked(filePath: string): boolean;

    /**
     * Locks a specific file.
     * @param filePath The path to the file to lock.
     */
    abstract lockFile(filePath: string): void;

    /**
     * Unlocks a specific file.
     * @param filePath The path to the file to unlock.
     */
    abstract unlockFile(filePath: string): void;

    /**
     * Locks all `.ts` files within a given directory.
     * @param dirPath The path to the directory to lock.
     */
    abstract lockDirectory(dirPath: string): void;

    /**
     * Unlocks all files within a given directory.
     * @param dirPath The path to the directory to unlock.
     */
    abstract unlockDirectory(dirPath: string): void;

    /**
     * A high-level function to lock or unlock a list of paths,
     * which can be a mix of files and directories.
     * @param paths An array of file or directory paths.
     * @param action The action to perform: 'lock' or 'unlock'.
     */
    abstract handleLockUnlock(paths: string[], action: 'lock' | 'unlock'): void;
}
