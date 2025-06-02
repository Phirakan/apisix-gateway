import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import process from 'process'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Check if running in Docker container
  const isDocker = env.DOCKER_ENV === 'true'
  const isDev = mode === 'development'
  
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5173,
      host: '0.0.0.0',
      proxy: {
        // Proxy สำหรับ APISIX Gateway - ใช้ container name เมื่อรันใน Docker
        '/api': {
          target: isDev && !isDocker 
            ? 'http://localhost:9080'  // Local development
            : 'http://apisix_api:9080', // Docker container
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('APISIX proxy error:', err.message);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log('→ APISIX:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('← APISIX:', proxyRes.statusCode, req.url);
            });
          },
        },
        // Proxy สำหรับ WordPress (direct access)
        '/wp-json': {
          target: isDev && !isDocker
            ? 'http://localhost:8080'
            : 'http://wordpress:80',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('WordPress proxy error:', err.message);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log('→ WordPress:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('← WordPress:', proxyRes.statusCode, req.url);
            });
          },
        },
        // Proxy สำหรับ GoFiber (direct access)
        '/direct-api': {
          target: isDev && !isDocker
            ? 'http://localhost:3000'
            : 'http://gofiber-backend:3000',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/direct-api/, '/api'),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.log('GoFiber proxy error:', err.message);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log('→ GoFiber:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log('← GoFiber:', proxyRes.statusCode, req.url);
            });
          },
        }
      }
    },
    preview: {
      port: 5173,
      host: '0.0.0.0',
    },
  }
})