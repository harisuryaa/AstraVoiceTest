import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  base: '/AstraVoiceTest/', // Updated base path
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      'engaged-humorous-fish.ngrok-free.app',
    ],
    proxy: {
      '/ws': {
        target: 'http://localhost:5173',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});