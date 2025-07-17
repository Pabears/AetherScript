import type { JSDocInfo } from './jsdoc-extractor';

export class JSDocFormatter {
    /**
     * 将 JSDoc 信息格式化为适合 LLM 的 TypeScript 代码字符串
     */
    public formatForLLM(jsdocInfo: JSDocInfo): string {
        const lines: string[] = [];
        
        // 添加库的描述
        lines.push(`// External dependency: ${jsdocInfo.name}`);
        if (jsdocInfo.description) {
            lines.push(`// ${jsdocInfo.description}`);
        }
        
        // 开始类定义
        lines.push(`class ${jsdocInfo.name} {`);
        
        // 添加构造函数
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
                
                // 简化构造函数签名
                const paramStrings = constructor.parameters.map(p => 
                    `${p.name}${p.type.includes('undefined') ? '?' : ''}: ${this.simplifyType(p.type)}`
                );
                lines.push(`    constructor(${paramStrings.join(', ')});`);
            }
        } else {
            // 默认构造函数
            lines.push(`    constructor();`);
        }
        
        // 添加属性
        for (const property of jsdocInfo.properties) {
            if (property.description) {
                lines.push(`    /** ${property.description} */`);
            }
            lines.push(`    ${property.name}: ${this.simplifyType(property.type)};`);
        }
        
        // 添加方法
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
            
            // 简化方法签名
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
     * 简化复杂的 TypeScript 类型为更简洁的形式
     */
    private simplifyType(type: string): string {
        // 移除模块路径和复杂的泛型
        let simplified = type
            .replace(/import\([^)]+\)\./g, '') // 移除 import() 路径
            .replace(/\w+\./g, '') // 移除命名空间前缀
            .replace(/\s+/g, ' ') // 标准化空格
            .trim();
        
        // 处理常见的类型简化
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
        
        // 如果类型太复杂，简化为 any
        if (simplified.length > 50) {
            simplified = 'any';
        }
        
        return simplified;
    }
    
    /**
     * 生成使用示例
     */
    public generateUsageExample(jsdocInfo: JSDocInfo): string {
        const lines: string[] = [];
        lines.push(`// Usage example for ${jsdocInfo.name}:`);
        
        // 构造函数示例
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
        
        // 方法调用示例
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
