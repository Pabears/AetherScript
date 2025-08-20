/**
 * @abstract
 * @class LockManagerService
 * @description
 * Service responsible for managing file locks to prevent accidental overwrites.
 * It controls the `aesc.lock` file, allowing paths to be locked and unlocked.
 */
export abstract class LockManagerService {
    /**
     * @abstract
     * @method lock
     * @description
     * Locks a list of files or directories. For directories, all `.ts` files within them
     * will be locked recursively.
     * @param {string[]} paths - An array of file or directory paths to lock.
     * @returns {void}
     */
    abstract lock(paths: string[]): void;

    /**
     * @abstract
     * @method unlock
     * @description
     * Unlocks a list of files or directories. For directories, all files within them
     * that are currently locked will be unlocked.
     * @param {string[]} paths - An array of file or directory paths to unlock.
     * @returns {void}
     */
    abstract unlock(paths: string[]): void;

    /**
     * @abstract
     * @method getLockedFiles
     * @description
     * Retrieves a list of all currently locked file paths.
     * @returns {string[]} An array of absolute paths for all locked files.
     */
    abstract getLockedFiles(): string[];

    /**
     * @abstract
     * @method isLocked
     * @description
     * Checks if a specific file path is currently locked.
     * @param {string} filePath - The path to the file to check.
     * @returns {boolean} True if the file is locked, false otherwise.
     */
    abstract isLocked(filePath: string): boolean;
}
