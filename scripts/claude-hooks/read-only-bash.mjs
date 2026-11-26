// Claude Code's PreToolUse hook for the reviewer subagent (see .claude/agents/reviewer.md). A
// subagent's tool list can't limit Bash to some commands, so this denies any shell command that
// isn't on a short list of commands that only read. It never allows a command itself: one that
// passes still goes through the session's usual permission checks.
// Reads the tool call as JSON on stdin and prints a denial if the command could change anything.

import { readFileSync } from 'node:fs'

class Refusal extends Error {}

function refuse(reason) {
  throw new Refusal(reason)
}

// Longest first, so that '&&' isn't read as two '&'.
const OPERATORS = '&>> <<< && || |& ;; >> >| >& &> << <& <> <( >( | ; & < > ( )'.split(' ')
const SEPARATORS = new Set(['&&', '||', '|&', '|', ';'])
const OUTPUT_REDIRECTIONS = new Set(['>', '>>', '>|', '>&', '&>', '&>>'])
const REDIRECTIONS = new Set([...OUTPUT_REDIRECTIONS, '<', '<<', '<<<', '<&', '<>'])
// Inside double quotes, a backslash escapes only these. Before a newline it joins the two lines.
const DOUBLE_QUOTE_ESCAPES = ['$', '`', '"', '\\', '\n']

const runsHiddenCommand = (source, index) => source[index] === '`' || source.startsWith('$(', index)

// Splits a command into words and operators the way the shell does, refusing anything that would
// run a command hidden inside another.
class Lexer {
  constructor(source) {
    this.source = source
    this.index = 0
    this.tokens = []
    this.word = null
  }

  run() {
    while (this.index < this.source.length) this.step()
    this.endWord()
    return this.tokens
  }

  step() {
    const char = this.source[this.index]
    if (char === "'") return this.readSingleQuoted()
    if (char === '"') return this.readDoubleQuoted()
    if (char === '\\') return this.readEscape()
    if (runsHiddenCommand(this.source, this.index)) refuse('it runs a command inside another')
    if (char === '#' && this.word === null) return this.skipComment()
    if (char === '\n') return this.readOperator(';', 1)
    if (/\s/.test(char)) return this.skipSpace()
    const operator = OPERATORS.find((candidate) => this.source.startsWith(candidate, this.index))
    if (operator) return this.readOperator(operator, operator.length)
    this.append(char)
    this.index += 1
  }

  append(text) {
    this.word = (this.word ?? '') + text
  }

  endWord() {
    if (this.word !== null) this.tokens.push({ type: 'word', text: this.word })
    this.word = null
  }

  readSingleQuoted() {
    const end = this.source.indexOf("'", this.index + 1)
    if (end < 0) refuse('a quote is never closed')
    this.append(this.source.slice(this.index + 1, end))
    this.index = end + 1
  }

  readDoubleQuoted() {
    this.append('')
    let i = this.index + 1
    while (i < this.source.length && this.source[i] !== '"') {
      if (runsHiddenCommand(this.source, i)) refuse('it runs a command inside another')
      i = this.readDoubleQuotedChar(i)
    }
    if (i >= this.source.length) refuse('a quote is never closed')
    this.index = i + 1
  }

  readDoubleQuotedChar(i) {
    const [char, next] = [this.source[i], this.source[i + 1]]
    if (char !== '\\' || !DOUBLE_QUOTE_ESCAPES.includes(next)) {
      this.append(char)
      return i + 1
    }
    if (next !== '\n') this.append(next)
    return i + 2
  }

  readEscape() {
    const next = this.source[this.index + 1]
    if (next !== undefined && next !== '\n') this.append(next)
    this.index += 2
  }

  skipComment() {
    const end = this.source.indexOf('\n', this.index)
    this.index = end < 0 ? this.source.length : end
  }

  skipSpace() {
    this.endWord()
    this.index += 1
  }

  readOperator(operator, length) {
    // In 2>/dev/null the 2 is the stream being redirected, not a word.
    if (REDIRECTIONS.has(operator) && /^\d+$/.test(this.word ?? '')) this.word = null
    this.endWord()
    this.tokens.push({ type: 'operator', text: operator })
    this.index += length
  }
}

function checkRedirection(operator, target) {
  if (target?.type !== 'word') refuse(`${operator} has no file after it`)
  if (operator === '<') return
  if (!OUTPUT_REDIRECTIONS.has(operator)) refuse(`it uses ${operator}`)
  if (target.text === '/dev/null' || (operator === '>&' && /^\d+$/.test(target.text))) return
  refuse(`it writes to ${target.text}`)
}

// Each command in the line, as its words, with every redirection checked on the way.
function commandsIn(tokens) {
  const commands = [[]]
  for (let i = 0; i < tokens.length; i += 1) {
    const { type, text } = tokens[i]
    if (type === 'word') {
      commands.at(-1).push(text)
    } else if (SEPARATORS.has(text)) {
      commands.push([])
    } else if (REDIRECTIONS.has(text)) {
      checkRedirection(text, tokens[i + 1])
      i += 1
    } else {
      refuse(`it uses ${text}`)
    }
  }
  return commands.filter((words) => words.length > 0)
}

const isShortOptions = (arg) => /^-[^-]/.test(arg)

