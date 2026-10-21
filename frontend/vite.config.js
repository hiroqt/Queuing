import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  define: {
    'import.meta.env.VITE_LOCAL_SETUP_MODE': JSON.stringify(
      command === 'serve' && process.env.VITE_LOCAL_SETUP_MODE !== 'false',
    ),
  },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5271",
      "/hubs": {
        target: "http://127.0.0.1:5271",
        ws: true,
      },
    },
  },
}))
