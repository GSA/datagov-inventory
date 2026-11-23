import { Button } from '@trussworks/react-uswds'
import { count } from '../tree'

interface CatalogCheckStatusProps {
  totalErrors: number
  /** When the check ran, in ms since the epoch. */
  timestamp: number
  /** The catalog has changed since the check. */
  stale: boolean
  /** With errors: whether their list is shown, and the id of that list. */
  resultsShown: boolean
  resultsId: string
  onToggleResults: () => void
}

/**
 * The last catalog check, in one line beside "Validate catalog": its result and time, or that the catalog has changed
 * since. Not a live region: the check's end is announced once elsewhere, and a change after it is not announced.
 */
export function CatalogCheckStatus({
  totalErrors,
  timestamp,
  stale,
  resultsShown,
  resultsId,
  onToggleResults,
}: CatalogCheckStatusProps) {
  const time = new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <div className="catalog-check display-flex flex-wrap flex-align-center">
      {/* Both texts hold the space, so the line keeps its size when the catalog changes. */}
      <span className="stacked-labels">
        <span className={stale ? 'stacked-labels__off' : undefined}>
          {totalErrors === 0 ? (
            <>
              <span className="text-success-dark text-bold" aria-hidden="true">
                ✓
              </span>{' '}
              No errors found · advisory check at {time}
            </>
          ) : (
            <>
              <span className="text-error-dark text-bold" aria-hidden="true">
                ✕
              </span>{' '}
              {count(totalErrors)} {totalErrors === 1 ? 'error' : 'errors'} found · checked at {time}
            </>
          )}
        </span>
        <span className={stale ? undefined : 'stacked-labels__off'}>Changed since last check at {time}</span>
      </span>
      {totalErrors > 0 && (
        <Button
          type="button"
          unstyled
          className="catalog-check__toggle"
          aria-expanded={resultsShown}
          aria-controls={resultsShown ? resultsId : undefined}
          onClick={onToggleResults}
        >
          <span className="stacked-labels">
            <span className={resultsShown ? undefined : 'stacked-labels__off'}>Hide results</span>
            <span className={resultsShown ? 'stacked-labels__off' : undefined}>Show results</span>
          </span>
        </Button>
      )}
    </div>
  )
}
