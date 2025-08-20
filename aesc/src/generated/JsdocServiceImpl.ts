import { JsdocService } from '../services/JsdocService';
import * as fs from 'fs';
import * as path from 'path';
import { Project, Node, ts } from 'ts-morph';

// --- All JSDoc-related classes are consolidated here to be self-contained ---

interface JSDocInfo {
    name: string;
    description: string;
    methods: { name: string; signature: string; description: string; parameters: { name: string; type: string; description: string }[]; returnType: string; returnDescription: string; }[];
    properties: { name: string; type: string; description: string; optional?: boolean; }[];
    constructors: { signature: string; description: string; parameters: { name: string; type: string; description: string }[]; }[];
}

class JSDocExtractor {
    private project: Project;
    private jsdocDir: string;
    private projectPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.project = new Project({ tsConfigFilePath: path.join(projectPath, 'tsconfig.json') });
        this.jsdocDir = path.join(projectPath, '.jsdoc');
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
        const possiblePaths = [
            `node_modules/${libraryName}/index.d.ts`, `node_modules/${libraryName}/lib/index.d.ts`,
            `node_modules/${libraryName}/types/index.d.ts`, `node_modules/${libraryName}/${libraryName.split('/').pop()}.d.ts`,
            `node_modules/${libraryName}/dist/index.d.ts`, `node_modules/@types/${libraryName}/index.d.ts`,
            `node_modules/@types/${libraryName.replace('@', '').replace('/', '__')}/index.d.ts`,
        ];
        if (!isScoped) {
            possiblePaths.push(`node_modules/@types/${libraryName}/index.d.ts`, `node_modules/@types/${libraryName.replace('-', '_')}/index.d.ts`);
        }
        return possiblePaths.map(p => path.join(this.projectPath, p)).filter(p => fs.existsSync(p));
    }

    private extractJSDocFromFiles(libraryName: string, filePaths: string[]): JSDocInfo | null {
        const jsdocInfo: JSDocInfo = { name: libraryName, description: '', methods: [], properties: [], constructors: [] };
        for (const filePath of filePaths) {
            try {
                const sourceFile = this.project.addSourceFileAtPath(filePath);
                sourceFile.getClasses().forEach(c => this.extractFromClassDeclaration(c, jsdocInfo));
                sourceFile.getInterfaces().forEach(i => this.extractFromInterfaceDeclaration(i, jsdocInfo));
                sourceFile.getExportedDeclarations().forEach(decls => decls.forEach(decl => {
                    if (Node.isClassDeclaration(decl)) this.extractFromClassDeclaration(decl, jsdocInfo);
                    else if (Node.isInterfaceDeclaration(decl)) this.extractFromInterfaceDeclaration(decl, jsdocInfo);
                    else if (Node.isTypeAliasDeclaration(decl)) this.extractFromTypeAliasDeclaration(decl, jsdocInfo);
                }));
            } catch (error) { console.error(`[JSDoc] Error processing file ${filePath}:`, error); }
        }
        return jsdocInfo.methods.length > 0 || jsdocInfo.properties.length > 0 ? jsdocInfo : null;
    }

    private extractFromClassDeclaration(classDecl: any, jsdocInfo: JSDocInfo) {
        const classJSDoc = classDecl.getJsDocs();
        if (classJSDoc.length > 0) jsdocInfo.description = this.extractDescription(classJSDoc[0]);
        classDecl.getConstructors().forEach((c: any) => jsdocInfo.constructors.push(this.extractConstructorInfo(c)));
        classDecl.getMethods().forEach((m: any) => jsdocInfo.methods.push(this.extractMethodInfo(m)));
        classDecl.getProperties().forEach((p: any) => jsdocInfo.properties.push(this.extractPropertyInfo(p)));
    }

    private extractFromInterfaceDeclaration(interfaceDecl: any, jsdocInfo: JSDocInfo) {
        const interfaceJSDoc = interfaceDecl.getJsDocs();
        if (interfaceJSDoc.length > 0) jsdocInfo.description = this.extractDescription(interfaceJSDoc[0]);
        interfaceDecl.getMethods().forEach((m: any) => jsdocInfo.methods.push(this.extractMethodInfo(m)));
        interfaceDecl.getProperties().forEach((p: any) => jsdocInfo.properties.push(this.extractPropertyInfo(p)));
    }

    private extractConstructorInfo = (c: any) => ({ signature: c.getText(), description: c.getJsDocs()[0] ? this.extractDescription(c.getJsDocs()[0]) : '', parameters: c.getParameters().map((p: any) => ({ name: p.getName(), type: p.getType().getText(), description: this.extractParameterDescription(c.getJsDocs(), p.getName()) })) });
    private extractMethodInfo = (m: any) => ({ name: m.getName(), signature: m.getText(), description: m.getJsDocs()[0] ? this.extractDescription(m.getJsDocs()[0]) : '', parameters: m.getParameters().map((p: any) => ({ name: p.getName(), type: p.getType().getText(), description: this.extractParameterDescription(m.getJsDocs(), p.getName()) })), returnType: m.getReturnType().getText(), returnDescription: this.extractReturnDescription(m.getJsDocs()) });
    private extractPropertyInfo = (p: any) => ({ name: p.getName(), type: p.getType().getText(), description: p.getJsDocs()[0] ? this.extractDescription(p.getJsDocs()[0]) : '' });
    private extractDescription = (jsDoc: any) => jsDoc.getDescription() || '';
    private extractParameterDescription = (docs: any[], name: string) => docs.flatMap(d => d.getTags()).find(t => t.getTagName() === 'param' && t.getName() === name)?.getComment() || '';
    private extractReturnDescription = (docs: any[]) => docs.flatMap(d => d.getTags()).find(t => t.getTagName() === 'returns' || t.getTagName() === 'return')?.getComment() || '';
    private extractFromTypeAliasDeclaration = (decl: any, info: JSDocInfo) => { if (decl.getJsDocs().length > 0 && !info.description) { info.description = this.extractDescription(decl.getJsDocs()[0]); } info.properties.push({ name: decl.getName(), type: decl.getTypeNode()?.getText() || 'any', description: info.description || `Type alias: ${decl.getName()}`, optional: false }); };
}

