# Validation Module

Browser-based DCAT-US 3.0 schema validation for the Inventory Editor.

## Features

- **Client-side validation** using Ajv JSON Schema 2020-12
- **Web Worker execution** for non-blocking validation of large catalogs
- **Real-time error display** with humanized field names
- **Stale validation tracking** - marks results as stale when objects are edited
- **Advisory disclaimer** - clear messaging that this is not the official Data.gov validator
- **Accessibility** - screen reader support, keyboard navigation, color-independent indicators
- **XSS protection** - HTML escaping for user data in error messages

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
const { validateCatalog, catalogSummary, validationProgress } = useValidation()

const handleValidateCatalog = async () => {
  await validateCatalog((progress) => {
    console.log(`Validation progress: ${progress}%`)
  })
}
```

## Components

- `ValidationStatusBadge` - Shows validation state (idle/validating/valid/invalid/stale)
- `ValidationSummary` - Displays error summary grouped by class
- `ValidationProgress` - Progress bar for catalog validation

## Architecture

```
validation/
├── types.ts              # TypeScript type definitions
├── validator.ts          # Ajv validator setup and validation functions
├── messages.ts           # Error message humanization
├── worker.ts             # Web Worker for off-thread validation
├── useValidationWorker.ts # React hook for worker communication
├── ValidationContext.tsx  # React Context for validation state
├── useValidation.ts      # Main validation hook
├── ValidationStatusBadge.tsx
├── ValidationSummary.tsx
├── ValidationProgress.tsx
└── validation.css        # Component styles
```

## Advisory Nature

This validation is **advisory only** and runs against a copied DCAT-US 3.0 schema. It is not the official Data.gov validator. The disclaimer is shown on all validation results to prevent confusion.

## Security

- All user data in error messages is HTML-escaped to prevent XSS attacks
- Validation runs client-side - no data is sent to external servers
- Schema is loaded from local files, not external URLs

## Performance

- Validation runs in a Web Worker to avoid blocking the main thread
- Progress reporting for large catalogs (100+ objects)
- Efficient state management using React Context
