import { Project } from 'ts-morph';
import { getAllExistingServices } from '../aesc/src/core/generator';
import * as path from 'path';

async function debugServices() {
    console.log('🔍 === Debugging getAllExistingServices ===');
    
    const project = new Project({
        tsConfigFilePath: path.join(__dirname, 'tsconfig.json'),
    });
    
    const outputDir = path.join(__dirname, 'src/generated');
    const newlyGeneratedServices: any[] = []; // Empty for this test
    
    console.log('1. Calling getAllExistingServices...');
    const allServices = await getAllExistingServices(outputDir, project, newlyGeneratedServices);
    
    console.log(`2. Found ${allServices.length} services:`);
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
}

debugServices().catch(console.error);
