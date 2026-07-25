import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

const tvLocalEnv = path.resolve(__dirname, '.env.local');

export default defineConfig({
  plugins: [react()],
  base: './',
  // Prefer a player-specific file. Keep the root file as a compatibility
  // fallback for existing development and packaging workflows.
  envDir: fs.existsSync(tvLocalEnv) ? __dirname : path.resolve(__dirname, '..'),
  // Expose NEXT_PUBLIC_* vars alongside VITE_* vars
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
