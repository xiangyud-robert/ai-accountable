// npm start: build the frontend and run the app the way Render does, as one server against the
// team's database on Supabase, with the settings in .env (docs/specs/platform.md, Running it).

import { readSettings } from './env.mjs'
import { requireFreePorts, runUntilStopped } from './servers.mjs'
import { fail, run, setup, start } from './setup.mjs'

const PORT = 8000
const SETTINGS = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'ACCOUNTABLE_TIMEZONE']

function listed(names) {
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}

function startEnv() {
  const settings = readSettings(SETTINGS)
  const missing = SETTINGS.filter((name) => !settings[name])
  if (missing.length > 0) {
    const one = missing.length === 1
    fail(
      `npm start needs ${listed(missing)} in .env, and ${one ? "it's" : "they're"} missing or empty.\n` +
        `Add ${one ? 'it' : 'each one'} to the .env file in the repo's root folder, as NAME=value on a line of its own,\n` +
        `then run npm start again. docs/STATUS.md says what goes in ${one ? 'it' : 'each'}.`,
    )
  }
  const env = { ...process.env, ...settings }
  // The stand-in signs anyone in as a sample teammate, so it's never on against Supabase (concern 18).
  delete env.ACCOUNTABLE_STAND_IN
  return env
}

const env = startEnv()
await setup()
await requireFreePorts([[PORT, 'its server']], 'npm start')

console.log('Building the frontend...')
// The build takes the Supabase settings from env, so the browser signs in with Supabase.
if ((await run('npm', ['run', 'build', '--workspace', 'frontend', '--', '--logLevel', 'warn'], { env })) !== 0) {
  fail('Building the frontend failed. The command was: npm run build --workspace frontend')
}

console.log('Starting Accountable...')
await runUntilStopped(
  [
    {
      name: 'server',
      child: start(
        'uv',
        ['run', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(PORT), '--log-level', 'warning'],
        { env },
      ),
      url: `http://127.0.0.1:${PORT}/api/stages`,
    },
  ],
  `http://localhost:${PORT}`,
)
