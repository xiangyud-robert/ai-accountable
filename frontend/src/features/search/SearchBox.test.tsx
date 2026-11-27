import type { QueryClient } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Briefcase, Building2, Users, type LucideIcon } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mockFetch, renderWithApp } from '../../test-utils'
import { SETTLE_MS } from './queries'
import { SearchBox } from './SearchBox'
import type { Found, SearchReply } from './types'

const found = <T,>(results: T[], total = results.length): Found<T> => ({ total, results })

const deal = (id: number, name: string) => ({
  id,
  name,
  organization_name: 'Harbor Logistics',
  stage: 'proposal' as const,
  value: 48_000,
})

/** What the server finds for "har", in the order it gives them. */
const HAR: SearchReply = {
  organizations: found([{ id: 1, name: 'Harbor Logistics', industry: 'Logistics' }]),
  contacts: found([
    { id: 4, name: 'Sharon Hale', job_title: 'Finance Director', organization_name: 'Harbor Logistics' },
    { id: 9, name: 'Ari Harmon', job_title: null, organization_name: null },
  ]),
  deals: found(
    [
      deal(12, 'Harbor fleet analytics'),
      deal(14, 'Harbor route planning'),
      deal(15, 'Harbor support plan'),
      deal(16, 'Charter renewal'),
      deal(17, 'Sharp Harvest pilot'),
    ],
    12,
  ),
}

const NOTHING: SearchReply = { organizations: found([]), contacts: found([]), deals: found([]) }

const searchedFor = (path: string) => new URLSearchParams(path.split('?')[1]).get('q') ?? ''

/** Answers each search from `replies`, by what was searched for, and finds nothing otherwise. */
function serve(replies: Record<string, SearchReply> = { har: HAR }) {
  return mockFetch((_method, path) => ({ body: replies[searchedFor(path)] ?? NOTHING }))
}

/** Holds each search until the test answers it, with the function this gives back. */
function holdSearches() {
  const held: Record<string, (reply: { body: SearchReply }) => void> = {}
  mockFetch((_method, path) => new Promise((resolve) => (held[searchedFor(path)] = resolve)))
  return async (query: string, body: SearchReply) => {
    await waitFor(() => expect(held).toHaveProperty([query]))
    held[query]({ body })
    await answered(query)
  }
}

const box = () => screen.getByRole('combobox', { name: 'Search' })
const list = () => screen.queryByRole('listbox', { name: 'Search results' })
const options = () => screen.getAllByRole('option')
const highlighted = () => screen.getByRole('option', { selected: true })
const group = (name: string | RegExp) => screen.getByRole('group', { name })

// The search waits for typing to pause, so the tests stop the clock and move it on themselves.
// Testing Library waits on a timeout after each user-event call, and moves a stopped clock on
// only when it sees Jest's, so it gets Vitest's under that name.
let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const advanceTimersByTime = (ms: number) => vi.advanceTimersByTime(ms)
  vi.stubGlobal('jest', { advanceTimersByTime })
  user = userEvent.setup({ advanceTimers: advanceTimersByTime })
})
afterEach(() => {
  vi.useRealTimers()
})

let client: QueryClient

function renderBox(ui = <SearchBox />) {
  const rendered = renderWithApp(ui, { path: '*', route: '/deals' })
  client = rendered.client
  return rendered
}

/** Lets typing pause long enough for the search to be sent. */
async function pause() {
  await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS))
}

/** Waits for the search for `query`, or every search sent, to be answered, and the answer to show. */
async function answered(query?: string) {
  await waitFor(() => expect(client.isFetching(query === undefined ? {} : { queryKey: ['search', query] })).toBe(0))
  await act(() => vi.advanceTimersByTimeAsync(0))
}

/** Types into the search box, and pauses. */
async function type(text: string) {
  await user.type(box(), text)
  await pause()
}

/** Types into the search box, pauses, and waits for the answer. */
async function search(text: string) {
  await type(text)
  await answered()
}

/** The paths an icon draws, to compare with the sidebar's. */
function drawing(Icon: LucideIcon) {
  const { container, unmount } = render(<Icon />)
  const paths = container.querySelector('svg')!.innerHTML
  unmount()
  return paths
}

