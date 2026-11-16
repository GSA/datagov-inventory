interface ValidationSummaryProps {
  catalogSummary: {
    valid: boolean
    totalErrors: number
    errorSummary: Record<string, number>
    timestamp: number
    schemaVersion: string
  } | null
  onViewErrors?: (objectType: string) => void
}

export function ValidationSummary({ catalogSummary, onViewErrors }: ValidationSummaryProps) {
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

              return (
                <li key={type} className="validation-summary__item">
                  <span className="validation-summary__count" aria-label={`${count} errors in ${type} objects`}>
                    {count} {type} {count === 1 ? 'error' : 'errors'}
                  </span>
                  {onViewErrors && (
                    <button type="button" onClick={() => onViewErrors(type)} className="validation-summary__view-btn">
                      View {type} errors
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
