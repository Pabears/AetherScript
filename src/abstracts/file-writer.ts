import type { GeneratedFile, WriteResult } from './types.ts'

export interface WriteOperation {
  files: GeneratedFile[]
  projectRoot: string
}

export interface WriteResult {
  writtenFiles: string[]
  containerUpdated: boolean
  dryRun: boolean
}

export abstract class AbstractFileWriter {
  abstract write(op: WriteOperation, dryRun?: boolean): Promise<WriteResult>
  abstract mergeContainer(containerPath: string, registrations: GeneratedFile['diRegistration'][]): Promise<string>
  abstract rollback(): Promise<void>
}
