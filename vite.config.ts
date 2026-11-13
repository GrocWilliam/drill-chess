import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 30000, // PGlite start-up is slow on loaded machines
    hookTimeout: 120000, // PGlite migrations in beforeAll pass 30 s when CI runs several jobs at once
    environment: 'node',
  },
});
