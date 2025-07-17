import * as fs from 'fs';
import * as path from 'path';
import { Project, Node, ts } from 'ts-morph';

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

export class JSDocExtractor {
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
     * 提取指定第三方库的 JSDoc 信息
     */
    public extractLibraryJSDoc(libraryName: string): JSDocInfo | null {
        try {
            // 尝试从缓存中读取
            const cachedPath = path.join(this.jsdocDir, `${libraryName}.json`);
            if (fs.existsSync(cachedPath)) {
                const cached = JSON.parse(fs.readFileSync(cachedPath, 'utf-8'));
                console.log(`[JSDoc] Using cached documentation for ${libraryName}`);
                return cached;
            }

            // 查找库的类型定义文件
            const typeDefPaths = this.findTypeDefinitionFiles(libraryName);
            if (typeDefPaths.length === 0) {
                console.log(`[JSDoc] No type definition files found for ${libraryName}`);
                return null;
            }

            // 提取 JSDoc 信息
            const jsdocInfo = this.extractJSDocFromFiles(libraryName, typeDefPaths);
            
            // 缓存结果
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
        // 处理 scoped packages (如 @types/node)
        const isScoped = libraryName.startsWith('@');
        const normalizedName = isScoped ? libraryName : libraryName;
        
        const possiblePaths = [
            // 主包的类型定义文件
            `node_modules/${normalizedName}/index.d.ts`,
            `node_modules/${normalizedName}/lib/index.d.ts`,
            `node_modules/${normalizedName}/types/index.d.ts`,
            `node_modules/${normalizedName}/${normalizedName.split('/').pop()}.d.ts`,
            `node_modules/${normalizedName}/dist/index.d.ts`,
            // @types 包的类型定义文件
            `node_modules/@types/${normalizedName}/index.d.ts`,
            `node_modules/@types/${normalizedName.replace('@', '').replace('/', '__')}/index.d.ts`,
        ];

        // 如果不是 scoped package，也尝试查找对应的 @types 包
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
                
                // 查找主要的类或接口声明
                const classes = sourceFile.getClasses();
                const interfaces = sourceFile.getInterfaces();
                
                console.log(`[JSDoc] Found ${classes.length} classes and ${interfaces.length} interfaces`);
                
                // 处理所有类声明（不仅仅是匹配名称的）
                for (const classDecl of classes) {
                    const className = classDecl.getName();
                    console.log(`[JSDoc] Processing class: ${className}`);
                    this.extractFromClassDeclaration(classDecl, jsdocInfo);
                }

                // 处理所有接口声明
                for (const interfaceDecl of interfaces) {
                    const interfaceName = interfaceDecl.getName();
                    console.log(`[JSDoc] Processing interface: ${interfaceName}`);
                    this.extractFromInterfaceDeclaration(interfaceDecl, jsdocInfo);
                }

                // 查找导出的声明
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
                            // 处理类型别名声明
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
        // 提取类的描述
        const classJSDoc = classDecl.getJsDocs();
        if (classJSDoc.length > 0) {
            jsdocInfo.description = this.extractDescription(classJSDoc[0]);
        }

        // 提取构造函数
        const constructors = classDecl.getConstructors();
        for (const constructor of constructors) {
            const constructorInfo = this.extractConstructorInfo(constructor);
            if (constructorInfo) {
                jsdocInfo.constructors.push(constructorInfo);
            }
        }

        // 提取方法
        const methods = classDecl.getMethods();
        for (const method of methods) {
            const methodInfo = this.extractMethodInfo(method);
            if (methodInfo) {
                jsdocInfo.methods.push(methodInfo);
            }
        }

        // 提取属性
        const properties = classDecl.getProperties();
        for (const property of properties) {
            const propertyInfo = this.extractPropertyInfo(property);
            if (propertyInfo) {
                jsdocInfo.properties.push(propertyInfo);
            }
        }
    }

    private extractFromInterfaceDeclaration(interfaceDecl: any, jsdocInfo: JSDocInfo) {
        // 提取接口的描述
        const interfaceJSDoc = interfaceDecl.getJsDocs();
        if (interfaceJSDoc.length > 0) {
            jsdocInfo.description = this.extractDescription(interfaceJSDoc[0]);
        }

        // 提取方法签名
        const methods = interfaceDecl.getMethods();
        for (const method of methods) {
            const methodInfo = this.extractMethodInfo(method);
            if (methodInfo) {
                jsdocInfo.methods.push(methodInfo);
            }
        }

        // 提取属性签名
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
                // 忽略错误
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
                // 忽略错误
            }
        }
        return '';
    }

    private extractFromTypeAliasDeclaration(typeAliasDecl: any, jsdocInfo: JSDocInfo) {
        // 提取类型别名的描述
        const typeAliasJSDoc = typeAliasDecl.getJsDocs();
        if (typeAliasJSDoc.length > 0) {
            if (!jsdocInfo.description) {
                jsdocInfo.description = this.extractDescription(typeAliasJSDoc[0]);
            }
        }

        // 对于类型别名，我们可以提取其基本信息作为属性
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
