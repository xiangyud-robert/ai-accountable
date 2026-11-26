// Claude Code's PreToolUse hook (see .claude/settings.json): blocks any edit to a file named .env,
// which holds the person's own secrets. The file tools are checked by their path. A shell command
// can change a file in too many ways to tell, so any command that names .env is blocked.
// Reads the tool call as JSON on stdin and prints a denial if it touches .env.

import { readFileSync } from 'node:fs'

// .env on its own, so .env.example and .envrc pass. Any case, since macOS and Windows ignore it.
const NAMES_ENV = /(?<![\w.-])\.env(?![\w.-])/i

const REASON =
  "A project hook blocks every change to .env, which holds the person's own secrets. " +
  'Tell them what to change and let them edit it. Shell commands that name .env are blocked too.'

function isEnvFile(path) {
  return path.split(/[\\/]/).pop().toLowerCase() === '.env'
}

function touchesEnv({ file_path, notebook_path, command }) {
  const path = file_path ?? notebook_path
  if (typeof path === 'string') return isEnvFile(path)
  return typeof command === 'string' && NAMES_ENV.test(command)
}

const { tool_input: toolInput = {} } = JSON.parse(readFileSync(0, 'utf8'))

if (touchesEnv(toolInput)) {
  const decision = { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: REASON }
  console.log(JSON.stringify({ hookSpecificOutput: decision }))
}
