import { Command } from 'cmdk'
import { Briefcase, Building2, Search, Users, type LucideIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react'
import { useNavigate } from 'react-router'
import { money, plural } from '../../lib/format'
import { useStages } from '../../lib/stages'
import type { StageKey } from '../../lib/types'
import { highlight } from './highlight'
import { useSearch } from './queries'
import type { Found, SearchResults } from './types'

type Result = { path: string; name: string; detail: string }
type ResultGroup = { kind: string; heading: string; icon: LucideIcon; results: Result[] }

// A result, tinted like a table row on hover when it's the one Enter would open. Focus stays in
// the box, so that result gets the focus ring too, as a picker's option does.
const RESULT =
  'flex h-12 cursor-pointer items-center gap-3 rounded-control px-2.5 data-[selected=true]:bg-page data-[selected=true]:outline-2 data-[selected=true]:outline-offset-2 data-[selected=true]:outline-focus'

/** A second line from its parts, leaving out any the record doesn't have. */
const secondLine = (...parts: (string | null)[]) => parts.filter(Boolean).join(', ')

function group<T>(kind: string, icon: LucideIcon, found: Found<T>, toResult: (record: T) => Result): ResultGroup {
  const shown = found.results.length
  const heading = found.total > shown ? `${kind}, ${shown} of ${found.total}` : kind
  return { kind, heading, icon, results: found.results.map(toResult) }
}

/** Organizations, contacts and deals, in that order, leaving out a kind with no results. */
function groupsOf({ organizations, contacts, deals }: SearchResults, stageName: (key: StageKey) => string) {
  return [
    group('Organizations', Building2, organizations, (o) => ({
      path: `/organizations/${o.id}`,
      name: o.name,
      detail: secondLine(o.industry),
    })),
    group('Contacts', Users, contacts, (c) => ({
      path: `/contacts/${c.id}`,
      name: c.name,
      detail: secondLine(c.job_title, c.organization_name),
    })),
    group('Deals', Briefcase, deals, (d) => ({
      path: `/deals/${d.id}`,
      name: d.name,
      detail: secondLine(d.organization_name, stageName(d.stage), money(d.value)),
    })),
  ].filter((g) => g.results.length > 0)
}

/** The top bar's search box and the list of results below it (docs/specs/search.md). */
export function SearchBox() {
  const [text, setText] = useState('')
  const [focused, setFocused] = useState(false)
  const box = useRef<HTMLInputElement>(null)
  const popupId = useId()
  const navigate = useNavigate()
  const { data: stages } = useStages()
  const { data } = useSearch(text)
  useSlashToFocus(box)

  // The list shows the latest results while the box has focus and something in it.
  const shown = focused && text.trim() !== '' && data?.query ? data : undefined
  const stageName = (key: StageKey) => stages?.find((s) => s.key === key)?.name ?? ''
  const groups = shown ? groupsOf(shown, stageName) : []
  const count = groups.reduce((sum, g) => sum + g.results.length, 0)
  const highlighted = useHighlight(count > 0 ? shown : undefined)
  const resultId = (path: string) => `${popupId}${path.replaceAll('/', '-')}`

  const choose = (path: string) => {
    navigate(path)
    setText('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') setText('')
    // Home and End move the caret, as in any text box, rather than the highlight.
    if (event.key === 'Home' || event.key === 'End') event.stopPropagation()
  }

  return (
    // The server has already found and ordered the results, so cmdk doesn't filter or sort them.
    // Focus stays in the box, and cmdk takes Up, Down and Enter from it.
    <Command
      shouldFilter={false}
      value={highlighted.value}
      onValueChange={highlighted.set}
      className="relative w-[400px]"
    >
      <Search
        aria-hidden
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
      <input
        ref={box}
        type="text"
        role="combobox"
        aria-label="Search"
        aria-autocomplete="list"
        aria-expanded={shown !== undefined}
        aria-controls={shown ? popupId : undefined}
        aria-activedescendant={count > 0 && highlighted.value ? resultId(highlighted.value) : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder="Search organizations, contacts and deals"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="h-9 w-full rounded-control border border-field bg-panel px-9 text-sm text-ink placeholder:text-ink-muted"
      />
      {text === '' && (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 grid h-5 min-w-5 -translate-y-1/2 place-items-center rounded-md bg-page px-1 font-mono text-xs text-ink-muted"
        >
          /
        </kbd>
      )}
      <p role="status" className="sr-only">
        {shown && (count > 0 ? plural(count, 'result') : 'No results')}
      </p>
      {shown && (
        <div id={popupId} className="absolute left-0 top-full z-40 mt-1 w-[480px] rounded-card bg-raised shadow-lift">
          {count === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-muted">
              No organizations, contacts or deals match "{shown.query}".
            </p>
          ) : (
            <Results
              key={highlighted.list}
              groups={groups}
              search={shown.query}
              resultId={resultId}
              onChoose={choose}
            />
          )}
        </div>
      )}
    </Command>
  )
}

type ResultsProps = {
  groups: ResultGroup[]
  /** What the results were found for, which their names show in semibold. */
  search: string
  resultId: (path: string) => string
  onChoose: (path: string) => void
}

/** The results in their groups, which cmdk moves the highlight through. */
function Results({ groups, search, resultId, onChoose }: ResultsProps) {
  return (
    <Command.List
      label="Search results"
      // Keeps focus in the box, so a click on a result reaches it before the list closes.
      onMouseDown={(event) => event.preventDefault()}
      className="max-h-[calc(100vh-88px)] overflow-y-auto p-1.5"
    >
      {groups.map(({ kind, heading, icon: Icon, results }) => (
        <Command.Group
          key={kind}
          value={kind}
          heading={<span className="block px-2.5 pb-1 pt-2 text-[13px] font-medium text-ink-muted">{heading}</span>}
        >
          {results.map(({ path, name, detail }) => (
            // On a result of its own, so it has the id the box points screen readers at.
            <Command.Item key={path} value={path} onSelect={onChoose} asChild>
              <div id={resultId(path)} className={RESULT}>
                <Icon aria-hidden size={18} className="shrink-0 text-ink-muted" />
                <span className="min-w-0">
                  <span className="block truncate">
                    <Name name={name} search={search} />
                  </span>
                  {detail && <span className="block truncate text-xs text-ink-muted">{detail}</span>}
                </span>
              </div>
            </Command.Item>
          ))}
        </Command.Group>
      ))}
    </Command.List>
  )
}

/** A result's name, with the part that matches the search in semibold. */
function Name({ name, search }: { name: string; search: string }) {
  const parts = highlight(name, search)
  if (!parts) return name
  return (
    <>
      {parts.before}
      <mark className="bg-transparent font-semibold text-inherit">{parts.match}</mark>
      {parts.after}
    </>
  )
}

/**
 * The result Enter would open, as cmdk's value. cmdk works out its list's own
 * aria-activedescendant only when it changes the value itself, so each time a new list of
 * results shows, this starts from nothing in a fresh list, and cmdk highlights the first result.
 * Set from here, the list could point screen readers at a result that has gone.
 */
function useHighlight(shown: SearchResults | undefined) {
  const [state, setState] = useState({ shown, value: '', list: 0 })
  if (state.shown !== shown) setState({ shown, value: '', list: state.list + 1 })
  return {
    value: state.value,
    list: state.list,
    set: (value: string) => setState((current) => ({ ...current, value })),
  }
}

/** True for a field that "/" should type itself in. */
const inField = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.matches('input, textarea, select, [role="combobox"], [role="textbox"]'))

/** "/" puts focus in the search box from anywhere, unless focus is in a field. */
function useSlashToFocus(box: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const focusBox = (event: globalThis.KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || inField(event.target)) return
      event.preventDefault()
      box.current?.focus()
    }
    document.addEventListener('keydown', focusBox)
    return () => document.removeEventListener('keydown', focusBox)
  }, [box])
}
