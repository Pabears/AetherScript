import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Project, SyntaxKind } from 'ts-morph';
import { AbstractValidator } from '../abstracts/validator.ts';
import type {
  GeneratedFile, ScannedClass, ValidationResult, ValidationIssue, DangerousApiConfig,
} from '../abstracts/types.ts';

// ── Strategy Interface ──────────────────────────────────────
interface ValidationStrategy {
  validate(...args: unknown[]): Promise<ValidationIssue[]>;
}

// ── Constants ───────────────────────────────────────────────
const DEFAULT_BANNED_IMPORTS = [
  'child_process', 'fs', 'os', 'net', 'http', 'https', 'crypto',
  'node:child_process', 'node:fs', 'node:os', 'node:net', 'node:http', 'node:https', 'node:crypto',
];
const DEFAULT_BANNED_GLOBALS = ['eval', 'Function', '__proto__'];

// ── 1. ContractStrategy ─────────────────────────────────────
class ContractStrategy implements ValidationStrategy {
  async validate(generated: GeneratedFile[], scanned: ScannedClass[]): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const scannedMap = new Map(scanned.map(s => [s.className, s]));

    for (const file of generated) {
      const spec = scannedMap.get(file.className);
      if (!spec) {
        issues.push({ severity: 'error', code: 'CONTRACT_NO_SPEC', message: `No scanned class found for ${file.className}`, file: file.filename });
        continue;
      }

      const project = new Project({ useInMemoryFileSystem: true });
      // Add type context + abstract source so ts-morph can resolve inheritance
      project.createSourceFile('types.ts', spec.typeContext || '');
      project.createSourceFile('abstract.ts', spec.sourceText || '');
      const src = project.createSourceFile('impl.ts', file.sourceCode);

      const implClass = src.getClasses().find(c => c.getName() === file.implClassName);
      if (!implClass) {
        issues.push({ severity: 'error', code: 'CONTRACT_NO_CLASS', message: `Implementation class ${file.implClassName} not found`, file: file.filename });
        continue;
      }

      const requiredMethods = spec.methodSignatures.map(sig => {
        const match = sig.match(/^\s*(?:abstract\s+)?(\w+)\s*[\(<]/);
        return match?.[1];
      }).filter(Boolean) as string[];

      const implMethods = new Set(
        implClass.getMethods().map(m => m.getName())
      );

      for (const method of requiredMethods) {
        if (!implMethods.has(method)) {
          issues.push({ severity: 'error', code: 'CONTRACT_MISSING_METHOD', message: `Missing implementation of abstract method: ${method}`, file: file.filename });
        }
      }
    }
    return issues;
  }
}

// ── 2. DangerousApiStrategy ─────────────────────────────────
class DangerousApiStrategy implements ValidationStrategy {
  async validate(files: GeneratedFile[], config: DangerousApiConfig): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const bannedImports = new Set(config.bannedImports);
    const bannedGlobals = new Set(config.bannedGlobals);

