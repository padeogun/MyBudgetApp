import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    host: true,   // expose to all network interfaces when running `vite`
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
