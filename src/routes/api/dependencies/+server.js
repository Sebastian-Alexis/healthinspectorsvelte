import fs from 'node:fs';
import path from 'path';
import nodeFetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { execSync } from 'node:child_process';

const LIBRARIES_IO_API_KEYS = [
	'7165ca9cc733d1abd00a87a930d9d714',
	'10b8f9c2a81b273a6c0db61fb96fb212',
	'53d6ec55fcbfdedb9ac6bd44ae42050c'
];
let currentApiKeyIndex = 0;

async function fetchRuntimeDependencies(library, version) {
	try {
		const apiKey = LIBRARIES_IO_API_KEYS[currentApiKeyIndex];
		const requestUrl = `https://libraries.io/api/pypi/${library}/${version}/dependencies?api_key=${apiKey}`;
		console.log('Making request to:', requestUrl);

		const response = await nodeFetch(requestUrl);
		if (!response.ok) {
			if (response.status === 429) {
				// Rotate API key and retry
				currentApiKeyIndex = (currentApiKeyIndex + 1) % LIBRARIES_IO_API_KEYS.length;
				return fetchRuntimeDependencies(library, version);
			}
			throw new Error(`Failed to fetch Libraries.io data for ${library}`);
		}
		const data = await response.json();

		// Save the response data to a file
		const __filename = fileURLToPath(import.meta.url);
		const dependencyResultPath = path.join(path.dirname(__filename), 'dependency_result');
		const filePath = path.join(dependencyResultPath, `${library}-${version}.json`);

		// Create the dependency_result folder if it doesn't exist
		if (!fs.existsSync(dependencyResultPath)) {
			fs.mkdirSync(dependencyResultPath);
		}

		// Write the data to the file
		fs.writeFileSync(filePath, JSON.stringify(data));

		return data.dependencies
			.filter((dep) => dep.kind === 'runtime')
			.map((dep) => ({
				name: dep.name,
				requirements: dep.requirements,
				latest_stable: dep.latest_stable
			}));
	} catch (error) {
		console.error(
			`Error fetching runtime dependencies from Libraries.io for ${library}: ${error.message}`
		);
		return [];
	}
}

