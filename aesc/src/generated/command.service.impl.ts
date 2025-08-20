import { CommandService } from '../services/command-service';
import type { GenerationService } from '../services/generation-service';
import type { JSDocService } from '../services/jsdoc-service';
import type { ProviderFactoryService } from '../services/provider-factory-service';
import type { StatisticsService } from '../services/statistics-service';
import type { GenerateOptions } from '../types';

/**
 * @class CommandServiceImpl
 * @description
 * Concrete implementation of the CommandService. It orchestrates calls to other services
 * to execute high-level commands.
 */
export class CommandServiceImpl extends CommandService {
    constructor(
        private readonly generationService: GenerationService,
        private readonly jsdocService: JSDocService,
        private readonly providerFactoryService: ProviderFactoryService,
        private readonly statisticsService: StatisticsService
    ) {
        super();
    }

    async runGenerate(options: GenerateOptions): Promise<void> {
        const result = await this.generationService.generate(options);
        this.statisticsService.printGenerationStatistics(result, options.verbose);
    }

    async runJSDocIndex(): Promise<void> {
        await this.jsdocService.indexAllDependencies();
    }

    async runListProviders(): Promise<void> {
        const providers = this.providerFactoryService.getAvailableProviders();
        const configured = this.providerFactoryService.getConfiguredProviders();
        console.log('Available Provider Types:', providers.join(', '));
        console.log('Configured Provider Instances:', configured.join(', '));
    }
}