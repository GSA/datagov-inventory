/**
 * The advisory note under an object's errors, worded and styled as in the catalog summary. `className`: its styles
 * where the hint's grey would be too faint, as inside an error alert.
 */
export function ValidationDisclaimer({ className = 'usa-hint margin-top-1' }: { className?: string }) {
  return (
    <p className={className} role="note">
      Advisory check against the DCAT-US 3.0 schema, run in this browser. This is not the official Data.gov validator.
    </p>
  )
}