describe('SearchBox', () => {
  test('is labelled Search, with the placeholder and the "/" hint while it’s empty', async () => {
    serve()
    renderBox()
    expect(box()).toHaveAttribute('placeholder', 'Search organizations, contacts and deals')
    expect(box()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('/')).toBeInTheDocument()
    await user.type(box(), 'h')
    expect(screen.queryByText('/')).not.toBeInTheDocument()
  })

  test('results show from the first character, and only spaces shows no list', async () => {
    const calls = serve({ h: HAR })
    renderBox()
    await search('   ')
    expect(list()).not.toBeInTheDocument()
    expect(calls).toEqual([])

    await search('h')
    expect(list()).toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-expanded', 'true')
    expect(calls.map((c) => c.path)).toEqual(['/search?q=h'])
  })

  test('sends one search once typing pauses, without the spaces around it', async () => {
    const calls = serve()
    renderBox()
    await user.type(box(), ' ha')
    await act(() => vi.advanceTimersByTimeAsync(SETTLE_MS - 1))
    await user.type(box(), 'r ')
    expect(calls).toEqual([])
    await pause()
    expect(calls.map((c) => c.path)).toEqual(['/search?q=har'])
  })

  test('the groups come in order, empty ones left out, with how many there are when it’s more than 5', async () => {
    serve({ har: { ...HAR, contacts: found([]) } })
    renderBox()
    await search('har')
    expect(within(list()!).getAllByRole('group')).toEqual([group('Organizations'), group('Deals, 5 of 12')])
    expect(within(group('Deals, 5 of 12')).getAllByRole('option')).toHaveLength(5)
  })

  test('each result has its kind’s icon, its name with the matching part in semibold, and its second line', async () => {
    serve()
    renderBox()
    await search('har')

    const organization = within(group('Organizations')).getByRole('option')
    expect(organization).toHaveTextContent(/^Harbor LogisticsLogistics$/)
    expect(organization.querySelector('svg')!.innerHTML).toBe(drawing(Building2))
    expect(within(organization).getByText('Har')).toHaveClass('font-semibold')

    const [sharon, ari] = within(group('Contacts')).getAllByRole('option')
    expect(sharon).toHaveTextContent(/^Sharon HaleFinance Director, Harbor Logistics$/)
    expect(within(sharon).getByText('har')).toHaveClass('font-semibold')
    expect(sharon.querySelector('svg')!.innerHTML).toBe(drawing(Users))
    // A contact with no job title or organization has no second line.
    expect(ari).toHaveTextContent(/^Ari Harmon$/)

    const fleet = within(group(/^Deals/)).getAllByRole('option')[0]
    expect(fleet).toHaveTextContent(/^Harbor fleet analyticsHarbor Logistics, Proposal, \$48,000$/)
    expect(fleet.querySelector('svg')!.innerHTML).toBe(drawing(Briefcase))
  })

  test('the order is the server’s', async () => {
    serve()
    renderBox()
    await search('har')
    const names = [
      'Harbor Logistics',
      'Sharon Hale',
      'Ari Harmon',
      'Harbor fleet analytics',
      'Harbor route planning',
      'Harbor support plan',
      'Charter renewal',
      'Sharp Harvest pilot',
    ]
    expect(options().map((option) => option.textContent)).toEqual(
      names.map((name) => expect.stringMatching(`^${name}`)),
    )
  })

  test('no results says so, with no list of results', async () => {
    serve()
    renderBox()
    await search('acme ')
    expect(screen.getByText('No organizations, contacts or deals match "acme".')).toBeVisible()
    expect(list()).not.toBeInTheDocument()
    expect(box()).toHaveAttribute('aria-expanded', 'true')
    expect(box()).not.toHaveAttribute('aria-activedescendant')
  })

  test('the number of results is announced', async () => {
    serve()
    renderBox()
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/^$/)
    await search('har')
    expect(status).toHaveTextContent(/^8 results$/)
    await user.clear(box())
    await search('acme')
    expect(status).toHaveTextContent(/^No results$/)
    await user.tab()
    expect(status).toHaveTextContent(/^$/)
  })

  test('the first result is highlighted as the list opens, and Up and Down move across the groups', async () => {
    serve()
    renderBox()
    await search('har')
    expect(highlighted()).toHaveTextContent(/^Harbor Logistics/)
    await user.keyboard('{ArrowDown}')
    expect(highlighted()).toHaveTextContent(/^Sharon Hale/)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(highlighted()).toHaveTextContent(/^Harbor fleet analytics/)
    await user.keyboard('{ArrowUp}')
    expect(highlighted()).toHaveTextContent(/^Ari Harmon/)
    expect(box()).toHaveFocus()
  })

  test('the box tells screen readers which result is highlighted', async () => {
    serve({ har: HAR, harb: { ...HAR, contacts: found([]) } })
    renderBox()
    // The box points at the highlighted result, and so does anything else that points at one.
    const pointsAtHighlighted = () => {
      expect(box()).toHaveAttribute('aria-activedescendant', highlighted().id)
      for (const element of document.querySelectorAll('[aria-activedescendant]')) {
        expect(element).toHaveAttribute('aria-activedescendant', highlighted().id)
      }
    }
    await search('har')
    pointsAtHighlighted()
    await user.keyboard('{ArrowDown}')
    pointsAtHighlighted()

    // New results start again from the first, which the box follows.
    await search('b')
    expect(highlighted()).toHaveTextContent(/^Harbor Logistics/)
    pointsAtHighlighted()
  })

  test('Enter opens the highlighted result’s page, clears the box and closes the list', async () => {
    serve()
    const { router } = renderBox()
    await search('har')
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')
    expect(router.state.location.pathname).toBe('/deals/12')
    expect(box()).toHaveValue('')
    expect(list()).not.toBeInTheDocument()
    expect(box()).toHaveFocus()
  })

  test('clicking a result opens its page', async () => {
    serve()
    const { router } = renderBox()
    await search('har')
    await user.click(screen.getByRole('option', { name: /^Sharon Hale/ }))
    expect(router.state.location.pathname).toBe('/contacts/4')
    expect(box()).toHaveValue('')
    expect(list()).not.toBeInTheDocument()
  })

  test('Escape closes the list and clears the box, and a second Escape leaves focus in it', async () => {
    serve()
    renderBox()
    await search('har')
    await user.keyboard('{Escape}')
    expect(box()).toHaveValue('')
    expect(list()).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(box()).toHaveFocus()
  })

  test('Home and End move the caret, rather than the highlight', async () => {
    serve()
    renderBox()
    await search('har')
    await user.keyboard('{ArrowDown}{Home}')
    expect(highlighted()).toHaveTextContent(/^Sharon Hale/)
    expect(box()).toHaveProperty('selectionStart', 0)
    await user.keyboard('{End}')
    expect(highlighted()).toHaveTextContent(/^Sharon Hale/)
    expect(box()).toHaveProperty('selectionStart', 3)
  })

  test('Tab and a click away close the list, keeping the text, and coming back opens it with the first highlighted', async () => {
    serve()
    renderBox(
      <>
        <SearchBox />
        <button type="button">Add deal</button>
      </>,
    )
    await search('har')
    await user.keyboard('{ArrowDown}')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Add deal' })).toHaveFocus()
    expect(list()).not.toBeInTheDocument()
    expect(box()).toHaveValue('har')
    expect(box()).toHaveAttribute('aria-expanded', 'false')

    await user.click(box())
    expect(list()).toBeInTheDocument()
    expect(highlighted()).toHaveTextContent(/^Harbor Logistics/)

    await user.click(document.body)
    expect(list()).not.toBeInTheDocument()
    expect(box()).toHaveValue('har')
  })

  test('the last results stay while the next ones load, and a late reply to an older search doesn’t replace them', async () => {
    const answer = holdSearches()
    renderBox()
    await type('har')
    await answer('har', HAR)
    expect(options()).toHaveLength(8)

    await type('b')
    expect(options()).toHaveLength(8)
    await answer('harb', { ...HAR, contacts: found([]), deals: found([]) })
    expect(options()).toHaveLength(1)

    // The search before the last answers last.
    await user.clear(box())
    await type('co')
    await type('b')
    await answer('cob', NOTHING)
    await answer('co', HAR)
    expect(screen.getByText('No organizations, contacts or deals match "cob".')).toBeInTheDocument()
  })

  test('after the box is emptied, the next search doesn’t show the one before it while it loads', async () => {
    const answer = holdSearches()
    renderBox()
    await type('har')
    await answer('har', HAR)
    await user.clear(box())
    await type('z')
    expect(list()).not.toBeInTheDocument()
    expect(screen.queryByText(/No organizations/)).not.toBeInTheDocument()
  })
})

