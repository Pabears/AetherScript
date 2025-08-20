import { GenerationService, GenerationResult } from '../services/generation-service';
import { FileAnalysisService } from '../services/file-analysis-service';
import { JsdocService } from '../services/jsdoc-service';
import { LockingService } from '../services/locking-service';
import { LoggingService } from '../services/logging-service';
import { ProviderService } from '../services/provider-service';
import { GenerateOptions } from '../types';
import { generateCode } from '../core/generator';

/**
 * Concrete implementation of the GenerationService.
 * It orchestrates the code generation process by calling other services.
 */
export class GenerationServiceImpl extends GenerationService {
    private logging!: LoggingService;
    private locking!: LockingService;
    private provider!: ProviderService;
    private jsdoc!: JsdocService;
    private fileAnalysis!: FileAnalysisService;
    private initialized = false;

    initialize(services: {
        logging: LoggingService;
        locking: LockingService;
        provider: ProviderService;
        jsdoc: JsdocService;
        fileAnalysis: FileAnalysisService;
    }): void {
        this.logging = services.logging;
        this.locking = services.locking;
        this.provider = services.provider;
        this.jsdoc = services.jsdoc;
        this.fileAnalysis = services.fileAnalysis;
        this.initialized = true;
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('GenerationService has not been initialized.');
        }
    }

    async generate(options: GenerateOptions): Promise<GenerationResult> {
        this.ensureInitialized();
        this.logging.info('Starting code generation via GenerationService...');

        // For now, this service will be a simple wrapper around the original
        // `generateCode` function. A deeper refactoring would move the logic
        // from `generateCode` into this class.
        const result = await generateCode(options);

        this.logging.info('Generation finished.');
        return result;
    }
}
