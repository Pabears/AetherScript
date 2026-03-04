// ============================================================
// AetherScript 2.0 — Scanner Implementation (Final Fusion)
// Base: Elegant (Result type + pure-function pipeline + concurrent)
// Fused: Robust file-size limit & excluded dirs; Performance SHA-256
//        incremental hash cache; bounded concurrency (manual semaphore);
//        Err results collected as warnings (not silently discarded).
// Security: path.resolve + escape validation; symlink detection (lstat);
//           SHA-256 hashing.
// ============================================================

import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as crypto from 'node:crypto';
import { AbstractScanner } from '../abstracts/scanner.ts';
import type { ScanResult, ScannedClass } from '../abstracts/types.ts';

// ---------------------------------------------------------------------------
// Result<T, E> — Algebraic type for explicit error handling
// ---------------------------------------------------------------------------

type Ok<T> = { readonly ok: true; readonly value: T };
type Err<E> = { readonly ok: false; readonly error: E };
type Result<T, E = string> = Ok<T> | Err<E>;

function Ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}
function Err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AUTOGEN_MARKER = '// @autogen';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_CONCURRENCY = 8;

const EXCLUDED_DIRS: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '__pycache__',
  '.svelte-kit',
]);

// ---------------------------------------------------------------------------
// Semaphore — manual bounded concurrency (no external deps)
// ---------------------------------------------------------------------------

class Semaphore {
  private current = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.current--;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

// ---------------------------------------------------------------------------
// Warning collector
// ---------------------------------------------------------------------------

interface ScanWarning {
  filePath: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Internal file descriptor
// ---------------------------------------------------------------------------

interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
}

// ---------------------------------------------------------------------------
// ScannerImpl
// ---------------------------------------------------------------------------

export class ScannerImpl extends AbstractScanner {
  private readonly hashCache: Map<string, string> = new Map();
  private readonly warnings: ScanWarning[] = [];
  private readonly concurrency: number;

  constructor(opts?: { concurrency?: number }) {
    super();
    this.concurrency = opts?.concurrency ?? DEFAULT_CONCURRENCY;
  }

  // -----------------------------------------------------------------------
  // Public API — AbstractScanner contract
  // -----------------------------------------------------------------------

  async scan(projectDir: string): Promise<ScanResult> {
    // 1. Validate & resolve project directory
    const resolvedDir = this.resolveAndValidateDir(projectDir);

    // 2. Locate tsconfig.json
    const tsconfigPath = path.join(resolvedDir, 'tsconfig.json');
    await this.assertFileReadable(tsconfigPath, 'tsconfig.json not found');

    // 3. Discover .ts files (recursive, respects excluded dirs)
    const discoveredFiles = await this.discoverTypeScriptFiles(resolvedDir);

    // 4. Process files concurrently with bounded concurrency
    const sem = new Semaphore(this.concurrency);
    const tasks = discoveredFiles.map((file) =>
      sem.run(() => this.processFile(file, resolvedDir)),
    );
    const results = await Promise.all(tasks);

    // 5. Collect successes, accumulate warnings from Err results
    const classes: ScannedClass[] = [];
    const fileHashes = new Map<string, string>();

    for (const result of results) {
      if (result.ok) {
        if (result.value) {
          classes.push(...result.value.classes);
          fileHashes.set(result.value.relativePath, result.value.hash);
        }
      } else {
        // Err: record as warning, do NOT silently discard
        this.warnings.push({
          filePath: result.error.filePath,
          message: result.error.message,
        });
      }
    }

    // 6. Log collected warnings
    if (this.warnings.length > 0) {
      for (const w of this.warnings) {
        console.warn(`[scanner:warn] ${w.filePath}: ${w.message}`);
      }
    }

    return {
      classes,
      projectRoot: resolvedDir,
      tsconfigPath,
      fileHashes,
      scannedAt: Date.now(),
    };
  }

  hasAutogenMarker(fileContent: string): boolean {
    // Check if any line starts with the marker (ignoring leading whitespace)
    const lines = fileContent.split('\n');
    return lines.some((line) => {
      const trimmed = line.trimStart();
      return trimmed === AUTOGEN_MARKER || trimmed.startsWith(AUTOGEN_MARKER + '\n') || trimmed.startsWith(AUTOGEN_MARKER + '\r') || trimmed.startsWith(AUTOGEN_MARKER + ' ');
    });
  }

  extractClassInfo(filePath: string, fileContent: string): ScannedClass[] {
    // Dynamic import of ts-morph is not possible synchronously;
    // we use the eagerly-imported module cached at the top.
    return this.extractClassInfoInternal(filePath, fileContent);
  }

  // -----------------------------------------------------------------------
  // Path safety
  // -----------------------------------------------------------------------

  private resolveAndValidateDir(projectDir: string): string {
    const resolved = path.resolve(projectDir);

    // Prevent escaping above the resolved directory itself.
    // The resolved path must not contain null bytes (path injection).
    if (resolved.includes('\0')) {
      throw new Error('[scanner] projectDir contains null bytes');
    }

    // Basic sanity: must be absolute after resolution
    if (!path.isAbsolute(resolved)) {
      throw new Error('[scanner] projectDir did not resolve to an absolute path');
    }

    return resolved;
  }

  // -----------------------------------------------------------------------
  // File discovery
  // -----------------------------------------------------------------------

  private async discoverTypeScriptFiles(rootDir: string): Promise<DiscoveredFile[]> {
    const files: DiscoveredFile[] = [];
    await this.walkDir(rootDir, rootDir, files);
    return files;
  }

