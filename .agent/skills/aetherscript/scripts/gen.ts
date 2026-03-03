import { Glob } from "bun";
import { join, relative } from "path";
import { createHash } from "crypto";
import { Project, ClassDeclaration, Type } from "ts-morph";

// Configuration
const SOURCE_DIR = ".";
const GENERATED_DIR = "src/generated";
const CACHE_FILE = join(GENERATED_DIR, ".autogen-cache.json");
const CONCURRENCY_LIMIT = 5; // Max parallel LLM calls

interface ServiceMeta {
    name: string;
    implPath: string;
    className: string;
    dependencies: { field: string; type: string }[];
}

interface CacheEntry {
    hash: string;
    serviceMeta: ServiceMeta;
}

interface CacheData {
    [filePath: string]: CacheEntry;
}

// --- Cache Manager ---
async function loadCache(): Promise<CacheData> {
    try {
        const file = Bun.file(CACHE_FILE);
        if (await file.exists()) {
            return await file.json();
        }
    } catch (e) {
        console.warn("⚠️ Failed to load cache, starting fresh.");
    }
    return {};
}

async function saveCache(cache: CacheData): Promise<void> {
    await Bun.write(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function computeHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
}

// --- Concurrency Limiter ---
async function runParallel<T>(
    tasks: (() => Promise<T>)[],
    limit: number
): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let index = 0;

    async function worker() {
        while (index < tasks.length) {
            const currentIndex = index++;
            results[currentIndex] = await tasks[currentIndex]();
        }
    }

    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

// --- AST Context Extraction ---
function extractLocalTypes(classNode: ClassDeclaration): string {
    const extractedTypes = new Set<string>();
    let typeContext = "";

    // Helper to traverse types (depth=1)
    const processType = (type: Type) => {
        // Unpack arrays/promises to get inner type
        if (type.isArray() && type.getArrayElementType()) {
            processType(type.getArrayElementType()!);
            return;
        }

        const symbol = type.getSymbol() || type.getAliasSymbol();
        if (!symbol) return;

        if (symbol.getName() === "Promise") {
            const typeArgs = type.getTypeArguments();
            if (typeArgs.length > 0) processType(typeArgs[0]);
            return;
        }

        const decls = symbol.getDeclarations();
        for (const decl of decls) {
            // Only care about local interfaces/types/classes defined in our project files
            const sourceFile = decl.getSourceFile();
            if (sourceFile.getFilePath().includes("node_modules")) continue;

            // Avoid extracting globally known types like String, Boolean
            const name = symbol.getName();
            if (["String", "Number", "Boolean", "Date", "Array", "Promise", "Object"].includes(name)) continue;
            if (extractedTypes.has(name)) continue;

            extractedTypes.add(name);
            typeContext += `\n// Definition for ${name} from ${sourceFile.getBaseName()}\n`;
            typeContext += decl.getText() + "\n";
        }
    };

    // 1. Process method parameters and return types
    for (const method of classNode.getMethods()) {
        if (!method.isAbstract()) continue;
        for (const param of method.getParameters()) {
            processType(param.getType());
        }
        processType(method.getReturnType());
    }

    // 2. Process class properties (dependencies like NotificationService, ProductService)
    for (const prop of classNode.getProperties()) {
        processType(prop.getType());
    }

    return typeContext;
}

// --- Main ---
async function main() {
    console.log("🚀 Starting Optimized Gemini Autogen with ts-morph...");
    const startTime = Date.now();

    const cache = await loadCache();
    const newCache: CacheData = {};

    // 1. Initialize ts-morph project
    const project = new Project({
        tsConfigFilePath: join(SOURCE_DIR, "tsconfig.json"),
        skipAddingFilesFromTsConfig: true,
    });

    // Add all typescript files dynamically
    const glob = new Glob("src/**/*.ts");
    const filePaths: string[] = [];
    for await (const file of glob.scan(SOURCE_DIR)) {
        if (!file.includes("generated") && !file.includes("node_modules") && !file.endsWith(".d.ts")) {
            filePaths.push(file);
        }
    }
    project.addSourceFilesAtPaths(filePaths);

    const classesToProcess: {
        file: string;
        content: string;
        className: string;
        classNode: ClassDeclaration
    }[] = [];

    // 2. Scan for @autogen classes using AST
    for (const sourceFile of project.getSourceFiles()) {
        const classes = sourceFile.getClasses();
        for (const cls of classes) {
            // Check for // @autogen or @AutoGen in leading comments
            const leadingComments = cls.getLeadingCommentRanges().map(c => c.getText());
            const hasAutogen = leadingComments.some(c => c.includes("@AutoGen") || c.includes("@autogen"));

            if (hasAutogen && cls.isAbstract() && cls.getName()) {
                classesToProcess.push({
                    file: sourceFile.getFilePath(),
                    content: sourceFile.getFullText(),
                    className: cls.getName()!,
                    classNode: cls
                });
            }
        }
    }

    console.log(`📂 Found ${classesToProcess.length} abstract classes to process.`);

    // 3. Process files in parallel with caching
    const tasks = classesToProcess.map(({ file, content, className, classNode }) => {
        return async (): Promise<ServiceMeta | null> => {
            const hash = computeHash(content);
            const implFileName = `${className.toLowerCase()}.impl.ts`;
            const implFilePath = join(GENERATED_DIR, implFileName);

            const cached = cache[file];
            const implExists = await Bun.file(implFilePath).exists();

            if (cached && cached.hash === hash && implExists) {
                console.log(`⚡ Cache hit: ${file}`);
                newCache[file] = cached;
                return cached.serviceMeta;
            }

            console.log(`🔄 Processing: ${file}`);
            const result = await handleAbstractClass(file, content, className, classNode, project);

            if (result) {
                newCache[file] = { hash, serviceMeta: result };
            }

            return result;
        };
    });

    const results = await runParallel(tasks, CONCURRENCY_LIMIT);
    const services = results.filter((s): s is ServiceMeta => s !== null);

    // Sort for deterministic container generation
    services.sort((a, b) => a.name.localeCompare(b.name));

    // 4. Generate Container
    await generateContainer(services);

    // 5. Save cache
    await saveCache(newCache);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Autogen complete in ${duration}s`);
}

async function handleAbstractClass(
    file: string,
    content: string,
    className: string,
    classNode: ClassDeclaration,
    project: Project
): Promise<ServiceMeta | null> {
    // 1. Extract Dependencies using AST instead of fragile Regex
    const dependencies: { field: string; type: string }[] = [];

    for (const prop of classNode.getProperties()) {
        const comments = prop.getLeadingCommentRanges().map(c => c.getText());
        const hasAutogen = comments.some(c => c.includes("@AutoGen") || c.includes("@autogen"));
        if (hasAutogen) {
            const field = prop.getName();
            let typeText = prop.getTypeNode()?.getText() || prop.getType().getText(prop);
            typeText = typeText.replace(" | undefined", "").trim();
            if (typeText.includes("import(")) {
                const parts = typeText.split(".");
                typeText = parts[parts.length - 1];
            }
            dependencies.push({ field, type: typeText });
        }
    }

    // 2. Extract Type Context (depth=1)
    const typeContext = extractLocalTypes(classNode);

    const implClassName = `${className}Impl`;
    const implFileName = `${className.toLowerCase()}.impl.ts`;
    const implFilePath = join(GENERATED_DIR, implFileName);

    let relativePath = relative(GENERATED_DIR, file).replace(/\.ts$/, "");
    if (!relativePath.startsWith(".")) {
        relativePath = "./" + relativePath;
    }

    let prompt = `
You are an expert TypeScript Code Generator.
Task: Implement a concrete class for the following Abstract Class.

Source File: ${file}
Class Name: ${className}
Implementation Name: ${implClassName}

Instructions:
1. Create a class \`${implClassName}\` that extends \`${className}\`.
2. Implement ALL abstract methods found in the source content.
3. You must use the \`@AutoGen\` decorator if useful, or just standard TS overrides.
4. For method logic:
   - Follow comments in the source code closely (e.g. validation rules, db calls).
   - If \`DB\` is used, assume standard methods like \`save(obj)\`, \`find(id)\` exist on it if typed.
5. You MUST include imports.
   - You MUST import the original class: \`import { ${className} } from '${relativePath}';\`
   - Preserve other necessary imports from the original file (adjusting paths to be relative to \`src/generated\`).
6. The file should export the class as a NAMED export: \`export class ${implClassName} ...\`

<Source_Content>
\`\`\`typescript
${content}
\`\`\`
</Source_Content>

<Type_Definitions>
The following are local types/interfaces referenced in the source content. 
Use these to understand the exact structure of the objects you are manipulating:
\`\`\`typescript
${typeContext || "// No external local types found."}
\`\`\`
</Type_Definitions>

Rules:
1. Output ONLY the valid TypeScript code.
2. Wrap code in <CODE_BLOCK>.
3. <DEPENDENCIES> if needed.
`;

    const MAX_RETRIES = 2;
    let attempt = 0;
    let finalCode = "";

    while (attempt <= MAX_RETRIES) {
        attempt++;
        const output = await callGemini(prompt);
        if (!output) {
            console.error(`  ❌ Failed to get LLM response for ${implClassName}`);
            return null;
        }

        const code = extractCodeLocal(output);
        finalCode = `// Generated from ${file}\n${code}`;

        // Write to file for ts-morph to analyze
        await Bun.write(implFilePath, finalCode);

        // Analyze with ts-morph
        let sourceFile = project.getSourceFile(implFilePath);
        if (!sourceFile) {
            sourceFile = project.addSourceFileAtPath(implFilePath);
        } else {
            sourceFile.refreshFromFileSystemSync();
        }

        const diagnostics = sourceFile.getPreEmitDiagnostics();

        if (diagnostics.length === 0) {
            console.log(`  ✓ Generated ${implFilePath} (Attempt ${attempt}: Syntax OK)`);
            return {
                name: className,
                implPath: `./${implFileName.replace(".ts", "")}`,
                className: implClassName,
                dependencies
            };
        }

        // Errors found -> Self-healing loop
        console.warn(`  🔄 Attempt ${attempt} failed syntax/type check for ${implClassName}. Executing Self-Healing...`);
        const errorMessages = diagnostics.map(d => {
            const msg = typeof d.getMessageText() === 'string' ? d.getMessageText() : d.getMessageText().toString();
            return `Line ${d.getLineNumber()}: ${msg}`;
        }).join("\n");

        if (attempt > MAX_RETRIES) {
            console.error(`  ❌ Max retries reached for ${implClassName}. Keeping output but it contains errors:\n${errorMessages}`);
            break;
        }

        // Prepare prompt for next iteration
        prompt = `
The previous TypeScript code you generated for ${implClassName} contains the following compiler errors:

<COMPILER_ERRORS>
${errorMessages}
</COMPILER_ERRORS>

Here is the exact code you generated that caused these errors:
<YOUR_PREVIOUS_CODE>
\`\`\`typescript
${finalCode}
\`\`\`
</YOUR_PREVIOUS_CODE>

Task: Fix ALL of the above compiler errors and output the complete, corrected TypeScript code. Do NOT hallucinate methods that were not defined in the original Type Definitions.
Rules:
1. Output ONLY the valid TypeScript code.
2. Wrap code in <CODE_BLOCK>.
`;
    }

    return {
        name: className,
        implPath: `./${implFileName.replace(".ts", "")}`,
        className: implClassName,
        dependencies
    };
}

async function generateContainer(services: ServiceMeta[]) {
    const containerPath = join(GENERATED_DIR, "container.ts");
    console.log("📦 Generating Container...");

    const imports = services.map(s => `import { ${s.className} } from '${s.implPath}';`).join("\n");

    const instantiations = services.map(s => `        const ${toLowerCase(s.name)} = new ${s.className}();`).join("\n");
    const registrations = services.map(s => `        this.services.set('${s.name}', ${toLowerCase(s.name)});`).join("\n");
    const injections = services.map(s => {
        return s.dependencies.map(d => {
            return `        ${toLowerCase(s.name)}.${d.field} = ${toLowerCase(d.type)}; // Injected ${d.type}`;
        }).join("\n");
    }).filter(s => s).join("\n");

    const code = `
${imports}

class Container {
    private services = new Map<string, any>();

    constructor() {
        this.registerServices();
    }

    private registerServices() {
        // 1. Instantiate
${instantiations}

        // 2. Inject
${injections}

        // 3. Register
${registrations}
    }

    public get(name: string): any {
        return this.services.get(name);
    }
}

export const container = new Container();
`;
    await Bun.write(containerPath, code);
    console.log(`  ✓ Generated ${containerPath}`);
}

function toLowerCase(str: string) {
    return str.charAt(0).toLowerCase() + str.slice(1);
}

async function callGemini(prompt: string): Promise<string | null> {
    try {
        const proc = Bun.spawn(["gemini", "-p", prompt], {
            stdout: "pipe",
            stderr: "pipe",
        });

        await proc.exited;

        if (proc.exitCode !== 0) {
            const errorOutput = await new Response(proc.stderr).text();
            console.error(`Gemini CLI Error (Exit Code: ${proc.exitCode}):`, errorOutput);
            return null;
        }

        const output = await new Response(proc.stdout).text();
        return output;
    } catch (e) {
        console.error("Gemini Spawn Exception:", e);
        return null;
    }
}

function extractCodeLocal(rawOutput: string): string {
    let text = rawOutput.trim();

    // 1. Try to find `<CODE_BLOCK>` tags if the LLM followed instructions perfectly
    const codeBlockMatch = text.match(/<CODE_BLOCK>([\s\S]*?)<\/CODE_BLOCK>/);
    if (codeBlockMatch && codeBlockMatch[1]) {
        text = codeBlockMatch[1].trim();
    }

    // 2. Try to find standard markdown TypeScript fences
    const mdBlockMatch = text.match(/```(?:typescript|ts)?\s([\s\S]*?)```/);
    if (mdBlockMatch && mdBlockMatch[1]) {
        text = mdBlockMatch[1].trim();
    }

    // 3. Fallback: just strip raw backticks if they are at the very edges
    if (text.startsWith("```")) {
        const parts = text.split("\n");
        if (parts.length > 1) {
            if (parts[0].startsWith("\`\`\`")) parts.shift();
            if (parts[parts.length - 1].startsWith("\`\`\`")) parts.pop();
            text = parts.join("\n").trim();
        }
    }

    return text;
}

main().catch(console.error);
