<script>
	import { onMount } from 'svelte';
	import Dependency from './components/Dependency.svelte';
	let libraryName = '';
	let libraryVersion = ''; // New variable for library version
	let rootDependency = null;
	let isLoading = false;
	let errorMessage = '';
	let visited = new Set();

	async function fetchDependenciesRecursively(library, version, parentDependency = null) {
		if (visited.has(`${library}@${version}`)) {
			console.log(`Skipping already processed library: ${library} (${version})`);
			return;
		}

		visited.add(`${library}@${version}`);
		console.log('Fetching dependencies for:', library, version);

		try {
			const response = await fetch(`/api/dependencies?library=${library}&version=${version}`);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const deps = await response.json();

			const depNode = { name: `${library} (${version})`, dependencies: [] };
			if (parentDependency) {
				parentDependency.dependencies.push(depNode);
			} else {
				rootDependency = depNode;
			}

			for (const dep of deps) {
				// Assuming the version is also returned in each dependency
				await fetchDependenciesRecursively(dep.name, dep.version, depNode);
			}
		} catch (error) {
			console.error('Error fetching dependencies:', error);
			errorMessage = 'Failed to fetch dependencies';
		}
	}

	function handleSubmit() {
		rootDependency = null;
		visited.clear();
		isLoading = true;
		errorMessage = '';
		fetchDependenciesRecursively(libraryName, libraryVersion)
			.then(() => (isLoading = false))
			.catch(() => (isLoading = false));
	}
</script>

<div class="flex gap-2 pt-2 px-2">
	<input
		type="text"
		placeholder="Type Python library name"
		class="input input-bordered w-full max-w-xs"
		bind:value={libraryName}
	/>
	<input
		type="text"
		placeholder="Version"
		class="input input-bordered w-full max-w-xs"
		bind:value={libraryVersion}
	/>
	<button class="btn btn-primary" on:click={handleSubmit} disabled={isLoading}>Submit</button>
</div>

{#if errorMessage}
	<p class="text-red-500">{errorMessage}</p>
{/if}

{#if rootDependency}
	<div class="join join-vertical flex w-1/2 pt-6">
		{#each rootDependency.dependencies as dep}
			<Dependency {dep} />
		{/each}
	</div>
{/if}

<style>
	/* Your styles here */
</style>