async function checkVulnerabilities(library, version) {
	try {
		const requestBody = {
			version: version,
			package: {
				name: library,
				ecosystem: 'PyPI'
			}
		};

		const response = await nodeFetch('https://api.osv.dev/v1/query', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(requestBody)
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		return data; // Contains vulnerability information
	} catch (error) {
		console.error(`Error checking vulnerabilities for ${library}: ${error.message}`);
		return { vulns: [] }; // Return empty vulnerabilities on error
	}
}

async function fetchDependenciesRecursively(library, version, depth = 0) {
    try {
        const vulnerabilityResponse = await checkVulnerabilities(library, version);
        console.log(`Vulnerability response for ${library}:`, vulnerabilityResponse);

        const vulns = Array.isArray(vulnerabilityResponse.vulns) ? vulnerabilityResponse.vulns : [];
        const cveIds = [
            ...new Set(
                vulns.flatMap((vuln) =>
                    vuln.aliases ? vuln.aliases.filter((alias) => alias.startsWith('CVE-')) : []
                )
            )
        ].join(', ');

        const dependencies = await fetchRuntimeDependencies(library, version);
        console.log(`Fetched dependencies for ${library}:`, dependencies);

        // Here, instead of fetching dependencies recursively, perform the desired operation
        if (depth === 0) {  // Check if it's the first call (top-level dependency)
            // Run your desired operation here
            const sourceCodeDirectory = 'src/routes/api/dependencies/sourcecode';
            const directories = fs.readdirSync(sourceCodeDirectory, { withFileTypes: true })
                .filter(dirent => dirent.isDirectory())
                .map(dirent => dirent.name);

            console.log('Directories:', directories);
            if (directories.length > 0) {
                console.log('Directory:', directories[0]);
                const sourceCodePath = path.join(sourceCodeDirectory, directories[0]);
                console.log('Source Code Directory:', sourceCodePath);
                process.chdir(sourceCodePath);
                execSync('cdxgen -o', { stdio: 'inherit' });
                console.log('SBOM generated successfully');
            }
        }

        return { dependencies, cveIds }; // Return dependencies and CVE IDs
    } catch (error) {
        console.error(`Error in fetching dependencies for ${library}: ${error.message}`);
        return { dependencies: [], cveIds: '' };
    }
}


function formatDependencyTree(dependencies, level = 0) {
	return dependencies
		.map((dep) => {
			if (!dep.name || !dep.latest_stable) {
				dep.latest_stable = ''; // Mark latest stable value as empty
				return ''; // Skip this dependency
			}
			console.log('VULNERABILITIES: ', dep.vulnerabilities);
			const cveIds = dep.vulnerabilities
				.flatMap((vuln) => vuln.aliases.filter((alias) => alias.startsWith('CVE-')))
				.filter((alias) => alias.length > 0) // Filter out empty arrays
				.join(', ');

			const uniqueCveIds = [...new Set(cveIds.split(',').map((cve) => cve.trim()))];
			dep.cveIds = uniqueCveIds.join(', ');
			console.log('DEPENDENCY LIST: ', dep.cveIds);
			const prefix = ' '.repeat(level * 2);
			const subDeps =
				dep.dependencies.length > 0 ? `\n${formatDependencyTree(dep.dependencies, level + 1)}` : '';
			const cveString = dep.cveIds ? ` (CVEs: ${dep.cveIds})` : '';

			return `${prefix}${dep.name} - ${dep.latest_stable}${cveString}${subDeps}`;
		})
		.filter((line) => line)
		.join('\n');
}

// Function to delete all files in a directory
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
	// deleteFilesInDirectory('src/routes/api/dependencies/results');
	// deleteFilesInDirectory('src/routes/api/dependencies/dependency_result');
	// deleteFile('src/routes/api/sbom/sbom.json');

	// Move the rest of the code here
	const library = url.searchParams.get('library');
	const requirementsFile = url.searchParams.get('requirementsFile');
	const version = url.searchParams.get('version');

	if ((!library && !requirementsFile) || !version) {
		console.error('Error: Library name or requirements file and version are requiredttttt');
		return new Response(
			JSON.stringify({ error: 'Library name or requirements file and version are requiredsssss' }),
			{
				status: 400,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}

	let libraries = [];
	if (library) {
		libraries.push({ name: library, version });
	} else if (requirementsFile) {
		const lines = requirementsFile.split('\n');
		libraries = lines
			.filter((line) => line.trim() && !line.trim().startsWith('#'))
			.map((line) => {
				const [name, version] = line.split(/(==|>=|<=|>|<)/); // Use regex to split on multiple operators
				return { name, version };
			});
	}

	function findBaseScore(obj) {
		if (obj && typeof obj === 'object') {
			for (let key in obj) {
				if (key === 'baseScore' && typeof obj[key] === 'number') {
					return obj[key];
				}
				let result = findBaseScore(obj[key]);
				if (result) {
					return result;
				}
			}
		}
		return null;
	}

	try {
		const allDependencies = [];
		const allCveIds = [];

		for (const { name, version } of libraries) {
			const { dependencies, cveIds } = await fetchDependenciesRecursively(name, version);
			allDependencies.push(...dependencies);
			allCveIds.push(...cveIds.split(',').map((cve) => cve.trim()));
		}

		const dependencyTreeString = formatDependencyTree(allDependencies);

		// Append CVE IDs to the final output string
		const cveIdsString = allCveIds.join(', ');
		const finalOutputString = `${dependencyTreeString} (${cveIdsString})`;

		console.log(finalOutputString); // This will log the formatted tree string

		// Print CVEs to the terminal
		const cveResults = [];
		const cveSet = new Set(allCveIds); // Use a Set to remove duplicates

		// Store the API results in src/routes/api/dependencies/results.json
		const __filename = fileURLToPath(import.meta.url);
		const resultsFolderPath = path.join(path.dirname(__filename), 'results');

		// Create the results folder if it doesn't exist
		if (!fs.existsSync(resultsFolderPath)) {
			fs.mkdirSync(resultsFolderPath);
		}

		for (const cve of cveSet) {
			if (!cve.trim()) {
				console.log("Skipping empty CVE ID.");
				continue; // Skip this iteration if the CVE ID is empty or just spaces
			}
		
			const apiUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveID=${cve}`;
			console.log('Making request to NVD API:', apiUrl);
		
			let response;
			let retryCount = 0;
			const maxRetries = 50; // Set your desired maximum retry limit
			const retryDelayBase = 6000; // Base delay in milliseconds
		
			while (retryCount < maxRetries) {
				try {
					response = await nodeFetch(apiUrl);
					if (response.ok) {
						const result = await response.json();
						cveResults.push(result);
		
						// Store the API result in a separate file
						const cveFilePath = path.join(resultsFolderPath, `${cve}.json`);
						fs.writeFileSync(cveFilePath, JSON.stringify(result));
						console.log(`Stored CVE ${cve} result in ${cveFilePath}`);
						break; // Exit the loop if successful
					} else {
						console.error(`Attempt ${retryCount + 1}: Failed to fetch NVD API data for CVE ${cve}, status: ${response.status}`);
					}
				} catch (error) {
					console.error(`Attempt ${retryCount + 1}: Error fetching data for CVE ${cve}: ${error.message}`);
				}
		
				retryCount++;
				if (retryCount < maxRetries) {
					// Wait before the next retry attempt
					const delay = retryCount * retryDelayBase; // Delay increases with each retry
					console.log(`Waiting ${delay} ms before next retry.`);
					await new Promise(resolve => setTimeout(resolve, delay));
				}
			}
		
			if (!response.ok && retryCount === maxRetries) {
				console.error(`Failed to fetch NVD API data for CVE ${cve} after ${maxRetries} retries.`);
			}
		}
		
		
		

		const cveFiles = fs.readdirSync('src/routes/api/dependencies/results');
		const baseScores = [];

		for (const cveFile of cveFiles) {
			// If the file is named ".json", delete it and continue with the next file
			if (cveFile === '.json') { 
				fs.unlinkSync(path.join('src/routes/api/dependencies/results', cveFile));
				console.log(`Deleted file: ${cveFile}`);
				continue;
			}

			const filePath = path.join('src/routes/api/dependencies/results', cveFile);
			const data = fs.readFileSync(filePath, 'utf8');
			const jsonData = JSON.parse(data);

			const baseScore = findBaseScore(jsonData);
			if (baseScore !== null) {
				baseScores.push(baseScore);
			} else {
				console.log(`Could not find baseScore in JSON data for ${cveFile}`);
			}
		}

		// Calculate the average base score
		// print all base scores
		const formattedDependencyTree = '';
		// Define the event variable
		// Receive FormattedDependencyTree from page.svelte
		const totalBaseScore = baseScores.reduce((sum, score) => sum + score, 0);
		const averageBaseScore = Math.round((totalBaseScore / baseScores.length) * 10) / 10;
		const numberOfBaseScores = fs.readdirSync('src/routes/api/dependencies/results').length;


		console.log('Average Base Score:', averageBaseScore);
		console.log('All Base Scores:', baseScores);

		const directoryPath = 'src/routes/api/dependencies/dependency_result'; // Replace with your directory path
		const files = fs.readdirSync(directoryPath);

		let sbomlibraries = [];
		for (const file of files) {
			const [name, version] = file.split('-'); // Assumes file name is in the format 'name-version.json'
			sbomlibraries.push({ name, version });
		}
		console.log(sbomlibraries);

		const sourceCodeDirectory = 'src/routes/api/dependencies/sourcecode';
		const directories = fs
			.readdirSync(sourceCodeDirectory, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);

		console.log('Directories:', directories);

		console.log('Directory:', directories[0]);
		const sourceCodePath = path.join('src/routes/api/dependencies/sourcecode', directories[0]);
		console.log('Source Code Directory:', sourceCodePath);
		// Change the current working directory to sourceCodePath

		console.log('FINAL TREE: ', finalOutputString);

		return new Response(
			JSON.stringify({
				dependencyTree: finalOutputString,
				cveResults: allCveIds,
				averageBaseScore,
				numberOfBaseScores,
				baseScores
			}),
			{
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	} catch (error) {
		console.error(`Error fetching runtime dependencies: ${error.message}`);
		console.log('from server.js');
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
}
