import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { execFileSync, execSync } from 'child_process';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface ScanData {
    classes: Array<{
        className: string;
        filePath: string;
        sourceCode: string;
        autoGenDependencies: Array<{ typeName: string, sourceCode: string }>;
        outputPath: string;
    }>;
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
        console.log(`\n🚀 启动 Agent 批处理生成实现 (第 ${attempt} 次尝试，剩余 ${remainingClasses.length} 个类)...`);
        
        let prompt = `
You are an elite AetherScript Code Generation Agent.
Task: Generate the concrete implementation (impl) files for a BATCH of abstract classes/interfaces based ENTIRELY on their JSDoc contracts.
Target Project Root: ${projectPath}

# Core Directives
1. **Naming**: The class must be named \`[ClassName]Impl\`. If the base is an abstract class, use \`extends\`; if it is an interface, use \`implements\`.
2. **Strictness**: Do NOT redeclare properties already existing in the base class. Directly implement abstract methods.
3. **Logic**: Every numbered step in the JSDoc must be implemented. Every \`@throws\` must have a guard. Every \`@edge-cases\` must be handled.
4. **Imports**: Use relative paths from the \`outputPath\` to import the base class and any dependencies. Do not use absolute paths.
5. **Batch Generation**: Generate ALL implementation files for the classes listed below in this single session. Write each to its specified \`outputPath\`.
6. **Autonomy**: You have YOLO mode enabled.

# Classes to Process in this Batch:
${JSON.stringify(remainingClasses.map(c => ({
    className: c.className,
    sourceCode: c.sourceCode,
    autoGenDependencies: c.autoGenDependencies,
    outputPath: c.outputPath
})), null, 2)}
        `.trim();

        if (lastErrorLog) {
            prompt += `\n\n# Previous Attempt Failed!\nHere is the compiler/validation error from your previous attempt. You MUST fix these errors in the implementation:\n\`\`\`text\n${lastErrorLog}\n\`\`\``;
            lastErrorLog = ""; // reset for next attempt
        }

        try {
            execFileSync('agy', [
                '--dangerously-skip-permissions',
                '--model', 'Gemini 3.5 Flash (High)',
                '-p', prompt
            ], {
                cwd: projectPath,
                stdio: 'inherit'
            });
        } catch (error: any) {
            console.error(`\n⚠️ Agent 批处理执行中途退出。Exit Code: ${error.status || 'unknown'}`);
        }

        // 验收闭环 (Outer Validation Loop)
        console.log(`\n🔍 开始使用 post-processor 验收实现...`);
        const nextMissingClasses = [];

        // 1. Check file existence
        for (const cls of remainingClasses) {
            const expectedFile = join(projectPath, cls.outputPath);
            if (!existsSync(expectedFile)) {
                console.error(`❌ 未找到生成的实现文件: ${expectedFile}`);
                nextMissingClasses.push(cls);
                lastErrorLog += `File missing: ${cls.outputPath}\n`;
            }
        }

        // 2. Run post-processor
        if (nextMissingClasses.length === 0) {
            try {
                const postProcessorPath = resolve(__dirname, 'post-processor.ts');
                // Use pipe to capture stdout/stderr for the agent, but also forward to process.stdout/stderr so user can see it
                const out = execSync(`bun ${postProcessorPath} --project ${projectPath}`, { cwd: projectPath, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
                console.log(out); // print success logs
                console.log(`\n✅ 所有 ${remainingClasses.length} 个类的实现文件已生成并且通过了 ts-morph 契约校验！`);
                remainingClasses = []; // All good!
            } catch (error: any) {
                const stdout = error.stdout ? error.stdout.toString() : '';
                const stderr = error.stderr ? error.stderr.toString() : '';
                console.log(stdout); // still show the user the output
                console.error(stderr);
                console.error(`\n❌ post-processor 契约校验失败。将再次把这些类喂给 Agent 修复。`);
                nextMissingClasses.push(...remainingClasses);
                lastErrorLog = stdout + "\n" + stderr;
            }
        }

        if (nextMissingClasses.length > 0) {
            remainingClasses = nextMissingClasses;
            console.log(`\n🔄 本轮结束，还有 ${remainingClasses.length} 个类需要处理。`);
        }
    }

    if (remainingClasses.length > 0) {
        console.error(`\n🚨 [AGENT_FAILURE_SUMMARY] 达到最大重试次数 (${maxRetries})，以下类的实现生成失败或未通过验收:`);
        remainingClasses.forEach(c => console.error(` - ${c.className}`));
        process.exit(1);
    } else {
        console.log(`\n🎉 批处理闭环执行完毕，所有实现均已成功生成并符合契约！`);
    }
}

main().catch(console.error);
