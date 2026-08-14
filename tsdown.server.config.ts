import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'server/server.ts',
  // Keep local agent modules in the production bundle. Leaving the build in
  // unbundle mode preserves a `./agents/support.ts` import that is not emitted
  // to `dist`, so the deployed server cannot start.
  unbundle: false,
  external: (id) => id.startsWith('@databricks/') || id.includes('/node_modules/'),
  tsconfig: 'tsconfig.server.json',
  outExtensions: () => ({
    js: '.js',
  }),
});
