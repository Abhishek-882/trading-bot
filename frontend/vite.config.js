import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  resolve: {
    alias: {
      bs58: path.resolve(__dirname, '../backend/node_modules/bs58'),
      '@solana/kit': path.resolve(__dirname, 'src/stubs/solana-kit.js'),
    },
  },

  build: {
    rollupOptions: {
      external: ['@solana/kit'],
    },
  },
});

