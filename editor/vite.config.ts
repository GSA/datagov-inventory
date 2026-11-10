import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const productionCsp = /Content-Security-Policy "([^"]+)"/.exec(
  readFileSync(new URL('cf/security-headers.conf', import.meta.url), 'utf8'),
)![1]

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    headers: {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        "connect-src 'self' ws: wss:",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'uswds-vendor': ['@trussworks/react-uswds']
        }
      }
    }
  },
  preview: {
    port: 4173,
    // The production CSP, so browser tests run under the policy nginx serves.
    headers: { 'Content-Security-Policy': productionCsp },
  },
})
