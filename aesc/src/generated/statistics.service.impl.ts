import { StatisticsService } from '../services/statistics-service';
import type { GenerationResult, FileStats, GenerationSummary } from '../types';
import {
    printGenerationStatistics as originalPrint,
    categorizePerformance as originalCategorize,
    generateSummary as originalSummary,
} from '../core/statistics';

/**
 * @class StatisticsServiceImpl
 * @description
 * Concrete implementation of the StatisticsService.
 * It wraps the original functions from `src/core/statistics.ts`.
 */
export class StatisticsServiceImpl extends StatisticsService {
    printGenerationStatistics(result: GenerationResult, verbose?: boolean): void {
        originalPrint(result, verbose);
    }

    categorizePerformance(duration: number): string {
        return originalCategorize(duration);
    }

    generateSummary(fileStats: FileStats[]): GenerationSummary {
        return originalSummary(fileStats);
    }
}
