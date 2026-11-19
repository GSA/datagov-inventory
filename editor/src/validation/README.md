# Validation Module

Browser-based DCAT-US 3.0 schema validation for the Inventory Editor.

## Features

- **Client-side validation** using a precompiled Ajv JSON Schema 2020-12 validator
- **Web Worker execution** for non-blocking validation of large catalogs
- **Real-time error display** with humanized field names
- **Stale validation tracking** - marks results as stale when objects are edited
- **Advisory disclaimer** - clear messaging that this is not the official Data.gov validator
- **Accessibility** - screen reader support, keyboard navigation, color-independent indicators

## Usage

### Validate a Single Object

```tsx
import { useValidation } from './validation'

function MyComponent({ objectId }) {
  const { validateObject, getObjectState, getObjectErrors } = useValidation()
  
  const handleValidate = async () => {
    await validateObject(objectId)
  }
  
  const state = getObjectState(objectId)
  const errors = getObjectErrors(objectId)
  
  return (
    <div>
      <button onClick={handleValidate}>Validate</button>
      <ValidationStatusBadge state={state} errorCount={errors.length} />
      {errors.map(error => (
        <div key={error.field}>{error.field}: {error.message}</div>
      ))}
    </div>
  )
}
```

### Validate Entire Catalog

```tsx
const { validateCatalog, catalogSummary } = useValidation()

const handleValidateCatalog = async () => {
  const { totalErrors } = await validateCatalog()
}
```

## Components

- `ValidationStatusBadge` - Shows validation state (idle/validating/valid/invalid/stale)
- `ValidationSummary` - Displays error summary grouped by class

## Architecture

```
validation/
├── types.ts              # TypeScript type definitions
├── validator.ts          # Validates the assembled catalog and assigns errors to objects
├── messages.ts           # Error message humanization
├── worker.ts             # Web Worker for off-thread validation
├── useValidationWorker.ts # React hook for worker communication
├── ValidationContext.tsx  # React Context for validation state
├── useValidation.ts      # Main validation hook
├── ValidationStatusBadge.tsx
├── ValidationSummary.tsx
└── validation.css        # Component styles
```

## Precompiled Validator

Ajv compiles schemas with `new Function`, which the CSP (`script-src 'self'`) blocks, so the
browser uses `src/generated/validateDocument.js`, generated from `createAjv` in
`src/schema/validator.ts`. Regenerate it after changing the schema, its formats or Ajv options:

```sh
npm run generate:validator
```

CI fails (`generate:validator:check`) when it is stale, and a unit test checks it agrees with the
runtime validator on every fixture.

Validation runs on the catalog as it would export (`assemble`). Each error goes to the deepest
object holding its path in the current link graph, with `instancePath` relative to that object.

## Advisory Nature

This validation is **advisory only** and runs against a copied DCAT-US 3.0 schema. It is not the official Data.gov validator. The disclaimer is shown on all validation results to prevent confusion.

## Security

- Error messages are plain text, rendered through React, which escapes them
- No `eval`: the validator is generated ahead of time, so the CSP needs no `'unsafe-eval'`
- Validation runs client-side - no data is sent to external servers
- The schema is bundled; nothing is fetched

## Performance

- Validation runs in a Web Worker to avoid blocking the main thread
- Progress reporting for large catalogs (100+ objects)
- Efficient state management using React Context
