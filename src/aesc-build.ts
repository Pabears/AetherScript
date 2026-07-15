import { readFileSync, existsSync, cpSync, rmSync, symlinkSync, cp } from 'fs';
import { join, resolve, basename } from 'path';
import { spawn, execSync } from 'child_process';
import { tmpdir } from 'os';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const AESC_ROOT = __dirname; // This is AetherScript/src

// Helper to run a command and stream output
function runCommand(command: string, args: string[], cwd: string, prefix: string = ''): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 [${prefix}] ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, { cwd, stdio: 'inherit' });
        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`[${prefix}] failed with exit code ${code}`));
        });
    });
}

// Copies project but ignores node_modules and .git
function createShadowWorkspace(projectPath: string, shadowPath: string) {
    if (existsSync(shadowPath)) {
        rmSync(shadowPath, { recursive: true, force: true });
    }
    cpSync(projectPath, shadowPath, {
        recursive: true,
        filter: (src) => {
            const name = basename(src);
            if (name === 'node_modules' || name === '.git' || name === '.aesc') return false;
            return true;
        }
    });
    // Create symlink to node_modules for fast module resolution
    const nmPath = join(projectPath, 'node_modules');
    if (existsSync(nmPath)) {
        symlinkSync(nmPath, join(shadowPath, 'node_modules'), 'dir');
    }
}

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('project', {
            type: 'string',
            description: 'Target project path',
            demandOption: true,
        })
        .argv;

    const projectPath = resolve(argv.project);
    const projectName = basename(projectPath);
    const scanFile = join(projectPath, '.aesc-scan.json');

    if (!existsSync(scanFile)) {
        console.error(`❌ Error: ${scanFile} not found. Run 'bun run scan' first.`);
        process.exit(1);
    }

    const aescDir = join(tmpdir(), `.aesc-${projectName}-${Date.now()}`);
    const shadowGen = join(aescDir, 'shadow-gen');
    const shadowTest = join(aescDir, 'shadow-test');

    console.log(`\n--- [PHASE 1: Forking] Creating Shadow Workspaces ---`);
    createShadowWorkspace(projectPath, shadowGen);
    createShadowWorkspace(projectPath, shadowTest);
    console.log(`✅ Created shadow workspaces in .aesc/`);

    console.log(`\n--- [PHASE 2: Parallel Execution] ---`);
    console.log(`Spawning aesc-gen and aesc-test in parallel...`);

    const genPromise = runCommand('bun', [join(AESC_ROOT, 'aesc-gen.ts'), '--project', shadowGen], projectPath, 'GEN');
    const testPromise = runCommand('bun', [join(AESC_ROOT, 'aesc-test.ts'), '--project', shadowTest, '--shadow'], projectPath, 'TEST');

    try {
        await Promise.all([genPromise, testPromise]);
        console.log(`\n✅ Parallel generation completed successfully!`);
    } catch (err: any) {
        console.error(`\n❌ Error during parallel generation:`, err.message);
        process.exit(1);
    }

    console.log(`\n--- [PHASE 3: Merge Back] ---`);
    // Copy generated impls back to main project
    const genSourceDir = join(shadowGen, 'src', 'generated');
    const targetGenDir = join(projectPath, 'src', 'generated');
    if (existsSync(genSourceDir)) {
        cpSync(genSourceDir, targetGenDir, { recursive: true });
        console.log(`✅ Merged implementations to ${targetGenDir}`);
    }

    // Copy generated tests back to main project
    const testSourceDir = join(shadowTest, 'test');
    const targetTestDir = join(projectPath, 'test');
    if (existsSync(testSourceDir)) {
        cpSync(testSourceDir, targetTestDir, { recursive: true });
        console.log(`✅ Merged tests to ${targetTestDir}`);
    }

    console.log(`\n--- [PHASE 4: Integration Test] ---`);
    
    // We need to figure out if we should run `bun test` or `bun run test:e2e`.
    // Let's read the scan file from the main project.
    const scanData = JSON.parse(readFileSync(scanFile, 'utf-8'));
    let hasE2e = false;
    let hasUnit = false;
    
    if (scanData.classes) {
        for (const cls of scanData.classes) {
            if (cls.moduleConfig?.testType === 'e2e') hasE2e = true;
            else hasUnit = true;
        }
    }

    try {
        if (hasUnit || (!hasUnit && !hasE2e)) {
            console.log(`⏳ Running: bun test`);
            execSync('bun test', { cwd: projectPath, stdio: 'pipe' });
        }
        if (hasE2e) {
            console.log(`⏳ Running: bun run test:e2e`);
            execSync('bun run test:e2e', { cwd: projectPath, stdio: 'pipe' });
        }
        console.log(`\n🎉 All integration tests passed! Architecture is pure.`);
    } catch (err: any) {
        const errorOutput = err.stdout?.toString() + "\n" + err.stderr?.toString();
        console.error(`\n❌ [CLASH] Integration tests failed after merge!`);
        console.log(errorOutput);
        
        console.log(`\n--- [PHASE 5: Blind Arbitration (Judge)] ---`);
        console.log(`🧑‍⚖️ Summoning Judge Agent...`);
        
        // Construct Judge Prompt
        const prompt = `
You are the AetherScript Blind Arbitration Judge.
The integration test failed after merging the independently generated implementation and test.
You must analyze the Abstract Class (The Contract), the test error output, and determine WHO VIOLATED THE CONTRACT.

RULES:
1. If the test asserts behavior that is NOT defined in the contract JSDoc, the test is WRONG (hallucinated requirements).
2. If the implementation fails to meet a requirement explicitly defined in the contract, the implementation is WRONG.
3. You must output your decision strictly and briefly. State who is wrong ("TEST" or "IMPL") and give a clear, 1-2 sentence instruction on what they must change to align with the contract. DO NOT write code.

# Test Failure Output:
${errorOutput}
        `.trim();

        try {
            console.log(`\n⚖️ Judge is deliberating...`);
            // Write prompt to a temporary file
            const tmpPromptFile = join(require('os').tmpdir(), `prompt-judge-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`);
            require('fs').writeFileSync(tmpPromptFile, prompt);

            execSync(`agy --model "Gemini 3.5 Pro" -p "$(cat ${tmpPromptFile})"`, {
                cwd: projectPath,
                stdio: 'inherit',
                shell: '/bin/bash'
            });
            require('fs').unlinkSync(tmpPromptFile);
        } catch (judgeErr: any) {
            console.error(`\n❌ Judge Agent crashed.`);
        }
        
        process.exit(1);
    }
}

main().catch(console.error);