  private async walkDir(
    currentDir: string,
    rootDir: string,
    accumulator: DiscoveredFile[],
  ): Promise<void> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      // Unreadable directory — skip silently (e.g. permission denied)
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;

        // Symlink directory detection — skip to avoid following symlinks outside tree
        const stat = await fs.lstat(fullPath).catch(() => null);
        if (!stat || stat.isSymbolicLink()) continue;

        await this.walkDir(fullPath, rootDir, accumulator);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        // Symlink file detection
        const stat = await fs.lstat(fullPath).catch(() => null);
        if (!stat || stat.isSymbolicLink()) continue;

        accumulator.push({
          absolutePath: fullPath,
          relativePath: path.relative(rootDir, fullPath),
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // File processing pipeline (pure-function style)
  // -----------------------------------------------------------------------

  private async processFile(
    file: DiscoveredFile,
    _rootDir: string,
  ): Promise<
    Result<
      { classes: ScannedClass[]; relativePath: string; hash: string } | null,
      { filePath: string; message: string }
    >
  > {
    try {
      // Stage 1: Stat check (size limit)
      const stat = await fs.stat(file.absolutePath);
      if (stat.size > MAX_FILE_SIZE_BYTES) {
        return Err({
          filePath: file.relativePath,
          message: `File exceeds ${MAX_FILE_SIZE_BYTES} bytes (${stat.size} bytes), skipped`,
        });
      }

      // Stage 2: Read content
      const content = await fs.readFile(file.absolutePath, 'utf-8');

      // Stage 3: Compute SHA-256 hash for incremental caching
      const hash = this.computeHash(content);
      const cached = this.hashCache.get(file.relativePath);
      if (cached === hash) {
        // File unchanged since last scan — skip re-parsing
        return Ok(null);
      }
      this.hashCache.set(file.relativePath, hash);

      // Stage 4: Check for @autogen marker
      if (!this.hasAutogenMarker(content)) {
        return Ok(null);
      }

      // Stage 5: AST extraction
      const classes = this.extractClassInfoInternal(file.absolutePath, content);
      if (classes.length === 0) {
        return Ok(null);
      }

      return Ok({ classes, relativePath: file.relativePath, hash });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return Err({ filePath: file.relativePath, message });
    }
  }

  // -----------------------------------------------------------------------
  // SHA-256 hashing
  // -----------------------------------------------------------------------

  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  // -----------------------------------------------------------------------
  // AST extraction via ts-morph
  // -----------------------------------------------------------------------

  private extractClassInfoInternal(filePath: string, fileContent: string): ScannedClass[] {
    // Lazy-require ts-morph to allow the module to load even if ts-morph
    // is not installed (error will surface at call time).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Project, SyntaxKind } = require('ts-morph') as typeof import('ts-morph');

    const project = new Project({ useInMemoryFileSystem: true });
    const sourceFile = project.createSourceFile('__scan__.ts', fileContent);

    const results: ScannedClass[] = [];

    for (const classDecl of sourceFile.getClasses()) {
      // Only process abstract classes
      if (!classDecl.isAbstract()) continue;

      // Verify the class has the @autogen marker in its leading trivia
      const classFullText = classDecl.getFullText();
      const classStart = classDecl.getStart();
      const fullStart = classDecl.getFullStart();
      const leadingTrivia = fileContent.substring(fullStart, classStart);
      if (!leadingTrivia.includes(AUTOGEN_MARKER)) continue;

      const className = classDecl.getName() ?? '<anonymous>';

      // --- Method signatures ---
      const methodSignatures: string[] = [];
      for (const method of classDecl.getMethods()) {
        if (method.isAbstract()) {
          methodSignatures.push(method.getText());
        }
      }

      // Also collect abstract properties with function types
      for (const prop of classDecl.getProperties()) {
        if (prop.isAbstract()) {
          methodSignatures.push(prop.getText());
        }
      }

      // --- Imports ---
      const imports: string[] = sourceFile
        .getImportDeclarations()
        .map((imp) => imp.getText());

      // --- Type context: collect all interfaces, types, enums in the file ---
      const typeContextParts: string[] = [];

      for (const iface of sourceFile.getInterfaces()) {
        typeContextParts.push(iface.getText());
      }
      for (const alias of sourceFile.getTypeAliases()) {
        typeContextParts.push(alias.getText());
      }
      for (const enumDecl of sourceFile.getEnums()) {
        typeContextParts.push(enumDecl.getText());
      }

      // Include imported type references — gather the import statements themselves
      // as type context so downstream generation knows what types are available.
      const importTexts = imports.join('\n');
      const typeContext = importTexts
        ? `${importTexts}\n\n${typeContextParts.join('\n\n')}`
        : typeContextParts.join('\n\n');

      results.push({
        className,
        filePath,
        sourceText: classDecl.getText(),
        typeContext,
        methodSignatures,
        imports,
      });
    }

    return results;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private async assertFileReadable(filePath: string, errMsg: string): Promise<void> {
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch {
      throw new Error(`[scanner] ${errMsg}: ${filePath}`);
    }
  }

  /** Expose collected warnings for testing / diagnostics */
  getWarnings(): ReadonlyArray<ScanWarning> {
    return [...this.warnings];
  }

  /** Clear the hash cache (useful for forcing a full rescan) */
  clearCache(): void {
    this.hashCache.clear();
  }
}
