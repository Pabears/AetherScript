/**
 * @abstract
 * @class FileUtilsService
 * @description
 * Service for handling common file system operations needed by the application.
 */
export abstract class FileUtilsService {
    /**
     * @abstract
     * @method saveGeneratedFile
     * @description
     * Saves content to a specified file path and logs the operation.
     * @param {string} filePath - The absolute path where the file should be saved.
     * @param {string} content - The content to write to the file.
     * @returns {void}
     */
    abstract saveGeneratedFile(filePath: string, content: string): void;

    /**
     * @abstract
     * @method ensureOutputDirectory
     * @description
     * Ensures that the specified output directory exists. If `force` is true,
     * it will first delete the directory if it exists.
     * @param {string} outputDir - The path to the directory.
     * @param {boolean} force - Whether to force clean the directory.
     * @returns {void}
     */
    abstract ensureOutputDirectory(outputDir: string, force: boolean): void;
}
