import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // HTTPS only in dev — enables Chrome install prompt over LAN
    ...(command === 'serve' ? [basicSsl()] : []),
  ],
  server: {
    host: true,   // expose to all network interfaces when running `vite`
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
}))
