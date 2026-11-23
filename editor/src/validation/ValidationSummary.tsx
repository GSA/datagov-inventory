import { Alert, AlertHeading } from '@trussworks/react-uswds'
import { classLabel } from '../labels'
import { count } from '../tree'
import { ValidationDisclaimer } from './ValidationDisclaimer'

interface ValidationSummaryProps {
  /** The element's id, for the button that hides and shows it. */
  id: string
  catalogSummary: {
    totalErrors: number
    errorSummary: Record<string, number>
  }
  /** The catalog has changed since this check, so its counts may be out of date. */
  stale: boolean
  objectResults?: Array<{
    objectId: string
    /** The object's title or name, shown before its id so the list says which object it is. */
    label?: string
    objectType: string
    valid: boolean
    errors: Array<{ field: string; message: string }>
  }>
  onNavigateToObject?: (objectId: string) => void
}

/**
 * A catalog check's errors: what to fix, by class, with a link to each object. Shown only when there are errors; the
 * status line beside "Validate catalog" says when the check ran. Worded like the object form's error alert.
 */
export function ValidationSummary({ id, catalogSummary, stale, objectResults, onNavigateToObject }: ValidationSummaryProps) {
  const { totalErrors, errorSummary } = catalogSummary

  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="margin-top-2">
      <Alert type="error" className="margin-top-0">
        <AlertHeading level="h2" id={`${id}-heading`} className="font-sans-md">
          {totalErrors === 1 ? 'Fix this error' : `Fix these ${count(totalErrors)} errors`}
        </AlertHeading>
        {stale && <p className="text-bold margin-y-1">The catalog has changed since this check.</p>}
        <ul className="usa-list usa-list--unstyled">
          {Object.entries(errorSummary).map(([type, errors]) => {
            if (errors === 0) return null
            const objectsWithErrors = objectResults?.filter((r) => r.objectType === type && !r.valid)

            return (
              <li key={type} className="margin-top-1">
                <span className="text-bold">
                  {count(errors)} {classLabel(type)} {errors === 1 ? 'error' : 'errors'}
                </span>
                {objectsWithErrors && objectsWithErrors.length > 0 && onNavigateToObject && (
                  <ul className="usa-list usa-list--unstyled">
                    {objectsWithErrors.map((obj) => (
                      <li key={obj.objectId}>
                        <button
                          type="button"
                          onClick={() => onNavigateToObject(obj.objectId)}
                          className="usa-button usa-button--unstyled text-left"
                        >
                          {obj.label && <bdi>{obj.label}</bdi>} ({obj.errors.length}{' '}
                          {obj.errors.length === 1 ? 'error' : 'errors'})
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
        {/* In the alert's own ink, not the hint's grey, which is too faint on its background. */}
        <ValidationDisclaimer className="font-sans-2xs margin-top-1 margin-bottom-0" />
      </Alert>
    </section>
  )
}
