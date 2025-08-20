/**
 * @fileoverview Service for orchestrating the entire code generation process.
 */

import { GenerateOptions } from '../types';
import { FileAnalysisService } from './file-analysis-service';
import { JsdocService } from './jsdoc-service';
import { LockingService } from './locking-service';
import { LoggingService } from './logging-service';
import { ProviderService } from './provider-service';

/**
 * Represents the statistics for a single generated file.
 */
export interface FileStats {
    interfaceName: string;
    status: 'generated' | 'skipped' | 'locked' | 'error';
    duration?: number;
    error?: string;
}

/**
 * Represents the result of a code generation run.
 */
export interface GenerationResult {
    success: boolean;
    fileStats: FileStats[];
    totalDuration: number;
}

/**
 * Abstract class defining the contract for the main code generation service.
 * Implementations will orchestrate the various steps of the generation process,
 * from file analysis to model interaction and file saving.
 * @service
 */
export abstract class GenerationService {
    /**
     * Injects the dependent services into the GenerationService.
     * @param services An object containing the required service instances.
     */
    abstract initialize(services: {
        logging: LoggingService;
        locking: LockingService;
        provider: ProviderService;
        jsdoc: JsdocService;
        fileAnalysis: FileAnalysisService;
    }): void;

    /**
     * The main method to run the code generation process.
     * @param options The generation options, such as 'force' or specific files to process.
     * @returns A promise that resolves with the results of the generation.
     */
    abstract generate(options: GenerateOptions): Promise<GenerationResult>;
}
