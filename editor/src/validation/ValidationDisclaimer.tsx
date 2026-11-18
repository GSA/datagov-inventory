/** The advisory note under an object's errors, worded and styled as in the catalog summary. */
export function ValidationDisclaimer() {
  return (
    <p className="usa-hint margin-top-1" role="note">
      Advisory check against the DCAT-US 3.0 schema, run in this browser. This is not the official Data.gov validator.
    </p>
  )
}
