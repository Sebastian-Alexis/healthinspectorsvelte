<script>
	let libraryName = '';
	let libraryVersion = '';
	let isLoading = false;
	let errorMessage = '';
	let dependencyTree = '';
	let averageBaseScore = null;
	let numberOfBaseScores = null;
	let basescoreList = '';
	let repoUrl = '';
	let baseScores = '';
	let roundedAverageScore = null;
	let isButtonDisabled = false;
	let resetDependencyTree = false;

	import download from 'downloadjs';

	async function generatesbom() {
		isButtonDisabled = true;
		try {
			const response = await fetch('/api/sbom');
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const fullSbomJson = await response.json();
			const sbom = fullSbomJson.sbom; // Extracting just the sbom part of the JSON
			const sbomString = JSON.stringify(sbom);
			console.log(sbomString);
			const sbomBlob = new Blob([sbomString], { type: 'application/json' });
			download(sbomBlob, 'sbom.json');
			isButtonDisabled = false;
		} catch (error) {
			console.error('Error:', error);
		} finally {
			isButtonDisabled = false;
		}
	}

	async function handleUrlSubmit() {
    console.log('URL submit event: ', repoUrl);
    isLoading = true;
	numberOfBaseScores = null;
	averageBaseScore = null;
	roundedAverageScore = null;
	resetDependencyTree = true;
	dependencyTree = '';
    if (repoUrl) {
        try {
            const response = await fetch(`/api/download?repoUrl=${repoUrl}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json(); // Parse the JSON response
            console.log('Repository downloaded successfully!');

			const sbomResponse = await fetch('/api/sbom');
			if (!sbomResponse.ok) {
				throw new Error(`HTTP error! status: ${sbomResponse.status}`);
			}

			const sbomData = await sbomResponse.json(); // Parse the JSON response
			console.log('SBOM generated successfully:', sbomData.sbom);
			console.log('Cleaned Dependency Tree:', sbomData.cleanedDependencyTree);
			dependencyTree = sbomData.cleanedDependencyTree;

			const responseContent = {
				averageBaseScore: sbomData.averageBaseScore,
				numberOfBaseScores: sbomData.numberOfBaseScores,
				baseScores: sbomData.baseScores,
				averageProjectScore: sbomData.averageProjectScore
			};

			numberOfBaseScores = sbomData.numberOfBaseScores;
			averageBaseScore = sbomData.averageBaseScore;
			roundedAverageScore = sbomData.averageProjectScore;
			resetDependencyTree = false;
			
			console.log(numberOfBaseScores);
			console.log(averageBaseScore);
			console.log(roundedAverageScore);

			const newResponse = new Response(JSON.stringify(responseContent), {
				status: 200,
				headers: {
					'Content-Type': 'application/json'
				}
			});

			console.log(dependencyTree);
			isLoading = false;
				// const lines = requirementsContent.split('\n');
				// const libraries = lines
				// 	.map((line) => {
				// 		const parts = line.split('==');
				// 		if (parts.length === 2 && parts[0] && parts[1]) {
				// 			return { name: parts[0], version: parts[1] };
				// 		}
				// 		return null;
				// 	})
				// 	.filter((lib) => lib !== null);
				// fetchAllDependencies(libraries, requirementsContent);

				// // Here you can do further processing with requirementsContent
				// // For example, displaying it on the page, further parsing, etc.
			} catch (error) {
				console.error('Error downloading repo:', error);
			}
		}
	}

	function handleFileChange(event) {
		console.log('File change event: ', event);
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
		console.log('File contents:', contents);
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
		console.log('Fetching dependencies for:', libraries);
		console.log('Requirements file:', requirementsFile);
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
						averageBaseScore = data.averageBaseScore;
						numberOfBaseScores = data.numberOfBaseScores;
						baseScores = data.baseScores;

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
			//send formattedDependencyTree to the server.js file
			const countLibraries = (formattedDependencyTree) => {
				const libraryCount = (formattedDependencyTree.match(/ - /g) || []).length;
				return libraryCount;
			};
			const countVulnerableLibraries = (formattedDependencyTree) => {
				const libraryCount = (formattedDependencyTree.match(/\(CVE/g) || []).length;
				return libraryCount;
			};
			console.log(dependencyTree);

			const numberOfLibraries = countLibraries(dependencyTree);
			const numberOfVulnerableLibraries = countVulnerableLibraries(dependencyTree);
			console.log('Number of libraries:', numberOfLibraries);
			console.log('Number of vulnerable libraries:', numberOfVulnerableLibraries);
			//subtract the number of vulnerable libraries from the total number of libraries and make a variable called numberOfSafeLibraries

			const numberOfSafeLibraries = numberOfLibraries - numberOfVulnerableLibraries;

			console.log('Number of safe libraries:', numberOfSafeLibraries);
			console.log('Base Score list:', baseScores);
			const safeList = Array(numberOfSafeLibraries).fill(0);
			console.log('Safe list:', safeList);
			const averageList = [...baseScores, ...safeList];
			console.log('Average list:', averageList);
			const averageScore = averageList.reduce((sum, score) => sum + score, 0) / averageList.length;
			roundedAverageScore = Math.round(averageScore * 10) / 10;

			console.log('Average score:', roundedAverageScore);
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
					<h1 class="label-text prose text-2xl">Or, Enter A GitHub Repo URL</h1>
				</article>
			</div>
			<div class="flex gap-2 pt-2 px-2">
				<input
					type="text"
					placeholder="Enter GitHub repo URL"
					class="input input-bordered w-full max-w-xs"
					bind:value={repoUrl}
				/>
				<button class="btn btn-primary" on:click={handleUrlSubmit} disabled={isLoading}>Submit</button>
			</div>
		</label>
	</div>

	<!-- Second Box -->
	<div class="card p-4 w-1/2 h-60 bg-slate-200 drop-shadow-xl overflow-auto">
		{#if errorMessage}
			<p class="text-red-500">{errorMessage}</p>
		{/if}

		{#if dependencyTree}
			<pre class="dependency-tree">{dependencyTree}</pre>
		{:else if (resetDependencyTree)}
			<!-- Add your empty state content here -->
			<p class="text-gray-500">loading....</p>
		{/if}
	</div>
</div>
<div class="p-4 flex px-12">
	<!-- Third Box -->
	<div class="card p-4 w-1/2 h-60 bg-slate-200 drop-shadow-xl mr-4">
		<article class="prose flex items-center px-2">
			<h1 class="label-text prose text-2xl">Average Base Score</h1>
		</article>
		<div class="pt-6">
			<div class="stats shadow">
				<div class="stat place-items-center px-4">
					<div class="stat-title">Vulnerabilites</div>
					{#if numberOfBaseScores !== null && numberOfBaseScores !== undefined}
						<div class="stat-value">{numberOfBaseScores}</div>
					{:else}
						<span class="loading loading-ring loading-md"></span>
					{/if}
					<div class="stat-desc">With Transitive Dependencies</div>
				</div>

				<div class="stat place-items-center px-4">
					<div class="stat-title">Vulnerability Score</div>
					{#if averageBaseScore !== null && averageBaseScore !== undefined}
						<div class="stat-value text-secondary">{averageBaseScore}</div>
					{:else}
						<span class="loading loading-ring loading-md"></span>
					{/if}
					<div class="stat-desc text-secondary">Average of all CVE's</div>
				</div>

				<div class="stat place-items-center px-4">
					<div class="stat-title">Project Score</div>
					{#if roundedAverageScore !== null && roundedAverageScore !== undefined}
						<div class="stat-value">{roundedAverageScore}</div>
					{:else}
						<span class="loading loading-ring loading-md"></span>
					{/if}
					<div class="stat-desc">Comprehensive Score</div>
				</div>
			</div>
		</div>
	</div>

	<!-- <div class="w-6rem"></div> -->

	<!-- Fourth Box -->
	<div class="card p-4 w-1/2 h-60 bg-slate-200 drop-shadow-xl">
		<article class="prose flex items-center px-2">
			<h1 class="label-text prose text-2xl">SBOM</h1>
		</article>
		<button
			class="btn btn-primary mx-auto my-auto"
			on:click={generatesbom}
			disabled={isButtonDisabled, isLoading}>Download SBOM</button
		>
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
