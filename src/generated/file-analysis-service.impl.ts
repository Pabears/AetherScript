import { FileAnalysisService, ServiceAnalysisResult } from '../services/file-analysis-service';
import { PropertyDependency } from '../types';
import { analyzeSourceFiles, getDependencies } from '../file-analysis';
import { Project, ClassDeclaration } from 'ts-morph';

/**
 * Concrete implementation of the FileAnalysisService.
 * It wraps the original file analysis functions.
 */
export class FileAnalysisServiceImpl extends FileAnalysisService {
    private project!: Project;
    private initialized = false;

    initialize(project: Project): void {
        this.project = project;
        this.initialized = true;
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('FileAnalysisService has not been initialized.');
        }
    }

    getDependencies(classDeclaration: ClassDeclaration): { constructorDeps: string[], propertyDeps: PropertyDependency[] } {
        this.ensureInitialized();
        return getDependencies(classDeclaration);
    }

    analyzeSourceFiles(filePaths: string[]): Map<string, ServiceAnalysisResult> {
        this.ensureInitialized();
        return analyzeSourceFiles(this.project, filePaths);
    }
}