describe('"/"', () => {
  function renderWithFields() {
    serve()
    renderBox(
      <>
        <SearchBox />
        <button type="button">Add deal</button>
        <label>
          Search deals <input type="search" />
        </label>
        <label>
          Notes <textarea />
        </label>
      </>,
    )
  }

  test('puts focus in the search box from anywhere, without typing itself', async () => {
    renderWithFields()
    await user.keyboard('/')
    expect(box()).toHaveFocus()
    expect(box()).toHaveValue('')

    await user.click(screen.getByRole('button', { name: 'Add deal' }))
    await user.keyboard('/')
    expect(box()).toHaveFocus()
  })

  test('types itself in a field instead', async () => {
    renderWithFields()
    await user.click(screen.getByRole('searchbox', { name: 'Search deals' }))
    await user.keyboard('/')
    expect(screen.getByRole('searchbox', { name: 'Search deals' })).toHaveValue('/')
    await user.click(screen.getByRole('textbox', { name: 'Notes' }))
    await user.keyboard('/')
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('/')
    expect(box()).not.toHaveFocus()
  })

  test('with Command or Control held, it’s left to the browser', async () => {
    renderWithFields()
    await user.keyboard('{Meta>}/{/Meta}{Control>}/{/Control}')
    expect(box()).not.toHaveFocus()
  })
})
