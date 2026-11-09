# Inventory Editor

Browser-only React/TypeScript application for authoring DCAT-US 3.0 metadata catalogs. Part of Inventory v2 (inventory.data.gov), implementing local-first editing with offline support.

## Quick Start

```bash
cd editor
npm install
npm run dev
```

App runs at http://localhost:5173

## Architecture

- **Framework**: React 18 + TypeScript 5
- **Build System**: Vite 5
- **UI**: USWDS 3 via `@trussworks/react-uswds`
- **Security**: CSP without unsafe-inline, banned `dangerouslySetInnerHTML`, pinned dependencies
- **Storage**: Browser IndexedDB (local-first editing)

## npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server at http://localhost:5173 |
| `npm run build` | Production build (runs typecheck + lint + vite build) |
| `npm run preview` | Preview production build at http://localhost:4173 |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |

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

## Documentation

- [Inventory v2 Architecture](../docs/architecture.md)
- [ADR 0002: UI Rendering Architecture](../docs/decisions/0002-ui-rendering-architecture-for-inventory-v2.md)
- [inventory.data.gov wiki](https://github.com/GSA/data.gov/wiki/inventory.data.gov)
