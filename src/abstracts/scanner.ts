import type { ScanResult, ScannedClass } from './types.ts'

export abstract class AbstractScanner {
  abstract scan(projectDir: string): Promise<ScanResult>
  abstract hasAutogenMarker(fileContent: string): boolean
  abstract extractClassInfo(filePath: string, fileContent: string): ScannedClass[]
}
