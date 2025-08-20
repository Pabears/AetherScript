import { ServiceGenerationService } from '../services/ServiceGenerationService';
import type {
    CodeProject,
    GeneratedService,
    GenerateOptions,
    FileStats,
    InterfaceDeclaration,
    ClassDeclaration
} from '../services/types';
import { Project, Node } from "ts-morph";
import * as path from 'path';
import * as fs from 'fs';
import { saveGeneratedFile } from '../utils/file-utils';
import { generatePrompt } from '../prompts/implementation';
import { container } from './container';

/**
 * Concrete implementation of the ServiceGenerationService.
 * This class orchestrates the generation of service implementations.
 */
export class ServiceGenerationServiceImpl implements ServiceGenerationService {

    public async getAllExistingServices(outputDir: string, project: CodeProject, newlyGeneratedServices: GeneratedService[]): Promise<GeneratedService[]> {
        const fileAnalysisService = container.get('FileAnalysisService');
        const allServices: GeneratedService[] = [...newlyGeneratedServices];
        if (!fs.existsSync(outputDir)) return allServices;

        const files = fs.readdirSync(outputDir).filter(file => file.endsWith('.service.impl.ts'));
        for (const file of files) {
            const filePath = path.join(outputDir, file);
            const interfaceName = path.basename(file, '.service.impl.ts').split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
            if (newlyGeneratedServices.some(s => s.interfaceName === interfaceName)) continue;
            try {
                const sourceFile = project.addSourceFileAtPath(filePath);
                const implClass = sourceFile.getClasses()[0];
                if (implClass) {
                    const { constructorDeps, propertyDeps } = fileAnalysisService.getDependencies(implClass);
                    allServices.push({
                        interfaceName,
                        implName: implClass.getName() || `${interfaceName}Impl`,
                        implFilePath: `./${file}`,
                        constructorDependencies: constructorDeps,
                        propertyDependencies: propertyDeps,
                    });
                }
            } catch (error) {
                console.warn(`Warning: Could not analyze existing service file ${file}: ${error}`);
            }
        }
        return allServices;
    }

    public async generateSingleService(interfaceName: string, declaration: InterfaceDeclaration | ClassDeclaration, outputDir: string, lockedFiles: string[], options: GenerateOptions, generatedServices: GeneratedService[]): Promise<FileStats> {
        const dependencyAnalysisService = container.get('DependencyAnalysisService');
        const providerService = container.get('ProviderService');
        const codeGenerationService = container.get('CodeGenerationService');
        const fileAnalysisService = container.get('FileAnalysisService');

        const fileStartTime = Date.now();
        const implName = `${interfaceName}Impl`;
        const implFileName = `${interfaceName.toLowerCase()}.service.impl.ts`;
        const implFilePath = path.join(outputDir, implFileName);

        try {
            if (lockedFiles.includes(path.resolve(implFilePath))) {
                return { interfaceName, status: 'locked', duration: Date.now() - fileStartTime };
            }
            if (options.force && options.files.length > 0 && fs.existsSync(implFilePath)) {
                fs.unlinkSync(implFilePath);
            }
            if (fs.existsSync(implFilePath) && !options.force) {
                return { interfaceName, status: 'skipped', duration: Date.now() - fileStartTime };
            }

            console.log(`  -> Generating implementation for ${interfaceName}...`);
            const originalImportPath = path.relative(path.dirname(implFilePath), declaration.getSourceFile().getFilePath()).replace(/\\/g, '/').replace(/\.ts$/, '');

            const { dependenciesText, originalCode } = dependencyAnalysisService.generateDependencyInfo(declaration, originalImportPath, implFilePath);
            const prompt = generatePrompt(declaration, dependenciesText, originalCode, options.provider);

            const { provider, config } = providerService.createProvider(options.provider);
            const rawResponse = await provider.generate(prompt, options.model || config.defaultModel || 'codellama', { verbose: options.verbose });

            const codeGenResult = await codeGenerationService.processGeneratedCode({
                rawCode: rawResponse,
                declaration,
                implFilePath,
                originalImportPath,
                interfaceName,
                model: options.model,
                verbose: options.verbose,
                provider: options.provider,
            });

            if (!codeGenResult.success || !codeGenResult.processedCode) {
                return { interfaceName, status: 'error', duration: Date.now() - fileStartTime, error: `Validation failed after ${codeGenResult.attempts} retry attempts` };
            }

            saveGeneratedFile(implFilePath, codeGenResult.processedCode);

            const { constructorDeps, propertyDeps } = fileAnalysisService.getDependencies(declaration as any);

            generatedServices.push({
                interfaceName,
                implName,
                implFilePath: `./${implFileName}`,
                constructorDependencies: constructorDeps || [],
                propertyDependencies: propertyDeps || [],
            });

            const fileDuration = Date.now() - fileStartTime;
            console.log(`  -> ✅ ${interfaceName} completed in ${(fileDuration / 1000).toFixed(2)}s`);

            return { interfaceName, status: 'generated', duration: fileDuration };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`  -> ❌ Failed to generate ${interfaceName}: ${errorMessage}`);
            return { interfaceName, status: 'error', duration: Date.now() - fileStartTime, error: errorMessage };
        }
    }
}