// git and GNU sort accept any unambiguous start of a long option, so --out=file means --output=file.
function abbreviates(arg, longOption) {
  const name = arg.split('=')[0]
  return name.length > 2 && longOption.startsWith(name)
}

const GIT_GLOBAL_FLAGS = new Set(['--no-pager', '-P', '--no-optional-locks'])
const GIT_READERS = new Set(
  (
    'blame cat-file check-ignore describe diff diff-tree for-each-ref grep log ls-files ls-tree merge-base ' +
    'name-rev range-diff rev-list rev-parse shortlog show show-ref status whatchanged'
  ).split(' '),
)
const GIT_BRANCH_FLAGS = new Set(
  '--show-current --list -l -a --all -r --remotes -v -vv --verbose --no-color --contains --merged --no-merged'.split(
    ' ',
  ),
)
const GIT_BRANCH_FILTER = /^--(sort|format|contains|no-contains|merged|no-merged|points-at)=/

function subcommandAndOptions(args) {
  let i = 0
  while (args[i]?.startsWith('-')) {
    if (args[i] === '-C') i += 2
    else if (GIT_GLOBAL_FLAGS.has(args[i])) i += 1
    else refuse(`git ${args[i]} isn't on the list`)
  }
  return [args[i] ?? '', args.slice(i + 1)]
}

// git branch only lists branches with no name after it. With a name it makes, moves or deletes one.
function checkGitBranch(options) {
  const other = options.find((option) => !GIT_BRANCH_FLAGS.has(option) && !GIT_BRANCH_FILTER.test(option))
  if (other !== undefined) refuse(`git branch ${other} isn't on the list, since git branch only lists branches here`)
}

// git grep -O opens the matching files in a program of the caller's choice.
const opensFiles = (option) =>
  abbreviates(option, '--open-files-in-pager') || (isShortOptions(option) && option.includes('O'))

function checkGit(args) {
  const [subcommand, options] = subcommandAndOptions(args)
  if (subcommand === 'branch') return checkGitBranch(options)
  if (!GIT_READERS.has(subcommand)) refuse(`git ${subcommand} isn't on the list of git commands that only read`)
  if (options.some((option) => abbreviates(option, '--output'))) refuse('--output writes a file')
  if (subcommand === 'grep' && options.some(opensFiles)) refuse('git grep -O runs another program')
}

const FIND_ACTIONS = new Set('-delete -exec -execdir -ok -okdir -fprint -fprint0 -fprintf -fls'.split(' '))

function checkFind(args) {
  const action = args.find((arg) => FIND_ACTIONS.has(arg))
  if (action) refuse(`find ${action} can change files or run a program`)
}

function checkSort(args) {
  const writes = (arg) =>
    abbreviates(arg, '--output') || abbreviates(arg, '--compress-program') || (isShortOptions(arg) && arg.includes('o'))
  if (args.some(writes)) refuse('sort -o writes a file, and --compress-program runs one')
}

// uniq INPUT OUTPUT writes to OUTPUT.
function checkUniq(args) {
  const files = args.filter((arg) => arg === '-' || !arg.startsWith('-'))
  if (files.length > 1) refuse('uniq writes to its second file')
}

// Only sed -n 'FROM,TOp' FILE..., which prints lines. Other sed scripts can write files or run programs.
function checkSed([flag, script, ...files]) {
  const printsLines = /^(\d+|\$)(,(\d+|\$))?p$/.test(script ?? '')
  if (flag !== '-n' || !printsLines || files.some((file) => file.startsWith('-'))) {
    refuse("sed is only allowed as sed -n '10,20p' FILE, and Read with an offset and limit does the same")
  }
}

const anyArguments = () => {}
const SIMPLE_READERS =
  'grep egrep fgrep cat head tail wc ls pwd cd echo diff cmp comm cut tr nl stat du basename dirname'
const READERS = new Map([
  ...[...SIMPLE_READERS.split(' '), 'realpath', 'which'].map((name) => [name, anyArguments]),
  ['git', checkGit],
  ['find', checkFind],
  ['sort', checkSort],
  ['uniq', checkUniq],
  ['sed', checkSed],
])

function checkCommand([name, ...args]) {
  const check = READERS.get(name)
  if (!check) refuse(`${name} isn't on the list of commands that only read`)
  check(args)
}

function refusalFor(command) {
  try {
    commandsIn(new Lexer(command).run()).forEach(checkCommand)
    return null
  } catch (error) {
    if (error instanceof Refusal) return error.message
    throw error
  }
}

const READ_ONLY_COMMANDS =
  'git diff, log, show, status, grep, blame, ls-files and other git commands that only read, ' +
  "grep, cat, head, tail, ls, find, wc, sort, uniq, diff and sed -n '10,20p'"

const { tool_input: toolInput = {} } = JSON.parse(readFileSync(0, 'utf8'))
const refusal = refusalFor(typeof toolInput.command === 'string' ? toolInput.command : '')

if (refusal) {
  const reason =
    `The reviewer only reads, so a hook refused this command: ${refusal}. ` +
    `Use Read, Grep or Glob, or a command that only reads, such as ${READ_ONLY_COMMANDS}. ` +
    'Output can be redirected only to /dev/null. Leave anything that changes files to the person.'
  const decision = { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason }
  console.log(JSON.stringify({ hookSpecificOutput: decision }))
}