class JSDocFormatter {
    public formatForLLM(jsdocInfo: JSDocInfo): string {
        const lines = [`// External dependency: ${jsdocInfo.name}`];
        if (jsdocInfo.description) lines.push(`// ${jsdocInfo.description}`);
        lines.push(`class ${jsdocInfo.name} {`);
        if (jsdocInfo.constructors.length > 0) {
            jsdocInfo.constructors.forEach(c => {
                if (c.description) lines.push(`    /**`, `     * ${c.description}`, ...c.parameters.filter(p => p.description).map(p => `     * @param ${p.name} ${p.description}`), `     */`);
                lines.push(`    constructor(${c.parameters.map(p => `${p.name}${p.type.includes('undefined') ? '?' : ''}: ${this.simplifyType(p.type)}`).join(', ')});`);
            });
        } else { lines.push(`    constructor();`); }
        jsdocInfo.properties.forEach(p => { if (p.description) lines.push(`    /** ${p.description} */`); lines.push(`    ${p.name}: ${this.simplifyType(p.type)};`); });
        jsdocInfo.methods.forEach(m => {
            if (m.description || m.parameters.some(p => p.description) || m.returnDescription) lines.push(`    /**`, ...(m.description ? [`     * ${m.description}`] : []), ...m.parameters.filter(p => p.description).map(p => `     * @param ${p.name} ${p.description}`), ...(m.returnDescription ? [`     * @returns ${m.returnDescription}`] : []), `     */`);
            lines.push(`    ${m.name}(${m.parameters.map(p => `${p.name}${p.type.includes('undefined') ? '?' : ''}: ${this.simplifyType(p.type)}`).join(', ')}): ${this.simplifyType(m.returnType)};`);
        });
        lines.push(`}`);
        return lines.join('\n');
    }
    private simplifyType = (type: string) => { let s = type.replace(/import\([^)]+\)\./g, '').replace(/\w+\./g, '').replace(/\s+/g, ' ').trim(); const tm = { 'string | undefined': 'string?', 'number | undefined': 'number?', 'boolean | undefined': 'boolean?', 'void': 'void', 'any': 'any', 'unknown': 'any' }; for (const [c, sm] of Object.entries(tm)) { s = s.replace(new RegExp(c, 'g'), sm); } return s.length > 50 ? 'any' : s; };
}

