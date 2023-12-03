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

	function typeWriter() {
		if (!deleting && letterIndex < phrases[phraseIndex].length) {
			currentPhrase += phrases[phraseIndex].charAt(letterIndex);
			letterIndex++;
			setTimeout(typeWriter, 150);
		} else if (deleting) {
			if (letterIndex > 0) {
				currentPhrase = currentPhrase.substring(0, currentPhrase.length - 1);
				letterIndex--;
				setTimeout(typeWriter, 75); // Faster deletion speed
			} else {
				deleting = false;
				phraseIndex = (phraseIndex + 1) % phrases.length;
				setTimeout(typeWriter, 2000); // Adjust pause between phrases
			}
		} else {
			setTimeout(() => {
				deleting = true;
				typeWriter();
			}, 3000); // Pause before deleting
		}
	}

	onMount(() => {
		typeWriter();
		setInterval(() => {
			cursorOpacity = cursorOpacity === 1 ? 0 : 1;
		}, 600); // Adjust cursor blink speed
	});
</script>

<div class="container mx-auto p-4">
	<div class="flex flex-col lg:flex-row">
		<div class="w-full lg:w-1/2 justify-center">
			<article class="prose lg:pl-6 mt-64">
				<h1>
					{currentPhrase}<span class="cursor" style="opacity: {cursorOpacity}">_</span>
				</h1>
				<p class="text-lg opacity-60 text-black">
					HealthInspect is a one-stop shop for identifying head to detect dependenceis an
				</p>
			</article>
		</div>
		<div class="w-full lg:w-1/2 mt-48">
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
