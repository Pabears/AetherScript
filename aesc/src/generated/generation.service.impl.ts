import { GenerationService } from '../services/generation-service';
import type { GenerateOptions, GenerationResult } from '../types';
import { generateCode as originalGenerateCode } from '../core/generator';

/**
 * @class GenerationServiceImpl
 * @description
 * Concrete implementation of the GenerationService.
 * It acts as a wrapper around the original `generateCode` function from `src/core/generator.ts`
 * to ensure behavioral consistency during the service-oriented refactoring.
 */
export class GenerationServiceImpl extends GenerationService {
    public async generate(options: GenerateOptions): Promise<GenerationResult> {
        return await originalGenerateCode(options);
    }
}
