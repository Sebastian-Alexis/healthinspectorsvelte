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
			const results = await Promise.all(
				libraries.map(async (lib) => {
					try {
						const response = await fetch(
							`/api/dependencies?library=${lib.name}&version=${lib.version}`
						);
						if (!response.ok) {
							throw new Error(`HTTP error! status: ${response.status}`);
						}
						const data = await response.json();
						// Format the dependency tree with an indent for dependencies
						const formattedDependencyTree = data.dependencyTree
							.split('\n')
							.map((line) => '  ' + line) // Add two spaces for indent
							.join('\n');
						return `${lib.name} - ${lib.version}\n${formattedDependencyTree}`;
					} catch (error) {
						console.error(`Error fetching dependencies for ${lib.name}:`, error);
						return `${lib.name} - ${lib.version}\n  Failed to fetch dependencies\n`;
					}
				})
			);

			dependencyTree = results.join('\n\n'); // Add an extra line break between libraries
		} catch (error) {
			console.error('Error in processing dependencies:', error);
			errorMessage = 'Failed to process dependencies';
		} finally {
			isLoading = false;
		}
	}

	function handleSubmit() {
		// Check if libraryName and libraryVersion are provided
		if (!libraryName || !libraryVersion) {
			errorMessage = 'Library name and version are required';
			return;
		}

		// Create an array with a single library object
		const singleLibrary = [{ name: libraryName, version: libraryVersion }];
		fetchAllDependencies(singleLibrary);
	}
</script>

<article class="prose mt-2 p-4">
	<div class="absolute top-6 right-4">
		<select class="select select-bordered">
			<option selected>Python (pip)</option>
			<option>Java (Maven)</option>
		</select>
	</div>
	<h1>Dashboard</h1>
	<!-- Rest of your content here -->
</article>

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
