import { FileUtilsService } from '../services/file-utils-service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @class FileUtilsServiceImpl
 * @description
 * Concrete implementation of the FileUtilsService.
 * This class contains the actual logic for file system operations.
 */
export class FileUtilsServiceImpl extends FileUtilsService {
    /**
     * @override
     */
    saveGeneratedFile(filePath: string, content: string): void {
        fs.writeFileSync(filePath, content);
        console.log(`  -> Wrote to ${filePath}`);
    }

    /**
     * @override
     */
    ensureOutputDirectory(outputDir: string, force: boolean): void {
        if (force) {
            console.log(`--force specified, cleaning directory: ${outputDir}`);
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
        fs.mkdirSync(outputDir, { recursive: true });
    }
}