import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { sveltekit } from '@sveltejs/kit/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs through the SvelteKit plugin so tests resolve exactly what the app resolves:
 * the alias map in `svelte.config.js` ($features, @cio/ui/*, …) and Svelte compilation
 * for the components those modules pull in transitively. A bare config only aliasing
 * $lib cannot load them, which is why two suites failed before a single test ran.
 */
export default defineConfig({
  root: __dirname,
  plugins: [sveltekit()],
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.{ts,tsx}']
  }
});
