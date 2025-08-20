import { FileUtilsService } from '../services/file-utils-service';
import {
    saveGeneratedFile as originalSave,
    ensureOutputDirectory as originalEnsure,
} from '../utils/file-utils';

/**
 * @class FileUtilsServiceImpl
 * @description
 * Concrete implementation of the FileUtilsService.
 * It wraps the original functions from `src/utils/file-utils.ts`.
 */
export class FileUtilsServiceImpl extends FileUtilsService {
    saveGeneratedFile(filePath: string, content: string): void {
        originalSave(filePath, content);
    }

    ensureOutputDirectory(outputDir: string, force: boolean): void {
        originalEnsure(outputDir, force);
    }
}
