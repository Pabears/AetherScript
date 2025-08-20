import type { GenerationResult, FileStats, GenerationSummary } from '../types';

/**
 * @abstract
 * @class StatisticsService
 * @description
 * Service for processing and presenting statistics related to code generation.
 */
export abstract class StatisticsService {
    /**
     * @abstract
     * @method printGenerationStatistics
     * @description
     * Prints a detailed, formatted summary of a generation run to the console.
     * @param {GenerationResult} result - The result object from a generation run.
     * @param {boolean} [verbose] - Whether to print verbose, per-file details.
     */
    abstract printGenerationStatistics(result: GenerationResult, verbose?: boolean): void;

    /**
     * @abstract
     * @method categorizePerformance
     * @description
     * Returns a qualitative performance category based on a duration.
     * @param {number} duration - The duration in milliseconds.
     * @returns {string} A performance category (e.g., 'Fast', 'Slow').
     */
    abstract categorizePerformance(duration: number): string;

    /**
     * @abstract
     * @method generateSummary
     * @description
     * Calculates aggregate statistics from a list of file generation stats.
     * @param {FileStats[]} fileStats - An array of file statistics.
     * @returns {GenerationSummary} An object containing the aggregated summary.
     */
    abstract generateSummary(fileStats: FileStats[]): GenerationSummary;
}
