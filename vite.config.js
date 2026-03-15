import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

const certDir = path.join(process.env.HOME, '.claude/certs')
const tsHost = 'tommys-mac-mini.tail59a169.ts.net'
const certFile = path.join(certDir, `${tsHost}.crt`)
const keyFile = path.join(certDir, `${tsHost}.key`)
const hasCerts = fs.existsSync(certFile) && fs.existsSync(keyFile)

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{js,ts}'],
  },
  server: {
    port: 5180,
    strictPort: true,
    allowedHosts: [tsHost],
    ...(hasCerts && {
      https: {
        cert: certFile,
        key: keyFile,
      },
    }),
    proxy: {
      '/api': 'http://localhost:5111',
      '/tallest-trees/api': {
        target: 'http://localhost:5111',
        rewrite: (p) => p.replace(/^\/tallest-trees/, ''),
      },
    },
  },
})
