#!/usr/bin/env bun
// AetherScript (aesc) — AI-Assisted Development You Can Trust
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { execSync } from 'child_process';
import { resolve } from 'path';

const SCRIPTS_DIR = __dirname;

function runScript(scriptName: string, projectPath: string) {
    const scriptPath = resolve(SCRIPTS_DIR, scriptName);
    console.log(`\n======================================================`);
    console.log(`▶ 执行 AetherScript 阶段: ${scriptName}`);
    console.log(`======================================================\n`);
    execSync(`bun ${scriptPath} --project ${projectPath}`, { stdio: 'inherit' });
}

yargs(hideBin(process.argv))
    .scriptName('aesc')
    .usage('Usage: $0 <command> [options]')
    .command(
        'scan',
        '扫描项目 JSDoc 并生成 AST 契约 (.aesc-scan.json)',
        (yargs) => {
            return yargs.option('project', {
                alias: 'p',
                type: 'string',
                description: '目标项目根目录路径',
                default: '.',
            });
        },
        (argv) => {
            runScript('scanner.ts', argv.project);
        }
    )
    .command(
        'gen',
        '根据契约自动批处理生成所有 impl 并校验，同时生成依赖注入容器',
        (yargs) => {
            return yargs.option('project', {
                alias: 'p',
                type: 'string',
                description: '目标项目根目录路径',
                default: '.',
            });
        },
        (argv) => {
            runScript('aesc-gen.ts', argv.project);
            runScript('container-gen.ts', argv.project);
        }
    )
    .command(
        'test',
        '根据契约自动批处理生成黑盒测试并进行运行验证',
        (yargs) => {
            return yargs.option('project', {
                alias: 'p',
                type: 'string',
                description: '目标项目根目录路径',
                default: '.',
            });
        },
        (argv) => {
            runScript('aesc-test.ts', argv.project);
        }
    )
    .command(
        'build',
        '一键执行全自动化流水线 (scan -> gen -> test)',
        (yargs) => {
            return yargs.option('project', {
                alias: 'p',
                type: 'string',
                description: '目标项目根目录路径',
                default: '.',
            });
        },
        (argv) => {
            runScript('scanner.ts', argv.project);
            runScript('aesc-gen.ts', argv.project);
            runScript('container-gen.ts', argv.project);
            runScript('aesc-test.ts', argv.project);
            console.log(`\n🎉 AetherScript Build Pipeline 100% 成功完成！`);
        }
    )
    .demandCommand(1, '请提供一个有效的命令。')
    .help()
    .alias('h', 'help')
    .parse();
