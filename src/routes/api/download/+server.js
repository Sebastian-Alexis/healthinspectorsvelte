import { exec } from 'node:child_process';
import { promisify } from 'util';
import fs from 'node:fs';
import path from 'path';
import fsExtra from 'fs-extra';

const execAsync = promisify(exec);

function deleteFilesInDirectory(directory) {
	if (fs.existsSync(directory)) {
		fs.readdir(directory, (err, files) => {
			if (err) throw err;

			for (const file of files) {
				fs.unlink(path.join(directory, file), (err) => {
					if (err) {
						if (err.code === 'ENOENT') {
							console.log(`File ${file} does not exist.`);
						} else {
							throw err;
						}
					}
				});
			}
		});
	} else {
		console.log(`Directory ${directory} does not exist.`);
	}
}

function deleteFile(filePath) {
	if (fs.existsSync(filePath)) {
		fs.unlinkSync(filePath);
		console.log(`Deleted file: ${filePath}`);
	} else {
		console.log(`File ${filePath} does not exist.`);
	}
}

export async function GET({ url }) {
	deleteFilesInDirectory('src/routes/api/dependencies/results');
	deleteFilesInDirectory('src/routes/api/dependencies/dependency_result');
	deleteFile('src/routes/api/sbom/sbom.json');
	const sourceCodeDir = 'src/routes/api/dependencies/sourcecode';

	try {
		await fsExtra.emptyDir(sourceCodeDir);
		console.log('All files in sourcecode directory deleted successfully.');
	} catch (err) {
		console.error('Error deleting files:', err);
		return new Response('Internal Server Error', { status: 500 });
	}
	const repoUrl = url.searchParams.get('repoUrl');
	if (!repoUrl) {
		console.error('Missing repoUrl parameter');
		return new Response('Missing repoUrl parameter', { status: 400 });
	}

	try {
		const repoName = repoUrl.split('/').pop();
		const repoPath = path.join('src/routes/api/dependencies/sourcecode', repoName);
		await execAsync(`git clone ${repoUrl} ${repoPath}`);
		console.log(`Cloned repository from ${repoUrl} to ${repoPath}`);

		// You can customize this part to suit what you need from the repo
		// For now, just return a success message
		return new Response(JSON.stringify({ message: "Repository processed successfully" }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (err) {
		console.error('Error from source code downloader:', err);
		return new Response('Error processing request', { status: 500 });
	}
}
