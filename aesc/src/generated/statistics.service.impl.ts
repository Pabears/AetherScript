import { StatisticsService } from '../services/statistics-service';
import type { GenerationResult, FileStats, GenerationSummary } from '../types';

/**
 * @class StatisticsServiceImpl
 * @description
 * Concrete implementation of the StatisticsService.
 * This class contains the actual logic for processing and presenting statistics.
 */
export class StatisticsServiceImpl extends StatisticsService {
    /**
     * @override
     */
    public printGenerationStatistics(result: GenerationResult, verbose: boolean = false): void {
        const { fileStats, totalDuration } = result;
        
        console.log('\n📊 Generation Statistics:');
        console.log('='.repeat(50));
        
        const generated = fileStats.filter(f => f.status === 'generated');
        const skipped = fileStats.filter(f => f.status === 'skipped');
        const locked = fileStats.filter(f => f.status === 'locked');
        const errors = fileStats.filter(f => f.status === 'error');
        
        console.log(`✅ Generated: ${generated.length} files`);
        console.log(`⏭️  Skipped: ${skipped.length} files`);
        console.log(`🔒 Locked: ${locked.length} files`);
        console.log(`❌ Errors: ${errors.length} files`);
        
        if (generated.length > 0) {
            const avgTime = generated.reduce((sum, f) => sum + (f.duration || 0), 0) / generated.length;
            const minTime = Math.min(...generated.map(f => f.duration || 0));
            const maxTime = Math.max(...generated.map(f => f.duration || 0));
            
            console.log('\n⏱️  Timing Details:');
            console.log(`   Average per file: ${(avgTime / 1000).toFixed(2)}s`);
            console.log(`   Fastest: ${(minTime / 1000).toFixed(2)}s`);
            console.log(`   Slowest: ${(maxTime / 1000).toFixed(2)}s`);
            
            if (verbose) {
                console.log('\n📋 Individual File Times:');
                generated.forEach(f => {
                    console.log(`   ${f.interfaceName}: ${((f.duration || 0) / 1000).toFixed(2)}s`);
                });
            }
        }
        
        if (errors.length > 0) {
            console.log('\n❌ Error Details:');
            errors.forEach(f => {
                console.log(`   ${f.interfaceName}: ${f.error} (${((f.duration || 0) / 1000).toFixed(2)}s)`);
            });
        }
        
        console.log('='.repeat(50));
        console.log(`🏁 Total generation time: ${(totalDuration / 1000).toFixed(2)}s`);
        console.log(`🕐 Completed at ${new Date().toLocaleTimeString()}`);
    }

    /**
     * @override
     */
    public categorizePerformance(duration: number): string {
        if (duration < 5000) return 'Fast';
        if (duration < 15000) return 'Normal';
        if (duration < 30000) return 'Slow';
        return 'Very Slow';
    }

    /**
     * @override
     */
    public generateSummary(fileStats: FileStats[]): GenerationSummary {
        const total = fileStats.length;
        const generated = fileStats.filter(f => f.status === 'generated').length;
        const skipped = fileStats.filter(f => f.status === 'skipped').length;
        const locked = fileStats.filter(f => f.status === 'locked').length;
        const errors = fileStats.filter(f => f.status === 'error').length;
        const successRate = total > 0 ? (generated / total) * 100 : 0;
        
        return {
            total,
            generated,
            skipped,
            locked,
            errors,
            successRate
        };
    }
}