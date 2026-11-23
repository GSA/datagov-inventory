/**
 * Writes generated DCAT-US 3.0 catalogs of 300, 1,000, 3,000 and 6,000 datasets for responsiveness checks (#29).
 *
 *   npm run generate:catalogs [-- <directory>]    # default: <os temp dir>/inventory-catalogs
 */
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeCatalogs } from '../fixtures/syntheticCatalogs.ts'

const dir = process.argv[2] ?? join(tmpdir(), 'inventory-catalogs')
for (const { datasets, path, bytes } of writeCatalogs(dir)) {
  console.log(`${datasets.toLocaleString('en-US').padStart(5)} datasets  ${(bytes / 1e6).toFixed(1).padStart(5)} MB  ${path}`)
}
