import { defineConfig } from 'vite';

export default defineConfig({
  base: '/grime-nsac/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  test: {
    environment: 'jsdom',
  },
});
