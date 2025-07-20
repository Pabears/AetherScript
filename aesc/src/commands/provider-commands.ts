import { ProviderFactory, ProviderManager } from '../providers';

/**
 * List all available and configured providers
 */
export async function listProvidersCommand(): Promise<void> {
    console.log('=== AetherScript Providers ===\n');
    
    const availableProviders = ProviderFactory.getAvailableProviders();
    const providerManager = new ProviderManager();
    providerManager.loadFromEnvironment();
    const configuredProviders = providerManager.getConfiguredProviders();
    
    console.log('📦 Available Provider Types:');
    availableProviders.forEach(provider => {
        console.log(`  - ${provider}`);
    });
    
    console.log('\n⚙️  Configured Providers:');
    for (const providerName of configuredProviders) {
        const config = providerManager.getProviderConfig(providerName);
        if (config) {
            const isDefault = providerManager.getDefaultProvider() === providerName;
            const defaultMark = isDefault ? ' (default)' : '';
            console.log(`  - ${providerName}${defaultMark}`);
            console.log(`    Type: ${config.type}`);
            console.log(`    Default Model: ${config.defaultModel || 'none'}`);
            if (config.settings.endpoint) {
                console.log(`    Endpoint: ${config.settings.endpoint}`);
            }
        }
    }
    
    console.log('\n🔧 Environment Variables:');
    const envVars = [
        'OLLAMA_ENDPOINT',
        'CLOUDFLARE_ACCOUNT_ID',
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_AIG_TOKEN'
    ];
    
    envVars.forEach(envVar => {
        const value = process.env[envVar];
        if (value) {
            const maskedValue = envVar.includes('TOKEN') || envVar.includes('KEY') 
                ? `${value.substring(0, 8)}...` 
                : value;
            console.log(`  ✅ ${envVar}=${maskedValue}`);
        } else {
            console.log(`  ❌ ${envVar}=<not set>`);
        }
    });
}

/**
 * Test connection to a specific provider
 */
export async function testProviderCommand(providerName?: string): Promise<void> {
    const providerManager = new ProviderManager();
    providerManager.loadFromEnvironment();
    
    try {
        const { provider, config } = providerManager.createProvider(providerName);
        
        console.log(`🔍 Testing connection to provider: ${provider.name}`);
        console.log(`   Configuration: ${providerName || 'default'}`);
        console.log(`   Type: ${config.type}`);
        console.log(`   Default Model: ${config.defaultModel || 'none'}`);
        
        await provider.validateConnection();
        console.log('✅ Connection successful!');
        
        // Try to get available models if supported
        if (provider.getAvailableModels) {
            try {
                const models = await provider.getAvailableModels();
                if (models.length > 0) {
                    console.log(`📋 Available models (${models.length}):`);
                    models.slice(0, 10).forEach(model => {
                        console.log(`   - ${model}`);
                    });
                    if (models.length > 10) {
                        console.log(`   ... and ${models.length - 10} more`);
                    }
                }
            } catch (error) {
                console.log('⚠️  Could not fetch available models');
            }
        }
        
    } catch (error) {
        console.error('❌ Connection failed:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

/**
 * Show provider configuration examples
 */
export function showProviderExamplesCommand(): void {
    console.log('=== AetherScript Provider Configuration Examples ===\n');
    
    console.log('🔧 Environment Variables:\n');
    
    console.log('# Cloudflare Workers AI');
    console.log('export CLOUDFLARE_ACCOUNT_ID="your-account-id"');
    console.log('export CLOUDFLARE_API_TOKEN="your-api-token"');
    console.log('export CLOUDFLARE_AIG_TOKEN="your-aig-token"  # Optional\n');
    
    console.log('# Remote Ollama');
    console.log('export OLLAMA_ENDPOINT="http://remote-server:11434/api/generate"\n');
    
    console.log('📝 Usage Examples:\n');
    
    console.log('# Use default Ollama');
    console.log('bunx aesc gen -vf\n');
    
    console.log('# Use Cloudflare Workers AI');
    console.log('bunx aesc gen -vf -p cloudflare -m "@cf/qwen/qwen2.5-coder-32b-instruct"\n');
    
    console.log('# Use remote Ollama with specific model');
    console.log('bunx aesc gen -vf -m qwen2.5-coder:32b\n');
    
    console.log('# Test provider connection');
    console.log('bunx aesc test-provider cloudflare\n');
    
    console.log('# List all providers');
    console.log('bunx aesc list-providers\n');
}

/**
 * Generate a simple test prompt to validate provider functionality
 */
export async function testGenerationCommand(providerName?: string, model?: string): Promise<void> {
    const providerManager = new ProviderManager();
    providerManager.loadFromEnvironment();
    
    try {
        const { provider, config } = providerManager.createProvider(providerName);
        const testModel = model || config.defaultModel || 'codellama';
        
        console.log(`🧪 Testing code generation with provider: ${provider.name}`);
        console.log(`   Model: ${testModel}`);
        console.log(`   Started at: ${new Date().toLocaleTimeString()}`);
        
        const testPrompt = `Generate a simple TypeScript function that adds two numbers:

interface Calculator {
    add(a: number, b: number): number;
}

Please implement this interface as a class called CalculatorImpl.`;

        console.log('\n📝 Sending test prompt...');
        
        const startTime = Date.now();
        const response = await provider.generate(testPrompt, testModel, {
            verbose: false,
            endpoint: config.settings.endpoint,
            auth: config.settings.auth,
            ...config.settings
        });
        const duration = Date.now() - startTime;
        
        // Enhanced statistics
        console.log('\n📊 Test Statistics:');
        console.log('=' .repeat(40));
        console.log(`✅ Status: Success`);
        console.log(`⏱️  Generation time: ${(duration / 1000).toFixed(2)}s`);
        console.log(`📏 Response length: ${response.length} characters`);
        console.log(`🔤 Word count: ~${response.split(/\s+/).length} words`);
        console.log(`📅 Completed at: ${new Date().toLocaleTimeString()}`);
        
        // Performance categorization
        let performanceCategory = '';
        if (duration < 2000) {
            performanceCategory = '🚀 Very Fast';
        } else if (duration < 5000) {
            performanceCategory = '⚡ Fast';
        } else if (duration < 10000) {
            performanceCategory = '🐢 Moderate';
        } else {
            performanceCategory = '🐌 Slow';
        }
        console.log(`📈 Performance: ${performanceCategory} (${duration}ms)`);
        
        console.log('=' .repeat(40));
        console.log('\n📄 Generated code:');
        console.log('---');
        console.log(response);
        console.log('---');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log('\n📊 Test Statistics:');
        console.log('=' .repeat(40));
        console.log(`❌ Status: Failed`);
        console.log(`🚫 Error: ${errorMessage}`);
        console.log(`📅 Failed at: ${new Date().toLocaleTimeString()}`);
        console.log('=' .repeat(40));
        
        console.error('❌ Generation failed:', errorMessage);
        process.exit(1);
    }
}
