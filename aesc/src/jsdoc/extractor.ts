import * as fs from 'fs'
import * as path from 'path'
import {
  Project,
  Node,
  ts,
  JSDoc,
  ParameterDeclaration,
  PropertyDeclaration,
  PropertySignature,
  MethodDeclaration,
  ConstructorDeclaration,
  ClassDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
} from 'ts-morph'

export interface JSDocInfo {
  name: string
  description: string
  methods: {
    name: string
    signature: string
    description: string
    parameters: { name: string; type: string; description: string }[]
    returnType: string
    returnDescription: string
  }[]
  properties: {
    name: string
    type: string
    description: string
    optional?: boolean
  }[]
  constructors: {
    signature: string
    description: string
    parameters: { name: string; type: string; description: string }[]
  }[]
}

export class JSDocExtractor {
  private project: Project
  private jsdocDir: string
  private projectPath: string

  constructor(projectPath: string, project?: Project) {
    this.projectPath = projectPath
    this.project = project || new Project({
      tsConfigFilePath: path.join(projectPath, 'tsconfig.json'),
    })
    this.jsdocDir = path.join(projectPath, '.jsdoc')
    this.ensureJSDocDir()
  }

  private ensureJSDocDir() {
    if (!fs.existsSync(this.jsdocDir)) {
      fs.mkdirSync(this.jsdocDir, { recursive: true })
    }
  }

  /**
   * Extract JSDoc information for specified third-party library
   */
  public extractLibraryJSDoc(libraryName: string): JSDocInfo | null {
    try {
      // Try to read from cache
      const cachedPath = path.join(this.jsdocDir, `${libraryName}.json`)
      if (fs.existsSync(cachedPath)) {
        const cached = JSON.parse(fs.readFileSync(cachedPath, 'utf-8'))
        console.log(`[JSDoc] Using cached documentation for ${libraryName}`)
        return cached
      }

      // Find library's type definition files
      const typeDefPaths = this.findTypeDefinitionFiles(libraryName)
      if (typeDefPaths.length === 0) {
        console.log(`[JSDoc] No type definition files found for ${libraryName}`)
        return null
      }

      // Extract JSDoc information
      const jsdocInfo = this.extractJSDocFromFiles(libraryName, typeDefPaths)

      // Cache results
      if (jsdocInfo) {
        fs.writeFileSync(cachedPath, JSON.stringify(jsdocInfo, null, 2))
        console.log(`[JSDoc] Cached documentation for ${libraryName}`)
      }

      return jsdocInfo
    } catch (error) {
      console.error(
        `[JSDoc] Error extracting documentation for ${libraryName}:`,
        error,
      )
      return null
    }
  }

  private findTypeDefinitionFiles(libraryName: string): string[] {
    // Handle scoped packages (like @types/node)
    const isScoped = libraryName.startsWith('@')
    const normalizedName = isScoped ? libraryName : libraryName

    const possiblePaths = [
      // Main package's type definition file
      `node_modules/${normalizedName}/index.d.ts`,
      `node_modules/${normalizedName}/lib/index.d.ts`,
      `node_modules/${normalizedName}/types/index.d.ts`,
      `node_modules/${normalizedName}/${normalizedName.split('/').pop()}.d.ts`,
      `node_modules/${normalizedName}/dist/index.d.ts`,
      // @types package's type definition file
      `node_modules/@types/${normalizedName}/index.d.ts`,
      `node_modules/@types/${normalizedName.replace('@', '').replace('/', '__')}/index.d.ts`,
    ]

    // If not a scoped package, also try to find corresponding @types package
    if (!isScoped) {
      possiblePaths.push(
        `node_modules/@types/${normalizedName}/index.d.ts`,
        `node_modules/@types/${normalizedName.replace('-', '_')}/index.d.ts`,
      )
    }

    const existingPaths: string[] = []

    for (const relativePath of possiblePaths) {
      const fullPath = path.join(this.projectPath, relativePath)
      if (fs.existsSync(fullPath)) {
        console.log(`[JSDoc] Found type definition file: ${fullPath}`)
        existingPaths.push(fullPath)
      }
    }

    if (existingPaths.length === 0) {
      console.log(`[JSDoc] No type definition files found for ${libraryName}`)
    }

    return existingPaths
  }

  private extractJSDocFromFiles(
    libraryName: string,
    filePaths: string[],
  ): JSDocInfo | null {
    const jsdocInfo: JSDocInfo = {
      name: libraryName,
      description: '',
      methods: [],
      properties: [],
      constructors: [],
    }

    for (const filePath of filePaths) {
      try {
        const sourceFile = this.project.addSourceFileAtPath(filePath)

        console.log(`[JSDoc] Processing file: ${filePath}`)

        // Find exported declarations
        const exportedDeclarations = sourceFile.getExportedDeclarations()
        console.log(
          `[JSDoc] Found ${exportedDeclarations.size} exported declarations`,
        )

        for (const [name, declarations] of exportedDeclarations) {
          console.log(`[JSDoc] Processing exported declaration: ${name}`)
          for (const decl of declarations) {
            if (Node.isClassDeclaration(decl)) {
              this.extractFromClassDeclaration(decl, jsdocInfo)
            } else if (Node.isInterfaceDeclaration(decl)) {
              this.extractFromInterfaceDeclaration(decl, jsdocInfo)
            } else if (Node.isTypeAliasDeclaration(decl)) {
              // Process type alias declarations
              this.extractFromTypeAliasDeclaration(decl, jsdocInfo)
            }
          }
        }
      } catch (error) {
        console.error(`[JSDoc] Error processing file ${filePath}:`, error)
      }
    }

    return jsdocInfo.methods.length > 0 || jsdocInfo.properties.length > 0
      ? jsdocInfo
      : null
  }

