import { JsdocService } from '../services/jsdoc-service';
import * as fs from 'fs';
import * as path from 'path';
import { Project, Node, ts, InterfaceDeclaration, ClassDeclaration, JSDoc, Type, ImportSpecifier, ImportDeclaration } from 'ts-morph';

// --- Start of inlined content ---

// Content from aesc/src/jsdoc/extractor.ts
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

class JSDocExtractor {
    private project: Project;
    private jsdocDir: string;
    private projectPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        const tsConfigFilePath = path.join(projectPath, 'tsconfig.json');
        this.project = new Project({
            tsConfigFilePath: fs.existsSync(tsConfigFilePath) ? tsConfigFilePath : undefined,
        });
        this.jsdocDir = path.join(projectPath, '.jsdoc');
        this.ensureJSDocDir();
    }

    private ensureJSDocDir() {
        if (!fs.existsSync(this.jsdocDir)) {
            fs.mkdirSync(this.jsdocDir, { recursive: true });
        }
    }

    public extractLibraryJSDoc(libraryName: string): JSDocInfo | null {
        try {
            const cachedPath = path.join(this.jsdocDir, `${libraryName}.json`);
            if (fs.existsSync(cachedPath)) {
                return JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
            }
            const typeDefPaths = this.findTypeDefinitionFiles(libraryName);
            if (typeDefPaths.length === 0) return null;
            const jsdocInfo = this.extractJSDocFromFiles(libraryName, typeDefPaths);
            if (jsdocInfo) {
                fs.writeFileSync(cachedPath, JSON.stringify(jsdocInfo, null, 2));
            }
            return jsdocInfo;
        } catch (error) {
            console.error(`[JSDoc] Error extracting documentation for ${libraryName}:`, error);
            return null;
        }
    }

    private findTypeDefinitionFiles(libraryName: string): string[] {
        const isScoped = libraryName.startsWith('@');
        const normalizedName = isScoped ? libraryName : libraryName;
        const possiblePaths = [
            `node_modules/${normalizedName}/index.d.ts`,
            `node_modules/${normalizedName}/lib/index.d.ts`,
            `node_modules/${normalizedName}/types/index.d.ts`,
            `node_modules/${normalizedName}/${normalizedName.split('/').pop()}.d.ts`,
            `node_modules/${normalizedName}/dist/index.d.ts`,
            `node_modules/@types/${normalizedName}/index.d.ts`,
            `node_modules/@types/${normalizedName.replace('@', '').replace('/', '__')}/index.d.ts`,
        ];
        if (!isScoped) {
            possiblePaths.push(
                `node_modules/@types/${normalizedName}/index.d.ts`,
                `node_modules/@types/${normalizedName.replace('-', '_')}/index.d.ts`
            );
        }
        return possiblePaths.map(p => path.join(this.projectPath, p)).filter(p => fs.existsSync(p));
    }

    private extractJSDocFromFiles(libraryName: string, filePaths: string[]): JSDocInfo | null {
        const jsdocInfo: JSDocInfo = { name: libraryName, description: '', methods: [], properties: [], constructors: [] };
        filePaths.forEach(filePath => {
            const sourceFile = this.project.addSourceFileAtPath(filePath);
            sourceFile.getClasses().forEach(c => this.extractFromClassDeclaration(c, jsdocInfo));
            sourceFile.getInterfaces().forEach(i => this.extractFromInterfaceDeclaration(i, jsdocInfo));
            sourceFile.getExportedDeclarations().forEach(decls => {
                decls.forEach(decl => {
                    if (Node.isClassDeclaration(decl)) this.extractFromClassDeclaration(decl, jsdocInfo);
                    else if (Node.isInterfaceDeclaration(decl)) this.extractFromInterfaceDeclaration(decl, jsdocInfo);
                    else if (Node.isTypeAliasDeclaration(decl)) this.extractFromTypeAliasDeclaration(decl, jsdocInfo);
                });
            });
        });
        return jsdocInfo.methods.length > 0 || jsdocInfo.properties.length > 0 ? jsdocInfo : null;
    }

    private extractFromClassDeclaration(classDecl: ClassDeclaration, jsdocInfo: JSDocInfo) {
        const classJSDoc = classDecl.getJsDocs();
        if (classJSDoc.length > 0) jsdocInfo.description = this.extractDescription(classJSDoc[0]);
        classDecl.getConstructors().forEach(c => jsdocInfo.constructors.push(this.extractConstructorInfo(c)));
        classDecl.getMethods().forEach(m => jsdocInfo.methods.push(this.extractMethodInfo(m)));
        classDecl.getProperties().forEach(p => jsdocInfo.properties.push(this.extractPropertyInfo(p)));
    }

    private extractFromInterfaceDeclaration(interfaceDecl: InterfaceDeclaration, jsdocInfo: JSDocInfo) {
        const interfaceJSDoc = interfaceDecl.getJsDocs();
        if (interfaceJSDoc.length > 0) jsdocInfo.description = this.extractDescription(interfaceJSDoc[0]);
        interfaceDecl.getMethods().forEach(m => jsdocInfo.methods.push(this.extractMethodInfo(m)));
        interfaceDecl.getProperties().forEach(p => jsdocInfo.properties.push(this.extractPropertyInfo(p)));
    }

    private extractConstructorInfo(constructor: any) {
        const jsDocs = constructor.getJsDocs();
        return {
            signature: constructor.getText(),
            description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : '',
            parameters: constructor.getParameters().map((p: any) => ({ name: p.getName(), type: p.getType().getText(), description: this.extractParameterDescription(jsDocs, p.getName()) }))
        };
    }

    private extractMethodInfo(method: any) {
        const jsDocs = method.getJsDocs();
        return {
            name: method.getName(),
            signature: method.getText(),
            description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : '',
            parameters: method.getParameters().map((p: any) => ({ name: p.getName(), type: p.getType().getText(), description: this.extractParameterDescription(jsDocs, p.getName()) })),
            returnType: method.getReturnType().getText(),
            returnDescription: this.extractReturnDescription(jsDocs)
        };
    }

    private extractPropertyInfo(property: any) {
        const jsDocs = property.getJsDocs();
        return {
            name: property.getName(),
            type: property.getType().getText(),
            description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : ''
        };
    }

    private extractDescription(jsDoc: JSDoc): string {
        return jsDoc.getDescription() || '';
    }

    private extractParameterDescription(jsDocs: JSDoc[], paramName: string): string {
        for (const jsDoc of jsDocs) {
            for (const tag of jsDoc.getTags()) {
                if (tag.getTagName() === 'param' && (tag as any).getName() === paramName) {
                    return tag.getComment() || '';
                }
            }
        }
        return '';
    }

    private extractReturnDescription(jsDocs: JSDoc[]): string {
        for (const jsDoc of jsDocs) {
            for (const tag of jsDoc.getTags()) {
                if (tag.getTagName() === 'returns' || tag.getTagName() === 'return') {
                    return tag.getComment() || '';
                }
            }
        }
        return '';
    }

    private extractFromTypeAliasDeclaration(typeAliasDecl: any, jsdocInfo: JSDocInfo) {
        const typeAliasJSDoc = typeAliasDecl.getJsDocs();
        if (typeAliasJSDoc.length > 0 && !jsdocInfo.description) {
            jsdocInfo.description = this.extractDescription(typeAliasJSDoc[0]);
        }
        jsdocInfo.properties.push({
            name: typeAliasDecl.getName(),
            type: typeAliasDecl.getTypeNode()?.getText() || 'any',
            description: jsdocInfo.description || `Type alias: ${typeAliasDecl.getName()}`,
            optional: false
        });
    }
}

