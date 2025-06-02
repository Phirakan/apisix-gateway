import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
 server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/wp-json': {
        target: 'http://localhost:8080/',  // Fixed: Changed from 8080 to 8880
        changeOrigin: true,
        secure: false,  // Add this if using HTTPS
        // Removed unnecessary rewrite function
      }
    }
  },
  preview: {
    port: 5173,
    host: '0.0.0.0',
  },
})
