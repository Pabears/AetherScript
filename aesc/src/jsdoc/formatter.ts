import type { JSDocInfo } from './extractor';

export class JSDocFormatter {
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
            .replace(/\s+/g, ' ') // Normalize spaces
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
