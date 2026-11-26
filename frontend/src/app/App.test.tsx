import { QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from 'radix-ui'
import { RouterProvider } from 'react-router'
import { describe, expect, test } from 'vitest'
import { createQueryClient } from '../lib/api'
import { STAGES, mockFetch } from '../test-utils'
import { router } from './App'

/** The app as main.tsx starts it, at `path`. Lists come back empty, and records as missing. */
async function openApp(path: string) {
  const lists = ['/organizations', '/contacts', '/deals']
  const calls = mockFetch((_method, url) => {
    if (url === '/stages') return { body: STAGES }
    if (lists.includes(url)) return { body: [] }
    return { status: 404, body: { detail: 'Not found' } }
  })
  await act(() => router.navigate(path))
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Tooltip.Provider>
        <RouterProvider router={router} />
      </Tooltip.Provider>
    </QueryClientProvider>,
  )
  return calls
}

const mainHeading = () => within(screen.getByRole('main')).findByRole('heading', { level: 1 })

describe('the app’s addresses', () => {
  test.each([
    ['/', 'Dashboard'],
    ['/organizations', 'Organizations'],
    ['/contacts', 'Contacts'],
    ['/deals', 'Deals'],
    ['/pipeline', 'Pipeline'],
  ])('%s shows the %s page inside the sidebar’s shell', async (path, title) => {
    await openApp(path)
    expect(await mainHeading()).toHaveTextContent(title)
    const current = within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('link', { current: 'page' })
    expect(current).toHaveTextContent(new RegExp(`^${title}`))
  })

  test.each([
    ['/organizations/1', 'organization'],
    ['/contacts/2', 'contact'],
    ['/deals/3', 'deal'],
  ])('%s asks for that %s', async (path, kind) => {
    const calls = await openApp(path)
    expect(await mainHeading()).toHaveTextContent(`This ${kind} no longer exists`)
    expect(calls).toContainEqual({ method: 'GET', path, body: undefined })
  })

  test('an unknown address says the page isn’t found, with a link to the dashboard', async () => {
    await openApp('/reports/2026')
    expect(await mainHeading()).toHaveTextContent('Page not found')
    expect(document.title).toBe('Page not found - Accountable')
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Go to the dashboard' }))
    expect(await mainHeading()).toHaveTextContent('Dashboard')
    expect(router.state.location.pathname).toBe('/')
  })
})
