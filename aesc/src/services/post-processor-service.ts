
import { InterfaceDeclaration, ClassDeclaration } from "ts-morph";
import type { CodeFixResult } from "../types";

/**
 * @abstract
 * @class PostProcessorService
 * @description
 * Service responsible for post-processing and validating generated code.
 * This includes fixing imports, cleaning up the code, and ensuring it's syntactically and semantically correct.
 */
export abstract class PostProcessorService {
    /**
     * @abstract
     * @method postProcessGeneratedCode
     * @description
     * Performs post-processing on the generated code.
     * This includes adding necessary imports that might be missing from the raw AI response.
     * @param {string} code - The generated code.
     * @param {InterfaceDeclaration | ClassDeclaration} declaration - The original interface or class declaration.
     * @param {string} generatedFilePath - The path to the generated file.
     * @returns {string} The post-processed code.
     */
    abstract postProcessGeneratedCode(
        code: string,
        declaration: InterfaceDeclaration | ClassDeclaration,
        generatedFilePath: string
    ): string;

    /**
     * @abstract
     * @method validateGeneratedCode
     * @description
     * Validates the generated TypeScript code.
     * @param {string} code - The generated code to validate.
     * @param {InterfaceDeclaration | ClassDeclaration} originalDeclaration - The original interface or class declaration.
     * @param {string} generatedFilePath - The path to the generated file.
     * @returns {Promise<{ isValid: boolean; errors: string[] }>} A promise that resolves to an object indicating if the code is valid and a list of errors.
     */
    abstract validateGeneratedCode(
        code: string,
        originalDeclaration: InterfaceDeclaration | ClassDeclaration,
        generatedFilePath: string
    ): Promise<{ isValid: boolean; errors: string[] }>;

    /**
     * @abstract
     * @method fixGeneratedCode
     * @description
     * Attempts to fix validation errors in generated code using the same model and provider as generation
     * @param {string} originalCode - The original generated code with validation errors.
     * @param {ClassDeclaration | InterfaceDeclaration} declaration - The original interface or class declaration.
     * @param {string} implFilePath - The path to the generated implementation file.
     * @param {string} originalImportPath - The original import path to the interface.
     * @param {string} interfaceName - The name of the interface.
     * @param {string[]} validationErrors - The list of validation errors.
     * @param {string} model - The model to use for fixing the code.
     * @param {boolean} verbose - Whether to log verbose output.
     * @param {string} [provider] - The provider to use for fixing the code.
     * @param {number} [maxRetries] - The maximum number of retries.
     * @returns {Promise<CodeFixResult>} A promise that resolves to a CodeFixResult.
     */
    abstract fixGeneratedCode(
        originalCode: string,
        declaration: ClassDeclaration | InterfaceDeclaration,
        implFilePath: string,
        originalImportPath: string,
        interfaceName: string,
        validationErrors: string[],
        model: string,
        verbose: boolean,
        provider?: string,
        maxRetries?: number
    ): Promise<CodeFixResult>;
}
