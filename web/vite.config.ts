/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // `/api` is data, `/auth` the BFF OAuth handshake — both go to the api's published port.
    // MSW intercepts `/api` before the network in dev; `/auth` is a full-page navigation, so it
    // always reaches this proxy.
    proxy: {
      '/api': {
        target: process.env.VITE_API_ORIGIN ?? 'http://localhost:5050',
        changeOrigin: true,
      },
      '/auth': {
        target: process.env.VITE_API_ORIGIN ?? 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
