import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true, // allow external access (needed when using ngrok)
    allowedHosts: [
      'engaged-humorous-fish.ngrok-free.app', // the ngrok hostname you're using
      // you can also use '.ngrok-free.app' to allow any ngrok subdomain
    ],
    // if you just want to skip the host check entirely in dev:
    // allowedHosts: 'all',
    proxy: {
      '/ws': {
        target: 'http://localhost:5173', // or your backend if different
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
