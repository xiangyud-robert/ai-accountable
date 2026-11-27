// Reads settings from .env at the repo root, for npm run dev and npm start. Plain Node with no
// dependencies, since npm run dev reads it before npm install has run.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseEnv } from 'node:util'
import { root } from './setup.mjs'

const ENV_FILE = join(root, '.env')

function readEnvFile() {
  if (!existsSync(ENV_FILE)) return {}
  // Some Windows editors start the file with a byte order mark, which would become part of the
  // first setting's name.
  return parseEnv(readFileSync(ENV_FILE, 'utf8').replace(/^\uFEFF/, ''))
}

// The named settings, each from the shell if it's set there, even to nothing, or else from .env.
// A setting in neither is left out.
export function readSettings(names) {
  const file = readEnvFile()
  const settings = {}
  for (const name of names) {
    const value = process.env[name] ?? file[name]
    if (value !== undefined) settings[name] = value
  }
  return settings
}
