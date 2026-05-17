import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [react()],
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
