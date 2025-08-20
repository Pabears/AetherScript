// Re-export all types for easy importing
export type { ProviderOptions } from '../providers/base-provider';

// Service-related types
export type PropertyDependency = {
    name: string;
    type: string;
};

export type GeneratedService = {
    interfaceName: string;
    implName: string;
    implFilePath: string;
    constructorDependencies: string[];
    propertyDependencies: PropertyDependency[];
};

// JSDoc-related types
export interface JSDocInfo {
    name: string;
    description: string;
    methods: {
        name: string;
        signature: string;
        description: string;
        parameters: { name: string; type: string; description: string }[];
        returnType: string;
        returnDescription: string;
    }[];
    properties: {
        name: string;
        type: string;
        description: string;
        optional?: boolean;
    }[];
    constructors: {
        signature: string;
        description: string;
        parameters: { name: string; type: string; description: string }[];
    }[];
}

// Generation-related types
export interface FileStats {
    interfaceName: string;
    status: 'generated' | 'skipped' | 'locked' | 'error';
    duration?: number;
    error?: string;
}

export interface GenerationResult {
    success: boolean;
    fileStats: FileStats[];
    totalDuration: number;
    generatedServices: GeneratedService[];
}

export interface GenerationSummary {
    total: number;
    generated: number;
    skipped: number;
    locked: number;
    errors: number;
    successRate: number;
}

// Provider-related types
export interface OllamaResponse {
    response: string;
}

// Logging-related types
export enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
    VERBOSE = 4
}

export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: Date;
    context?: string;
    data?: any;
}

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