  private extractFromClassDeclaration(
    classDecl: ClassDeclaration,
    jsdocInfo: JSDocInfo,
  ) {
    // Extract class description
    const classJSDoc = classDecl.getJsDocs()
    if (classJSDoc.length > 0) {
      jsdocInfo.description = this.extractDescription(classJSDoc[0])
    }

    // Extract constructors
    const constructors = classDecl.getConstructors()
    for (const constructor of constructors) {
      const constructorInfo = this.extractConstructorInfo(constructor)
      if (constructorInfo) {
        jsdocInfo.constructors.push(constructorInfo)
      }
    }

    // Extract methods
    const methods = classDecl.getMethods()
    for (const method of methods) {
      const methodInfo = this.extractMethodInfo(method)
      if (methodInfo) {
        jsdocInfo.methods.push(methodInfo)
      }
    }

    // Extract properties
    const properties = classDecl.getProperties()
    for (const property of properties) {
      const propertyInfo = this.extractPropertyInfo(property)
      if (propertyInfo) {
        jsdocInfo.properties.push(propertyInfo)
      }
    }
  }

  private extractFromInterfaceDeclaration(
    interfaceDecl: InterfaceDeclaration,
    jsdocInfo: JSDocInfo,
  ) {
    // Extract interface description
    const interfaceJSDoc = interfaceDecl.getJsDocs()
    if (interfaceJSDoc.length > 0) {
      jsdocInfo.description = this.extractDescription(interfaceJSDoc[0])
    }

    // Extract method signatures
    const methods = interfaceDecl.getMethods()
    for (const method of methods) {
      const methodInfo = this.extractMethodInfo(method)
      if (methodInfo) {
        jsdocInfo.methods.push(methodInfo)
      }
    }

    // Extract property signatures
    const properties = interfaceDecl.getProperties()
    for (const property of properties) {
      const propertyInfo = this.extractPropertyInfo(property)
      if (propertyInfo) {
        jsdocInfo.properties.push(propertyInfo)
      }
    }
  }

  private extractConstructorInfo(constructor: ConstructorDeclaration): {
    signature: string
    description: string
    parameters: { name: string; type: string; description: string }[]
  } {
    const jsDocs = constructor.getJsDocs()
    const parameters = constructor.getParameters()

    return {
      signature: constructor.getText(),
      description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : '',
      parameters: parameters.map((param: ParameterDeclaration) => ({
        name: param.getName(),
        type: param.getType().getText(),
        description: this.extractParameterDescription(jsDocs, param.getName()),
      })),
    }
  }

  private extractMethodInfo(method: MethodDeclaration): {
    name: string
    signature: string
    description: string
    parameters: { name: string; type: string; description: string }[]
    returnType: string
    returnDescription: string
  } {
    const jsDocs = method.getJsDocs()
    const parameters = method.getParameters()

    return {
      name: method.getName(),
      signature: method.getText(),
      description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : '',
      parameters: parameters.map((param: ParameterDeclaration) => ({
        name: param.getName(),
        type: param.getType().getText(),
        description: this.extractParameterDescription(jsDocs, param.getName()),
      })),
      returnType: method.getReturnType().getText(),
      returnDescription: this.extractReturnDescription(jsDocs),
    }
  }

  private extractPropertyInfo(property: PropertyDeclaration | PropertySignature): {
    name: string
    type: string
    description: string
  } {
    const jsDocs = property.getJsDocs()

    return {
      name: property.getName(),
      type: property.getType().getText(),
      description: jsDocs.length > 0 ? this.extractDescription(jsDocs[0]) : '',
    }
  }

  private extractDescription(jsDoc: JSDoc): string {
    try {
      const description = jsDoc.getDescription()
      return description || ''
    } catch {
      return ''
    }
  }

  private extractParameterDescription(
    jsDocs: JSDoc[],
    paramName: string,
  ): string {
    for (const jsDoc of jsDocs) {
      try {
        const tags = jsDoc.getTags()
        for (const tag of tags) {
          if (tag.getTagName() === 'param' && tag.getName() === paramName) {
            return tag.getComment() || ''
          }
        }
      } catch {
        // Ignore errors
      }
    }
    return ''
  }

  private extractReturnDescription(jsDocs: JSDoc[]): string {
    for (const jsDoc of jsDocs) {
      try {
        const tags = jsDoc.getTags()
        for (const tag of tags) {
          if (tag.getTagName() === 'returns' || tag.getTagName() === 'return') {
            return tag.getComment() || ''
          }
        }
      } catch {
        // Ignore errors
      }
    }
    return ''
  }

  private extractFromTypeAliasDeclaration(
    typeAliasDecl: TypeAliasDeclaration,
    jsdocInfo: JSDocInfo,
  ) {
    // Extract type alias description
    const typeAliasJSDoc = typeAliasDecl.getJsDocs()
    if (typeAliasJSDoc.length > 0) {
      if (!jsdocInfo.description) {
        jsdocInfo.description = this.extractDescription(typeAliasJSDoc[0])
      }
    }

    // For type aliases, we can extract their basic information as properties
    const typeName = typeAliasDecl.getName()
    const typeText = (typeAliasDecl.getTypeNode()?.getText() || 'unknown') as string

    jsdocInfo.properties.push({
      name: typeName,
      type: typeText,
      description: jsdocInfo.description || `Type alias: ${typeName}`,
      optional: false,
    })
  }
}
