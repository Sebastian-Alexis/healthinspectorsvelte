import fetch from 'node-fetch';

const LIBRARIES_IO_API_KEY = '7165ca9cc733d1abd00a87a930d9d714'; // Replace with your actual API key

async function fetchRuntimeDependencies(library, version) {
	try {
		const requestUrl = `https://libraries.io/api/pypi/${library}/${version}/dependencies?api_key=${LIBRARIES_IO_API_KEY}`;
		console.log('Making request to:', requestUrl); // Log the request URL

		const response = await fetch(requestUrl);
		if (!response.ok) {
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

async function fetchDependenciesRecursively(library, version, depth = 0) {
	try {
		const dependencies = await fetchRuntimeDependencies(library, version);

		for (const dep of dependencies) {
			if (typeof dep.latest_stable === 'string' && dep.latest_stable) {
				dep.dependencies = await fetchDependenciesRecursively(
					dep.name,
					dep.latest_stable,
					depth + 1
				);
			} else {
				console.log(`No stable version found for ${dep.name}, skipping its dependencies`);
				dep.dependencies = [];
			}
		}

		return dependencies;
	} catch (error) {
		console.error(`Error in recursive dependency fetching for ${library}: ${error.message}`);
		return [];
	}
}

function formatDependencyTree(dependencies, level = 0) {
	return dependencies
		.map((dep) => {
			const prefix = ' '.repeat(level * 2);
			const subDeps =
				dep.dependencies.length > 0 ? `\n${formatDependencyTree(dep.dependencies, level + 1)}` : '';
			return `${prefix}${dep.name} - ${dep.latest_stable}${subDeps}`;
		})
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
		const dependencies = await fetchDependenciesRecursively(library, version);
		const dependencyTreeString = formatDependencyTree(dependencies);
		console.log(dependencyTreeString); // This will log the formatted tree string

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
