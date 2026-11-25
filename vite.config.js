import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL || 'http://localhost:5000'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      port: 5173,
      proxy: {
        // En dev, les appels /api sont redirigés vers le backend automatiquement
        // Évite les problèmes CORS pendant le développement local
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
        // Socket.IO (WebSocket) est également proxifié
        '/socket.io': {
          target: backendUrl,
          changeOrigin: true,
          ws: true,  // <-- active le proxy WebSocket pour Socket.IO
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 800,
    },
  }
})
