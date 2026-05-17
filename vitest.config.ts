import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    server: {
      deps: {
        inline: ['quickhull3d'],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/lib/**/*.ts'],
      exclude: [
        'src/lib/store.ts', // React-bound (Zustand store)
        'src/lib/exports.ts', // DOM-bound (downloads, screenshot, URL)
        'src/lib/mesh.ts', // THREE.BufferGeometry — visual only
        'src/lib/references.ts', // pure data table
        'src/lib/brepjsKernel.ts', // brepjs OC WASM init — requires browser
        'src/lib/__*__.ts', // legacy tsx-runnable sanity scripts
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 90,
        lines: 85,
      },
    },
  },
});
