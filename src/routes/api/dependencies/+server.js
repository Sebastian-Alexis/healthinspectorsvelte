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
		const runtimeDependencies = data.dependencies.filter((dep) => dep.kind === 'runtime');
		return runtimeDependencies.map((dep) => ({
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

async function fetchDependenciesRecursively(library, version) {
	try {
		const dependencies = await fetchRuntimeDependencies(library, version);

		for (const dep of dependencies) {
			// Check if latest_stable is a non-empty string and not undefined
			if (typeof dep.latest_stable === 'string' && dep.latest_stable) {
				dep.dependencies = await fetchDependenciesRecursively(dep.name, dep.latest_stable);
			} else {
				dep.dependencies = [];
				console.log(
					`No stable version found or undefined for ${dep.name}, skipping its dependencies`
				);
			}
		}

		return dependencies;
	} catch (error) {
		console.error(`Error in recursive dependency fetching for ${library}: ${error.message}`);
		return [];
	}
}

export async function GET({ url }) {
	const library = url.searchParams.get('library');
	const version = url.searchParams.get('version'); // Assuming version is passed as a query parameter

	console.log('Library requested:', library);

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
		console.log(`Fetching dependencies recursively from Libraries.io for ${library}`);
		const dependencies = await fetchDependenciesRecursively(library, version);
		console.log(`All dependencies for ${library}:`, dependencies);

		return new Response(JSON.stringify(dependencies), {
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
