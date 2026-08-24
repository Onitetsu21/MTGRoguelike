import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// JSON files under /data are imported directly by the data-loading layer.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
});
