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
		fetchAllDependencies(libraries, contents);
	}

	async function fetchAllDependencies(libraries, requirementsFile) {
		isLoading = true;
		errorMessage = '';
		dependencyTree = '';

		try {
			const results = await Promise.all(
				libraries.map(async (lib) => {
					try {
						const response = await fetch(
							`/api/dependencies?library=${lib.name}&version=${lib.version}&requirementsFile=${requirementsFile}`
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
		fetchAllDependencies(singleLibrary, '');
	}
</script>

<article class="prose mt-6 px-12">
	<div class="absolute top-6 right-4">
		<select class="select select-bordered">
			<option selected>Python (pip)</option>
			<option>Java (Maven)</option>
		</select>
	</div>
	<h1>Dashboard</h1>
	<!-- Rest of your content here -->
</article>

<div class="h-8"></div>

<div class="p-4 flex px-12">
	<!-- First Box -->
	<div class="card p-4 w-1/2 h-60 bg-slate-200 drop-shadow-xl mr-4">
		<article class="prose flex items-center px-2">
			<h1 class="label-text prose text-2xl">Provide A Library</h1>
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
				class="input input-bordered w-1/6"
				bind:value={libraryVersion}
			/>
			<button class="btn btn-primary" on:click={handleSubmit} disabled={isLoading}>Submit</button>
		</div>
		<label class="form-controls">
			<div class="label">
				<article class="prose flex">
					<h1 class="label-text prose text-2xl">Or, Pick A requirements.txt File</h1>
				</article>
			</div>
			<input
				type="file"
				class="file-input file-input-bordered w-full max-w-xs"
				bind:this={fileInput}
				on:change={handleFileChange}
			/>
		</label>
	</div>

	<div class="w-[6rem]"></div>

	<!-- Second Box -->
	<div class="card p-4 w-1/2 h-auto bg-slate-200 drop-shadow-xl">
		{#if errorMessage}
			<p class="text-red-500">{errorMessage}</p>
		{/if}

		{#if dependencyTree}
			<pre class="dependency-tree">{dependencyTree}</pre>
		{/if}
	</div>
</div>

<div class="p-4 flex px-12">
	<!-- Third Box -->
	<div class="card p-4 w-1/2 h-60 bg-slate-200 drop-shadow-xl mr-4">
		<article class="prose flex items-center px-2">
			<h1 class="label-text prose text-2xl">Third Box</h1>
		</article>
		<!-- Content for the third box -->
	</div>
</div>

<style>
	.dependency-tree {
		white-space: pre-wrap;
		background-color: #f5f5f5;
		border: 1px solid #ccc;
		padding: 1em;
	}
</style>
