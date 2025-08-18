import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
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
} from './file-saver';

// Mock fs module
spyOn(fs, 'existsSync').mockImplementation(() => false);
spyOn(fs, 'readFileSync').mockImplementation(() => '');
spyOn(fs, 'writeFileSync').mockImplementation(() => {});
spyOn(fs, 'rmSync').mockImplementation(() => {});
spyOn(fs, 'mkdirSync').mockImplementation(() => {});
spyOn(fs, 'statSync').mockImplementation(() => ({ isDirectory: () => false } as any));

describe('file-saver', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (fs.existsSync as any).mockClear();
    (fs.readFileSync as any).mockClear();
    (fs.writeFileSync as any).mockClear();
    (fs.rmSync as any).mockClear();
    (fs.mkdirSync as any).mockClear();
    (fs.statSync as any).mockClear();
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

    it('should return an empty array if lock file is invalid JSON', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('invalid json');
      const data = getLockData();
      expect(data).toEqual([]);
    });

    it('should return an empty array if readFileSync throws', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockImplementation(() => {
        throw new Error('read error');
      });
      const data = getLockData();
      expect(data).toEqual([]);
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

    it("should unlock a file by removing it from the lock data", () => {
      const lockedFile = path.resolve('file.ts');
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify([lockedFile]));
      (fs.statSync as any).mockReturnValue({ isDirectory: () => false });

      handleLockUnlock(['file.ts'], 'unlock');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        'aesc.lock',
        '[]'
      );
    });

    it("should handle statSync errors", () => {
      (fs.statSync as any).mockImplementation(() => {
        throw new Error('stat error');
      });
      const consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
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
      expect(writtenContent).toContain("'IServiceA': ServiceAImpl;");
      expect(writtenContent).toContain("'IServiceB': ServiceBImpl;");
      expect(writtenContent).toContain("'IServiceA': () => {");
      expect(writtenContent).toContain("instance.depB = this.get('IServiceB');");
      expect(writtenContent).toContain("'IServiceB': () => {");
    });
  });
});
