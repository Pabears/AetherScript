// ============================================================
// AetherScript 2.0 — FileWriter 最终融合实现
// 基底：优雅派（RAII Transaction + 正确内容回滚 + 关注点分离）
// 融合：性能派并发写 + .bak 备份 | 稳健派防御校验 | rename 原子写入
// 裁决日期：2026-03-04
// ============================================================

import { AbstractFileWriter, type WriteOperation, type WriteResult } from '../abstracts/file-writer.ts';
import type { GeneratedFile } from '../abstracts/types.ts';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Tracks a single file's state for transactional rollback */
interface TransactionEntry {
  /** Absolute target path in generatedDir */
  targetPath: string;
  /** Original content before write (null = file did not exist) */
  originalContent: string | null;
  /** Path of .bak file (null if original did not exist) */
  backupPath: string | null;
  /** Temp file path used for staged write */
  tempPath: string;
  /** Whether the rename (commit) has been executed */
  committed: boolean;
}

// ---------------------------------------------------------------------------
// FileWriter Implementation
// ---------------------------------------------------------------------------

export class FileWriterImpl extends AbstractFileWriter {
  /** Current transaction ledger; null when no transaction is active */
  private transaction: TransactionEntry[] | null = null;

  /** Temp directory for the current transaction */
  private tempDir: string | null = null;

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  async write(op: WriteOperation, dryRun = false): Promise<WriteResult> {
    // ── Defensive parameter validation (稳健派) ──────────────────────
    this.validateWriteOperation(op);

    const generatedDir = path.resolve(op.projectRoot, 'src', 'generated');

    if (dryRun) {
      return this.executeDryRun(op, generatedDir);
    }

    // ── Begin RAII Transaction (优雅派) ──────────────────────────────
    await fs.mkdir(generatedDir, { recursive: true });

    // Create temp dir on same filesystem for atomic rename
    // We use generatedDir as the base so rename is a same-partition operation
    this.tempDir = await fs.mkdtemp(path.join(generatedDir, '.aether-tmp-'));
    this.transaction = [];

    try {
      // ── Stage 1: Concurrent temp-file writes (性能派 Promise.all) ──
      await this.stageFiles(op.files, generatedDir);

      // ── Stage 2: Atomic commit via rename ─────────────────────────
      await this.commitAll();

      // ── Stage 3: Merge DI container ───────────────────────────────
      const registrations = op.files
        .map((f) => f.diRegistration)
        .filter((r): r is NonNullable<typeof r> => r != null);

      let containerUpdated = false;
      if (registrations.length > 0) {
        const containerPath = path.join(generatedDir, 'container.ts');
        await this.mergeContainer(containerPath, registrations);
        containerUpdated = true;
      }

      const writtenFiles = this.transaction.map((e) => e.targetPath);

      // Transaction succeeded — clear the ledger
      const result: WriteResult = {
        writtenFiles,
        containerUpdated,
        dryRun: false,
      };

      return result;
    } catch (err) {
      // ── Automatic rollback on any failure (RAII guarantee) ────────
      await this.rollback();
      throw err;
    } finally {
      // ── Cleanup temp directory ────────────────────────────────────
      await this.cleanupTempDir();
    }
  }

