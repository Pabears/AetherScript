export * from './extractor'
import { JSDocIndexer, type JSDocCache } from './indexer'
import { JSDocExtractor, type JSDocInfo } from './extractor'
import { JSDocFormatter } from './formatter'

let jsdocIndexer: JSDocIndexer | null = null
let jsdocExtractor: JSDocExtractor | null = null
let jsdocFormatter: JSDocFormatter | null = null

function getJSDocIndexer(): JSDocIndexer {
  if (!jsdocIndexer) {
    jsdocIndexer = new JSDocIndexer(process.cwd())
  }
  return jsdocIndexer
}

function getJSDocExtractor(): JSDocExtractor {
  if (!jsdocExtractor) {
    jsdocExtractor = new JSDocExtractor(process.cwd())
  }
  return jsdocExtractor
}

function getJSDocFormatter(): JSDocFormatter {
  if (!jsdocFormatter) {
    jsdocFormatter = new JSDocFormatter()
  }
  return jsdocFormatter
}

/**
 * Index JSDoc documentation from all third-party dependencies
 */
export async function indexJSDoc(): Promise<void> {
  await getJSDocIndexer().indexAllDependencies()
}

/**
 * Clear the JSDoc documentation cache
 */
export function clearJSDocCache(): void {
  getJSDocIndexer().clearIndex()
}

/**
 * Get JSDoc for a specific library, extracting it if not already indexed
 * @param libraryName The name of the library (e.g., 'react', '@angular/core')
 * @returns The JSDoc information, or null if not found
 */
export function getLibraryJSDoc(libraryName: string): JSDocInfo | null {
  const extractor = getJSDocExtractor()
  return extractor.extractLibraryJSDoc(libraryName)
}

/**
 * Format JSDoc information for use in an LLM prompt
 * @param jsdoc The JSDoc information to format
 * @returns A string containing the formatted JSDoc
 */
export function formatJSDocForLLM(jsdoc: JSDocInfo): string {
  const formatter = getJSDocFormatter()
  return formatter.formatForLLM(jsdoc)
}
