import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // In development, the browser talks to Vite, and Vite forwards API calls to Express.
    proxy: { '/api': 'http://localhost:3001' },
  },
});
