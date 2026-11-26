import { render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { tableRows } from '../test-utils'
import { ChartTable } from './ChartTable'

const texts = (elements: HTMLElement[]) => elements.map((element) => element.textContent)

describe('ChartTable', () => {
  test('gives a chart’s figures as a table named by its caption, with a heading on each row', () => {
    render(
      <ChartTable
        caption="Open pipeline by stage"
        headers={['Stage', 'Value', 'Expected revenue']}
        rows={[
          ['New', '$131,000', '$13,100'],
          ['Qualified', '$169,000', '$42,250'],
        ]}
      />,
    )
    expect(tableRows('Open pipeline by stage')).toEqual([
      ['Stage', 'Value', 'Expected revenue'],
      ['New', '$131,000', '$13,100'],
      ['Qualified', '$169,000', '$42,250'],
    ])
    const table = within(screen.getByRole('table', { name: 'Open pipeline by stage' }))
    expect(texts(table.getAllByRole('columnheader'))).toEqual(['Stage', 'Value', 'Expected revenue'])
    expect(texts(table.getAllByRole('rowheader'))).toEqual(['New', 'Qualified'])
    expect(texts(table.getAllByRole('cell'))).toEqual(['$131,000', '$13,100', '$169,000', '$42,250'])
  })
})
