import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev server proxies the Flask API so `npm run dev` needs no CORS juggling.
// Production build lands in frontend/dist, which Flask serves automatically.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.BLINDNAV_API || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