  async mergeContainer(
    containerPath: string,
    registrations: GeneratedFile['diRegistration'][],
  ): Promise<string> {
    if (!registrations || registrations.length === 0) {
      throw new Error('mergeContainer: registrations array must not be empty');
    }

    // Read existing container content (TOCTOU-safe: try/catch, not existsSync)
    let existingContent: string;
    try {
      existingContent = await fs.readFile(containerPath, 'utf-8');
    } catch {
      existingContent = '';
    }

    const importLines: string[] = [];
    const bindLines: string[] = [];

    for (const reg of registrations) {
      if (!reg || !reg.abstractName || !reg.implName || !reg.importPath) {
        throw new Error(
          `mergeContainer: invalid registration entry — abstractName, implName, importPath are all required`,
        );
      }

      const importLine = `import { ${reg.implName} } from '${reg.importPath}';`;
      const bindLine = `  container.bind<${reg.abstractName}>(${reg.implName});`;

      // Avoid duplicate imports if container already contains them
      if (!existingContent.includes(importLine)) {
        importLines.push(importLine);
      }
      if (!existingContent.includes(bindLine)) {
        bindLines.push(bindLine);
      }
    }

    let content: string;

    if (existingContent.trim().length === 0) {
      // Generate fresh container file
      content = [
        '// ============================================================',
        '// AetherScript 2.0 — Auto-generated DI Container',
        '// DO NOT EDIT — this file is regenerated on each write pass',
        '// ============================================================',
        '',
        ...importLines,
        '',
        'export function configureContainer(container: any): void {',
        ...bindLines,
        '}',
        '',
      ].join('\n');
    } else {
      // Merge into existing content
      content = existingContent;

      // Inject new imports before the first blank line or at the top
      if (importLines.length > 0) {
        const importBlock = importLines.join('\n');
        const insertPos = content.lastIndexOf('\nimport ');
        if (insertPos !== -1) {
          // Find the end of the last import line
          const lineEnd = content.indexOf('\n', insertPos + 1);
          content =
            content.slice(0, lineEnd + 1) +
            importBlock +
            '\n' +
            content.slice(lineEnd + 1);
        } else {
          content = importBlock + '\n' + content;
        }
      }

      // Inject new bind lines before the closing brace of configureContainer
      if (bindLines.length > 0) {
        const closingBrace = content.lastIndexOf('}');
        if (closingBrace !== -1) {
          content =
            content.slice(0, closingBrace) +
            bindLines.join('\n') +
            '\n' +
            content.slice(closingBrace);
        }
      }
    }

    await fs.writeFile(containerPath, content, 'utf-8');
    return content;
  }

