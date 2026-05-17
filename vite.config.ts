import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

function gitShortHash(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  } catch {
    return 'unknown';
  }
}

// GitHub Pages serves project pages from /<repo>/ — so we use a relative
// base path. This works for both local dev (npm run dev = /) and Pages.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Plancktons — Hill T₁ orthoscheme study',
        short_name: 'Plancktons',
        description:
          'Interactive 3D study of Hill T₁ orthoschemes: random face-to-face aggregation, gyration descriptors, η_C / η_B / η_M packing fractions, and reference packing densities.',
        theme_color: '#15181c',
        background_color: '#15181c',
        display: 'standalone',
        start_url: process.env.GITHUB_PAGES ? '/plancktons/' : '/',
        scope: process.env.GITHUB_PAGES ? '/plancktons/' : '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // Cache the worker chunk and all main assets for offline use. WASM
        // files (quickhull3d compiles to JS, not WASM, so the only
        // performance-critical bundle is the worker JS chunk) are included
        // via the default globPatterns.
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  base: process.env.GITHUB_PAGES ? '/plancktons/' : '/',
  define: {
    __BUILD_COMMIT__: JSON.stringify(gitShortHash()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/@react-three')) return 'r3f';
          if (id.includes('node_modules/quickhull3d')) return 'hull';
          return undefined;
        },
      },
    },
  },
});
