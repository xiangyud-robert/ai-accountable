import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const webPort = Number(process.env.ACCOUNTABLE_WEB_PORT ?? 5173)
const apiPort = Number(process.env.ACCOUNTABLE_API_PORT ?? 8000)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: webPort,
    strictPort: true,
    // The app is served from one address, so it needs no CORS. With Vite's default, a page on
    // any other localhost port could use the API through the proxy.
    cors: false,
    fs: {
      // Vite's own list, which this replaces, plus the databases in data/ and e2e/.data/.
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key,p12,pfx,cer,der}',
        '.npmrc',
        '.yarnrc.yml',
        '**/.git/**',
        '*.db',
        '*.db-*',
      ],
    },
    proxy: {
      // 127.0.0.1 rather than localhost, which can resolve to ::1 where uvicorn isn't listening.
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
  test: {
    environment: 'jsdom',
    env: { TZ: 'America/Los_Angeles' },
    setupFiles: ['./src/test-setup.ts'],
    css: false,
    // A test left with .only would make the run skip every other test, so it fails instead.
    allowOnly: false,
    // Globals stubbed and functions spied on in one test are put back before the next.
    unstubGlobals: true,
    restoreMocks: true,
    // Used by npm test, which runs `vitest run --coverage`.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test-setup.ts', 'src/test-utils.tsx'],
      reporter: ['text-summary'],
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
    },
  },
})
