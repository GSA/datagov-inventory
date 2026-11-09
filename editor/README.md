# Inventory Editor

## About

The **Inventory Editor** is a browser-only React/TypeScript single-page application for authoring DCAT-US 3.0 metadata catalogs. It is part of the Inventory v2 application (inventory.data.gov) and implements the local-first editing model described in [ADR 0002](../docs/decisions/0002-ui-rendering-architecture-for-inventory-v2.md).

Federal agency users load entire catalogs into browser storage, edit metadata locally, and sync changes back to the Inventory Flask backend. The editor supports offline editing and will enable anonymous editing (2.1 feature) without backend storage.

### Key Characteristics
- **Local-first**: Full catalog loads into browser (IndexedDB), survives 900-second session timeout
- **Browser-only**: Can operate without backend for anonymous editing
- **Security-first**: CSP without unsafe-inline, banned `dangerouslySetInnerHTML`, all dependencies pinned
- **USWDS**: Section 508 compliant UI components
- **TypeScript**: Strict type checking for reliability

## Architecture

- **Framework**: React 18 + TypeScript 5
- **Build System**: Vite 5 (fast dev server, optimized production builds)
- **UI Components**: USWDS 3 via `@trussworks/react-uswds`
- **Security**: CSP headers, ESLint security rules, locked dependencies
- **Storage**: Browser IndexedDB (to be implemented)
- **Backend API**: Flask APIFlask endpoints for validation, sync, export (to be implemented)

### Security Controls (NIST 800-53)

This application implements the following security controls per ADR 0002:

- **SI-15 Output Sanitization**: React escapes by default, `dangerouslySetInnerHTML` banned by ESLint (build fails if present)
- **SC-18 Mobile Code**: Content Security Policy with `connect-src 'none'` prevents catalog data exfiltration
- **SR-3 Supply Chain Risk Management**: All dependencies pinned in `package-lock.json`, audit in CI

## Local Development

### Prerequisites

- **Node.js 18+** and **npm 9+**
- (Optional) **make** for convenience commands

### Quick Start

```bash
# 1. Install dependencies
cd editor
npm install

# 2. Start development server
npm run dev

# App available at http://localhost:5173/
```

### Key npm Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server with hot reload at http://localhost:5173 |
| `npm run build` | Production build (runs typecheck + lint + vite build) |
| `npm run preview` | Preview production build at http://localhost:4173 |
| `npm run lint` | Run ESLint (fails on `dangerouslySetInnerHTML`) |
| `npm run typecheck` | Run TypeScript compiler (type-check only, no emit) |

### Development Workflow

1. **Make code changes** in `src/`
2. **Run type-check**: `npm run typecheck` (catches type errors)
3. **Run linter**: `npm run lint` (catches style and security issues)
4. **Test in browser**: Dev server auto-reloads on save
5. **Build for production**: `npm run build` (runs all checks + builds)

**Important**: The `build` script runs `typecheck` and `lint` before building. If either fails, the build fails. This enforces security controls (no `dangerouslySetInnerHTML` can reach production).

## Security Controls Verification

### Verify CSP Network Blocking

Start dev server and test that CSP prevents network connections:

```bash
npm run dev
```

Open browser DevTools console at `http://localhost:5173/` and run:
```javascript
// Should be blocked by CSP
fetch('https://www.google.com')
```

**Expected error**: `Refused to connect to 'https://www.google.com' because it violates the following Content Security Policy directive: "connect-src 'none'"`

This CSP directive prevents catalog metadata from being exfiltrated to external servers, which is critical for the browser-only editing model (SI-15, SC-18).

### Verify dangerouslySetInnerHTML Ban

Create a test file with banned code:

```typescript
// src/TestDanger.tsx
export const TestDanger = () => {
  return <div dangerouslySetInnerHTML={{ __html: '<p>test</p>' }} />
}
```

Run lint:
```bash
npm run lint
```

**Expected error**: ESLint error about banned `dangerouslySetInnerHTML` property

Try to build:
```bash
npm run build
```

**Expected**: Build fails because lint fails (enforces SI-15 control)

Delete the test file and verify build succeeds:
```bash
rm src/TestDanger.tsx
npm run build
```

## Project Structure

```
editor/
├── index.html          # HTML entry point with CSP meta tag
├── package.json        # Dependencies and npm scripts
├── package-lock.json   # Pinned dependency tree (committed)
├── tsconfig.json       # TypeScript config (strict mode)
├── tsconfig.node.json  # Node-specific TypeScript config
├── vite.config.ts      # Vite build config with CSP headers
├── .eslintrc.cjs       # ESLint rules (bans dangerouslySetInnerHTML)
├── .gitignore          # Git ignore patterns
├── README.md           # This file
└── src/
    ├── main.tsx        # React app entry point
    ├── App.tsx         # Root component with USWDS page frame
    └── vite-env.d.ts   # Vite type definitions
```

## Production Build

```bash
npm run build
```

Produces optimized static files in `editor/dist/`:
- `index.html` - Entry point
- `assets/*.js` - JavaScript bundles (vendor chunks separated)
- `assets/*.css` - Compiled styles
- Sourcemaps for debugging

Preview the production build:
```bash
npm run preview
```

## Integration with Flask Backend

The editor will be mounted in the Flask application at `/catalog/{id}/edit`. The Flask route serves the built `index.html`, and the editor makes API calls to:

- `POST /api/catalog/{id}/sync` - Sync local changes
- `POST /api/validate` - Validate catalog structure
- `GET /api/schema/{class}/form` - Get form model for DCAT class

(API integration not implemented in this initial build)

## Testing

Test framework setup (Jest/Vitest, Playwright, pa11y-ci, axe) is deferred to **issue #17**. This initial build establishes the foundation with security controls verified manually.

## Development Status

This is the **initial build chain and security foundation** (issue #16). Subsequent issues will add:

- **Issue #17**: Test tooling and CI workflow
- Later: Catalog tree UI, editing forms, IndexedDB integration, API client, validation

Current state: Minimal USWDS page frame with verified security controls.

## Related Resources

- [Inventory v2 Architecture](../docs/architecture.md)
- [ADR 0002: UI Rendering Architecture](../docs/decisions/0002-ui-rendering-architecture-for-inventory-v2.md)
- [inventory.data.gov wiki](https://github.com/GSA/data.gov/wiki/inventory.data.gov)
- [USWDS Design System](https://designsystem.digital.gov/)
- [@trussworks/react-uswds](https://github.com/trussworks/react-uswds)
