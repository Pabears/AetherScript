import { JSDocService } from '../services/jsdoc-service';
import type { JSDocInfo } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { Project, Node, ts } from 'ts-morph';

// All classes from the jsdoc directory are now here

class JSDocExtractor {
    private project: Project;
    private jsdocDir: string;
    private projectPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.project = new Project({
            tsConfigFilePath: path.join(projectPath, 'tsconfig.json'),
        });
        this.jsdocDir = path.join(projectPath, '.jsdoc');
        this.ensureJSDocDir();
    }

    private ensureJSDocDir() {
        if (!fs.existsSync(this.jsdocDir)) {
            fs.mkdirSync(this.jsdocDir, { recursive: true });
        }
    }

    /**
     * Extract JSDoc information for specified third-party library
     */
    public extractLibraryJSDoc(libraryName: string): JSDocInfo | null {
        try {
            // Try to read from cache
            const cachedPath = path.join(this.jsdocDir, `${libraryName}.json`);
            if (fs.existsSync(cachedPath)) {
                const cached = JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
                console.log(`[JSDoc] Using cached documentation for ${libraryName}`);
                return cached;
            }

            // Find library's type definition files
            const typeDefPaths = this.findTypeDefinitionFiles(libraryName);
            if (typeDefPaths.length === 0) {
                console.log(`[JSDoc] No type definition files found for ${libraryName}`);
                return null;
            }

            // Extract JSDoc information
            const jsdocInfo = this.extractJSDocFromFiles(libraryName, typeDefPaths);
            
            // Cache results
            if (jsdocInfo) {
                fs.writeFileSync(cachedPath, JSON.stringify(jsdocInfo, null, 2));
                console.log(`[JSDoc] Cached documentation for ${libraryName}`);
            }

            return jsdocInfo;
        } catch (error) {
            console.error(`[JSDoc] Error extracting documentation for ${libraryName}:`, error);
            return null;
        }
    }

    private findTypeDefinitionFiles(libraryName: string): string[] {
        // Handle scoped packages (like @types/node)
        const isScoped = libraryName.startsWith('@');
        const normalizedName = isScoped ? libraryName : libraryName;
        
        const possiblePaths = [
            // Main package's type definition file
            `node_modules/${normalizedName}/index.d.ts`,
            `node_modules/${normalizedName}/lib/index.d.ts`,
            `node_modules/${normalizedName}/types/index.d.ts`,
            `node_modules/${normalizedName}/${normalizedName.split('/').pop()}.d.ts`,
            `node_modules/${normalizedName}/dist/index.d.ts`,
            // @types package's type definition file
            `node_modules/@types/${normalizedName}/index.d.ts`,
            `node_modules/@types/${normalizedName.replace('@', '').replace('/', '__')}/index.d.ts`,
        ];

        // If not a scoped package, also try to find corresponding @types package
        if (!isScoped) {
            possiblePaths.push(
                `node_modules/@types/${normalizedName}/index.d.ts`,
                `node_modules/@types/${normalizedName.replace('-', '_')}/index.d.ts`
            );
        }

        const existingPaths: string[] = [];

        for (const relativePath of possiblePaths) {
            const fullPath = path.join(this.projectPath, relativePath);
            if (fs.existsSync(fullPath)) {
                console.log(`[JSDoc] Found type definition file: ${fullPath}`);
                existingPaths.push(fullPath);
            }
        }

        if (existingPaths.length === 0) {
            console.log(`[JSDoc] No type definition files found for ${libraryName}`);
        }

        return existingPaths;
    }

    private extractJSDocFromFiles(libraryName: string, filePaths: string[]): JSDocInfo | null {
        const jsdocInfo: JSDocInfo = {
            name: libraryName,
            description: '',
            methods: [],
            properties: [],
            constructors: []
        };

        for (const filePath of filePaths) {
            try {
                const sourceFile = this.project.addSourceFileAtPath(filePath);
                
                console.log(`[JSDoc] Processing file: ${filePath}`);
                
                // Find main class or interface declarations
                const classes = sourceFile.getClasses();
                const interfaces = sourceFile.getInterfaces();
                
                console.log(`[JSDoc] Found ${classes.length} classes and ${interfaces.length} interfaces`);
                
                // Process all class declarations (not just name-matching ones)
                for (const classDecl of classes) {
                    const className = classDecl.getName();
                    console.log(`[JSDoc] Processing class: ${className}`);
                    this.extractFromClassDeclaration(classDecl, jsdocInfo);
                }

                // Process all interface declarations
                for (const interfaceDecl of interfaces) {
                    const interfaceName = interfaceDecl.getName();
                    console.log(`[JSDoc] Processing interface: ${interfaceName}`);
                    this.extractFromInterfaceDeclaration(interfaceDecl, jsdocInfo);
                }

                // Find exported declarations
                const exportedDeclarations = sourceFile.getExportedDeclarations();
                console.log(`[JSDoc] Found ${exportedDeclarations.size} exported declarations`);
                
                for (const [name, declarations] of exportedDeclarations) {
                    console.log(`[JSDoc] Processing exported declaration: ${name}`);
                    for (const decl of declarations) {
                        if (Node.isClassDeclaration(decl)) {
                            this.extractFromClassDeclaration(decl, jsdocInfo);
                        } else if (Node.isInterfaceDeclaration(decl)) {
                            this.extractFromInterfaceDeclaration(decl, jsdocInfo);
                        } else if (Node.isTypeAliasDeclaration(decl)) {
                            // Process type alias declarations
                            this.extractFromTypeAliasDeclaration(decl, jsdocInfo);
                        }
                    }
                }

            } catch (error) {
                console.error(`[JSDoc] Error processing file ${filePath}:`, error);
            }
        }

        return jsdocInfo.methods.length > 0 || jsdocInfo.properties.length > 0 ? jsdocInfo : null;
    }

    private extractFromClassDeclaration(classDecl: any, jsdocInfo: JSDocInfo) {
        // Extract class description
        const classJSDoc = classDecl.getJsDocs();
        if (classJSDoc.length > 0) {
            jsdocInfo.description = this.extractDescription(classJSDoc[0]);
        }

        // Extract constructors
        const constructors = classDecl.getConstructors();
        for (const constructor of constructors) {
            const constructorInfo = this.extractConstructorInfo(constructor);
            if (constructorInfo) {
                jsdocInfo.constructors.push(constructorInfo);
            }
        }

        // Extract methods
        const methods = classDecl.getMethods();
        for (const method of methods) {
            const methodInfo = this.extractMethodInfo(method);
            if (methodInfo) {
                jsdocInfo.methods.push(methodInfo);
            }
        }

        // Extract properties
        const properties = classDecl.getProperties();
        for (const property of properties) {
            const propertyInfo = this.extractPropertyInfo(property);
            if (propertyInfo) {
                jsdocInfo.properties.push(propertyInfo);
            }
        }
    }

    private extractFromInterfaceDeclaration(interfaceDecl: any, jsdocInfo: JSDocInfo) {
        // Extract interface description
        const interfaceJSDoc = interfaceDecl.getJsDocs();
        if (interfaceJSDoc.length > 0) {
            jsdocInfo.description = this.extractDescription(interfaceJSDoc[0]);
        }

        // Extract method signatures
        const methods = interfaceDecl.getMethods();
        for (const method of methods) {
            const methodInfo = this.extractMethodInfo(method);
            if (methodInfo) {
                jsdocInfo.methods.push(methodInfo);
            }
        }

        // Extract property signatures
        const properties = interfaceDecl.getProperties();
        for (const property of properties) {
            const propertyInfo = this.extractPropertyInfo(property);
            if (propertyInfo) {
                jsdocInfo.properties.push(propertyInfo);
            }
        }
    }

    private extractConstructorInfo(constructor: any): any {
        const jsDocs = constructor.getJsDocs();
        const parameters = constructor.getParameters();
        
        return {
            signature: constructor.getText(),
            description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : '',
            parameters: parameters.map((param: any) => ({
                name: param.getName(),
                type: param.getType().getText(),
                description: this.extractParameterDescription(jsDocs, param.getName())
            }))
        };
    }

    private extractMethodInfo(method: any): any {
        const jsDocs = method.getJsDocs();
        const parameters = method.getParameters();
        
        return {
            name: method.getName(),
            signature: method.getText(),
            description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : '',
            parameters: parameters.map((param: any) => ({
                name: param.getName(),
                type: param.getType().getText(),
                description: this.extractParameterDescription(jsDocs, param.getName())
            })),
            returnType: method.getReturnType().getText(),
            returnDescription: this.extractReturnDescription(jsDocs)
        };
    }

    private extractPropertyInfo(property: any): any {
        const jsDocs = property.getJsDocs();
        
        return {
            name: property.getName(),
            type: property.getType().getText(),
            description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : ''
        };
    }

    private extractDescription(jsDoc: any): string {
        try {
            const description = jsDoc.getDescription();
            return description || '';
        } catch {
            return '';
        }
    }

    private extractParameterDescription(jsDocs: any[], paramName: string): string {
        for (const jsDoc of jsDocs) {
            try {
                const tags = jsDoc.getTags();
                for (const tag of tags) {
                    if (tag.getTagName() === 'param' && tag.getName() === paramName) {
                        return tag.getComment() || '';
                    }
                }
            } catch {
                // Ignore errors
            }
        }
        return '';
    }

    private extractReturnDescription(jsDocs: any[]): string {
        for (const jsDoc of jsDocs) {
            try {
                const tags = jsDoc.getTags();
                for (const tag of tags) {
                    if (tag.getTagName() === 'returns' || tag.getTagName() === 'return') {
                        return tag.getComment() || '';
                    }
                }
            } catch {
                // Ignore errors
            }
        }
        return '';
    }

    private extractFromTypeAliasDeclaration(typeAliasDecl: any, jsdocInfo: JSDocInfo) {
        // Extract type alias description
        const typeAliasJSDoc = typeAliasDecl.getJsDocs();
        if (typeAliasJSDoc.length > 0) {
            if (!jsdocInfo.description) {
                jsdocInfo.description = this.extractDescription(typeAliasJSDoc[0]);
            }
        }

        // For type aliases, we can extract their basic information as properties
        const typeName = typeAliasDecl.getName();
        const typeText = typeAliasDecl.getTypeNode()?.getText() || 'any';
        
        jsdocInfo.properties.push({
            name: typeName,
            type: typeText,
            description: jsdocInfo.description || `Type alias: ${typeName}`,
            optional: false
        });
    }
}

