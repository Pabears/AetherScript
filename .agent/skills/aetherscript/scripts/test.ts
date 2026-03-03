import { Project, ClassDeclaration } from "ts-morph";
import { Glob } from "bun";
import { join } from "path";

// Configuration
const SOURCE_DIR = "src";
const SERVICE_DIR = "src/service";
const GENERATED_DIR = "src/generated";
const TEST_DIR = "test";

interface ServiceInfo {
    name: string;
    implPath: string;
    sourceFile: string;
    abstractClassDef: string;
}

async function main() {
    console.log("🧪 Starting AetherScript Test-Driven Generator...");

    const project = new Project();
    project.addSourceFilesAtPaths(`${SOURCE_DIR}/**/*.ts`);

    const glob = new Glob(`${SERVICE_DIR}/*.ts`);
    const services: ServiceInfo[] = [];

    for await (const file of glob.scan(".")) {
        if (file.includes("node_modules")) continue;

        const content = await Bun.file(file).text();

        // Only process files with // @autogen
        if (!content.includes("// @autogen")) {
            continue;
        }

        const sourceFile = project.getSourceFile(file);
        if (!sourceFile) continue;

        const classNode = sourceFile.getClasses().find(c => c.isAbstract());
        if (!classNode) continue;

        const baseName = classNode.getName();
        if (!baseName) continue;

        // Extract the code block of the abstract class including comments
        const abstractClassDef = classNode.getFullText();

        services.push({
            name: baseName,
            implPath: join(GENERATED_DIR, `${baseName.toLowerCase()}.impl.ts`),
            sourceFile: file,
            abstractClassDef
        });
    }

    console.log(`📂 Found ${services.length} abstract interfaces for Test-Driven Generation.`);

    // Ensure test directory exists
    await Bun.write(join(TEST_DIR, ".gitkeep"), "");

    const CONCURRENCY_LIMIT = 5;

    console.log(`🚀 Executing test generation with concurrency of ${CONCURRENCY_LIMIT}...`);

    const tasks = services.map(service => () => generateTest(service));

    async function runParallel<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
        const results: T[] = new Array(tasks.length);
        let index = 0;
        async function worker() {
            while (index < tasks.length) {
                const currentIndex = index++;
                results[currentIndex] = await tasks[currentIndex]();
            }
        }
        await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
        return results;
    }

    await runParallel(tasks, CONCURRENCY_LIMIT);

    console.log("\n✅ Test-Driven generation complete!");
}

async function generateTest(service: ServiceInfo) {
    const testFileName = `${service.name.toLowerCase()}.test.ts`;
    const testFilePath = join(TEST_DIR, testFileName);

    // Check if test already exists
    if (await Bun.file(testFilePath).exists()) {
        console.log(`⏭️  Skipping ${testFileName} (already exists)`);
        return;
    }

    console.log(`🔄 Generating test for ${service.name} interface...`);

    const prompt = `
You are a rigorous TypeScript Test-Driven Development (TDD) engineer.
Your task is to generate a comprehensive unit test file for a concrete implementation that MUST adhere to the following Abstract Class Contract.

Abstract Interface Contract:
\`\`\`typescript
${service.abstractClassDef}
\`\`\`

Requirements:
1. Use Bun's built-in test runner (\`import { describe, it, expect, beforeEach, mock } from "bun:test"\`)
2. Mock ALL dependencies listed with \`@AutoGen\`. 
   CRITICAL: Do NOT use simple object literals for mocks because the implementation might call unexpected abstract methods (like findObjectsByField). 
   Instead, use a dynamic Proxy to mock dependencies safely. Example pattern:
   \`\`\`typescript
   function createMockDependency() {
       const mocks: Record<string, any> = {};
       return new Proxy({}, {
           get(target, prop: string) {
               if (prop === 'then') return undefined; // Promise bypass
               if (!mocks[prop]) {
                   // Default to mock returning undefined unless the name implies array
                   const isArray = prop.includes('findObjects') || prop.includes('getAll');
                   mocks[prop] = mock(() => Promise.resolve(isArray ? [] : undefined));
               }
               return mocks[prop];
           },
           set(target, prop: string, value: any) {
               mocks[prop] = value;
               return true;
           }
       });
   }
   \`\`\`
   CRITICAL MOCKING RULES:
   - For ANY method that retrieves an object (e.g. \`findObjectById\`, \`getObjectById\`, \`getProject\`), you MUST manually mock it in the test using \`mockResolvedValue({...})\` to return a valid object structure (like \`{ status: 'TODO' }\`). 
   - If you do not manually mock these, the Proxy will return \`undefined\`, which will crash business logic like \`if (task.status === ...)\`!
   - You MUST import the concrete implementation class from \`../src/generated/${service.name.toLowerCase()}.impl.ts\` which is named \`${service.name}Impl\`.
   - Test all public abstract methods perfectly according to the JSDoc contractual rules.

Output ONLY the test file code, no markdown fences or explanations.
`;

    const output = await callGemini(prompt);
    if (output) {
        const clean = extractCodeLocal(output);
        await Bun.write(testFilePath, clean);
        console.log(`  ✓ Generated ${testFilePath}`);
    }
}

function extractCodeLocal(output: string): string {
    let clean = output.trim();
    // Strip markdown fences if present
    if (clean.startsWith("```")) {
        const lines = clean.split("\n");
        if (lines[0].startsWith("```")) lines.shift();
        if (lines[lines.length - 1].startsWith("```")) lines.pop();
        clean = lines.join("\n").trim();
    }
    return clean;
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

main().catch(console.error);