  async rollback(): Promise<void> {
    if (!this.transaction || this.transaction.length === 0) {
      return;
    }

    // Reverse order: undo the most recent writes first
    const entries = [...this.transaction].reverse();

    for (const entry of entries) {
      try {
        if (!entry.committed) {
          // File was never renamed into place — nothing to undo
          continue;
        }

        if (entry.originalContent !== null) {
          // ── Restore from in-memory content (优雅派: correct content rollback) ──
          await fs.writeFile(entry.targetPath, entry.originalContent, 'utf-8');
        } else {
          // File did not exist before — remove it
          await fs.unlink(entry.targetPath).catch(() => {
            // Best-effort: file may already be gone
          });
        }

        // Also try restoring from .bak if in-memory restore fails
        // (.bak serves as persistent rollback supplement — 性能派)
      } catch (restoreErr) {
        // Fallback: try .bak file
        if (entry.backupPath) {
          try {
            const backupContent = await fs.readFile(entry.backupPath, 'utf-8');
            await fs.writeFile(entry.targetPath, backupContent, 'utf-8');
          } catch {
            // Both restore paths failed — log but don't throw
            // (rollback must be best-effort to avoid masking original error)
            console.error(
              `[FileWriter] CRITICAL: Failed to rollback ${entry.targetPath}`,
            );
          }
        }
      }
    }

    // Cleanup .bak files
    for (const entry of entries) {
      if (entry.backupPath) {
        await fs.unlink(entry.backupPath).catch(() => {});
      }
    }

    this.transaction = null;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Validate write operation parameters (稳健派 defensive checks).
   */
  private validateWriteOperation(op: WriteOperation): void {
    if (!op) {
      throw new Error('write: WriteOperation must not be null/undefined');
    }
    if (!op.projectRoot || typeof op.projectRoot !== 'string') {
      throw new Error('write: projectRoot must be a non-empty string');
    }
    if (!Array.isArray(op.files)) {
      throw new Error('write: files must be an array');
    }
    if (op.files.length === 0) {
      throw new Error('write: files array must not be empty');
    }
    for (const file of op.files) {
      if (!file.filename || typeof file.filename !== 'string') {
        throw new Error('write: each file must have a non-empty filename');
      }
      if (typeof file.sourceCode !== 'string') {
        throw new Error(
          `write: file "${file.filename}" must have sourceCode as a string`,
        );
      }
    }
  }

  /**
   * Validate that a resolved path is within the generatedDir boundary.
   * Prevents path traversal attacks (阻塞级安全).
   */
  private assertWithinBoundary(
    resolvedPath: string,
    generatedDir: string,
  ): void {
    const normalizedTarget = path.resolve(resolvedPath);
    const normalizedBoundary = path.resolve(generatedDir);

    // Must start with boundary + separator (or be exactly the boundary)
    if (
      normalizedTarget !== normalizedBoundary &&
      !normalizedTarget.startsWith(normalizedBoundary + path.sep)
    ) {
      throw new Error(
        `Path traversal blocked: "${resolvedPath}" escapes generatedDir "${generatedDir}"`,
      );
    }
  }

  /**
   * Dry-run mode: resolve paths and validate without writing.
   */
  private async executeDryRun(
    op: WriteOperation,
    generatedDir: string,
  ): Promise<WriteResult> {
    const writtenFiles: string[] = [];

    for (const file of op.files) {
      const targetPath = path.resolve(generatedDir, file.filename);
      this.assertWithinBoundary(targetPath, generatedDir);
      writtenFiles.push(targetPath);
    }

    return {
      writtenFiles,
      containerUpdated: false,
      dryRun: true,
    };
  }

  /**
   * Stage all files concurrently into temp directory.
   * Captures original content for rollback + creates .bak backups.
   * (性能派 Promise.all + 优雅派 RAII ledger)
   */
  private async stageFiles(
    files: GeneratedFile[],
    generatedDir: string,
  ): Promise<void> {
    await Promise.all(
      files.map(async (file, index) => {
        const targetPath = path.resolve(generatedDir, file.filename);

        // ── Path traversal check (阻塞级安全) ────────────────────────
        this.assertWithinBoundary(targetPath, generatedDir);

        // ── Capture original content for rollback (TOCTOU-safe) ─────
        let originalContent: string | null = null;
        let backupPath: string | null = null;

        try {
          originalContent = await fs.readFile(targetPath, 'utf-8');
        } catch {
          // File does not exist — original is null
          originalContent = null;
        }

        // ── Create .bak persistent backup (性能派 supplement) ────────
        if (originalContent !== null) {
          backupPath = `${targetPath}.bak`;
          await fs.writeFile(backupPath, originalContent, 'utf-8');
        }

        // ── Write to temp file (same partition for atomic rename) ────
        const tempPath = path.join(this.tempDir!, `${index}-${file.filename}`);
        // Ensure subdirectory exists in temp dir if filename contains path segments
        await fs.mkdir(path.dirname(tempPath), { recursive: true });
        await fs.writeFile(tempPath, file.sourceCode, 'utf-8');

        // ── Record in transaction ledger ────────────────────────────
        const entry: TransactionEntry = {
          targetPath,
          originalContent,
          backupPath,
          tempPath,
          committed: false,
        };

        this.transaction!.push(entry);
      }),
    );
  }

  /**
   * Commit all staged files via atomic rename (稳健派 same-partition rename).
   * If any rename fails, preceding renames can be rolled back via the ledger.
   */
  private async commitAll(): Promise<void> {
    for (const entry of this.transaction!) {
      // Ensure target directory exists (handles nested filenames)
      await fs.mkdir(path.dirname(entry.targetPath), { recursive: true });

      // Atomic rename: temp → target (same filesystem = single inode update)
      await fs.rename(entry.tempPath, entry.targetPath);
      entry.committed = true;
    }
  }

  /**
   * Remove the temporary directory and all its contents.
   */
  private async cleanupTempDir(): Promise<void> {
    if (this.tempDir) {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup
      }
      this.tempDir = null;
    }
  }
}