class JSDocFormatter {
    /**
     * Format JSDoc information into TypeScript code strings suitable for LLM
     */
    public formatForLLM(jsdocInfo: JSDocInfo): string {
        const lines: string[] = [];
        
        // Add library description
        lines.push(`// External dependency: ${jsdocInfo.name}`);
        if (jsdocInfo.description) {
            lines.push(`// ${jsdocInfo.description}`);
        }
        
        // Start class definition
        lines.push(`class ${jsdocInfo.name} {`);
        
        // Add constructors
        if (jsdocInfo.constructors.length > 0) {
            for (const constructor of jsdocInfo.constructors) {
                if (constructor.description) {
                    lines.push(`    /**`);
                    lines.push(`     * ${constructor.description}`);
                    for (const param of constructor.parameters) {
                        if (param.description) {
                            lines.push(`     * @param ${param.name} ${param.description}`);
                        }
                    }
                    lines.push(`     */`);
                }
                
                // Simplify constructor signature
                const paramStrings = constructor.parameters.map(p => 
                    `${p.name}${p.type.includes('undefined') ? '?' : ''}: ${this.simplifyType(p.type)}`
                );
                lines.push(`    constructor(${paramStrings.join(', ')});`);
            }
        } else {
            // Default constructor
            lines.push(`    constructor();`);
        }
        
        // Add properties
        for (const property of jsdocInfo.properties) {
            if (property.description) {
                lines.push(`    /** ${property.description} */`);
            }
            lines.push(`    ${property.name}: ${this.simplifyType(property.type)};`);
        }
        
        // Add methods
        for (const method of jsdocInfo.methods) {
            if (method.description || method.parameters.some(p => p.description) || method.returnDescription) {
                lines.push(`    /**`);
                if (method.description) {
                    lines.push(`     * ${method.description}`);
                }
                for (const param of method.parameters) {
                    if (param.description) {
                        lines.push(`     * @param ${param.name} ${param.description}`);
                    }
                }
                if (method.returnDescription) {
                    lines.push(`     * @returns ${method.returnDescription}`);
                }
                lines.push(`     */`);
            }
            
            // Simplify method signature
            const paramStrings = method.parameters.map(p => 
                `${p.name}${p.type.includes('undefined') ? '?' : ''}: ${this.simplifyType(p.type)}`
            );
            const returnType = this.simplifyType(method.returnType);
            lines.push(`    ${method.name}(${paramStrings.join(', ')}): ${returnType};`);
        }
        
        lines.push(`}`);
        
        return lines.join('\n');
    }
    
