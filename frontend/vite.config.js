import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://127.0.0.1:5271'
  return {
    define: {
      'import.meta.env.VITE_LOCAL_SETUP_MODE': JSON.stringify(
        command === 'serve' && process.env.VITE_LOCAL_SETUP_MODE !== 'false',
      ),
    },
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        "/api": apiTarget,
        "/hubs": {
          target: apiTarget,
          ws: true,
        },
      },
    },
  }
})
