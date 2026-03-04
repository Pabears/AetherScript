// ============================================================
// AetherScript 2.0 — Shared Types
// ============================================================

export interface ScannedClass {
  className: string;
  filePath: string;
  sourceText: string;
  typeContext: string;
  methodSignatures: string[];
  imports: string[];
}

export interface ScanResult {
  classes: ScannedClass[];
  projectRoot: string;
  tsconfigPath: string;
  fileHashes: Map<string, string>;
  scannedAt: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface GeneratedFile {
  className: string;
  implClassName: string;
  filename: string;
  sourceCode: string;
  diRegistration: {
    abstractName: string;
    implName: string;
    importPath: string;
  };
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  file: string;
  line?: number;
}

export interface ValidationResult {
  passed: boolean;
  issues: ValidationIssue[];
}

export interface DangerousApiConfig {
  bannedImports: string[];
  bannedGlobals: string[];
  bannedPatterns?: RegExp[];
}

export interface CostReport {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  callCount: number;
  breakdown: Array<{ callId: string; purpose: string; usage: TokenUsage; timestamp: number }>;
}

export type PipelineStage = 'scan' | 'sanitize' | 'generate' | 'validate' | 'write';

export interface PipelineEvent {
  stage: PipelineStage;
  status: 'start' | 'success' | 'failure';
  durationMs: number;
  detail?: unknown;
}

export interface PipelineConfig {
  projectDir: string;
  maxCostPerRunUsd?: number;
  dryRun?: boolean;
  dangerousApiConfig?: DangerousApiConfig;
}

export interface PipelineResult {
  success: boolean;
  stage: PipelineStage;
  filesWritten: string[];
  usage: CostReport;
  events: PipelineEvent[];
  error?: string;
}
