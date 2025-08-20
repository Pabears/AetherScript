import { CliService, ParsedArgs } from '../services/cli-service';
import { GenerationService } from '../services/generation-service';
import { JsdocService } from '../services/jsdoc-service';
import { LockingService } from '../services/locking-service';
import { ProviderService } from '../services/provider-service';
import { main as cliMain } from '../cli';

/**
 * Concrete implementation of the CliService.
 * It wraps the original CLI entry point.
 */
export class CliServiceImpl extends CliService {
    private generation!: GenerationService;
    private jsdoc!: JsdocService;
    private locking!: LockingService;
    private provider!: ProviderService;
    private initialized = false;

    initialize(services: {
        generation: GenerationService;
        jsdoc: JsdocService;
        locking: LockingService;
        provider: ProviderService;
    }): void {
        this.generation = services.generation;
        this.jsdoc = services.jsdoc;
        this.locking = services.locking;
        this.provider = services.provider;
        this.initialized = true;
    }

    async run(argv: string[]): Promise<void> {
        if (!this.initialized) {
            throw new Error('CliService not initialized.');
        }

        // For now, this service will be a simple wrapper around the original
        // `main` function from the CLI. A deeper refactoring would move the
        // logic from the `switch` statement in `cli/index.ts` here.
        await cliMain();
    }
}
