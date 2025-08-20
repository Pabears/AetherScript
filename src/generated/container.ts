/**
 * @fileoverview Dependency Injection (DI) container for the application.
 */

import { LoggingServiceImpl } from './logging-service.impl';
import { ConfigServiceImpl } from './config-service.impl';
import { ProviderServiceImpl } from './provider-service.impl';
import { JsdocServiceImpl } from './jsdoc-service.impl';
import { FileAnalysisServiceImpl } from './file-analysis-service.impl';
import { LockingServiceImpl } from './locking-service.impl';
import { GenerationServiceImpl } from './generation-service.impl';
import { CliServiceImpl } from './cli-service.impl';

// Service instances
const loggingService = new LoggingServiceImpl();
const configService = new ConfigServiceImpl();
const providerService = new ProviderServiceImpl();
const jsdocService = new JsdocServiceImpl();
const fileAnalysisService = new FileAnalysisServiceImpl();
const lockingService = new LockingServiceImpl();
const generationService = new GenerationServiceImpl();
const cliService = new CliServiceImpl();

// Perform dependency injection
generationService.initialize({
    logging: loggingService,
    locking: lockingService,
    provider: providerService,
    jsdoc: jsdocService,
    fileAnalysis: fileAnalysisService,
});

cliService.initialize({
    generation: generationService,
    jsdoc: jsdocService,
    locking: lockingService,
    provider: providerService,
});

/**
 * The application container. Holds instances of all services.
 */
export const container = {
    logging: loggingService,
    config: configService,
    provider: providerService,
    jsdoc: jsdocService,
    fileAnalysis: fileAnalysisService,
    locking: lockingService,
    generation: generationService,
    cli: cliService,
};

export type AppContainer = typeof container;
