import { describe, it, expect, mock, spyOn, afterEach, beforeEach } from 'bun:test';
import * as fs from 'fs';
import { Project } from 'ts-morph';
import { getAllExistingServices } from './generator';

// Mock child modules
mock.module('../file-analysis', () => ({
  getDependencies: mock(() => ({ constructorDeps: [], propertyDeps: [] })),
}));

describe('generator.test.s', () => {

  describe('getAllExistingServices', () => {
    let project: Project;
    // Keep track of spies to restore them
    const spies: { mockRestore: () => void }[] = [];

    beforeEach(() => {
      project = new Project({ useInMemoryFileSystem: true });
    });

    afterEach(() => {
      // Restore all spies after each test
      spies.forEach(spy => spy.mockRestore());
      spies.length = 0; // Clear the array
    });

    it('should return only newly generated services if output directory does not exist', async () => {
      // Arrange
      const existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(false);
      spies.push(existsSyncSpy);

      const newlyGenerated = [{ interfaceName: 'ServiceA', implName: 'ServiceAImpl', implFilePath: './ServiceA.ts', constructorDependencies: [], propertyDependencies: [] }];

      // Act
      const result = await getAllExistingServices('/output', project, newlyGenerated);

      // Assert
      expect(result).toEqual(newlyGenerated);
      expect(existsSyncSpy).toHaveBeenCalledWith('/output');
    });

    it('should return an empty array if output directory exists but is empty and no new services are provided', async () => {
      // Arrange
      const existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(true);
      spies.push(existsSyncSpy);
      const readdirSyncSpy = spyOn(fs, 'readdirSync').mockReturnValue([]);
      spies.push(readdirSyncSpy);

      // Act
      const result = await getAllExistingServices('/output', project, []);

      // Assert
      expect(result).toEqual([]);
      expect(existsSyncSpy).toHaveBeenCalledWith('/output');
      expect(readdirSyncSpy).toHaveBeenCalledWith('/output');
    });
  });
});
