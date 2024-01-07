<script>
	import { onMount } from 'svelte';
	let libraryName = '';
	let libraryVersion = '';
	let isLoading = false;
	let errorMessage = '';
	let dependencyTree = '';

	async function fetchDependencies() {
		isLoading = true;
		errorMessage = '';
		dependencyTree = '';

		try {
			const response = await fetch(
				`/api/dependencies?library=${libraryName}&version=${libraryVersion}`
			);
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();

			dependencyTree = data.dependencyTree; // Use the formatted dependency tree string from the response
		} catch (error) {
			console.error('Error fetching dependencies:', error);
			errorMessage = 'Failed to fetch dependencies';
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
