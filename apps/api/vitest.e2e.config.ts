import { defineConfig } from 'vitest/config';

/**
 * Las E2E importan el AppModule compilado (`dist/`), no el TS fuente.
 * Así se evitan problemas de Vite/SWC con decoradores Nest.
 * El script `test:e2e` ejecuta `nest build` antes.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    pool: 'forks',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    sequence: { concurrent: false },
  },
});
