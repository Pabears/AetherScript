import type { GenerateOptions, GenerationResult } from '../types';

/**
 * @abstract
 * @class GenerationService
 * @description
 * The core service responsible for orchestrating the entire code generation process.
 * It analyzes source files, manages concurrent generation of individual services,
 * and creates the final dependency injection container.
 */
export abstract class GenerationService {
    /**
     * @abstract
     * @method generate
     * @description
     * The main entry point for code generation. It takes command-line options,
     * finds all services marked with @AutoGen, generates their implementations,
     * and assembles the DI container.
     * @param {GenerateOptions} options - The options for the generation process.
     * @returns {Promise<GenerationResult>} A summary of the generation results,
     * including statistics and success status.
     */
    abstract generate(options: GenerateOptions): Promise<GenerationResult>;
}