    /**
     * Simplify complex TypeScript types to more concise forms
     */
    private simplifyType(type: string): string {
        // Remove module paths and complex generics
        let simplified = type
            .replace(/import\([^)]+\)\./g, '') // Remove import() paths
            .replace(/\w+\./g, '') // Remove namespace prefixes
            .replace(/\s+/g, ' ')
            .trim();
        
        // Handle common type simplifications
        const typeMap: { [key: string]: string } = {
            'string | undefined': 'string?',
            'number | undefined': 'number?',
            'boolean | undefined': 'boolean?',
            'void': 'void',
            'any': 'any',
            'unknown': 'any'
        };
        
        for (const [complex, simple] of Object.entries(typeMap)) {
            simplified = simplified.replace(new RegExp(complex, 'g'), simple);
        }
        
        // If type is too complex, simplify to any
        if (simplified.length > 50) {
            simplified = 'any';
        }
        
        return simplified;
    }
    
    /**
     * Generate usage examples
     */
    public generateUsageExample(jsdocInfo: JSDocInfo): string {
        const lines: string[] = [];
        lines.push(`// Usage example for ${jsdocInfo.name}:`);
        
        // Constructor example
        if (jsdocInfo.constructors.length > 0) {
            const constructor = jsdocInfo.constructors[0];
            if (constructor) {
                const exampleParams = constructor.parameters.map(p => {
                    if (p.type.includes('string')) return `"example"`;
                    if (p.type.includes('number')) return `123`;
                    if (p.type.includes('boolean')) return `true`;
                    if (p.type.includes('object') || p.type.includes('{')) return `{}`;
                    return `undefined`;
                });
                lines.push(`const instance = new ${jsdocInfo.name}(${exampleParams.join(', ')});`);
            }
        } else {
            lines.push(`const instance = new ${jsdocInfo.name}();`);
        }
        
        // Method call examples
        const publicMethods = jsdocInfo.methods.filter(m => !m.name.startsWith('_'));
        if (publicMethods.length > 0) {
            const method = publicMethods[0];
            if (method) {
                const exampleParams = method.parameters.map(p => {
                    if (p.type.includes('string')) return `"key"`;
                    if (p.type.includes('number')) return `123`;
                    if (p.type.includes('boolean')) return `true`;
                    return `value`;
                });
                
                if (method.returnType.includes('Promise')) {
                    lines.push(`const result = await instance.${method.name}(${exampleParams.join(', ')});`);
                } else {
                    lines.push(`const result = instance.${method.name}(${exampleParams.join(', ')});`);
                }
            }
        }
        
        return lines.join('\n');
    }
}

