import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: '/',
  plugins: [basicSsl()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,ts}'],
  },
  server: {
    port: 5180,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': 'http://127.0.0.1:5111',
    },
  },
})
