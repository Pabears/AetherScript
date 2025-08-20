import { DependencyAnalysisService } from '../services/dependency-analysis-service';
import type { InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import { generateDependencyInfo as originalGenerateDependencyInfo } from '../core/dependency-analyzer';

/**
 * @class DependencyAnalysisServiceImpl
 * @description
 * Concrete implementation of the DependencyAnalysisService.
 * It acts as a wrapper around the original `generateDependencyInfo` function.
 */
export class DependencyAnalysisServiceImpl extends DependencyAnalysisService {
    /**
     * @override
     * @method generateDependencyInfo
     */
    generateDependencyInfo(
        declaration: InterfaceDeclaration | ClassDeclaration,
        originalImportPath: string,
        generatedFilePath: string
    ): { dependenciesText: string; originalCode: string } {
        return originalGenerateDependencyInfo(declaration, originalImportPath, generatedFilePath);
    }
}
