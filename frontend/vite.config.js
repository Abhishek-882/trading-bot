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
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      bs58: path.resolve(__dirname, '../backend/node_modules/bs58'),
      '@solana/kit': path.resolve(__dirname, 'src/stubs/solana-kit.js'),
      '@solana/wallet-standard-wallet-adapter-base': path.resolve(__dirname, 'src/stubs/wallet-standard-base.js'),
    },
  },

  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-solana': [
            '@solana/web3.js',
            '@solana/wallet-adapter-base',
            '@solana/wallet-adapter-react',
            '@solana/wallet-adapter-react-ui',
          ],
          'vendor-three': ['three'],
        },
      },
    },
  },
});

