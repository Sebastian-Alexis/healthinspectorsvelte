import nodeFetch from 'node-fetch';

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

const fetch = require('fetch-cookie')(require('node-fetch'));

async function fetchCVEBaseScore(cveId) {
	try {
		const apiUrl = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveID=${cveId}`;
		console.log('Fetching base score for CVE ID:', cveId);
		console.log('API URL:', apiUrl);

		const response = await nodeFetch(apiUrl);
		if (!response.ok) {
			throw new Error(`Failed to fetch NVD API data for CVE ID: ${cveId}`);
		}
		const data = await response.json();
		console.log('API response:', data);

		if (data.vulnerabilities && data.vulnerabilities.length > 0) {
			const baseScore = data.vulnerabilities[0].metrics.cvssMetricV2[0].cvssData.baseScore;
			return baseScore;
		} else {
			throw new Error(`CVE base score not found for CVE ID: ${cveId}`);
		}
	} catch (error) {
		console.error(`Error fetching base score for CVE ID: ${cveId}: ${error.message}`);
		return null;
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

export async function GET({ url }) {
	const library = url.searchParams.get('library');
	const version = url.searchParams.get('version'); // Assuming version is passed as a query parameter

	if (!library || !version) {
		console.error('Error: Library name and version are required');
		return new Response(JSON.stringify({ error: 'Library name and version are required' }), {
			status: 400,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}

	try {
		const { dependencies, cveIds } = await fetchDependenciesRecursively(library, version);
		let dependencyTreeString = formatDependencyTree(dependencies);

		// Append CVE IDs to the final output string
		dependencyTreeString += ` (${cveIds})`;

		console.log(dependencyTreeString); // This will log the formatted tree string

		// Print CVEs to the terminal
		const cveList = cveIds.split(',').map((cve) => cve.trim());
		console.log('CVEs:', cveList);

		// Fetch base scores for CVEs and calculate average
		const baseScores = [];
		for (const cveId of cveList) {
			const baseScore = await fetchCVEBaseScore(cveId);
			if (baseScore !== null) {
				baseScores.push(baseScore);
			}
		}
		const averageBaseScore = baseScores.reduce((sum, score) => sum + score, 0) / baseScores.length;
		console.log('Average Base Score:', averageBaseScore);

		return new Response(JSON.stringify({ dependencyTree: dependencyTreeString }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error(`Error fetching runtime dependencies for ${library}: ${error.message}`);
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
}
