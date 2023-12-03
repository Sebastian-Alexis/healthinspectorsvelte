<script>
	import { onMount } from 'svelte';
	let phrases = [
		'Your guide to software security',
		'Comprehensive SBOM creator',
		'Transitive Dependency Detector'
	];
	let currentPhrase = '';
	let cursorOpacity = 1;
	let phraseIndex = 0;
	let letterIndex = 0;
	let deleting = false;
	let dropdownOpen = false;

	function toggleDropdown() {
		dropdownOpen = !dropdownOpen;
	}
	function typeWriter() {
		if (!deleting && letterIndex < phrases[phraseIndex].length) {
			currentPhrase += phrases[phraseIndex].charAt(letterIndex);
			letterIndex++;
			setTimeout(typeWriter, 100);
		} else if (deleting) {
			if (letterIndex > 0) {
				currentPhrase = currentPhrase.substring(0, currentPhrase.length - 1);
				letterIndex--;
				setTimeout(typeWriter, 50); // Faster deletion speed
			} else {
				deleting = false;
				phraseIndex = (phraseIndex + 1) % phrases.length;
				setTimeout(typeWriter, 1333); // Adjust pause between phrases
			}
		} else {
			setTimeout(() => {
				deleting = true;
				typeWriter();
			}, 2000); // Pause before deleting
		}
	}

	onMount(() => {
		typeWriter();
		setInterval(() => {
			cursorOpacity = cursorOpacity === 1 ? 0 : 1;
		}, 600); // Adjust cursor blink speed
	});
</script>

<div class="navbar bg-base-100">
	<div class="navbar-start">
		<div class="dropdown">
			<!-- svelte-ignore a11y-click-events-have-key-events -->
			<div on:click={toggleDropdown} tabindex="0" role="button" class="btn btn-ghost btn-circle">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="h-5 w-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h7"
					/>
				</svg>
			</div>
			{#if dropdownOpen}
				<!-- svelte-ignore a11y-<code> -->
				<ul
					tabindex="0"
					class="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
				>
					<li><a href="/">Homepage</a></li>
					<li><a href="/dashboard">Dashboard</a></li>
					<li><a href="https://sebastianalexis.com">Portfolio</a></li>
				</ul>
			{/if}
		</div>
	</div>
	<div class="navbar-center">
		<a class="btn btn-ghost text-xl" href="/">HealthInspector</a>
	</div>
	<div class="navbar-end">
		<a class="btn" href="mailto:sebastianralexis@gmail.com">Contact</a>
	</div>
</div>

<div class="container mx-auto px-4 sm:px-6 lg:px-8">
	<div class="flex flex-col-reverse lg:flex-row">
		<div class="w-full lg:w-1/2">
			<article class="prose lg:prose-lg xl:prose-xl mt-10 lg:mt-44">
				<h1>
					{currentPhrase}<span class="cursor" style="opacity: {cursorOpacity}">_</span>
				</h1>
				<p class="text-base sm:text-lg md:text-xl opacity-60 text-black">
					HealthInspector is a one-stop shop for identifying both direct and transitive
					dependencies. We then directly help you create a comprehensive SBOM (Software Bill Of
					Materials) and check each dependency for vulnerabilities. We detect vulnerabilities by
					calling the NVD (National Vulnerability Database) and accurately letting you know about
					your dependencies’ latest vulnerabilities.
				</p>
				<a href="/dashboard">
					<button class="btn btn-primary">Go To Dashboard</button>
				</a>
			</article>
		</div>
		<div class="w-full lg:w-1/2 mt-28">
			<div class="mockup-browser bg-base-300 tilt-3d relative">
				<div class="mockup-browser-toolbar custom-toolbar">
					<div class="input">https://healthinspector.sebastianalexis.com/dashboard</div>
				</div>
				<img
					src="/images/placeholderdash.png"
					alt="dashboard"
					class="absolute top-0 left-0 w-full h-full object-cover"
				/>
			</div>
		</div>
	</div>
</div>

<style>
	.container {
		max-width: 100%;
		overflow-x: hidden; /* Prevent horizontal overflow */
	}

	.tilt-3d {
		transform: perspective(1000px) rotateY(-20deg) rotateX(10deg);
		transform-style: preserve-3d;
		/* The mockup will be responsive, with padding from the viewport */
		margin: 2rem auto;
		max-width: calc(100% - 4rem); /* Prevents touching the edges */
	}

	.mockup-browser {
		/* Set a padding-top percentage for the aspect ratio you want (commonly 16:9) */
		padding-top: 56.25%;
		position: relative; /* Allows absolute positioning within */
	}

	.mockup-browser img {
		/* Existing styles */
		position: absolute;
		top: 0;
		left: 0;
		z-index: 10; /* Increase z-index */

		/* More pronounced drop shadow */
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7);
	}

	.mockup-browser-toolbar {
		/* Positioning adjustments for the toolbar */
		position: absolute;
		top: 0;
		width: 100%;
		/* No additional content styles, assuming these come from your CSS framework */
	}

	img {
		/* Absolute positioning to fill the mockup browser */
		position: absolute;
		top: 0;
		left: 0;
	}

	/* If you have custom toolbar styles, you can adjust them here */

	.cursor {
		animation: blink 1s linear infinite;
		color: var(--daisyui-primary); /* DaisyUI primary color variable */
	}

	@keyframes blink {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0;
		}
	}

	@keyframes blink {
		50% {
			opacity: 0;
		}
	}
</style>
