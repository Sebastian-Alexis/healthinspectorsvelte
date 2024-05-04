import fs from 'node:fs';
import path from 'path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// SvelteKit uses this export pattern for handling requests
export async function GET() {
    console.log('Generating SBOM...');

    try {
        const baseDirectory = dirname(fileURLToPath(import.meta.url));
        const sourceCodeDirectory = path.join('C:\\Users\\sebas\\Programming\\healthinspectorsvelte\\src\\routes\\api\\dependencies\\sourcecode');
        const cacheDirectory = path.join(baseDirectory, 'cache');
        const directories = fs.readdirSync(sourceCodeDirectory, { withFileTypes: true })
                              .filter(dirent => dirent.isDirectory())
                              .map(dirent => dirent.name);

        console.log('Directories:', directories);

        if (directories.length === 0) {
            console.error('No directories found.');
            return new Response('No source code directories found', { status: 404 });
        }

        const selectedDirectory = directories[0];
        const cachePath = path.join(cacheDirectory, `${selectedDirectory}.json`);
        console.log('Directory:', selectedDirectory);

        // Check if data is cached
        if (fs.existsSync(cachePath)) {
            console.log('Loading data from cache...');
            const cachedData = fs.readFileSync(cachePath, 'utf8');
            return new Response(cachedData, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }

        const sourceCodePath = path.join(sourceCodeDirectory, selectedDirectory);
        console.log('Source Code Directory:', sourceCodePath);

        // Capture the output of cdxgen command
        const output = execSync(`cdxgen -o ${path.join(sourceCodePath, 'bom.json')} -p -t python`, {
            cwd: sourceCodePath,
            encoding: 'utf8', // Make sure to return a string
            stdio: 'pipe' // Capture stdout and stderr
        });

        // Extract and clean the dependency tree from the output
        const treeStart = output.indexOf('╔═══════════════════════════════════════╗');
        const treeEnd = output.indexOf('╚═══════════════════════════════════════╝') + '╚═══════════════════════════════════════╝'.length;
        let tree = output.substring(treeStart, treeEnd)
                           .replace(/Dependency Tree/g, '')
                           .replace(/Generated with ♥ by cdxgen/g, '')
                           .replace(/[║╔╚╗╝─═╟╢]/g, '')
                           .replace(/ +/g, ' ')
                           .trim();

        // Check and read SBOM file
        const sbomPath = path.join(sourceCodePath, 'bom.json');
        if (!fs.existsSync(sbomPath)) {
            console.log('SBOM file not found', { status: 404 });
            return new Response('SBOM file not found', { status: 404 });
        }
        const sbomString = fs.readFileSync(sbomPath, 'utf8');
        const sbomJson = JSON.parse(sbomString);

        // Package response content
        const responseContent = {
            sbom: sbomJson,
            cleanedDependencyTree: tree
        };

        // Save response content to cache
        if (!fs.existsSync(cacheDirectory)) {
            fs.mkdirSync(cacheDirectory);
        }
        fs.writeFileSync(cachePath, JSON.stringify(responseContent), 'utf8');

        return new Response(JSON.stringify(responseContent), {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error:', error);
        return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
    }
}
