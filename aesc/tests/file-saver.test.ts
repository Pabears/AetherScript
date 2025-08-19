import { describe, it, expect, beforeEach, spyOn, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';

import {
  getLockData,
  saveLockData,
  handleLockUnlock,
  ensureOutputDirectory,
  generateContainer,
  saveGeneratedFile,
} from '../src/file-saver';

describe('file-saver', () => {
  const spies: any[] = [];

  beforeEach(() => {
    spies.push(spyOn(fs, 'existsSync').mockImplementation(() => false));
    spies.push(spyOn(fs, 'readFileSync').mockImplementation(() => ''));
    spies.push(spyOn(fs, 'writeFileSync').mockImplementation(() => {}));
    spies.push(spyOn(fs, 'rmSync').mockImplementation(() => {}));
    spies.push(spyOn(fs, 'mkdirSync').mockImplementation(() => {}));
    spies.push(spyOn(fs, 'statSync').mockImplementation(() => ({ isDirectory: () => false, mtimeMs: Date.now() } as any)));
  });

  afterEach(() => {
    for (const spy of spies) {
      spy.mockRestore();
    }
    spies.length = 0;
  });

  describe('getLockData', () => {
    it('should return an empty array if lock file does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      const data = getLockData();
      expect(data).toEqual([]);
    });

    it('should return parsed data if lock file exists and is valid', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('["/path/to/file1"]');
      const data = getLockData();
      expect(data).toEqual(['/path/to/file1']);
    });

    it('should log error and return empty array if lock file is invalid JSON', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('invalid json');
      const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
      spies.push(consoleErrorSpy);
      const data = getLockData();
      expect(data).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should log error and return empty array if readFileSync throws non-ENOENT error', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockImplementation(() => {
        const error: any = new Error('read error');
        error.code = 'EACCES';
        throw error;
      });
      const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
      spies.push(consoleErrorSpy);
      const data = getLockData();
      expect(data).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('saveLockData', () => {
    it('should write the data to the lock file', () => {
      const data = ['/path/to/file1'];
      saveLockData(data);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'aesc.lock',
        JSON.stringify(data, null, 2)
      );
    });

    it('should remove duplicates before writing', () => {
      const data = ['/path/to/file1', '/path/to/file1'];
      saveLockData(data);
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'aesc.lock',
        JSON.stringify(['/path/to/file1'], null, 2)
      );
    });
  });

  describe('ensureOutputDirectory', () => {
    it('should create directory if it does not exist', () => {
      (fs.existsSync as any).mockReturnValue(false);
      ensureOutputDirectory('/output', false);
      expect(fs.mkdirSync).toHaveBeenCalledWith('/output', { recursive: true });
    });

    it('should not clean directory if it exists and force is false', () => {
      (fs.existsSync as any).mockReturnValue(true);
      ensureOutputDirectory('/output', false);
      expect(fs.rmSync).not.toHaveBeenCalled();
      expect(fs.mkdirSync).toHaveBeenCalledWith('/output', { recursive: true });
    });

    it('should clean and create directory if force is true', () => {
      (fs.existsSync as any).mockReturnValue(true);
      ensureOutputDirectory('/output', true);
      expect(fs.rmSync).toHaveBeenCalledWith('/output', { recursive: true, force: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith('/output', { recursive: true });
    });
  });

  describe('saveGeneratedFile', () => {
    it('should write the content to the file', () => {
      saveGeneratedFile('/path/to/file', 'content');
      expect(fs.writeFileSync).toHaveBeenCalledWith('/path/to/file', 'content');
    });
  });

  describe('handleLockUnlock', () => {
    it("should lock a file by adding it to the lock data", () => {
      (fs.existsSync as any).mockReturnValue(true); // lock file exists
      (fs.readFileSync as any).mockReturnValue('[]'); // empty lock file
      (fs.statSync as any).mockReturnValue({ isDirectory: () => false });

      handleLockUnlock(['file.ts'], 'lock');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'aesc.lock',
        expect.stringContaining('file.ts')
      );
    });

    it("should unlock a file and log it", () => {
      const lockedFile = path.resolve('file.ts');
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify([lockedFile]));
      (fs.statSync as any).mockReturnValue({ isDirectory: () => false });
      const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
      spies.push(consoleLogSpy);

      handleLockUnlock(['file.ts'], 'unlock', true);

      expect(fs.writeFileSync).toHaveBeenCalledWith('aesc.lock', '[]' );
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should handle statSync errors", () => {
      (fs.statSync as any).mockImplementation(() => {
        throw new Error('stat error');
      });
      const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
      spies.push(consoleErrorSpy);
      handleLockUnlock(['file.ts'], 'lock');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('generateContainer', () => {
    type PropertyDependency = {
      name: string;
      type: string;
    };
    type GeneratedService = {
      interfaceName: string;
      implName: string;
      implFilePath: string;
      constructorDependencies: string[];
      propertyDependencies: PropertyDependency[];
    };

    it('should generate a DI container with the provided services', async () => {
      const services: GeneratedService[] = [
        {
          interfaceName: 'IServiceA',
          implName: 'ServiceAImpl',
          implFilePath: './service-a.impl.ts',
          constructorDependencies: [],
          propertyDependencies: [
            { name: 'depB', type: 'IServiceB' },
          ],
        },
        {
          interfaceName: 'IServiceB',
          implName: 'ServiceBImpl',
          implFilePath: './service-b.impl.ts',
          constructorDependencies: [],
          propertyDependencies: [],
        },
      ];

      await generateContainer('/output', services);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writtenContent = (fs.writeFileSync as any).mock.calls[0][1];

      expect(writtenContent).toContain('import { ServiceAImpl } from \'./service-a.impl\';');
      expect(writtenContent).toContain('import { ServiceBImpl } from \'./service-b.impl\';');
    });

    it('should handle duplicate services', async () => {
        const services: GeneratedService[] = [
            { interfaceName: 'IServiceA', implName: 'ServiceAImpl', implFilePath: './service-a.impl.ts', constructorDependencies: [], propertyDependencies: [] },
            { interfaceName: 'IServiceA', implName: 'ServiceAImpl', implFilePath: './service-a.impl.ts', constructorDependencies: [], propertyDependencies: [] },
        ];

        await generateContainer('/output', services);

        const writtenContent = (fs.writeFileSync as any).mock.calls[0][1];
        const importCount = (writtenContent.match(/import { ServiceAImpl }/g) || []).length;
        expect(importCount).toBe(1);
    });
  });
});