class JSDocFormatter {
    public formatForLLM(jsdocInfo: JSDocInfo): string {
        const lines: string[] = [];
        lines.push(`// External dependency: ${jsdocInfo.name}`);
        if (jsdocInfo.description) lines.push(`// ${jsdocInfo.description}`);
        lines.push(`class ${jsdocInfo.name} {`);
        if (jsdocInfo.constructors.length > 0) {
            jsdocInfo.constructors.forEach(c => {
                if (c.description) lines.push(`    /**\n     * ${c.description}\n     */`);
                lines.push(`    constructor(${c.parameters.map(p => `${p.name}: ${this.simplifyType(p.type)}`).join(', ')});`);
            });
        } else {
            lines.push(`    constructor();`);
        }
        jsdocInfo.properties.forEach(p => {
            if (p.description) lines.push(`    /** ${p.description} */`);
            lines.push(`    ${p.name}: ${this.simplifyType(p.type)};`);
        });
        jsdocInfo.methods.forEach(m => {
            if (m.description) lines.push(`    /**\n     * ${m.description}\n     */`);
            lines.push(`    ${m.name}(${m.parameters.map(p => `${p.name}: ${this.simplifyType(p.type)}`).join(', ')}): ${this.simplifyType(m.returnType)};`);
        });
        lines.push(`}`);
        return lines.join('\n');
    }
    private simplifyType(type: string): string {
        let simplified = type.replace(/import\([^)]+\)\./g, '').replace(/\w+\./g, '').replace(/\s+/g, ' ').trim();
        if (simplified.length > 50) simplified = 'any';
        return simplified;
    }
    public generateUsageExample(jsdocInfo: JSDocInfo): string {
        const lines: string[] = [`// Usage example for ${jsdocInfo.name}:`];
        const constructor = jsdocInfo.constructors[0];
        if (constructor) {
            const params = constructor.parameters.map(p => p.type.includes('string') ? `"example"` : '123').join(', ');
            lines.push(`const instance = new ${jsdocInfo.name}(${params});`);
        } else {
            lines.push(`const instance = new ${jsdocInfo.name}();`);
        }
        const method = jsdocInfo.methods.find(m => !m.name.startsWith('_'));
        if (method) {
            const params = method.parameters.map(p => p.type.includes('string') ? `"key"` : 'value').join(', ');
            lines.push(`const result = ${method.returnType.includes('Promise') ? 'await ' : ''}instance.${method.name}(${params});`);
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
    public async indexAllDependencies(): Promise<void> {
        const packageJsonPath = path.join(this.projectPath, 'package.json');
        if (!fs.existsSync(packageJsonPath)) return;
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const dependencies = { ...packageJson.dependencies || {}, ...packageJson.devDependencies || {} };
        for (const depName of Object.keys(dependencies)) {
            if (depName.startsWith('@types/')) continue;
            const cachedPath = path.join(this.jsdocDir, `${depName}.json`);
            if (fs.existsSync(cachedPath)) continue;
            const jsdocInfo = this.extractor.extractLibraryJSDoc(depName);
            if (jsdocInfo) {
                fs.writeFileSync(cachedPath, JSON.stringify(jsdocInfo, null, 2));
            }
        }
    }
    public loadLibraryJSDoc(libraryName: string): JSDocInfo | null {
        const cachedPath = path.join(this.jsdocDir, `${libraryName}.json`);
        if (!fs.existsSync(cachedPath)) return null;
        return JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
    }
    public getIndexedLibraries(): string[] {
        if (!fs.existsSync(this.jsdocDir)) return [];
        return fs.readdirSync(this.jsdocDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
    }
    public clearIndex(): void {
        if (fs.existsSync(this.jsdocDir)) {
            fs.readdirSync(this.jsdocDir).forEach(file => {
                if (file.endsWith('.json')) {
                    fs.unlinkSync(path.join(this.jsdocDir, file));
                }
            });
        }
    }
}

// --- End of inlined content ---

export class JsdocServiceImpl extends JsdocService {
    private extractor!: JSDocExtractor;
    private formatter!: JSDocFormatter;
    private indexer!: JSDocIndexer;
    private initialized = false;

    initialize(projectPath: string): void {
        this.indexer = new JSDocIndexer(projectPath);
        this.extractor = (this.indexer as any).extractor;
        this.formatter = new JSDocFormatter();
        this.initialized = true;
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('JsdocService has not been initialized.');
        }
    }

    async extractLibraryJSDoc(libraryName: string): Promise<JSDocInfo | null> {
        this.ensureInitialized();
        return Promise.resolve(this.extractor.extractLibraryJSDoc(libraryName));
    }

    formatForLLM(jsdocInfo: JSDocInfo): string {
        this.ensureInitialized();
        return this.formatter.formatForLLM(jsdocInfo);
    }

    generateUsageExample(jsdocInfo: JSDocInfo): string {
        this.ensureInitialized();
        return this.formatter.generateUsageExample(jsdocInfo);
    }

    async indexAllDependencies(): Promise<void> {
        this.ensureInitialized();
        return this.indexer.indexAllDependencies();
    }

    loadLibraryJSDoc(libraryName: string): JSDocInfo | null {
        this.ensureInitialized();
        return this.indexer.loadLibraryJSDoc(libraryName);
    }

    getIndexedLibraries(): string[] {
        this.ensureInitialized();
        return this.indexer.getIndexedLibraries();
    }

    clearCache(): void {
        this.ensureInitialized();
        this.indexer.clearIndex();
    }
}
