import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip } from 'radix-ui'
import type { FormEvent } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { Button, IconButton } from './Button'

describe('Button', () => {
  test('doesn’t submit the form it sits in, unless it’s the submit button', async () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
    const onClick = vi.fn()
    render(
      <form onSubmit={onSubmit}>
        <Button onClick={onClick}>Cancel</Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </form>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClick).toHaveBeenCalledOnce()
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })
})

describe('IconButton', () => {
  function renderIconButtons() {
    const onClick = vi.fn()
    render(
      <Tooltip.Provider>
        <IconButton label="Edit Harbor Logistics" tooltip="Edit" onClick={onClick}>
          <svg aria-hidden />
        </IconButton>
        <IconButton label="Actions for this call">
          <svg aria-hidden />
        </IconButton>
      </Tooltip.Provider>,
    )
    return { onClick }
  }

  test('is named for screen readers by its label, and works like a button', async () => {
    const { onClick } = renderIconButtons()
    await userEvent.click(screen.getByRole('button', { name: 'Edit Harbor Logistics' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  test('shows its tooltip when it has focus, or its label if it has no tooltip', async () => {
    renderIconButtons()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Edit Harbor Logistics' })).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Edit')
    await userEvent.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Actions for this call')
  })
})
