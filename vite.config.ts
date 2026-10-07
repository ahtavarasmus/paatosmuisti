import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the built page works from any folder of a static host.
  base: './',
  plugins: [react()],
});
