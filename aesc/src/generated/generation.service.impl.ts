import { Project } from "ts-morph";
import * as path from 'path';
import * as fs from 'fs';

// Abstract Service
import { GenerationService } from "../services/generation-service";

// Types
import type { GenerateOptions, GenerationResult, FileStats, GeneratedService } from '../types';

// Original functions from the old architecture
import { generateCode as originalGenerateCode } from '../core/generator';

/**
 * @class GenerationServiceImpl
 * @description
 * Concrete implementation of the GenerationService.
 * For this initial refactoring step, it acts as a wrapper around the original 
 * `generateCode` function from `src/core/generator.ts`.
 * This maintains the exact original behavior while fitting it into the new service-oriented architecture.
 * Future refactoring will break down the logic from `generateCode` into this class directly.
 */
export class GenerationServiceImpl extends GenerationService {

    /**
     * @override
     * @method generate
     * @description
     * Orchestrates the code generation process by calling the original `generateCode` function.
     * @param {GenerateOptions} options - The options for the generation process.
     * @returns {Promise<GenerationResult>} A summary of the generation results.
     */
    public async generate(options: GenerateOptions): Promise<GenerationResult> {
        // For now, we delegate directly to the original, unmodified function
        // to ensure behavior remains identical during the refactoring process.
        return await originalGenerateCode(options);
    }
}
