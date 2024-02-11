import nodeFetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
		const cveIds = vulns
			.flatMap((vuln) =>
				vuln.aliases ? vuln.aliases.filter((alias) => alias.startsWith('CVE-')) : []
			)
			.join(', ');

		const dependencies = await fetchRuntimeDependencies(library, version);
		console.log(`Fetched dependencies for ${library}:`, dependencies);

		for (const dep of dependencies) {
			const vulnerabilityResponse = await checkVulnerabilities(dep.name, dep.latest_stable);
			dep.vulnerabilities = Array.isArray(vulnerabilityResponse.vulns)
				? vulnerabilityResponse.vulns
				: [];

			// Calculate baseScore for each dependency
			dep.baseScore =
				dep.vulnerabilities.length > 0
					? dep.vulnerabilities.reduce((sum, vuln) => sum + (vuln.baseScore || 0), 0) /
					  dep.vulnerabilities.length
					: 0;

			if (typeof dep.latest_stable === 'string' && dep.latest_stable) {
				dep.dependencies = await fetchDependenciesRecursively(
					dep.name,
					dep.latest_stable,
					depth + 1
				);
			} else {
				dep.dependencies = [];
			}
		}

		return { dependencies, cveIds }; // Return both dependencies and CVE IDs
	} catch (error) {
		console.error(`Error in recursive dependency fetching for ${library}: ${error.message}`);
		return { dependencies: [], cveIds: '' }; // Return empty dependencies and CVE IDs on error
	}
}

function formatDependencyTree(dependencies, level = 0) {
	return dependencies
		.map((dep) => {
			if (!dep.name || !dep.latest_stable) {
				return ''; // Skip this dependency
			}

			const cveIds = dep.vulnerabilities
				.flatMap((vuln) => vuln.aliases.filter((alias) => alias.startsWith('CVE-')))
				.join(', ');

			const prefix = ' '.repeat(level * 2);
			const subDeps =
				dep.dependencies.length > 0 ? `\n${formatDependencyTree(dep.dependencies, level + 1)}` : '';
			const cveString = cveIds ? ` (CVEs: ${cveIds})` : '';

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

export async function GET({ url }) {
	deleteFilesInDirectory('src/routes/api/dependencies/results');
	// Move the rest of the code here
	const library = url.searchParams.get('library');
	const requirementsFile = url.searchParams.get('requirementsFile');
	const version = url.searchParams.get('version');

	if ((!library && !requirementsFile) || !version) {
		console.error('Error: Library name or requirements file and version are required');
		return new Response(
			JSON.stringify({ error: 'Library name or requirements file and version are required' }),
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
				const [name, version] = line.split('==');
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

		for (const cve of cveSet) {
			const apiUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveID=${cve}`;

			// Check if the CVE ID already exists in cveResults
			const existingCve = cveResults.find((result) => result.cveID === cve);
			if (existingCve) {
				console.log(`CVE ${cve} is already stored.`);
				continue; // Skip making the API call
			}

			const response = await nodeFetch(apiUrl);
			if (response.ok) {
				const result = await response.json();
				cveResults.push(result);
			} else {
				console.error(`Failed to fetch NVD API data for CVE ${cve}`);
			}
		}

		// Store the API results in src/routes/api/dependencies/results.json
		const __filename = fileURLToPath(import.meta.url);
		const resultsFolderPath = path.join(path.dirname(__filename), 'results');

		// Create the results folder if it doesn't exist
		if (!fs.existsSync(resultsFolderPath)) {
			fs.mkdirSync(resultsFolderPath);
		}

		for (const cve of cveSet) {
			const apiUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveID=${cve}`;
			console.log('Making request to NVD API:', apiUrl);

			// Check if the CVE ID already exists in cveResults
			const existingCve = cveResults.find((result) => result.cveID === cve);
			if (existingCve) {
				console.log(`CVE ${cve} is already stored.`);
				continue; // Skip making the API call
			}

			const response = await nodeFetch(apiUrl);
			if (response.ok) {
				const result = await response.json();
				cveResults.push(result);

				// Store the API result in a separate file
				const cveFilePath = path.join(resultsFolderPath, `${cve}.json`);
				fs.writeFileSync(cveFilePath, JSON.stringify(result));
				console.log(`Stored CVE ${cve} result in ${cveFilePath}`);
			} else {
				console.error(`Failed to fetch NVD API data for CVE ${cve}`);
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

		console.log('Number of Base Scores:', numberOfBaseScores);

		console.log('Average Base Score:', averageBaseScore);
		console.log('All Base Scores:', baseScores);

		// Return the response
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
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
}
