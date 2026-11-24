import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CatalogCheckStatus } from './CatalogCheckStatus'

const timestamp = new Date(2026, 10, 23, 15, 5).getTime()
const time = new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const props = { timestamp, resultsShown: true, resultsId: 'results', onToggleResults: () => {} }

/** The text a sighted user sees: the hidden one of the two stacked texts only holds the space. */
const shown = (container: HTMLElement) => container.querySelector('.stacked-labels > :not(.stacked-labels__off)')!

describe('CatalogCheckStatus', () => {
  it('says no errors were found in an advisory check, and when, with no button', () => {
    const { container } = render(<CatalogCheckStatus {...props} totalErrors={0} stale={false} />)
    expect(shown(container)).toHaveTextContent(`✓ No errors found · advisory check at ${time}`)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('says the catalog has changed since the check, without the check mark, in the same space', () => {
    const { container } = render(<CatalogCheckStatus {...props} totalErrors={0} stale />)
    expect(shown(container)).toHaveTextContent(`Changed since last check (${time})`)
    expect(shown(container)).not.toHaveTextContent('✓')
    // The result's text stays, hidden, so the line keeps its size.
    expect(container.querySelector('.stacked-labels__off')).toHaveTextContent('No errors found')
  })

  it('counts the errors and hides or shows their list', async () => {
    const onToggleResults = vi.fn()
    const { container, rerender } = render(
      <CatalogCheckStatus {...props} totalErrors={1_234} stale={false} onToggleResults={onToggleResults} />,
    )
    expect(shown(container)).toHaveTextContent(`✕ 1,234 errors found · advisory check at ${time}`)
    // Its name, without the stylesheet that hides the other label here, is checked in the browser (e2e).
    const toggle = screen.getByRole('button', { expanded: true })
    expect(shown(toggle)).toHaveTextContent('Hide results')
    expect(toggle).toHaveAttribute('aria-controls', 'results')
    await userEvent.click(toggle)
    expect(onToggleResults).toHaveBeenCalledOnce()

    // Out of date, it still says there were errors, with the list hidden too.
    rerender(<CatalogCheckStatus {...props} totalErrors={1} stale resultsShown={false} />)
    expect(shown(container)).toHaveTextContent(`Changed since last check (${time}, 1 error)`)
    const collapsed = screen.getByRole('button', { expanded: false })
    expect(shown(collapsed)).toHaveTextContent('Show results')
    expect(collapsed).not.toHaveAttribute('aria-controls')
  })
})
