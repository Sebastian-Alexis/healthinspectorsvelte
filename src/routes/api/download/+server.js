import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import fsExtra from 'fs-extra';

const execAsync = promisify(exec);

export async function GET({ url }) {
	const sourceCodeDir = 'src/routes/api/dependencies/sourcecode';

	try {
		await fsExtra.emptyDir(sourceCodeDir);
		console.log('All files in sourcecode directory deleted successfully.');
	} catch (err) {
		console.error('Error deleting files:', err);
	}
	const repoUrl = url.searchParams.get('repoUrl');
	if (!repoUrl) {
		console.error('Missing repoUrl parameter');
		// Use Response for error cases
		return new Response('Missing repoUrl parameter', { status: 400 });
	}

	try {
		const repoName = repoUrl.split('/').pop();
		const repoPath = path.join('src/routes/api/dependencies/sourcecode', repoName);
		await execAsync(`git clone ${repoUrl} ${repoPath}`);
		console.log(`Cloned repository from ${repoUrl} to ${repoPath}`);

		const requirementsFilePath = path.join(repoPath, 'requirements.txt');
		const requirementsFile = await fs.promises.readFile(requirementsFilePath, 'utf8');
		console.log(`Read requirements file from ${requirementsFilePath}`);

		// Return a Response object with JSON body
		return new Response(JSON.stringify({ requirementsFile }), {
			status: 200, // Explicitly set the status code
			headers: { 'Content-Type': 'application/json' } // Set headers appropriately
		});
	} catch (err) {
		console.error('Error from source code downloader:', err);
		// Use Response for error cases with detailed error information
		return new Response('Error processing request', { status: 500 });
	}
}