class JSDocIndexer {
    private projectPath: string;
    private jsdocDir: string;
    private extractor: JSDocExtractor;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.jsdocDir = path.join(projectPath, '.jsdoc');
        this.extractor = new JSDocExtractor(projectPath);
        this.ensureJSDocDir();
    }

    private ensureJSDocDir() {
        if (!fs.existsSync(this.jsdocDir)) {
            fs.mkdirSync(this.jsdocDir, { recursive: true });
        }
    }

    /**
     * Read all dependencies from package.json and batch index them
     */
    public async indexAllDependencies(): Promise<void> {
        console.log('[JSDoc Indexer] Starting dependency indexing...');
        
        const packageJsonPath = path.join(this.projectPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) {
            console.log('[JSDoc Indexer] No package.json found, skipping indexing');
            return;
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = {
            ...packageJson.dependencies || {},
            ...packageJson.devDependencies || {}
        };

        const dependencyNames = Object.keys(dependencies);
        console.log(`[JSDoc Indexer] Found ${dependencyNames.length} dependencies to index`);

        let indexedCount = 0;
        let skippedCount = 0;

        for (const dependencyName of dependencyNames) {
            // Skip @types packages as they are usually type definitions, not main packages
            if (dependencyName.startsWith('@types/')) {
                skippedCount++;
                continue;
            }

            const cachedPath = path.join(this.jsdocDir, `${dependencyName}.json`);
            
            // Skip if already indexed
            if (fs.existsSync(cachedPath)) {
                console.log(`[JSDoc Indexer] ${dependencyName} already indexed, skipping`);
                skippedCount++;
                continue;
            }

            console.log(`[JSDoc Indexer] Indexing ${dependencyName}...`);
            
            try {
                const jsdocInfo = this.extractor.extractLibraryJSDoc(dependencyName);
                if (jsdocInfo) {
                    fs.writeFileSync(cachedPath, JSON.stringify(jsdocInfo, null, 2));
                    console.log(`[JSDoc Indexer] Successfully indexed ${dependencyName}`);
                    indexedCount++;
                } else {
                    console.log(`[JSDoc Indexer] No JSDoc found for ${dependencyName}`);
                    skippedCount++;
                }
            } catch (error) {
                console.error(`[JSDoc Indexer] Error indexing ${dependencyName}:`, error);
                skippedCount++;
            }
        }

        console.log(`[JSDoc Indexer] Indexing complete. Indexed: ${indexedCount}, Skipped: ${skippedCount}`);
    }

    /**
     * Load documentation for specified library from .jsdoc directory
     */
    public loadLibraryJSDoc(libraryName: string): JSDocInfo | null {
        const cachedPath = path.join(this.jsdocDir, `${libraryName}.json`);
        
        if (!fs.existsSync(cachedPath)) {
            return null;
        }

        try {
            const cached = JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
            return cached;
        } catch (error) {
            console.error(`[JSDoc Indexer] Error loading cached JSDoc for ${libraryName}:`, error);
            return null;
        }
    }

    /**
     * Get all indexed library names
     */
    public getIndexedLibraries(): string[] {
        if (!fs.existsSync(this.jsdocDir)) {
            return [];
        }

        return fs.readdirSync(this.jsdocDir)
            .filter(file => file.endsWith('.json'))
            .map(file => file.replace('.json', ''));
    }

    /**
     * Clear all index cache
     */
    public clearIndex(): void {
        if (fs.existsSync(this.jsdocDir)) {
            const files = fs.readdirSync(this.jsdocDir);
            for (const file of files) {
                if (file.endsWith('.json')) {
                    fs.unlinkSync(path.join(this.jsdocDir, file));
                }
            }
            console.log('[JSDoc Indexer] Index cache cleared');
        }
    }
}

