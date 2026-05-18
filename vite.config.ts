import { execFileSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const CANONICAL_URL = 'https://andymai.github.io/plancktons/';

function gitShortHash(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  } catch {
    return 'unknown';
  }
}

// ISO-8601 date (YYYY-MM-DD) of the latest commit on HEAD. Used as
// <lastmod> in sitemap.xml so re-deploys without code changes don't
// artificially advance the timestamp crawlers see.
function gitLastCommitDate(): string {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cd', '--date=format:%Y-%m-%d'])
      .toString()
      .trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function sitemapPlugin(): Plugin {
  return {
    name: 'plancktons:sitemap',
    apply: 'build',
    generateBundle() {
      const lastmod = gitLastCommitDate();
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${CANONICAL_URL}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: xml });
    },
  };
}

// GitHub Pages serves project pages from /<repo>/ — so we use a relative
// base path. This works for both local dev (npm run dev = /) and Pages.
export default defineConfig({
  plugins: [
    react(),
    sitemapPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icon-192.png',
        'icon-512.png',
        'icon-512-maskable.png',
        'og-image.png',
      ],
      manifest: {
        name: 'Plancktons — Hill T₁ orthoscheme study',
        short_name: 'Plancktons',
        description:
          'Interactive 3D study of Hill T₁ orthoschemes: random face-to-face aggregation, gyration descriptors, η_C / η_B / η_M packing fractions, and reference packing densities.',
        categories: ['education', 'science', 'utilities'],
        lang: 'en',
        dir: 'ltr',
        orientation: 'any',
        theme_color: '#15181c',
        background_color: '#15181c',
        display: 'standalone',
        start_url: process.env.GITHUB_PAGES ? '/plancktons/' : '/',
        scope: process.env.GITHUB_PAGES ? '/plancktons/' : '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
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
