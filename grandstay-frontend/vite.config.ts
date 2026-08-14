import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/, priority: 30 },
            { name: 'data-vendor', test: /node_modules[\\/](@tanstack|axios)[\\/]/, priority: 20 },
            { name: 'charts-vendor', test: /node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/, priority: 20 },
            { name: 'ui-vendor', test: /node_modules[\\/](lucide-react|sonner)[\\/]/, priority: 20 },
            { name: 'vendor', test: /node_modules[\\/]/, maxSize: 250_000, priority: 1 },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: './src/test/setup.ts' },
})
