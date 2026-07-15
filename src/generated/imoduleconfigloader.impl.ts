import * as fs from 'node:fs';
import * as path from 'node:path';
import { IModuleConfigLoader } from '../service/module-config-loader.ts';
import { type AescModuleConfig, DEFAULT_MODULE_CONFIG } from '../module-config.ts';

export class ConfigParseError extends Error {
    constructor(filePath: string, cause: unknown) {
        super(`Failed to parse aesccfg.json at ${filePath}: ${String(cause)}`);
        this.name = 'ConfigParseError';
    }
}

export class ConfigValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ConfigValidationError';
    }
}

export class IModuleConfigLoaderImpl extends IModuleConfigLoader {
    /**
     * Walk up from the abstract class file's directory looking for aesccfg.json.
     * Returns fully-merged AescModuleConfig (user values + defaults).
     */
    public load(abstractClassFilePath: string, projectRoot: string): AescModuleConfig {
        const resolvedRoot = path.resolve(projectRoot);
        let searchDir = path.resolve(path.dirname(abstractClassFilePath));

        // Step 1-4: bubble up looking for aesccfg.json
        while (true) {
            const candidate = path.join(searchDir, 'aesccfg.json');

            if (fs.existsSync(candidate)) {
                // Step 5: parse JSON — hard fail on malformed JSON
                let raw: unknown;
                try {
                    raw = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
                } catch (err) {
                    throw new ConfigParseError(candidate, err);
                }

                // Step 6: field-level type validation (lenient on unknown keys)
                const cfg = raw as Record<string, unknown>;

                if (cfg.outputPath !== undefined && typeof cfg.outputPath !== 'string') {
                    throw new ConfigValidationError(`aesccfg.json: outputPath must be a string (found ${typeof cfg.outputPath})`);
                }
                if (cfg.generateDI !== undefined && typeof cfg.generateDI !== 'boolean') {
                    throw new ConfigValidationError(`aesccfg.json: generateDI must be a boolean (found ${typeof cfg.generateDI})`);
                }
                if (cfg.testDir !== undefined && typeof cfg.testDir !== 'string') {
                    throw new ConfigValidationError(`aesccfg.json: testDir must be a string (found ${typeof cfg.testDir})`);
                }
                if (cfg.testType !== undefined && cfg.testType !== 'unit' && cfg.testType !== 'e2e') {
                    throw new ConfigValidationError(`aesccfg.json: testType must be "unit" or "e2e" (found ${JSON.stringify(cfg.testType)})`);
                }
                if (cfg.postGenHints !== undefined && (!Array.isArray(cfg.postGenHints) || !cfg.postGenHints.every((h: unknown) => typeof h === 'string'))) {
                    throw new ConfigValidationError(`aesccfg.json: postGenHints must be an array of strings`);
                }

                // Step 7: merge with defaults (user values win)
                const merged: AescModuleConfig = {
                    ...DEFAULT_MODULE_CONFIG,
                    ...(cfg.outputPath !== undefined ? { outputPath: cfg.outputPath as string } : {}),
                    ...(cfg.generateDI !== undefined ? { generateDI: cfg.generateDI as boolean } : {}),
                    ...(cfg.testDir !== undefined ? { testDir: cfg.testDir as string } : {}),
                    ...(cfg.testType !== undefined ? { testType: cfg.testType as 'unit' | 'e2e' } : {}),
                    ...(cfg.postGenHints !== undefined ? { postGenHints: cfg.postGenHints as string[] } : {}),
                };

                // Step 8: path traversal security check
                this._validateOutputPath(merged.outputPath, candidate);

                return merged;
            }

            // Step 3: move to parent directory
            const parent = path.dirname(searchDir);

            // Step 4: reached projectRoot or filesystem root — stop
            if (searchDir === resolvedRoot || parent === searchDir) {
                return { ...DEFAULT_MODULE_CONFIG };
            }

            searchDir = parent;
        }
    }

    private _validateOutputPath(outputPath: string, configFilePath: string): void {
        // Must be relative
        if (path.isAbsolute(outputPath)) {
            throw new ConfigValidationError(
                `aesccfg.json at ${configFilePath}: outputPath must be a relative path, got "${outputPath}"`
            );
        }
        // Must not contain ".." segments
        const segments = outputPath.split(/[/\\]/);
        if (segments.includes('..')) {
            throw new ConfigValidationError(
                `aesccfg.json at ${configFilePath}: outputPath must not contain ".." (path traversal), got "${outputPath}"`
            );
        }
    }
}
