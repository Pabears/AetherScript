import type { ProcessGeneratedCodeParams, ProcessGeneratedCodeResult } from './types';

/**
 * Abstract class for a code generation service.
 * This service is responsible for taking raw AI-generated code
 * and processing it through a pipeline of cleaning, validation,
 * and fixing steps to produce usable code.
 */
export abstract class CodeGenerationService {
    /**
     * Processes raw AI-generated code through the complete pipeline.
     * @param params The parameters for the code generation process.
     * @returns A promise that resolves with the result of the process.
     */
    abstract processGeneratedCode(params: ProcessGeneratedCodeParams): Promise<ProcessGeneratedCodeResult>;
}
