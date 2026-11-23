import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ValidationSummary } from './ValidationSummary'

const summary = { totalErrors: 3, errorSummary: { Dataset: 2, Distribution: 1, Agent: 0 } }
const objectResults = [
  { objectId: 'a', label: 'Air quality', objectType: 'Dataset', valid: false, errors: [{ field: 'Issued', message: 'x' }, { field: 'Title', message: 'y' }] },
  { objectId: 'b', label: 'CSV file', objectType: 'Distribution', valid: false, errors: [{ field: 'Format', message: 'z' }] },
]

describe('ValidationSummary', () => {
  it('lists what to fix by class, with a link to each object, and the advisory note', async () => {
    const onNavigateToObject = vi.fn()
    render(
      <ValidationSummary id="results" catalogSummary={summary} stale={false} objectResults={objectResults} onNavigateToObject={onNavigateToObject} />,
    )
    const region = screen.getByRole('region', { name: 'Fix these 3 errors' })
    expect(region).toHaveAttribute('id', 'results')
    expect(region).toHaveTextContent('2 Dataset errors')
    expect(region).toHaveTextContent('1 Distribution error')
    expect(region).not.toHaveTextContent('Agent')
    expect(region).not.toHaveTextContent('changed since')
    expect(screen.getByRole('note')).toHaveTextContent('not the official Data.gov validator')

    await userEvent.click(screen.getByRole('button', { name: 'CSV file (1 error)' }))
    expect(onNavigateToObject).toHaveBeenCalledWith('b')
  })

  it('says when the catalog has changed since the check', () => {
    render(<ValidationSummary id="results" catalogSummary={{ totalErrors: 1, errorSummary: { Dataset: 1 } }} stale />)
    expect(screen.getByRole('region', { name: 'Fix this error' })).toHaveTextContent(
      'The catalog has changed since this check.',
    )
  })
})
