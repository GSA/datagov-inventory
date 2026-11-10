# Inventory Editor

Browser-only React/TypeScript application for authoring DCAT-US 3.0 metadata catalogs. Part of Inventory v2 (inventory.data.gov), implementing local-first editing with offline support.

## Quick Start

```bash
git submodule update --init   # the pinned DCAT-US 3.0 schema, see schema/README.md
cd editor
npm install
npm run dev
```

App runs at http://localhost:5173

**Hot Module Replacement (HMR):** The dev server automatically watches for file changes and updates the browser instantly. Edit any file in `src/` and see changes live without manual refresh.

## Architecture

- **Framework**: React 18 + TypeScript 5
- **Build System**: Vite 5
- **UI**: USWDS 3 via `@trussworks/react-uswds`
- **Security**: CSP without unsafe-inline, banned `dangerouslySetInnerHTML`, pinned dependencies
- **Storage**: Browser IndexedDB (local-first editing)

## Catalog model

`src/catalog/decompose.ts` turns a DCAT-US 3.0 document into the object graph of
[ADR 0005](../docs/decisions/0005-object-graph-data-model-for-dcat-us-3.md): a `Map` of
objects (id, DCAT class, own scalar properties) whose class-valued properties are ordered
lists of child ids. Which properties hold classes, and so each object's class, comes from
the schema (`getClassProperties` in `src/schema`). Ids are the objects' JSON Pointers in
the source document (`#/dataset/0`). Input is bounded by `DEFAULT_LIMITS` (25 MB, 64
levels deep, 250,000 JSON objects), checked before parsing. `fixtures/decomposed/` holds
the expected output for each valid fixture catalog as plain JSON, for other implementations
(the Python one, E04-02) to test against. The module may import only
`src/schema` and is type-checked without DOM types (`src/catalog/tsconfig.json`), so it
can run in a worker.

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with HMR at http://localhost:5173 |
| `npm run build` | Production build (runs typecheck + lint + vite build) |
| `npm run preview` | Preview production build at http://localhost:4173 |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run unit tests with Vitest |
| `npm run test:ui` | Run unit tests with Vitest UI |
| `npm run test:coverage` | Run unit tests with coverage report |
| `npm run test:browser` | Run Playwright browser tests |
| `npm run test:browser:ui` | Run Playwright tests with UI |
| `npm run schema:update -- <commit>` | Move the pinned DCAT-US 3.0 schema to a GSA/dcat-us commit |
| `npm run schema:check` | Check the schema pin matches the submodule (runs in CI) |

## Testing

### Unit Tests

Unit tests verify React components and TypeScript logic in isolation using Vitest.

**Run unit tests:**
```bash
npm run test
```

**Run tests with UI:**
```bash
npm run test:ui
```

**Run tests with coverage:**
```bash
npm run test:coverage
```

**Guidelines:**
- Unit tests live next to source files: `src/Component.test.tsx`
- Test component rendering and user interactions
- Use `@testing-library/react` for component testing
- Mock external dependencies (future: API calls, IndexedDB)
- Keep tests fast - no real browser, no network calls

**Example unit test:**
```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MyComponent } from './MyComponent'

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected text')).toBeInTheDocument()
  })
})
```

### Browser Tests

Browser tests verify the application works in a real browser using Playwright.

**Run browser tests:**
```bash
npm run test:browser
```

**Run browser tests with UI:**
```bash
npm run test:browser:ui
```

**Guidelines:**
- Browser tests live in `e2e/` directory
- Test user workflows and page interactions
- Include accessibility scanning with @axe-core/playwright
- Tests run against production build (`npm run build` + `npm run preview`)
- Use page object pattern for complex workflows

**Example browser test:**
```typescript
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('page is accessible', async ({ page }) => {
  await page.goto('/')

  const accessibilityScanResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()

  expect(accessibilityScanResults.violations).toEqual([])
})
```

### Continuous Integration

GitHub Actions runs all checks on every push:
- **lint**: ESLint checks
- **typecheck**: TypeScript compilation
- **test**: Vitest unit tests and the DCAT-US schema pin check (`schema:check`)
- **build**: Production build
- **test-browser**: Playwright browser tests with accessibility
- **audit**: npm security audit

Failed browser tests upload artifacts:
- `playwright-report`: HTML test report
- `playwright-traces`: Execution traces for debugging

**Branch protection:** The "Commit" workflow must pass before merging to `main`.

## Development Workflow

1. **Start dev server**: `npm run dev`
2. **Open browser**: http://localhost:5173
3. **Edit files**: Make changes to any file in `src/`
4. **See changes instantly**: Browser updates automatically (HMR)
5. **Check for errors**: Terminal shows TypeScript/lint errors in real-time

**HMR preserves state:** React component state is preserved during hot updates, so you don't lose form inputs or UI state when editing.

## Security Controls

The `build` script runs `typecheck` and `lint` before building to enforce security controls:

- **SI-15 Output Sanitization**: `dangerouslySetInnerHTML` banned by ESLint (build fails if present)
- **SC-18 Mobile Code**: CSP with `connect-src 'none'` prevents data exfiltration
- **SR-3 Supply Chain**: All dependencies pinned in `package-lock.json`

These controls have been verified during development. Build successfully blocks dangerous code and CSP prevents network requests.

### Verify Security Controls

Test CSP blocks network:
```bash
npm run dev
# In browser console: fetch('https://www.google.com')
# Expected: CSP error blocking the request
```

Test dangerouslySetInnerHTML ban:
```typescript
// Create src/Test.tsx with dangerouslySetInnerHTML
npm run build
// Expected: Build fails with ESLint error
```

## Deployment

The [Deploy editor](../.github/workflows/deploy-editor.yml) workflow builds the app, copies `dist/` into `cf/public/` and pushes it to the cloud.gov `development` space as a static site served by nginx (`manifest.yml`, `cf/`). It runs on every push to `main` that touches `editor/` or the workflow, or by hand from the Actions tab. To roll back, revert the bad commit on `main`; the revert redeploys.

The security headers, including the CSP, are set in [`cf/security-headers.conf`](cf/security-headers.conf). Paths outside `/assets/` that don't match a file serve `index.html`, so deep links work; missing files under `/assets/` return 404.

URL: https://inventory-editor-dev-datagov.app.cloud.gov

The workflow needs `CF_SERVICE_USER` and `CF_SERVICE_AUTH` secrets on the `development` GitHub environment: the credentials of a `space-deployer` [cloud.gov service account](https://cloud.gov/docs/services/cloud-gov-service-account/) in `gsa-datagov`/`development`. Limit that environment's deployment branches to `main`.

## Documentation

- [Inventory v2 Architecture](../docs/architecture.md)
- [ADR 0002: UI Rendering Architecture](../docs/decisions/0002-ui-rendering-architecture-for-inventory-v2.md)
- [inventory.data.gov wiki](https://github.com/GSA/data.gov/wiki/inventory.data.gov)
