<script>
	export let dep;

	// Utility function to generate unique IDs for DOM elements
	function uniqueId(name) {
		return `dep-${name.replace(/\W/g, '-')}`;
	}
</script>

<div class="collapse collapse-arrow bg-base-200">
	<input type="checkbox" id={uniqueId(dep.name)} />
	<label for={uniqueId(dep.name)} class="collapse-title text-xl font-medium">
		{dep.name}
	</label>
	<div class="collapse-content">
		{#if dep.dependencies && dep.dependencies.length > 0}
			{#each dep.dependencies as subDep}
				<Dependency {subDep} />
			{/each}
		{/if}
	</div>
</div>
