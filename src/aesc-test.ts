import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync, execSync } from 'child_process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface ScanData {
    classes: Array<{
        className: string;
        jsDoc: string;
        moduleConfig: {
            testType: 'unit' | 'e2e';
            testDir: string;
            testCommand?: string;
        };
    }>;
}

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option("shadow", { type: "boolean", default: false, description: "Run in shadow mode (skip test execution)" })
        .option('project', {
            type: 'string',
            description: 'Target project path',
            demandOption: true,
        })
        .argv;

    const projectPath = resolve(argv.project);
    const scanFile = join(projectPath, '.aesc-scan.json');

    if (!existsSync(scanFile)) {
        console.error(`❌ Error: ${scanFile} not found. Run 'bun run scan' first.`);
        process.exit(1);
    }

    const scanData: ScanData = JSON.parse(readFileSync(scanFile, 'utf-8'));

    if (!scanData.classes || scanData.classes.length === 0) {
        console.log('No classes found in .aesc-scan.json');
        return;
    }

    let remainingClasses = [...scanData.classes];
    let maxRetries = 3;
    let attempt = 0;
    let lastErrorLog = "";

    while (remainingClasses.length > 0 && attempt < maxRetries) {
        attempt++;
        console.log(`\n🚀 启动 Agent 批处理生成测试 (第 ${attempt} 次尝试，剩余 ${remainingClasses.length} 个类)...`);
        
        let prompt = `
You are an elite AetherScript Test Generation Agent.
Task: Generate the complete black-box test suite for a BATCH of classes based ENTIRELY on their JSDoc contracts.
Target Project Root: ${projectPath}

# Core Directives
1. **Naming**: The test file MUST be named \`[classname.toLowerCase()].test.ts\` (e.g. \`customerservice.test.ts\`) or \`[classname.toLowerCase()].e2e.ts\` for e2e.
2. **Framework**: Use \`bun:test\` (describe, it, expect, mock, spyOn).
3. **Logic**: You MUST NOT look at the implementation file. Write tests that verify the \`@edge-cases\`, \`@throws\`, and numbered logic steps defined in the abstract class JSDoc.
4. **Batch Generation**: Generate ALL test files for the classes listed below in this single session. Write each to the \`test/\` directory in the project root.
5. **Autonomy**: You have YOLO mode enabled.

# Classes to Test in this Batch:
${JSON.stringify(remainingClasses.map(c => ({
    className: c.className,
    sourceCode: c.sourceCode,
    moduleConfig: c.moduleConfig
})), null, 2)}
        `.trim();

        if (lastErrorLog) {
            prompt += `\n\n# Previous Attempt Failed!\nHere is the test runner error from your previous attempt. You MUST fix these failing tests:\n\`\`\`text\n${lastErrorLog}\n\`\`\``;
            lastErrorLog = "";
        }

        try {
            // Write prompt to a temporary file to avoid command line length limits and escaping issues
            const tmpPromptFile = join(require('os').tmpdir(), `prompt-test-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`);
            require('fs').writeFileSync(tmpPromptFile, prompt);

            execSync(`agy --dangerously-skip-permissions --model "Gemini 3.5 Flash (High)" -p "$(cat ${tmpPromptFile})"`, {
                cwd: projectPath,
                stdio: 'inherit',
                shell: '/bin/bash'
            });

            require('fs').unlinkSync(tmpPromptFile);
        } catch (error: any) {
            console.error(`\n⚠️ Agent 批处理执行中途退出。Exit Code: ${error.status || 'unknown'}`);
        }

        // 验收闭环 (Outer Validation Loop)
        console.log(`\n🔍 开始使用 bun test 验证测试用例...`);
        const nextMissingClasses = [];

        // 1. Check file existence
        for (const cls of remainingClasses) {
            const isE2e = cls.moduleConfig?.testType === 'e2e';
            const suffix = isE2e ? '.e2e.ts' : '.test.ts';
            const expectedFile = join(projectPath, 'test', cls.className.toLowerCase() + suffix);
            
            if (!existsSync(expectedFile)) {
                console.error(`❌ 未找到生成的测试文件: ${expectedFile}`);
                nextMissingClasses.push(cls);
                lastErrorLog += `Test file missing: test/${cls.className.toLowerCase()}${suffix}\n`;
            }
        }

        // 2. Run test verification
        if (nextMissingClasses.length === 0) {
            if (argv.shadow) {
                console.log(`\n⏳ [Shadow Mode] 静态生成完毕，跳过本地执行验证 (等待主宇宙 Merge 后决战)...`);
                remainingClasses = []; // Assume success for now
            } else {
                try {
                // Find if e2e test is required
                const hasE2e = remainingClasses.some(c => c.moduleConfig?.testType === 'e2e');
                const testCommand = hasE2e ? 'bun run test:e2e' : 'bun test';
                
                console.log(`\n⏳ 执行验证命令: ${testCommand}`);
                const out = execSync(testCommand, { cwd: projectPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
                console.log(out);
                console.log(`\n✅ 所有 ${remainingClasses.length} 个类的测试文件已生成并且通过了验证！`);
                remainingClasses = []; // All good!
            } catch (error: any) {
                const stdout = error.stdout ? error.stdout.toString() : '';
                const stderr = error.stderr ? error.stderr.toString() : '';
                console.log(stdout); // still show output
                console.error(stderr);
                console.error(`\n❌ 测试验证失败，有一些测试逻辑存在错误。将再次把这些类喂给 Agent 修复。`);
                nextMissingClasses.push(...remainingClasses);
                lastErrorLog = stdout + "\n" + stderr;
            }
            }
        }

        if (nextMissingClasses.length > 0) {
            remainingClasses = nextMissingClasses;
            console.log(`\n🔄 本轮结束，还有 ${remainingClasses.length} 个类需要修复。`);
        }
    }

    if (remainingClasses.length > 0) {
        console.error(`\n🚨 [AGENT_FAILURE_SUMMARY] 达到最大重试次数 (${maxRetries})，以下类的测试依然生成失败或未通过验收:`);
        remainingClasses.forEach(c => console.error(` - ${c.className}`));
        process.exit(1);
    } else {
        console.log(`\n🎉 批处理闭环执行完毕，所有测试均已成功生成并验证！`);
    }
}

main().catch(console.error);
