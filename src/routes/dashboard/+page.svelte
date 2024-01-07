<script>
	import { onMount } from 'svelte';
	let libraryName = '';
	let libraryVersion = '';
	let isLoading = false;
	let errorMessage = '';
	let dependencyTree = '';
	let fileInput;

	function handleFileChange(event) {
		const file = event.target.files[0];
		if (file) {
			const reader = new FileReader();
			reader.onload = (e) => {
				const contents = e.target.result;
				processFileContents(contents);
			};
			reader.readAsText(file);
		}
	}

	function processFileContents(contents) {
		const lines = contents.split('\n');
		const libraries = lines
			.map((line) => {
				const parts = line.split('==');
				if (parts.length === 2 && parts[0] && parts[1]) {
					return { name: parts[0], version: parts[1] };
				}
				return null;
			})
			.filter((lib) => lib !== null);
		fetchAllDependencies(libraries);
	}

	async function fetchAllDependencies(libraries) {
		isLoading = true;
		errorMessage = '';
		dependencyTree = '';

		try {
			const promises = libraries.map((lib) =>
				fetch(`/api/dependencies?library=${lib.name}&version=${lib.version}`)
					.then((response) => {
						if (!response.ok) {
							console.error(`Failed to fetch for ${lib.name}`);
							return { dependencyTree: `Failed to fetch for ${lib.name}\n` };
						}
						return response.json();
					})
					.catch((error) => {
						console.error(`Error fetching dependencies for ${lib.name}:`, error);
						return { dependencyTree: `Error fetching dependencies for ${lib.name}\n` };
					})
			);
			const results = await Promise.all(promises);
			dependencyTree = results.map((result) => result.dependencyTree).join('\n');
		} catch (error) {
			console.error('Error in processing dependencies:', error);
			errorMessage = 'Failed to process dependencies';
		} finally {
			isLoading = false;
		}
	}

	function handleSubmit() {
		fetchDependencies();
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
	<input
		type="file"
		class="file-input file-input-bordered w-full max-w-xs"
		bind:this={fileInput}
		on:change={handleFileChange}
	/>
</div>

{#if errorMessage}
	<p class="text-red-500">{errorMessage}</p>
{/if}

{#if dependencyTree}
	<pre class="dependency-tree">{dependencyTree}</pre>
{/if}

<style>
	.dependency-tree {
		white-space: pre-wrap;
		background-color: #f5f5f5;
		border: 1px solid #ccc;
		padding: 1em;
	}
</style>
