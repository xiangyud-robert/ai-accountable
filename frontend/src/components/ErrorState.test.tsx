import { screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { NotFound, UNREACHABLE_MESSAGE, Unreachable } from '../lib/api'
import { renderWithApp } from '../test-utils'
import { ErrorState } from './ErrorState'

describe('ErrorState', () => {
  test('a record page that can’t reach the server has the message as its main heading', () => {
    renderWithApp(<ErrorState error={new Unreachable(UNREACHABLE_MESSAGE)} kind="deal" listPath="/deals" listName="deals" />)
    expect(screen.getByRole('heading', { level: 1, name: UNREACHABLE_MESSAGE })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(UNREACHABLE_MESSAGE)
  })

  test('on a list page, which has its own heading, the message is a paragraph', () => {
    renderWithApp(<ErrorState error={new Unreachable(UNREACHABLE_MESSAGE)} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(UNREACHABLE_MESSAGE)
  })

  test('a record that no longer exists says so, with a link back to its list', () => {
    renderWithApp(<ErrorState error={new NotFound('Not found')} kind="deal" listPath="/deals" listName="deals" />)
    expect(screen.getByRole('heading', { level: 1, name: 'This deal no longer exists' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to deals' })).toHaveAttribute('href', '/deals')
  })
})
