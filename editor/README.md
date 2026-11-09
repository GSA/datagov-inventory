# Inventory Editor

Browser-only React/TypeScript application for authoring DCAT-US 3.0 metadata catalogs. Part of Inventory v2 (inventory.data.gov), implementing local-first editing with offline support.

## Quick Start

```bash
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

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with HMR at http://localhost:5173 |
| `npm run build` | Production build (runs typecheck + lint + vite build) |
| `npm run preview` | Preview production build at http://localhost:4173 |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

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

The [Deploy editor](../.github/workflows/deploy-editor.yml) workflow builds the app, copies `dist/` into `cf/public/` and pushes it to the cloud.gov `development` space as a static site served by nginx (`manifest.yml`, `cf/`). It runs on every push to `main` that touches `editor/`, or by hand from the Actions tab. To roll back, revert the bad commit on `main`; the revert redeploys.

The security headers, including the CSP, are set in [`cf/security-headers.conf`](cf/security-headers.conf). Paths outside `/assets/` that don't match a file serve `index.html`, so deep links work; missing files under `/assets/` return 404.

URL: https://inventory-editor-dev-datagov.app.cloud.gov

The workflow needs `CF_SERVICE_USER` and `CF_SERVICE_AUTH` secrets on the `development` GitHub environment: the credentials of a `space-deployer` [cloud.gov service account](https://cloud.gov/docs/services/cloud-gov-service-account/) in `gsa-datagov`/`development`. Limit that environment's deployment branches to `main`.

## Documentation

- [Inventory v2 Architecture](../docs/architecture.md)
- [ADR 0002: UI Rendering Architecture](../docs/decisions/0002-ui-rendering-architecture-for-inventory-v2.md)
- [inventory.data.gov wiki](https://github.com/GSA/data.gov/wiki/inventory.data.gov)
