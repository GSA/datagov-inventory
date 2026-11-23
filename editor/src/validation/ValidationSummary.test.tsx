import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ValidationSummary } from './ValidationSummary'

const timestamp = 1
const summary = { totalErrors: 3, errorSummary: { Dataset: 2, Distribution: 1, Agent: 0 }, timestamp }
const objectResults = [
  { objectId: 'a', label: 'Air quality', objectType: 'Dataset', errors: 2 },
  { objectId: 'b', label: 'CSV file', objectType: 'Distribution', errors: 1 },
]
/** The heading a sighted user sees: the hidden one of the two stacked headings only holds the space. */
const shownHeading = () => document.querySelector('h2 > :not(.stacked-labels__off)')

describe('ValidationSummary', () => {
  it('lists what to fix by class, with a link to each object, and the advisory note', async () => {
    const onNavigateToObject = vi.fn()
    render(
      <ValidationSummary id="results" catalogSummary={summary} stale={false} objectResults={objectResults} onNavigateToObject={onNavigateToObject} />,
    )
    expect(shownHeading()).toHaveTextContent('Fix these 3 errors in the catalog')
    const region = document.getElementById('results')!
    expect(region).toHaveTextContent('2 Dataset errors')
    expect(region).toHaveTextContent('1 Distribution error')
    expect(region).not.toHaveTextContent('Agent')
    expect(screen.getByRole('note')).toHaveTextContent('not the official Data.gov validator')

    await userEvent.click(screen.getByRole('button', { name: 'CSV file (1 error)' }))
    expect(onNavigateToObject).toHaveBeenCalledWith('b')
  })

  it('folds a class with more than 10 objects', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ objectId: `d${i}`, label: `Dataset ${i}`, objectType: 'Dataset', errors: 1 }))
    render(
      <ValidationSummary
        id="results"
        catalogSummary={{ totalErrors: 12, errorSummary: { Dataset: 11, Distribution: 1 }, timestamp }}
        stale={false}
        objectResults={[...many, objectResults[1]]}
        onNavigateToObject={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: '11 Dataset errors' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: '1 Distribution error' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('says when the catalog has changed since the check', () => {
    render(
      <ValidationSummary
        id="results"
        catalogSummary={{ totalErrors: 1, errorSummary: { Dataset: 1 }, timestamp }}
        stale
        objectResults={[objectResults[0]]}
        onNavigateToObject={() => {}}
      />,
    )
    expect(shownHeading()).toHaveTextContent('The catalog has changed since this check')
  })
})