class JSDocManager {
    private extractor: JSDocExtractor;
    private formatter: JSDocFormatter;
    private indexer: JSDocIndexer;
    private projectPath: string;

    constructor(projectPath: string = process.cwd()) {
        this.projectPath = projectPath;
        this.extractor = new JSDocExtractor(projectPath);
        this.formatter = new JSDocFormatter();
        this.indexer = new JSDocIndexer(projectPath);
    }

    /**
     * Extract and format JSDoc for a library
     */
    async processLibrary(libraryName: string): Promise<void> {
        try {
            // Extract JSDoc from library
            const extractedData = this.extractor.extractLibraryJSDoc(libraryName);
            
            if (extractedData) {
                // Format the extracted data
                const formattedData = this.formatter.formatForLLM(extractedData);
                
                console.log(`✅ Successfully processed JSDoc for library: ${libraryName}`);
            } else {
                console.log(`⚠️  No JSDoc found for library: ${libraryName}`);
            }
        } catch (error) {
            console.error(`❌ Failed to process JSDoc for library ${libraryName}:`, error);
            throw error;
        }
    }

    /**
     * Get formatted JSDoc for a library
     */
    getLibraryJSDoc(libraryName: string): any {
        return this.extractor.extractLibraryJSDoc(libraryName);
    }

    /**
     * Index all dependencies from package.json
     */
    async indexAllDependencies(): Promise<void> {
        await this.indexer.indexAllDependencies();
    }

    /**
     * Clear JSDoc cache
     */
    clearCache(): void {
        this.indexer.clearIndex();
    }
}

/**
 * @class JSDocServiceImpl
 * @description
 * Concrete implementation of the JSDocService.
 * It uses the original JSDocManager and other classes from the `src/jsdoc` directory
 * to perform its operations.
 */
export class JSDocServiceImpl extends JSDocService {
    private manager: JSDocManager;
    private formatter: JSDocFormatter;
    private indexer: JSDocIndexer; // Have a separate indexer instance

    constructor(projectPath: string = process.cwd()) {
        super();
        this.manager = new JSDocManager(projectPath);
        this.formatter = new JSDocFormatter();
        this.indexer = new JSDocIndexer(projectPath); // Instantiate it
    }

    async getLibraryJSDoc(libraryName: string): Promise<JSDocInfo | null> {
        // The original method is synchronous, but we adapt it to the async interface
        return Promise.resolve(this.manager.getLibraryJSDoc(libraryName));
    }

    async getFormattedLibraryJSDoc(libraryName: string): Promise<string | null> {
        const jsdocInfo = await this.getLibraryJSDoc(libraryName);
        if (!jsdocInfo) {
            return null;
        }
        return this.formatter.formatForLLM(jsdocInfo);
    }

    async indexAllDependencies(): Promise<void> {
        return this.manager.indexAllDependencies();
    }

    async clearCache(): Promise<void> {
        // The original method is synchronous
        this.manager.clearCache();
        return Promise.resolve();
    }

    async getIndexedLibraries(): Promise<string[]> {
        // Use the separate indexer instance to call this method
        return Promise.resolve(this.indexer.getIndexedLibraries());
    }
}