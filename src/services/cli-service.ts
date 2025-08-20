/**
 * @fileoverview Service for handling command-line interface (CLI) operations.
 */

import { GenerationService } from './generation-service';
import { JsdocService } from './jsdoc-service';
import { LockingService } from './locking-service';
import { ProviderService } from './provider-service';

/**
 * Represents the parsed command-line arguments.
 */
export interface ParsedArgs {
    [key: string]: any;
    _: string[];
}

/**
 * Abstract class defining the contract for a CLI service.
 * Implementations will parse arguments and execute commands.
 * @service
 */
export abstract class CliService {
    /**
     * Initializes the service with its dependencies.
     * @param services An object containing the required service instances.
     */
    abstract initialize(services: {
        generation: GenerationService;
        jsdoc: JsdocService;
        locking: LockingService;
        provider: ProviderService;
    }): void;

    /**
     * The main entry point for the CLI service. It parses arguments and executes the
     * corresponding command.
     * @param argv The command-line arguments array (e.g., `process.argv`).
     */
    abstract run(argv: string[]): Promise<void>;
}
