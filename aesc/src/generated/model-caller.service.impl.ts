import { ModelCallerService } from '../services/model-caller-service';
import type { ProviderOptions } from '../types';
import {
    callOllamaModel as originalCallModel,
    configureProvider as originalConfigureProvider,
    setDefaultProvider as originalSetDefaultProvider,
    listProviders as originalListProviders
} from '../model-caller';

/**
 * @class ModelCallerServiceImpl
 * @description
 * Concrete implementation of the ModelCallerService.
 * It acts as a wrapper around the original functions from `model-caller.ts`.
 */
export class ModelCallerServiceImpl extends ModelCallerService {
    /**
     * @override
     * @method callModel
     */
    callModel(
        prompt: string,
        loggingContext: string,
        model: string,
        verbose: boolean,
        providerName?: string,
        providerOptions?: ProviderOptions
    ): Promise<string> {
        return originalCallModel(prompt, loggingContext, model, verbose, providerName, providerOptions);
    }

    /**
     * @override
     * @method configureProvider
     */
    configureProvider(
        name: string,
        type: string,
        settings: Record<string, any>,
        defaultModel?: string
    ): void {
        originalConfigureProvider(name, type, settings, defaultModel);
    }

    /**
     * @override
     * @method setDefaultProvider
     */
    setDefaultProvider(providerName: string): void {
        originalSetDefaultProvider(providerName);
    }

    /**
     * @override
     * @method listProviders
     */
    listProviders(): { available: string[]; configured: string[] } {
        return originalListProviders();
    }
}
