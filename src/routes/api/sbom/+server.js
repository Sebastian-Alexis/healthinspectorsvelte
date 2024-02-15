import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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

		try {
			process.chdir(sourceCodePath);
			execSync(
				'cdxgen --output /Users/alexi1/healthinspectorsvelte/src/routes/api/sbom/sbom.json',
				{
					stdio: 'inherit'
				}
			);
		} catch (error) {
			console.error(`Error running command: ${error.message}`);
			return new Response(`Error generating SBOM: ${error.message}`, { status: 500 });
		}

		// Assuming sbom.json is placed in the same directory as this script after generation
		const sbomPath = path.join(sourceCodePath, 'sbom.json');
		if (!fs.existsSync(sbomPath)) {
			return new Response('SBOM file not found', { status: 404 });
		}
		const sbomString = fs.readFileSync(sbomPath, 'utf8');
		const sbomJson = JSON.parse(sbomString);

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
