import { container } from '../generated/container';

/**
 * JSDoc index command - Batch index all dependencies in package.json
 */
export async function indexJSDocCommand(): Promise<void> {
    const jsdocService = container.get('JsdocService');
    const loggingService = container.get('LoggingService');

    loggingService.info('Starting JSDoc indexing for project...', 'JSDoc');
    
    try {
        await jsdocService.indexAllDependencies();
        // The service implementation will log the details.
        loggingService.info('JSDoc indexing completed successfully!', 'JSDoc');
    } catch (error) {
        loggingService.error('Error during JSDoc indexing', 'JSDoc', { error });
        process.exit(1);
    }
}

/**
 * Clear JSDoc index cache
 */
export function clearJSDocIndexCommand(): void {
    const jsdocService = container.get('JsdocService');
    const loggingService = container.get('LoggingService');

    loggingService.info('Clearing JSDoc index...', 'JSDoc');
    jsdocService.clearCache();
    loggingService.info('JSDoc index cleared successfully!', 'JSDoc');
}
