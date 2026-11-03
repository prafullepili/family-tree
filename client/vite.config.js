import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/family-tree/',
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            // The API watcher can restart while the browser is making a request.
            // Return JSON so sign-in can show a useful, retryable error.
            if (!response || response.headersSent || response.destroyed || typeof response.writeHead !== 'function') return;
            response.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '2' });
            response.end(JSON.stringify({ error: 'The local API is starting or restarting. Wait a moment, then sign in again.' }));
          });
        },
      },
    },
  },
});
