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

    let buildAttempt = 0;
    const maxBuildRetries = 3;
    let integrationSuccess = false;

    while (buildAttempt < maxBuildRetries && !integrationSuccess) {
        buildAttempt++;
        console.log(`\n=== 🔄 Integration Iteration ${buildAttempt}/${maxBuildRetries} ===`);

        console.log(`\n--- [PHASE 3: Merge Back] ---`);
        // Copy generated impls back to main project
        const genSourceDir = join(shadowGen, 'src', 'generated');
        const targetGenDir = join(projectPath, 'src', 'generated');
        if (existsSync(genSourceDir)) {
            cpSync(genSourceDir, targetGenDir, { recursive: true });
            console.log(`✅ Merged implementations to ${targetGenDir}`);
        }

        // Also merge individual outputPaths (for frontend plugins etc)
        const scanData = JSON.parse(readFileSync(scanFile, 'utf-8'));
        if (scanData.classes) {
            for (const cls of scanData.classes) {
                if (cls.outputPath) {
                    const sourceFile = join(shadowGen, cls.outputPath);
                    const targetFile = join(projectPath, cls.outputPath);
                    if (existsSync(sourceFile)) {
                        cpSync(sourceFile, targetFile);
                        console.log(`✅ Merged ${cls.outputPath}`);
                    }
                }
            }
        }

        // Copy generated tests back to main project
        const testSourceDir = join(shadowTest, 'test');
        const targetTestDir = join(projectPath, 'test');
        if (existsSync(testSourceDir)) {
            cpSync(testSourceDir, targetTestDir, { recursive: true });
            console.log(`✅ Merged tests to ${targetTestDir}`);
        }

        console.log(`\n--- [PHASE 4: Integration Test] ---`);
        
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
                console.log(`⏳ Running: bun run build:frontend (for E2E tests)`);
                try {
                    execSync('npm run build:frontend', { cwd: projectPath, stdio: 'pipe' });
                } catch (e) {
                    try {
                        execSync('bun run build:frontend', { cwd: projectPath, stdio: 'pipe' });
                    } catch (err) {}
                }
                console.log(`⏳ Running: bun run test:e2e`);
                execSync('bun run test:e2e', { cwd: projectPath, stdio: 'pipe' });
            }
            integrationSuccess = true;
            console.log(`\n🎉 All integration tests passed! Architecture is pure.`);
        } catch (err: any) {
            const errorOutput = err.stdout?.toString() + "\n" + err.stderr?.toString();
            console.error(`\n❌ [CLASH] Integration tests failed after merge!`);
            console.log(errorOutput);
            
            console.log(`\n--- [PHASE 5: Blind Arbitration (Judge)] ---`);
            console.log(`🧑‍⚖️ Summoning Judge Agent...`);
            
            // 读取所有的契约文件内容提供给裁判
            let contractContents = "";
            try {
                const serviceFiles = require('fs').readdirSync(join(projectPath, 'src', 'service')).filter((f: string) => f.endsWith('.ts'));
                for (const f of serviceFiles) {
                    contractContents += `\n--- [CONTRACT: ${f}] ---\n`;
                    contractContents += require('fs').readFileSync(join(projectPath, 'src', 'service', f), 'utf-8');
                }
            } catch (e: any) {
                console.error(`Failed to read contracts for judge: ${e.message}`);
            }

            // Construct Judge Prompt
            const prompt = `
You are the AetherScript Blind Arbitration Judge.
The integration test failed after merging the independently generated implementation and test.
You must analyze the Abstract Class (The Contract), the test error output, and determine WHO VIOLATED THE CONTRACT.

RULES:
1. If the test asserts behavior that is NOT defined in the contract JSDoc, the test is WRONG (hallucinated requirements).
2. If the implementation fails to meet a requirement explicitly defined in the contract, the implementation is WRONG.
3. You must output your decision strictly and briefly. State who is wrong ("TEST is wrong" or "IMPL is wrong") and give a clear, 1-2 sentence instruction on what they must change to align with the contract. DO NOT write code.

# Contracts:
${contractContents}

# Test Failure Output:
${errorOutput}
            `.trim();

            let judgeOutput = "";
            try {
                console.log(`\n⚖️ Judge is deliberating...`);
                const tmpPromptFile = join(require('os').tmpdir(), `prompt-judge-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`);
                require('fs').writeFileSync(tmpPromptFile, prompt);

                judgeOutput = execSync(`~/.local/bin/agy --model "Gemini 3.1 Pro (High)" -p "$(cat ${tmpPromptFile})"`, {
                    cwd: projectPath,
                    stdio: 'pipe',
                    shell: '/bin/bash',
                    env: process.env
                }).toString();
                
                require('fs').unlinkSync(tmpPromptFile);
                console.log(`\n🧑‍⚖️ Judge Verdict:\n${judgeOutput}`);
            } catch (judgeErr: any) {
                console.error(`\n❌ Judge Agent crashed: ${judgeErr.message}`);
                process.exit(1);
            }
            
            // Parse verdict and trigger counter-attack
            const upperOutput = judgeOutput.toUpperCase();
            try {
                if (upperOutput.includes('TEST IS WRONG')) {
                    console.log(`\n⚔️ Counter-Attack: Triggering TEST Rework...`);
                    await runCommand('bun', [join(AESC_ROOT, 'aesc-test.ts'), '--project', shadowTest, '--shadow', '--feedback', judgeOutput], projectPath, 'TEST-REWORK');
                } else if (upperOutput.includes('IMPL IS WRONG')) {
                    console.log(`\n⚔️ Counter-Attack: Triggering IMPL Rework...`);
                    await runCommand('bun', [join(AESC_ROOT, 'aesc-gen.ts'), '--project', shadowGen, '--feedback', judgeOutput], projectPath, 'IMPL-REWORK');
                } else {
                    console.error(`\n❌ Judge verdict unclear (Could not find 'TEST is wrong' or 'IMPL is wrong'). Aborting retry loop.`);
                    process.exit(1);
                }
            } catch (reworkErr: any) {
                console.error(`\n❌ Rework execution failed: ${reworkErr.message}`);
                process.exit(1);
            }
        }
    }

    if (!integrationSuccess) {
        console.error(`\n❌ Max retries (${maxBuildRetries}) reached. Integration failed. The architecture is flawed.`);
        process.exit(1);
    }
}

main().catch(console.error);
