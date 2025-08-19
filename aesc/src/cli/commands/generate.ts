import type { GenerateOptions } from '../../types';
import { generateCode } from '../../core/generator';
import { printGenerationStatistics } from '../../core/statistics';

/**
 * Handle the generate command
 */
export async function handleGenerate(options: GenerateOptions): Promise<void> {
    try {
        const result = await generateCode(options);
        
        // Print statistics
        printGenerationStatistics(result, options.verbose);
        
        // Exit with error code if generation failed
        if (!result.success) {
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ Generation failed:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}
