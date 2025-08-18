import { Project, InterfaceDeclaration, ClassDeclaration, Node, SourceFile } from 'ts-morph' // Added SourceFile
import * as path from 'path'

export type PropertyDependency = {
  name: string
  type: string
}

export type GeneratedService = {
  interfaceName: string // This should probably be implName or targetName
  implName: string // This is what the test expects
  implFilePath: string
  constructorDependencies: string[]
  propertyDependencies: PropertyDependency[]
}

export function getDependencies(cls: ClassDeclaration): {
  constructorDeps: string[]
  propertyDeps: PropertyDependency[]
} {
  const constructorDeps: string[] = []
  const propertyDeps: PropertyDependency[] = []

  const constructor = cls.getConstructors()[0]
  if (constructor) {
    for (const param of constructor.getParameters()) {
      const paramType = param.getType()
      const typeText = paramType.getText()
      if (typeText !== 'any' && typeText !== 'unknown') {
        constructorDeps.push(typeText)
      }
    }
  }

  for (const prop of cls.getProperties()) {
    if (prop.getDecorator('AutoGen')) {
      const propType = prop.getType()
      const targetType = propType.isUnion()
        ? propType.getUnionTypes().find((t) => !t.isUndefined())
        : propType
      if (targetType) {
        propertyDeps.push({
          name: prop.getName(),
          type: targetType.getText(),
        })
      }
    }
  }

  return { constructorDeps, propertyDeps }
}

export function analyzeSourceFiles(
  project: Project,
  files: string[],
): Map<
  string,
  { declaration: InterfaceDeclaration | ClassDeclaration; sourceFile: SourceFile }
> {
  const servicesToGenerate = new Map<
    string,
    { declaration: InterfaceDeclaration | ClassDeclaration; sourceFile: SourceFile }
  >()

  let allSourceFiles = project.getSourceFiles('src/**/*.ts')

  if (files.length > 0) {
    const lowerCaseFiles = files.map((f) => f.toLowerCase())
    allSourceFiles = allSourceFiles.filter((sf) => {
      const fileName = path.basename(sf.getFilePath()).toLowerCase()
      return lowerCaseFiles.includes(fileName)
    })
  }

  // Collect all unique services to generate
  for (const sourceFile of allSourceFiles) {
    const classes = sourceFile.getClasses()
    for (const cls of classes) {
      for (const prop of cls.getProperties()) {
        if (!prop.getDecorator('AutoGen')) continue

        console.log(`Found @AutoGen on ${cls.getName()}.${prop.getName()}`)
        const propType = prop.getType()
        const targetType = propType.isUnion()
          ? propType.getUnionTypes().find((t) => !t.isUndefined())
          : propType

        if (!targetType) {
          console.error(
            `  -> Error: Could not resolve type for ${prop.getName()}`,
          )
          continue
        }
        const typeSymbol = targetType.getSymbol()
        if (!typeSymbol) {
          console.error(
            `  -> Error: Could not find symbol for type ${targetType.getText()}`,
          )
          continue
        }
        const decl = typeSymbol.getDeclarations()[0]
        if (
          !decl ||
          (!Node.isInterfaceDeclaration(decl) &&
            !(Node.isClassDeclaration(decl) && decl.isAbstract()))
        ) {
          console.error(
            `  -> Error: Type ${targetType.getText()} is not a resolvable interface or abstract class.`, 
          )
          continue
        }

        let targetDeclaration: InterfaceDeclaration | ClassDeclaration = decl;

        // If it's an interface, try to find its abstract class implementation
        if (Node.isInterfaceDeclaration(decl)) {
            const allClassesInProject = project.getSourceFiles().flatMap(sf => sf.getClasses()); // Corrected line
            const implementingClasses = allClassesInProject.filter(cls => 
                cls.isAbstract() && cls.getImplements().some(impl => impl.getText() === decl.getName())
            );
            if (implementingClasses.length > 0) {
                targetDeclaration = implementingClasses[0]; // Assuming one abstract implementation for simplicity
            } else {
                console.error(
                    `  -> Error: Interface ${decl.getName()} has no abstract class implementation found.`
                );
                continue; // Skip if no abstract implementation is found
            }
        }

        const serviceName = targetDeclaration.getName()!; // Use the name of the found declaration (interface or abstract class)
        if (!servicesToGenerate.has(serviceName)) {
          const dependencySourceFile = targetDeclaration.getSourceFile()
          servicesToGenerate.set(serviceName, {
            declaration: targetDeclaration,
            sourceFile: dependencySourceFile,
          })
        }
      }
    }
  }

  return servicesToGenerate
}
