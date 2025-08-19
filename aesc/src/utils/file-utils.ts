import * as fs from 'fs';
import * as path from 'path';

export function saveGeneratedFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content);
    console.log(`  -> Wrote to ${filePath}`);
}

export function ensureOutputDirectory(outputDir: string, force: boolean): void {
    if (force) {
        console.log(`--force specified, cleaning directory: ${outputDir}`);
        fs.rmSync(outputDir, { recursive: true, force: true });
    }
    fs.mkdirSync(outputDir, { recursive: true });
}
