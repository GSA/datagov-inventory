interface ValidationSummaryProps {
  catalogSummary: {
    valid: boolean
    totalErrors: number
    errorSummary: Record<string, number>
    timestamp: number
    schemaVersion: string
  } | null
  objectResults?: Array<{
    objectId: string
    objectType: string
    valid: boolean
    errors: Array<{ field: string; message: string }>
  }>
  onNavigateToObject?: (objectId: string) => void
}

export function ValidationSummary({ catalogSummary, objectResults, onNavigateToObject }: ValidationSummaryProps) {
  if (!catalogSummary) {
    return (
      <div className="validation-summary validation-summary--empty" role="region" aria-label="Validation results">
        <p>No validation results yet. Click &ldquo;Validate&rdquo; to check the catalog.</p>
      </div>
    )
  }

  const { valid, totalErrors, errorSummary, schemaVersion } = catalogSummary

  return (
    <div className="validation-summary" role="region" aria-label="Validation results">
      <div className="validation-summary__header">
        <h2>Validation Results</h2>
        <p className="validation-summary__disclaimer" role="note">
          Advisory check against DCAT-US schema version {schemaVersion}. This is not the official Data.gov validator.
        </p>
      </div>

      {valid ? (
        <div className="validation-summary__success" role="status" aria-live="polite">
          <span className="validation-summary__icon" aria-hidden="true">
            ✓
          </span>
          <p>No errors found in the catalog.</p>
        </div>
      ) : (
        <div className="validation-summary__errors" role="status" aria-live="polite">
          <p className="validation-summary__total">
            <strong>{totalErrors}</strong> {totalErrors === 1 ? 'error' : 'errors'} found
          </p>

          <ul className="validation-summary__list">
            {Object.entries(errorSummary).map(([type, count]) => {
              if (count === 0) return null

              const objectsWithErrors = objectResults?.filter(
                (r) => r.objectType === type && !r.valid
              )

              return (
                <li key={type} className="validation-summary__item">
                  <div>
                    <span className="validation-summary__count" aria-label={`${count} errors in ${type} objects`}>
                      {count} {type} {count === 1 ? 'error' : 'errors'}
                    </span>
                    {objectsWithErrors && objectsWithErrors.length > 0 && onNavigateToObject && (
                      <ul className="validation-summary__objects margin-top-1">
                        {objectsWithErrors.map((obj) => (
                          <li key={obj.objectId}>
                            <button
                              type="button"
                              onClick={() => onNavigateToObject(obj.objectId)}
                              className="validation-summary__object-link"
                            >
                              {obj.objectId} ({obj.errors.length} {obj.errors.length === 1 ? 'error' : 'errors'})
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
