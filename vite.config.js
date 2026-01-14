import { defineConfig } from 'vite';

export default defineConfig({
  base: '/glacier-sim/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
