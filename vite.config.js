import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy chiamate API-Football — forza forwarding header x-apisports-key
      '/sportsapi': {
        target: 'https://v3.football.api-sports.io',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/sportsapi/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // Assicura che l'header di autenticazione venga inoltrato
            const key = req.headers['x-apisports-key'];
            if (key) proxyReq.setHeader('x-apisports-key', key);
          });
        },
      },
      // Proxy immagini API-Football — evita CORS su Canvas
      '/imgproxy': {
        target: 'https://media.api-sports.io',
        changeOrigin: true,
        rewrite: path => path.replace(/^\/imgproxy/, ''),
      },
    },
  },
})
