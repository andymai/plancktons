import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project pages from /<repo>/ — so we use a relative
// base path. This works for both local dev (npm run dev = /) and Pages.
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/plancktons/' : '/',
});
