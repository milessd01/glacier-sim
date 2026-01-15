import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isNetlify = process.env.NETLIFY === 'true';
  const base = isNetlify ? '/' : '/glacier-sim/';

  return {
    base,
    build: {
      outDir: 'dist',
      assetsDir: 'assets'
    }
  };
});
