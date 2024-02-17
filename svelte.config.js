import adapter from '@sveltejs/adapter-auto';
import preprocess from 'svelte-preprocess'; // Corrected import

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter()
	},
	preprocess: preprocess() // Use svelte-preprocess
};

export default config;
