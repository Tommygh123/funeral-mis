import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: [
      'blurt-raisin-naming.ngrok-free.dev', // Add your specific ngrok URL here
      'localhost'
    ]
  }
});