import { Project, InterfaceDeclaration, ClassDeclaration } from 'ts-morph';
import type { GenerateOptions, GenerationResult, FileStats, GeneratedService } from '../types';

/**
 * @interface PipelineContext
 * @description
 * Holds the state that is passed through each stage of the generation pipeline.
 * It accumulates data and results as the pipeline progresses.
 */
export interface PipelineContext {
    project: Project;
    options: GenerateOptions;
    outputDir: string;
    lockedFiles: string[];
    servicesToGenerate: Map<string, { declaration: InterfaceDeclaration | ClassDeclaration }>;
    generatedServices: GeneratedService[];
    fileStats: FileStats[];
    totalStartTime: number;
}

/**
 * @interface PipelineStage
 * @description
 * Represents a single stage in the generation pipeline.
 * Each stage performs a specific task and modifies the context.
 */
export interface PipelineStage {
    execute(context: PipelineContext): Promise<PipelineContext>;
}
