import { Glob } from "bun";
import { join, relative } from "path";

// Configuration
const SOURCE_DIR = ".";
const GENERATED_DIR = "src/generated";
const TEST_DIR = "test";

interface ServiceInfo {
    name: string;
    implPath: string;
    sourceFile: string;
}

async function main() {
    console.log("🧪 Starting AetherScript Test Generator...");

    // Find all generated impl files
    const glob = new Glob(`${GENERATED_DIR}/*.impl.ts`);
    const services: ServiceInfo[] = [];

    for await (const file of glob.scan(SOURCE_DIR)) {
        if (file.includes("node_modules")) continue;

        const content = await Bun.file(file).text();

        // Extract class name
        const classMatch = content.match(/export class (\w+Impl)/);
        if (classMatch) {
            const implName = classMatch[1];
            const baseName = implName.replace("Impl", "");
            services.push({
                name: baseName,
                implPath: file.replace(/\.ts$/, ""),
                sourceFile: file
            });
        }
    }

    console.log(`📂 Found ${services.length} implementations to test.`);

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

    console.log("\n✅ Test generation complete!");
}

async function generateTest(service: ServiceInfo) {
    const testFileName = `${service.name.toLowerCase()}.test.ts`;
    const testFilePath = join(TEST_DIR, testFileName);

    // Check if test already exists
    if (await Bun.file(testFilePath).exists()) {
        console.log(`⏭️  Skipping ${testFileName} (already exists)`);
        return;
    }

    console.log(`🔄 Generating test for ${service.name}...`);

    // Read the implementation
    const implContent = await Bun.file(service.sourceFile).text();

    const prompt = `
You are a TypeScript test generator.
Generate a comprehensive test file for the following implementation.

Implementation:
\`\`\`typescript
${implContent}
\`\`\`

Requirements:
1. Use Bun's built-in test runner (\`import { describe, it, expect, beforeEach } from "bun:test"\`)
2. Mock dependencies (use simple object mocks, no external libraries)
3. Test all public methods
4. Include happy path and edge cases
5. Import the implementation class

Output ONLY the test file code, no markdown fences.
`;

    const output = await callGemini(prompt);
    if (output) {
        const clean = cleanOutput(output);
        await Bun.write(testFilePath, clean);
        console.log(`  ✓ Generated ${testFilePath}`);
    }
}

function cleanOutput(output: string): string {
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
        const output = await new Response(proc.stdout).text();
        return output;
    } catch (e) {
        console.error("Gemini Error:", e);
        return null;
    }
}

main().catch(console.error);
