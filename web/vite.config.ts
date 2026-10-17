import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// vite configuration with proxy to go fiber backend on port 8080
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/login': 'http://localhost:8080',
      '/logout': 'http://localhost:8080',
      '/protected': 'http://localhost:8080',
      '/buoi-hoc': 'http://localhost:8080',
      '/sinh-vien': 'http://localhost:8080',
      '/lop-hoc': 'http://localhost:8080',
      '/mon-hoc': 'http://localhost:8080',
      '/faces': 'http://localhost:8080',
      '/events': 'http://localhost:8080',
      '/api': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