    // Static import pattern: import ... from 'xxx' / require('xxx')
    const importRe = /(?:from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
    // Dynamic import/require
    const dynamicRe = /(?:import\s*\(|require\s*\()\s*[^'"]/g;
    // globalThis bracket access: globalThis['eval'] / globalThis["Function"]
    const globalAliasRe = /globalThis\s*\[\s*['"](\w+)['"]\s*\]/g;

    for (const file of files) {
      const lines = file.sourceCode.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNo = i + 1;

        // Check static imports
        importRe.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = importRe.exec(line)) !== null) {
          const mod = m[1] || m[2];
          if (bannedImports.has(mod)) {
            issues.push({ severity: 'error', code: 'DANGEROUS_IMPORT', message: `Banned import: "${mod}"`, file: file.filename, line: lineNo });
          }
        }

        // Check dynamic import/require with non-literal arg
        dynamicRe.lastIndex = 0;
        if (dynamicRe.test(line)) {
          issues.push({ severity: 'warning', code: 'DYNAMIC_IMPORT', message: 'Dynamic import/require with non-literal argument', file: file.filename, line: lineNo });
        }

        // Check banned globals (direct usage)
        for (const g of bannedGlobals) {
          const re = new RegExp(`\\b${g}\\b`, 'g');
          // Skip if it appears only in a string or comment-like context (simple heuristic: standalone usage)
          if (re.test(line)) {
            issues.push({ severity: 'error', code: 'DANGEROUS_GLOBAL', message: `Banned global usage: "${g}"`, file: file.filename, line: lineNo });
          }
        }

        // Check globalThis alias access
        globalAliasRe.lastIndex = 0;
        while ((m = globalAliasRe.exec(line)) !== null) {
          const name = m[1];
          if (bannedGlobals.has(name)) {
            issues.push({ severity: 'error', code: 'DANGEROUS_ALIAS', message: `Banned globalThis alias access: globalThis['${name}']`, file: file.filename, line: lineNo });
          }
        }
      }

      // Check custom banned patterns
      if (config.bannedPatterns) {
        for (const pattern of config.bannedPatterns) {
          pattern.lastIndex = 0;
          const lines2 = file.sourceCode.split('\n');
          for (let i = 0; i < lines2.length; i++) {
            pattern.lastIndex = 0;
            if (pattern.test(lines2[i])) {
              issues.push({ severity: 'warning', code: 'BANNED_PATTERN', message: `Matched banned pattern: ${pattern}`, file: file.filename, line: i + 1 });
            }
          }
        }
      }
    }
    return issues;
  }
}

// ── 3. CompilationStrategy ──────────────────────────────────
class CompilationStrategy implements ValidationStrategy {
  async validate(files: GeneratedFile[], projectRoot: string): Promise<ValidationIssue[]> {
    const issues: ValidationIssue[] = [];
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aether-validate-'));

    try {
      // Write generated files to tmp
      const fileNames: string[] = [];
      for (const file of files) {
        const filePath = path.join(tmpDir, file.filename);
        fs.writeFileSync(filePath, file.sourceCode, 'utf-8');
        fileNames.push(filePath);
      }

      // Read tsconfig if available
      let compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        esModuleInterop: true,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      };

      const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const parsed = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
        if (parsed.config) {
          const converted = ts.parseJsonConfigFileContent(parsed.config, ts.sys, projectRoot);
          compilerOptions = { ...converted.options, noEmit: true, skipLibCheck: true };
        }
      }

      const program = ts.createProgram(fileNames, compilerOptions);
      const diagnostics = ts.getPreEmitDiagnostics(program);

      for (const diag of diagnostics) {
        const severity = diag.category === ts.DiagnosticCategory.Error ? 'error' : 'warning';
        const msg = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        const fileName = diag.file?.fileName || 'unknown';
        const line = diag.file && diag.start != null
          ? diag.file.getLineAndCharacterOfPosition(diag.start).line + 1
          : undefined;
        issues.push({ severity, code: `TS${diag.code}`, message: msg, file: path.basename(fileName), line });
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    return issues;
  }
}

// ── ValidatorImpl ───────────────────────────────────────────
export class ValidatorImpl extends AbstractValidator {
  private contractStrategy = new ContractStrategy();
  private dangerousApiStrategy = new DangerousApiStrategy();
  private compilationStrategy = new CompilationStrategy();

  async verifyContract(generated: GeneratedFile[], scanned: ScannedClass[]): Promise<ValidationResult> {
    const issues = await this.contractStrategy.validate(generated, scanned);
    return { passed: issues.every(i => i.severity !== 'error'), issues };
  }

  async scanDangerousApis(files: GeneratedFile[], config: DangerousApiConfig): Promise<ValidationResult> {
    const merged: DangerousApiConfig = {
      bannedImports: config.bannedImports.length ? config.bannedImports : DEFAULT_BANNED_IMPORTS,
      bannedGlobals: config.bannedGlobals.length ? config.bannedGlobals : DEFAULT_BANNED_GLOBALS,
      bannedPatterns: config.bannedPatterns,
    };
    const issues = await this.dangerousApiStrategy.validate(files, merged);
    return { passed: issues.every(i => i.severity !== 'error'), issues };
  }

  async checkCompilation(files: GeneratedFile[], projectRoot: string): Promise<ValidationResult> {
    const issues = await this.compilationStrategy.validate(files, projectRoot);
    return { passed: issues.every(i => i.severity !== 'error'), issues };
  }

  async validateAll(
    generated: GeneratedFile[],
    scanned: ScannedClass[],
    projectRoot: string,
    dangerousApiConfig: DangerousApiConfig,
  ): Promise<ValidationResult> {
    const [contract, dangerous, compilation] = await Promise.all([
      this.verifyContract(generated, scanned),
      this.scanDangerousApis(generated, dangerousApiConfig),
      this.checkCompilation(generated, projectRoot),
    ]);
    const allIssues = [...contract.issues, ...dangerous.issues, ...compilation.issues];
    return { passed: allIssues.every(i => i.severity !== 'error'), issues: allIssues };
  }
}
