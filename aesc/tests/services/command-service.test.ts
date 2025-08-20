import { describe, test, expect, spyOn } from 'bun:test';
import { CommandServiceImpl } from '../../src/generated/command.service.impl';
import type { GenerationService } from '../../src/services/generation-service';
import type { JSDocService } from '../../src/services/jsdoc-service';
import type { ProviderFactoryService } from '../../src/services/provider-factory-service';
import type { StatisticsService } from '../../src/services/statistics-service';
import type { GenerateOptions, GenerationResult } from '../../src/types';

// Create dummy objects for services with compliant method signatures
const mockGenerationService: GenerationService = {
    generate: async (options: GenerateOptions): Promise<GenerationResult> => ({ success: true, fileStats: [], totalDuration: 0, generatedServices: [] }),
};
const mockJSDocService: JSDocService = {
    indexAllDependencies: async () => {},
    getLibraryJSDoc: async () => null,
    getFormattedLibraryJSDoc: async () => null,
    clearCache: async () => {},
    getIndexedLibraries: async () => [],
};
const mockProviderFactoryService: ProviderFactoryService = {
    getAvailableProviders: () => ['mock-provider'],
    getConfiguredProviders: () => ['mock-configured'],
    createProvider: () => ({} as any),
    setProviderConfig: () => {},
    getProviderConfig: () => ({} as any),
    setDefaultProvider: () => {},
};
const mockStatisticsService: StatisticsService = {
    printGenerationStatistics: () => {},
    categorizePerformance: () => 'Fast',
    generateSummary: () => ({} as any),
};

describe('CommandService', () => {
    let service: CommandServiceImpl;

    test('runGenerate should call generation and statistics services', async () => {
        const genSpy = spyOn(mockGenerationService, 'generate');
        const statsSpy = spyOn(mockStatisticsService, 'printGenerationStatistics');
        
        service = new CommandServiceImpl(mockGenerationService, mockJSDocService, mockProviderFactoryService, mockStatisticsService);
        const mockOptions: GenerateOptions = { force: false, files: [], verbose: false, model: 'test' };
        
        await service.runGenerate(mockOptions);

        expect(genSpy).toHaveBeenCalledWith(mockOptions);
        expect(statsSpy).toHaveBeenCalled();
        
        genSpy.mockRestore();
        statsSpy.mockRestore();
    });

    test('runJSDocIndex should call the JSDoc service', async () => {
        const jsdocSpy = spyOn(mockJSDocService, 'indexAllDependencies');
        service = new CommandServiceImpl(mockGenerationService, mockJSDocService, mockProviderFactoryService, mockStatisticsService);

        await service.runJSDocIndex();
        expect(jsdocSpy).toHaveBeenCalled();
        
        jsdocSpy.mockRestore();
    });

    test('runListProviders should call the ProviderFactory service', async () => {
        const providerSpy = spyOn(mockProviderFactoryService, 'getAvailableProviders');
        const configuredSpy = spyOn(mockProviderFactoryService, 'getConfiguredProviders');
        const logSpy = spyOn(console, 'log').mockImplementation(() => {});
        
        service = new CommandServiceImpl(mockGenerationService, mockJSDocService, mockProviderFactoryService, mockStatisticsService);

        await service.runListProviders();
        
        expect(providerSpy).toHaveBeenCalled();
        expect(configuredSpy).toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith('Available Provider Types:', 'mock-provider');
        
        providerSpy.mockRestore();
        configuredSpy.mockRestore();
        logSpy.mockRestore();
    });
});