import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// The headers nginx sends in production (cf/security-headers.conf), except HSTS, which needs HTTPS.
const securityHeaders = readFileSync(new URL('cf/security-headers.conf', import.meta.url), 'utf8')
const productionHeaders = Object.fromEntries(
  Array.from(securityHeaders.matchAll(/^\s*add_header\s+(\S+)\s+"([^"]*)"/gm))
    .map(([, name, value]) => [name, value])
    .filter(([name]) => name !== 'Strict-Transport-Security'),
)
if (!productionHeaders['Content-Security-Policy']) throw new Error('No CSP found in cf/security-headers.conf')

export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es'
  },
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
    // Maps without the sourceMappingURL comment: DevTools would fetch them, and the CSP's
    // connect-src 'none' blocks that.
    sourcemap: 'hidden',
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
    // Production's headers, so browser tests run under the CSP nginx serves.
    headers: productionHeaders,
  },
})
