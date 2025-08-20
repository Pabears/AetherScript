import { FileAnalysisService } from '../services/file-analysis-service';
import type { Project, InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import type { PropertyDependency } from "../types";
import { getDependencies as originalGetDependencies, analyzeSourceFiles as originalAnalyzeSourceFiles } from '../file-analysis';

/**
 * @class FileAnalysisServiceImpl
 * @description
 * Concrete implementation of the FileAnalysisService.
 * It uses the original, unmodified functions from the `src/file-analysis.ts` file.
 */
export class FileAnalysisServiceImpl extends FileAnalysisService {
    /**
     * @override
     * @method getDependencies
     */
    getDependencies(cls: ClassDeclaration): { constructorDeps: string[], propertyDeps: PropertyDependency[] } {
        return originalGetDependencies(cls);
    }

    /**
     * @override
     * @method analyzeSourceFiles
     */
    analyzeSourceFiles(project: Project, files: string[]): Map<string, { declaration: InterfaceDeclaration | ClassDeclaration, sourceFile: any }> {
        return originalAnalyzeSourceFiles(project, files);
    }
}
