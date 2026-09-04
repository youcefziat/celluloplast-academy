import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Workspace packages are resolved from source here.
 *
 * The build does the same thing by a different route: `tsc-alias` rewrites `@cio/*` specifiers
 * into relative paths under `node_modules/<pkg>/dist`, bypassing the package `exports` map
 * entirely. Vite honours that map instead, and it cannot express a two-segment subpath —
 * `"./queries/*\/*"` carries two wildcards where Node permits one, so it silently matches
 * nothing. Every `@cio/db/queries/<dir>/<file>` import then failed to resolve and took three
 * test files down with it before a single test ran.
 *
 * Pointing at source keeps tests reading the same code the app compiles, and removes the
 * dependency on a stale `dist` being present.
 */
const workspaceAliases = ['db', 'utils', 'core', 'email', 'jobs', 'question-types', 'certificates', 'analytics'].map(
  (name) => ({
    find: new RegExp(`^@cio/${name}(/.*)?$`),
    replacement: path.resolve(__dirname, `../../packages/${name}/src$1`)
  })
);

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@api\/(.*)$/, replacement: path.resolve(__dirname, 'src/$1') },
      // `@db/*` is the db package's own internal alias, reached once its source is in play.
      { find: /^@db\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/db/src/$1') },
      ...workspaceAliases
    ]
  },
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/']
    }
  }
});
