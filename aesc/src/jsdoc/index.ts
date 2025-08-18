/**
 * JSDoc module - unified entry point for JSDoc functionality
 */

// Re-export all JSDoc functionality
export * from './extractor'
export * from './formatter'
export * from './indexer'

// Convenience imports for common use cases
import { JSDocExtractor } from './extractor'
import { JSDocFormatter } from './formatter'
import { JSDocIndexer } from './indexer'

/**
 * High-level JSDoc operations
 */
export class JSDocManager {
  private extractor: JSDocExtractor
  private formatter: JSDocFormatter
  private indexer: JSDocIndexer
  private projectPath: string

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath
    this.extractor = new JSDocExtractor(projectPath)
    this.formatter = new JSDocFormatter()
    this.indexer = new JSDocIndexer(projectPath)
  }

  /**
   * Extract and format JSDoc for a library
   */
  async processLibrary(libraryName: string): Promise<void> {
    try {
      // Extract JSDoc from library
      const extractedData = this.extractor.extractLibraryJSDoc(libraryName)

      if (extractedData) {
        // Format the extracted data
        const formattedData = this.formatter.formatForLLM(extractedData)

        console.log(
          `✅ Successfully processed JSDoc for library: ${libraryName}`,
        )
      } else {
        console.log(`⚠️  No JSDoc found for library: ${libraryName}`)
      }
    } catch (error) {
      console.error(
        `❌ Failed to process JSDoc for library ${libraryName}:`,
        error,
      )
      throw error
    }
  }

  /**
   * Get formatted JSDoc for a library
   */
  getLibraryJSDoc(libraryName: string): JSDocInfo | null {
    return this.extractor.extractLibraryJSDoc(libraryName)
  }

  /**
   * Index all dependencies from package.json
   */
  async indexAllDependencies(): Promise<void> {
    await this.indexer.indexAllDependencies()
  }

  /**
   * Clear JSDoc cache
   */
  clearCache(): void {
    this.indexer.clearIndex()
  }
}
