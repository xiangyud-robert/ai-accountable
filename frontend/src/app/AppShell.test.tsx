import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import { mockFetch, renderWithApp } from '../test-utils'
import { AppShell } from './AppShell'

const SECTIONS = ['Dashboard', 'Organizations', 'Contacts', 'Deals', 'Pipeline']

const sections = () => within(screen.getByRole('navigation', { name: 'Sections' }))
const section = (name: string) => sections().getByRole('link', { name: new RegExp(`^${name}`) })

/** The shell at `route`, with lists of these lengths already loaded. */
function renderShell(route = '/', path = route, counts = { organizations: 3, contacts: 12, deals: 7 }) {
  const list = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }))
  return renderWithApp(<AppShell />, {
    path,
    route,
    data: [
      [['organizations'], list(counts.organizations)],
      [['contacts'], list(counts.contacts)],
      [['deals'], list(counts.deals)],
    ],
  })
}

describe('AppShell', () => {
  test('a skip link comes first, and goes to the main area', () => {
    renderShell()
    const skip = screen.getAllByRole('link')[0]
    expect(skip).toHaveTextContent('Skip to content')
    expect(skip).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
  })

  test('the sidebar has the wordmark, its tagline and the five sections', () => {
    renderShell()
    expect(screen.getByRole('complementary')).toHaveTextContent(/^AccountableEvery deal, accounted for/)
    const links = sections().getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/organizations',
      '/contacts',
      '/deals',
      '/pipeline',
    ])
    // Each name, without the count some of them end with.
    expect(links.map((link) => link.textContent?.replace(/\d+$/, ''))).toEqual(SECTIONS)
  })

  test('the sidebar has the Dark mode switch, after the five sections', () => {
    renderShell()
    const darkMode = within(screen.getByRole('complementary')).getByRole('switch', { name: 'Dark mode' })
    expect(section('Pipeline').compareDocumentPosition(darkMode) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('Organizations, Contacts and Deals show how many records they have', () => {
    renderShell('/', '/', { organizations: 3, contacts: 12, deals: 0 })
    expect(section('Dashboard')).toHaveTextContent(/^Dashboard$/)
    expect(section('Organizations')).toHaveTextContent(/^Organizations3$/)
    expect(section('Contacts')).toHaveTextContent(/^Contacts12$/)
    expect(section('Deals')).toHaveTextContent(/^Deals0$/)
    expect(section('Pipeline')).toHaveTextContent(/^Pipeline$/)
  })

  test('the counts load from the server, and show once they have', async () => {
    const replies: Record<string, unknown[]> = { '/organizations': [{}, {}], '/contacts': [{}], '/deals': [{}, {}, {}] }
    const calls = mockFetch((_method, path) => ({ body: replies[path] }))
    renderWithApp(<AppShell />)
    expect(section('Organizations')).toHaveTextContent(/^Organizations$/)
    await waitFor(() => expect(section('Deals')).toHaveTextContent(/^Deals3$/))
    expect(section('Organizations')).toHaveTextContent(/^Organizations2$/)
    expect(section('Contacts')).toHaveTextContent(/^Contacts1$/)
    expect(calls.map((c) => c.path).sort()).toEqual(['/contacts', '/deals', '/organizations'])
  })

  test('marks the current section, including on a record’s own page', () => {
    renderShell('/contacts/4', '/contacts/:id')
    expect(section('Contacts')).toHaveAttribute('aria-current', 'page')
    for (const name of ['Dashboard', 'Organizations', 'Deals', 'Pipeline']) {
      expect(section(name)).not.toHaveAttribute('aria-current')
    }
  })

  test('the dashboard is only current on its own address', () => {
    renderShell('/')
    expect(section('Dashboard')).toHaveAttribute('aria-current', 'page')
    expect(sections().getAllByRole('link', { current: 'page' })).toHaveLength(1)
  })

  test('choosing a section goes there', async () => {
    const { router } = renderShell('/')
    await userEvent.click(section('Pipeline'))
    expect(router.state.location.pathname).toBe('/pipeline')
  })
})
