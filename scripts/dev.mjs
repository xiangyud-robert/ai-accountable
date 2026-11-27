// npm run dev: set up on the first run, then start the backend and frontend together.

import { readSettings } from './env.mjs'
import { requireFreePorts, runUntilStopped } from './servers.mjs'
import { setup, start } from './setup.mjs'

const API_PORT = 8000
const WEB_PORT = 5173

// npm run dev never reaches Supabase (concern 15). It takes only the time zone from .env, turns
// on the stand-in sign-in (concern 18), and leaves out the Supabase settings even if the shell
// has them, so the frontend's dev server uses the stand-in too.
function devEnv() {
  const env = { ...process.env, ...readSettings(['ACCOUNTABLE_TIMEZONE']), ACCOUNTABLE_STAND_IN: '1' }
  delete env.SUPABASE_URL
  delete env.SUPABASE_PUBLISHABLE_KEY
  return env
}

await setup()
await requireFreePorts(
  [
    [API_PORT, 'the backend'],
    [WEB_PORT, 'the frontend'],
  ],
  'npm run dev',
)

console.log('Starting Accountable...')

const env = devEnv()
await runUntilStopped(
  [
    {
      name: 'backend',
      child: start(
        'uv',
        [
          'run',
          'uvicorn',
          'backend.main:app',
          '--host',
          '127.0.0.1',
          '--port',
          String(API_PORT),
          '--log-level',
          'warning',
        ],
        { env },
      ),
      url: `http://127.0.0.1:${API_PORT}/api/stages`,
    },
    {
      name: 'frontend',
      child: start('npm', ['run', 'dev', '--workspace', 'frontend', '--', '--logLevel', 'warn'], { env }),
      url: `http://127.0.0.1:${WEB_PORT}/`,
    },
  ],
  `http://localhost:${WEB_PORT}`,
)
