import { Project } from 'ts-morph';
import { getAllExistingServices } from '../aesc/src/core/generator';
import { generateContainer } from '../aesc/src/file-saver';
import * as path from 'path';

async function debugContainer() {
    console.log('🔍 === Debugging generateContainer Flow ===');
    
    const project = new Project({
        tsConfigFilePath: path.join(__dirname, 'tsconfig.json'),
    });
    
    const outputDir = path.join(__dirname, 'src/generated');
    const newlyGeneratedServices: any[] = []; // Empty for this test
    
    console.log('1. Getting all existing services...');
    const allServices = await getAllExistingServices(outputDir, project, newlyGeneratedServices);
    
    console.log(`2. Found ${allServices.length} services with dependencies:`);
    allServices.forEach((service, index) => {
        console.log(`\n--- Service ${index + 1}: ${service.interfaceName} ---`);
        console.log(`Interface Name: ${service.interfaceName}`);
        console.log(`Implementation Name: ${service.implName}`);
        console.log(`File Path: ${service.implFilePath}`);
        console.log(`Constructor Dependencies: [${service.constructorDependencies.join(', ')}]`);
        console.log(`Property Dependencies:`);
        service.propertyDependencies.forEach((dep: any) => {
            console.log(`  - ${dep.name}: ${dep.type}`);
        });
    });
    
    console.log('\n3. Testing generateContainer function...');
    
    // Test the normalizeServiceId function logic
    const normalizeServiceId = (interfaceName: string): string => {
        // If already in correct format (PascalCase with Service suffix), return as-is
        if (/^[A-Z][a-zA-Z]*Service$/.test(interfaceName)) {
            return interfaceName;
        }
        
        // Handle special case for "DB" -> "DB" (not "DBService")
        if (interfaceName.toLowerCase() === 'db') {
            return 'DB';
        }
        
        // Convert from lowercase or mixed case to PascalCase
        // Handle cases like "userservice" -> "UserService", "notificationservice" -> "NotificationService"
        const baseName = interfaceName
            .toLowerCase()
            .replace(/service$/, ''); // Remove 'service' suffix if present
            
        // Convert to PascalCase
        const pascalCase = baseName
            .split(/[^a-zA-Z0-9]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
            
        return pascalCase + 'Service';
    };

    // Test the extractInterfaceName function logic
    const extractInterfaceName = (typeStr: string): string => {
        console.log(`    Extracting interface name from: "${typeStr}"`);
        // Handle types like "import(\"/path/to/file\").InterfaceName" or "InterfaceName"
        if (typeStr.includes('import(')) {
            // Extract from import("...").InterfaceName
            const match = typeStr.match(/\)\.([A-Za-z_][A-Za-z0-9_]*)$/);
            const rawName = match?.[1] || typeStr;
            const normalized = normalizeServiceId(rawName);
            console.log(`    Import type: ${rawName} -> ${normalized}`);
            return normalized;
        }
        // Handle simple interface names
        const normalized = normalizeServiceId(typeStr);
        console.log(`    Simple type: ${typeStr} -> ${normalized}`);
        return normalized;
    };
    
    console.log('\n4. Testing dependency extraction for each service:');
    allServices.forEach((service, index) => {
        console.log(`\n--- Testing Service ${index + 1}: ${service.interfaceName} ---`);
        const serviceId = normalizeServiceId(service.interfaceName);
        console.log(`Service ID: ${serviceId}`);
        
        console.log(`Property Dependencies Processing:`);
        service.propertyDependencies.forEach((dep: any) => {
            const depInterfaceName = extractInterfaceName(dep.type);
            console.log(`  ${dep.name}: ${dep.type} -> ${depInterfaceName}`);
        });
    });
}

debugContainer().catch(console.error);
