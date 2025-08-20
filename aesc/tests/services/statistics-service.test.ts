import { describe, test, expect, beforeEach, spyOn } from 'bun:test';
import { StatisticsServiceImpl } from '../../src/generated/statistics.service.impl';
import type { FileStats, GenerationResult, GenerationSummary } from '../../src/types';

describe('StatisticsService', () => {
    let service: StatisticsServiceImpl;

    beforeEach(() => {
        service = new StatisticsServiceImpl();
    });

    describe('generateSummary', () => {
        test('should correctly calculate summary statistics', () => {
            const fileStats: FileStats[] = [
                { interfaceName: 'A', status: 'generated', duration: 1000 },
                { interfaceName: 'B', status: 'generated', duration: 2000 },
                { interfaceName: 'C', status: 'skipped' },
                { interfaceName: 'D', status: 'locked' },
                { interfaceName: 'E', status: 'error', error: 'failed' },
            ];

            const summary = service.generateSummary(fileStats);

            expect(summary.total).toBe(5);
            expect(summary.generated).toBe(2);
            expect(summary.skipped).toBe(1);
            expect(summary.locked).toBe(1);
            expect(summary.errors).toBe(1);
            expect(summary.successRate).toBe(40); // (2 / 5) * 100
        });

        test('should handle an empty array', () => {
            const summary = service.generateSummary([]);
            expect(summary.total).toBe(0);
            expect(summary.successRate).toBe(0);
        });
    });

    describe('categorizePerformance', () => {
        test('should return correct performance categories', () => {
            expect(service.categorizePerformance(4999)).toBe('Fast');
            expect(service.categorizePerformance(5000)).toBe('Normal');
            expect(service.categorizePerformance(15000)).toBe('Slow');
            expect(service.categorizePerformance(30000)).toBe('Very Slow');
        });
    });

    describe('printGenerationStatistics', () => {
        test('should print a formatted summary to the console', () => {
            const logSpy = spyOn(console, 'log').mockImplementation(() => {});

            const result: GenerationResult = {
                success: false,
                totalDuration: 45123,
                fileStats: [
                    { interfaceName: 'A', status: 'generated', duration: 1234 },
                    { interfaceName: 'B', status: 'skipped' },
                    { interfaceName: 'C', status: 'error', error: 'Syntax Error' },
                ],
                generatedServices: [],
            };

            service.printGenerationStatistics(result, false);

            // Check if console.log was called multiple times
            expect(logSpy).toHaveBeenCalled();

            // Check for specific output strings
            const allLogCalls = logSpy.mock.calls.flat().join('\n');
            expect(allLogCalls).toContain('Generated: 1 files');
            expect(allLogCalls).toContain('Skipped: 1 files');
            expect(allLogCalls).toContain('Errors: 1 files');
            expect(allLogCalls).toContain('Total generation time: 45.12s');
            expect(allLogCalls).toContain('C: Syntax Error');

            logSpy.mockRestore();
        });
    });
});