class JSDocIndexer {
    private projectPath: string;
    private jsdocDir: string;
    private extractor: JSDocExtractor;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.jsdocDir = path.join(projectPath, '.jsdoc');
        this.extractor = new JSDocExtractor(projectPath);
        if (!fs.existsSync(this.jsdocDir)) fs.mkdirSync(this.jsdocDir, { recursive: true });
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
            try {
                const jsdocInfo = this.extractor.extractLibraryJSDoc(depName);
                if (jsdocInfo) fs.writeFileSync(cachedPath, JSON.stringify(jsdocInfo, null, 2));
            } catch (error) { console.error(`[JSDoc Indexer] Error indexing ${depName}:`, error); }
        }
    }
    public loadLibraryJSDoc = (libName: string) => { const p = path.join(this.jsdocDir, `${libName}.json`); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null; };
    public getIndexedLibraries = () => fs.existsSync(this.jsdocDir) ? fs.readdirSync(this.jsdocDir).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')) : [];
    public clearIndex = () => { if (fs.existsSync(this.jsdocDir)) fs.readdirSync(this.jsdocDir).forEach(f => { if (f.endsWith('.json')) fs.unlinkSync(path.join(this.jsdocDir, f)); }); };
}

class JSDocManager {
    private extractor: JSDocExtractor;
    private formatter: JSDocFormatter;
    private indexer: JSDocIndexer;

    constructor(projectPath: string = process.cwd()) {
        this.extractor = new JSDocExtractor(projectPath);
        this.formatter = new JSDocFormatter();
        this.indexer = new JSDocIndexer(projectPath);
    }

    async processLibrary(libraryName: string): Promise<void> {
        try {
            const extractedData = this.extractor.extractLibraryJSDoc(libraryName);
            if (extractedData) this.formatter.formatForLLM(extractedData);
        } catch (error) {
            console.error(`❌ Failed to process JSDoc for library ${libraryName}:`, error);
            throw error;
        }
    }
    getLibraryJSDoc = (libraryName: string) => this.extractor.extractLibraryJSDoc(libraryName);
    async indexAllDependencies(): Promise<void> { await this.indexer.indexAllDependencies(); }
    clearCache(): void { this.indexer.clearIndex(); }
}


/**
 * Concrete implementation of the JsdocService.
 * This class is self-contained and includes all necessary logic
 * for JSDoc processing, adapted from the original jsdoc module.
 */
export class JsdocServiceImpl implements JsdocService {
    private jsdocManager: JSDocManager;

    constructor() {
        // The project path can be made configurable if needed in the future.
        this.jsdocManager = new JSDocManager(process.cwd());
    }

    public async processLibrary(libraryName: string): Promise<void> {
        await this.jsdocManager.processLibrary(libraryName);
    }

    public getLibraryJSDoc(libraryName: string): any {
        return this.jsdocManager.getLibraryJSDoc(libraryName);
    }

    public async indexAllDependencies(): Promise<void> {
        await this.jsdocManager.indexAllDependencies();
    }

    public clearCache(): void {
        this.jsdocManager.clearCache();
    }
}
