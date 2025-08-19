// Re-export all types for easy importing
export type { PropertyDependency, GeneratedService } from '../file-analysis';
export type { ProviderOptions } from '../providers/base-provider';

// CLI-related types
export interface GenerateOptions {
    force: boolean;
    files: string[];
    verbose: boolean;
    model: string;
    provider?: string;
}

// Configuration types
export interface AescConfig {
    outputDir: string;
    defaultModel: string;
    defaultProvider?: string;
    timeout?: number;
}
