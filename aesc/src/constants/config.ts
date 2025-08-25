import type { AescConfig } from '../types';

export const DEFAULT_CONFIG: AescConfig = {
    outputDir: 'src/generated',
    defaultModel: 'qwen3-coder',
    timeout: 600000, // 10 minutes
};
