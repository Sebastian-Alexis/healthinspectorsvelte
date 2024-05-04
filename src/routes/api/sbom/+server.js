import fs from 'node:fs';
import path from 'path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// SvelteKit uses this export pattern for handling requests
export async function GET() {
	console.log('Generating SBOM...');

	try {
		const sourceCodeDirectory = 'src/routes/api/dependencies/sourcecode';
		const directories = fs
			.readdirSync(sourceCodeDirectory, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);

		console.log('Directories:', directories);

		if (directories.length === 0) {
			console.error('No directories found.');
			return new Response('No source code directories found', { status: 404 });
		}

		console.log('Directory:', directories[0]);
		const sourceCodePath = path.join(sourceCodeDirectory, directories[0]);
		console.log('Source Code Directory:', sourceCodePath);
		const rootDirectory = dirname(fileURLToPath(import.meta.url));
		console.log('Root Directory:', rootDirectory);
		process.chdir(sourceCodePath);

		execSync('cdxgen -o', {
			stdio: 'inherit'
		});
		process.chdir('C:\\Users\\sebas\\Programming\\healthinspectorsvelte');
		const currentCodePath = dirname(fileURLToPath(import.meta.url));
		console.log('current Code Directory:', currentCodePath);

		console.log('SBOM generated successfully');

		// Wait for 3 seconds
		await new Promise((resolve) => setTimeout(resolve, 3000));

		const sbomPath = path.join(sourceCodePath, '/bom.json');
		console.log(sourceCodePath);

		if (!fs.existsSync(sbomPath)) {
			console.log('SBOM file not found', { status: 404 });
		}
		const sbomString = fs.readFileSync(sbomPath, 'utf8');
		const sbomJson = JSON.parse(sbomString);
		console.log('SBOM:', sbomJson);

		// Return the SBOM JSON in the response
		return new Response(JSON.stringify(sbomJson), {
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
