import { Accordion, Alert, AlertHeading } from '@trussworks/react-uswds'
import { classLabel } from '../labels'
import { count } from '../tree'
import { ValidationDisclaimer } from './ValidationDisclaimer'

/** Longer lists of objects start folded. */
const FOLD_OVER = 10

interface ValidationSummaryProps {
  /** The element's id, for the button that hides and shows it. */
  id: string
  catalogSummary: {
    totalErrors: number
    errorSummary: Record<string, number>
    timestamp: number
  }
  /** The catalog has changed since this check, so its counts may be out of date. */
  stale: boolean
  /** The objects with errors, each with its title or name and its number of errors. */
  objectResults: Array<{ objectId: string; label: string; objectType: string; errors: number }>
  onNavigateToObject: (objectId: string) => void
}

/**
 * A catalog check's errors: what to fix, by class, with a link to each object. Shown only when there are errors; the
 * status line beside "Validate catalog" says when the check ran. Worded like the object form's error alert.
 */
export function ValidationSummary({ id, catalogSummary, stale, objectResults, onNavigateToObject }: ValidationSummaryProps) {
  const { totalErrors, errorSummary, timestamp } = catalogSummary
  const classes = Object.entries(errorSummary).filter(([, errors]) => errors > 0)

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="margin-top-2">
      <Alert type="error" className="margin-top-0">
        {/* Both headings hold the space, so the list doesn't move when the catalog changes. */}
        <AlertHeading level="h2" id={`${id}-heading`} className="font-sans-md stacked-labels">
          <span className={stale ? 'stacked-labels__off' : undefined}>
            {totalErrors === 1 ? 'Fix this error in the catalog' : `Fix these ${count(totalErrors)} errors in the catalog`}
          </span>
          <span className={stale ? undefined : 'stacked-labels__off'}>The catalog has changed since this check</span>
        </AlertHeading>
        {/* In the alert's own ink, not the hint's grey, which is too faint on its background. */}
        <ValidationDisclaimer className="font-sans-2xs margin-top-1 margin-bottom-0" />
      </Alert>
      {/* Under the alert, not in it, where USWDS's alert body would make it wider than a phone. Keyed by the check, so a
          new check starts with its own folds. */}
      <Accordion
        key={timestamp}
        bordered
        multiselectable
        className="margin-top-1"
        items={classes.map(([type, errors]) => {
          const objects = objectResults.filter((r) => r.objectType === type)
          return {
            id: `${id}-${type}`,
            headingLevel: 'h3',
            expanded: objects.length <= FOLD_OVER,
            title: `${count(errors)} ${classLabel(type)} ${errors === 1 ? 'error' : 'errors'}`,
            content: (
              <ul className="usa-list usa-list--unstyled">
                {objects.map((obj) => (
                  <li key={obj.objectId}>
                    <button
                      type="button"
                      onClick={() => onNavigateToObject(obj.objectId)}
                      className="usa-button usa-button--unstyled text-left"
                    >
                      <bdi>{obj.label}</bdi> ({count(obj.errors)} {obj.errors === 1 ? 'error' : 'errors'})
                    </button>
                  </li>
                ))}
              </ul>
            ),
          }
        })}
      />
    </section>
  )
}
