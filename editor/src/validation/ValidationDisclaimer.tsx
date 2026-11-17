export function ValidationDisclaimer() {
  return (
    <div className="usa-alert usa-alert--info usa-alert--slim margin-top-2" role="note">
      <div className="usa-alert__body">
        <p className="usa-alert__text">
          <strong>Advisory check:</strong> This validation runs in your browser against a copied DCAT-US 3.0 schema. It
          is not the official Data.gov validator. Use it to catch issues during editing, but final validation should be
          performed by the official validator.
        </p>
      </div>
    </div>
  )
}
