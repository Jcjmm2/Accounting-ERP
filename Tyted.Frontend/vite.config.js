import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl()
  ],
  server: {
    host: true,
    port: 5173,
    // El dev server corre por HTTPS (basicSsl) y la API por HTTP en localhost:5077.
    // El proxy hace que en desarrollo todas las llamadas a /api/* salgan del mismo
    // origen (https://localhost:5173) y Vite las reenvíe al backend, eliminando así
    // cualquier problema de mixed-content o CORS durante el desarrollo.
    proxy: {
      '/api': {
        target: 'http://localhost:5077',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
